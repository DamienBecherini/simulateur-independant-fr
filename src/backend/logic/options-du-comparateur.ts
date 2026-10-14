// src/backend/logic/options-du-comparateur.ts
// Réglages du comparateur proposés par défaut, et ceux de l'utilisateur complétés par ces valeurs (voir l'ADR 009).
// Ils vivent avec le moteur pour servir à la fois l'interface (src/lib/comparateur-options.ts) et les outils des
// clients d'IA (src/backend/logic/outils, voir l'ADR 010) : les deux comparent avec les mêmes réglages.

import type { ComparaisonOptions, DonneesDeLAnnee, FinancialFlow, FraisFonctionnement, ReglagesComparateur, RepartitionBenefice, SimulationAnnuelle } from "../../types.js"

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

/**
 * Message du comparateur quand l'activité comparée n'a aucun chiffre d'affaires : aucun statut n'est désigné. Il vit
 * ici, module léger, pour que l'interface le reconnaisse sans importer le comparateur.
 */
export const SANS_CHIFFRE_D_AFFAIRES = "Saisissez un chiffre d'affaires pour comparer les statuts."

/**
 * Note du comparateur quand l'activité comparée a un chiffre d'affaires mais aucune charge dans la grille : ses frais
 * réels manquent, et chaque statut aux frais de gestion estimés plus bas que le statut actuel en garde toute l'économie.
 */
export const AUCUNE_CHARGE = "Aucune charge saisie pour cette activité : pensez à la CFE, à l'assurance, à la banque. Sans elles, un statut aux frais de gestion estimés plus bas que le vôtre paraît plus avantageux de toute l'économie de frais estimée."

/**
 * Calcul à l'envers (chiffre-d-affaires-pour-un-net.ts) : chiffre d'affaires le plus haut essayé, au-delà duquel le net
 * visé est dit hors de portée ; une borne de la recherche, pas une règle fiscale. Ici, comme le message suivant, pour
 * que l'interface les lise sans importer le comparateur.
 */
export const CHIFFRE_D_AFFAIRES_MAXIMAL = 10_000_000

/** Calcul à l'envers sans chiffre d'affaires saisi : comment il le répartit. */
export const CHIFFRE_D_AFFAIRES_REPARTI = "Aucun chiffre d'affaires saisi pour cette activité cette année : le calcul le répartit également sur les 12 mois, en prestations de services (libérales, en BNC, pour une micro-entreprise)."

/** « Sur toutes les années » : part du bénéfice distribuable gardée chaque année proposée par défaut (voir l'ADR 014). */
export const PART_MISE_EN_RESERVE_PAR_DEFAUT = 0.5

/**
 * Au meilleur net, la case « avec 4 trimestres de retraite » est cochée d'office : une rémunération qui ne valide aucun
 * trimestre est rarement un bon choix sans le savoir. Seul un choix de l'utilisateur est enregistré (ADR 009) : une
 * case décochée le reste, et les réglages enregistrés avant ce défaut, sans la case, le reçoivent.
 */
export function avecLaRetraiteParDefaut(repartition: RepartitionBenefice): RepartitionBenefice {
  if (repartition.mode !== "meilleurNet" || repartition.avecRetraite !== undefined) return repartition
  return { ...repartition, avecRetraite: true }
}

/** Total de l'année d'un type de flux de l'activité dans la grille. */
function totalDeLAnnee(donnees: DonneesDeLAnnee, activityId: string, type: FinancialFlow["type"]): number {
  return donnees.monthlyData.flatMap(mois => mois.flows).filter(flux => flux.entityId === activityId && flux.type === type).reduce((somme, flux) => somme + flux.amount, 0)
}

/**
 * En mode « Selon la grille », chaque colonne de société reprend la rémunération saisie dans la grille, et ses dividendes
 * (gardés à la conversion) : une rémunération réglée dans un autre mode n'y compte pas. Les autres modes sont inchangés.
 */
export function avecLaRemunerationDeLaGrille(options: ComparaisonOptions, donnees: DonneesDeLAnnee): ComparaisonOptions {
  if (options.repartition.mode !== "grille") return options
  return { ...options, remunerationNette: totalDeLAnnee(donnees, options.activityId, "director_remuneration") }
}

/**
 * Réglages proposés à l'ouverture du comparateur pour une activité : avec des dividendes saisis, on reprend la
 * rémunération et les dividendes de la grille ; sinon, chaque statut de société prend sa rémunération au meilleur net
 * parmi celles qui valident 4 trimestres de retraite, tout le reste en dividendes, pour ne pas le pénaliser avec un
 * bénéfice qui resterait bloqué. La rémunération saisie reste proposée pour les autres modes.
 */
export function defaultComparisonOptions(session: DonneesDeLAnnee, activityId: string): ComparaisonOptions {
  return {
    activityId,
    remunerationNette: totalDeLAnnee(session, activityId, "director_remuneration"),
    repartition: avecLaRetraiteParDefaut({ mode: totalDeLAnnee(session, activityId, "dividends_payment") === 0 ? "meilleurNet" : "grille", partDistribuee: 1 }),
    partBncPrestations: 1,
    fraisFonctionnement: defaultFraisFonctionnement()
  }
}

/**
 * Réglages du comparateur pour une activité et l'année affichée : ceux que l'utilisateur a choisis, et pour les autres
 * les valeurs par défaut tirées de la grille de l'année. La rémunération saisie vaut pour son année seulement ;
 * le mode de partage, la part BNC et les frais de fonctionnement valent pour toutes les années.
 */
export function optionsDuComparateur(vue: SimulationAnnuelle, activityId: string, reglages: ReglagesComparateur | undefined): ComparaisonOptions {
  const defaut = defaultComparisonOptions(vue, activityId)
  if (!reglages) return defaut
  const options: ComparaisonOptions = {
    ...defaut,
    remunerationNette: reglages.remunerationParAnnee?.[String(vue.annee)] ?? defaut.remunerationNette,
    repartition: avecLaRetraiteParDefaut(reglages.repartition ?? defaut.repartition),
    partBncPrestations: reglages.partBncPrestations ?? defaut.partBncPrestations,
    fraisFonctionnement: reglages.fraisFonctionnement ?? defaut.fraisFonctionnement
  }
  return avecLaRemunerationDeLaGrille(options, vue)
}
