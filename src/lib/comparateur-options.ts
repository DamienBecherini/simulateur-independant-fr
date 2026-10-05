// src/lib/comparateur-options.ts

import { STATUTS_FRAIS } from "@/types"
import type { ComparaisonOptions, Comparateur, Company, FraisFonctionnement, MicroEntreprise, ModeRepartition, OptimisationRemuneration, PosteFrais, DonneesDeLAnnee, ReglagesComparateur, RepartitionBenefice, SimulationAnnuelle, StatutFrais } from "@/types"

/** Libellés des postes de frais, dans l'ordre d'affichage. */
export const posteFraisLabels: Record<PosteFrais, string> = {
  expertComptable: "Expert-comptable",
  banque: "Compte bancaire professionnel",
  logiciel: "Logiciel de facturation et de comptabilité",
  assurance: "Assurance responsabilité civile professionnelle",
  cfe: "Cotisation foncière des entreprises (CFE)"
}

export const statutsFrais: StatutFrais[] = [...STATUTS_FRAIS]

/** Modes de partage du bénéfice en SASU et EURL, dans l'ordre d'affichage, avec leur libellé. */
export const libellesRepartition: Record<ModeRepartition, string> = {
  meilleurNet: "Au meilleur net",
  dividendes: "Rémunération saisie, le reste en dividendes",
  remuneration: "Tout en rémunération",
  personnalisee: "Répartition personnalisée",
  grille: "Dividendes saisis dans la grille"
}

/**
 * Reporte une rémunération dans le comparateur, tout le bénéfice restant étant distribué : en répartition
 * personnalisée, on y reste, avec 100 % distribué ; sinon, on passe à « le reste en dividendes ».
 */
export function avecRemuneration(options: ComparaisonOptions, remunerationNette: number): ComparaisonOptions {
  const mode = options.repartition.mode === "personnalisee" ? "personnalisee" : "dividendes"
  return { ...options, remunerationNette, repartition: { mode, partDistribuee: 1 } }
}

/**
 * Reporte dans le comparateur une rémunération de l'arbitrage. Au meilleur net, ses deux meilleurs points y restent :
 * on coche ou décoche seulement « avec 4 trimestres de retraite » ; toute autre rémunération est reportée telle quelle.
 */
export function appliquerRemuneration(options: ComparaisonOptions, remunerationNette: number, optimisation: OptimisationRemuneration | null): ComparaisonOptions {
  const { meilleur, meilleurAvecRetraite } = optimisation ?? {}
  const auMeilleurNet = options.repartition.mode === "meilleurNet"
  if (auMeilleurNet && remunerationNette === meilleur?.remunerationNette) return { ...options, repartition: { ...options.repartition, avecRetraite: false } }
  if (auMeilleurNet && remunerationNette === meilleurAvecRetraite?.remunerationNette) return { ...options, repartition: { ...options.repartition, avecRetraite: true } }
  return avecRemuneration(options, remunerationNette)
}

/**
 * Frais de fonctionnement annuels proposés par défaut : des ordres de grandeur, à ajuster à sa situation.
 * Le recours à un expert-comptable n'est pas obligatoire, mais quasi systématique en société (bilan, liasse fiscale).
 * La CFE varie selon la commune, et n'est pas due l'année de création.
 */
export function defaultFraisFonctionnement(): FraisFonctionnement {
  return {
    SASU: { expertComptable: 2000, banque: 200, logiciel: 150, assurance: 250, cfe: 300 },
    EURL: { expertComptable: 2000, banque: 200, logiciel: 150, assurance: 250, cfe: 300 },
    EI: { expertComptable: 1200, banque: 150, logiciel: 150, assurance: 250, cfe: 300 },
    micro: { expertComptable: 0, banque: 100, logiciel: 100, assurance: 350, cfe: 300 }
  }
}

/** Activités qu'on peut faire changer de statut dans le comparateur. */
export function comparableActivities(session: DonneesDeLAnnee): (Company | MicroEntreprise)[] {
  return session.entities.filter((e): e is Company | MicroEntreprise => e.type !== "person")
}

/**
 * Au meilleur net, la case « avec 4 trimestres de retraite » est cochée d'office : une rémunération qui ne valide aucun
 * trimestre est rarement un bon choix sans le savoir. Seul un choix de l'utilisateur est enregistré (ADR 009) : une
 * case décochée le reste, et les réglages enregistrés avant ce défaut, sans la case, le reçoivent.
 */
export function avecLaRetraiteParDefaut(repartition: RepartitionBenefice): RepartitionBenefice {
  if (repartition.mode !== "meilleurNet" || repartition.avecRetraite !== undefined) return repartition
  return { ...repartition, avecRetraite: true }
}

/**
 * Le partage du bénéfice dans un autre mode. La case « 4 trimestres » ne suit que si elle a été décochée : cochée,
 * c'est la valeur par défaut, qui n'a pas à être enregistrée avec un mode où elle n'a pas de sens.
 */
export function avecLeMode(repartition: RepartitionBenefice, mode: ModeRepartition): RepartitionBenefice {
  const { avecRetraite, ...reste } = repartition
  return { ...reste, mode, ...(avecRetraite === false ? { avecRetraite } : {}) }
}

/**
 * Réglages proposés à l'ouverture du comparateur pour une activité : avec des dividendes saisis, on reprend la
 * rémunération et les dividendes de la grille ; sinon, chaque statut de société prend sa rémunération au meilleur net
 * parmi celles qui valident 4 trimestres de retraite, tout le reste en dividendes, pour ne pas le pénaliser avec un
 * bénéfice qui resterait bloqué. La rémunération saisie reste proposée pour les autres modes.
 */
export function defaultComparisonOptions(session: DonneesDeLAnnee, activityId: string): ComparaisonOptions {
  const flows = session.monthlyData.flatMap(month => month.flows).filter(flow => flow.entityId === activityId)
  const annualTotal = (type: string) => flows.filter(flow => flow.type === type).reduce((sum, flow) => sum + flow.amount, 0)

  return {
    activityId,
    remunerationNette: annualTotal("director_remuneration"),
    repartition: avecLaRetraiteParDefaut({ mode: annualTotal("dividends_payment") === 0 ? "meilleurNet" : "grille", partDistribuee: 1 }),
    partBncPrestations: 1,
    fraisFonctionnement: defaultFraisFonctionnement()
  }
}

/**
 * Activité comparée : celle que l'utilisateur a choisie, ou la première si elle n'est pas (ou plus) dans la session.
 * `undefined` sans activité.
 */
export function activiteComparee(session: DonneesDeLAnnee, comparateur: Comparateur | undefined): Company | MicroEntreprise | undefined {
  const activites = comparableActivities(session)
  return activites.find(activite => activite.id === comparateur?.activiteComparee) ?? activites[0]
}

/**
 * Réglages du comparateur pour une activité et l'année affichée : ceux que l'utilisateur a choisis, et pour les autres
 * les valeurs par défaut tirées de la grille de l'année. La rémunération saisie vaut pour son année seulement ;
 * le mode de partage, la part BNC et les frais de fonctionnement valent pour toutes les années.
 */
export function optionsDuComparateur(vue: SimulationAnnuelle, activityId: string, reglages: ReglagesComparateur | undefined): ComparaisonOptions {
  const defaut = defaultComparisonOptions(vue, activityId)
  if (!reglages) return defaut
  return {
    ...defaut,
    remunerationNette: reglages.remunerationParAnnee?.[String(vue.annee)] ?? defaut.remunerationNette,
    repartition: avecLaRetraiteParDefaut(reglages.repartition ?? defaut.repartition),
    partBncPrestations: reglages.partBncPrestations ?? defaut.partBncPrestations,
    fraisFonctionnement: reglages.fraisFonctionnement ?? defaut.fraisFonctionnement
  }
}

/** Réglages du comparateur de l'activité comparée dans une session, pour l'année affichée ; `null` sans activité. */
export function reglagesDeLActiviteComparee(vue: SimulationAnnuelle, comparateur: Comparateur | undefined): { activite: Company | MicroEntreprise; options: ComparaisonOptions } | null {
  const activite = activiteComparee(vue, comparateur)
  if (!activite) return null
  return { activite, options: optionsDuComparateur(vue, activite.id, comparateur?.reglagesParActivite[activite.id]) }
}

const avecRetraite = (repartition: RepartitionBenefice) => avecLaRetraiteParDefaut(repartition).avecRetraite ?? false
const memeRepartition = (a: RepartitionBenefice, b: RepartitionBenefice) => a.mode === b.mode && a.partDistribuee === b.partDistribuee && avecRetraite(a) === avecRetraite(b)
const memesFrais = (a: FraisFonctionnement | undefined, b: FraisFonctionnement | undefined) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Retient ce que l'utilisateur vient de changer dans le comparateur, en passant des réglages affichés (`avant`) aux
 * nouveaux (`apres`) : seuls les champs modifiés rejoignent ses réglages, les autres gardent leur valeur choisie,
 * ou restent absents pour suivre la grille. Une rémunération modifiée est retenue pour l'année affichée.
 */
export function retenirLesReglages(reglages: ReglagesComparateur | undefined, avant: ComparaisonOptions, apres: ComparaisonOptions, annee: number): ReglagesComparateur {
  const retenus: ReglagesComparateur = { ...reglages }
  if (!memeRepartition(avant.repartition, apres.repartition)) retenus.repartition = apres.repartition
  if (avant.remunerationNette !== apres.remunerationNette) retenus.remunerationParAnnee = { ...reglages?.remunerationParAnnee, [String(annee)]: apres.remunerationNette }
  if (avant.partBncPrestations !== apres.partBncPrestations) retenus.partBncPrestations = apres.partBncPrestations
  if (!memesFrais(avant.fraisFonctionnement, apres.fraisFonctionnement)) retenus.fraisFonctionnement = apres.fraisFonctionnement
  return retenus
}

/** Le comparateur avec de nouveaux réglages pour une activité, qui devient l'activité comparée. */
export function avecReglagesDeLActivite(comparateur: Comparateur | undefined, activityId: string, reglages: ReglagesComparateur): Comparateur {
  return { ...comparateur, activiteComparee: activityId, reglagesParActivite: { ...comparateur?.reglagesParActivite, [activityId]: reglages } }
}

/** Le comparateur avec une autre activité comparée ; les réglages de chaque activité sont conservés. */
export function avecActiviteComparee(comparateur: Comparateur | undefined, activityId: string): Comparateur {
  return { reglagesParActivite: {}, ...comparateur, activiteComparee: activityId }
}
