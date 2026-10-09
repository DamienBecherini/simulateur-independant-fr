// src/backend/logic/outils/lecture.ts
// Outils qui décrivent la session telle qu'elle est : ses acteurs, ses relations, ses flux, et les règles d'une année.
// Ils ne calculent rien : les résultats viennent des outils de resultats.ts, qui appellent le moteur.

import { z } from "zod"
import type { Entity, FinancialFlow, SessionState } from "../../../types.js"
import { ANNEE_COURANTE, PREMIERE_ANNEE_DES_REGLES, reglesDeLAnnee, type ReglesFiscales } from "../regles.js"
import { anneeDeLaSession, empreinteDeLaSession, ErreurOutil, genreDe, GENRES_D_ACTEUR, nomDe, phraseDeLaRelation, trouverActeur, TYPES_DE_FLUX } from "./commun.js"
import { AnneeSchema, IdentifiantSchema, LIMITES, ListeDeMoisSchema } from "./limites.js"
import { definirOutil, resultatSeul } from "./outil.js"

/** Montant saisi, arrondi au centime : les flux sont des données de l'utilisateur, pas des résultats de calcul. */
const auCentime = (montant: number) => Math.round(montant * 100) / 100

// ===================================================================================
// == decrire_simulation
// ===================================================================================

const ValeurDeReglage = z.union([z.string(), z.number(), z.boolean(), z.null()])

/** Réglages d'un acteur qui comptent pour les calculs, sans son apparence (avatar). */
function reglagesDeLActeur(acteur: Entity, detaille: boolean): Record<string, z.infer<typeof ValeurDeReglage>> {
  if (acteur.type === "person") {
    const frais = acteur.fraisReels
    const resume = { partsFiscales: acteur.fiscalParts, fraisReels: frais ? `${frais.trajets.length} trajet(s), ${auCentime(frais.autresFrais)} € d'autres frais` : null }
    return detaille && frais ? { ...resume, trajets: JSON.stringify(frais.trajets) } : resume
  }
  // Profession libérale réglementée et part conventionnée : seulement quand elles sont saisies (voir l'ADR 015).
  const profession = { ...(acteur.profession === undefined ? {} : { profession: acteur.profession }), ...(acteur.partConventionnee === undefined ? {} : { partConventionnee: acteur.partConventionnee }) }
  const commun = { dateDeCreation: acteur.dateDeCreation ?? null, deplacementsKmParAn: acteur.deplacementsProfessionnels?.kmParAn ?? null, ...profession }
  if (acteur.type === "company") return { capitalSocial: acteur.capitalSocial, ...(acteur.reservesInitiales === undefined ? {} : { reservesInitiales: acteur.reservesInitiales }), ...commun }
  return { beneficieACRE: acteur.beneficieACRE, opteVFL: acteur.opteVFL, rfrN2: acteur.rfrN2 ?? null, horsPlafondAnneePrecedente: acteur.horsPlafondAnneePrecedente ?? false, ...commun }
}

/** Nombre de séries (même acteur, type et libellé) d'une grille. */
const nombreDeSeries = (flux: FinancialFlow[]) => new Set(flux.map(f => `${f.entityId}|${f.type}|${f.label}`)).size

export const decrireSimulation = definirOutil({
  nom: "decrire_simulation",
  titre: "Décrire la simulation",
  description: [
    "Décrit la simulation ouverte : son nom, ses années, ses acteurs (personnes et activités, avec leurs identifiants et leurs réglages utiles au calcul), les relations entre eux, le nombre de flux par année et l'activité ouverte dans le comparateur.",
    "À appeler en premier : les autres outils désignent les acteurs par leur identifiant (champ « id »).",
    "Ne contient aucun montant calculé : pour les résultats, utilisez simuler ; pour les flux saisis, lister_flux.",
    "« empreinte » identifie l'état de la session : une proposition construite sur une autre empreinte sera refusée."
  ].join(" "),
  lecture: true,
  parametres: z.strictObject({
    detaille: z.boolean().default(false).describe("Vrai pour ajouter le détail des trajets domicile-travail des personnes. Faux par défaut : le résumé suffit presque toujours.")
  }),
  resultat: z.object({
    nom: z.string(),
    empreinte: z.string(),
    annees: z.array(z.number()),
    reglesConnues: z.object({ premiere: z.number(), derniere: z.number() }),
    acteurs: z.array(z.object({ id: z.string(), nom: z.string(), genre: z.enum(GENRES_D_ACTEUR), verrouille: z.boolean(), reglages: z.record(z.string(), ValeurDeReglage) })),
    relations: z.array(z.object({ id: z.string(), deId: z.string(), versId: z.string(), type: z.string(), phrase: z.string() })),
    flux: z.array(z.object({ annee: z.number(), nombreDeFlux: z.number(), nombreDeSeries: z.number() })),
    comparateur: z.object({ activiteComparee: z.string().nullable(), activitesReglees: z.array(z.string()) })
  }),
  executer: (session, { detaille }) =>
    resultatSeul({
      nom: session.name,
      empreinte: empreinteDeLaSession(session),
      annees: session.annees.map(a => a.annee),
      reglesConnues: { premiere: PREMIERE_ANNEE_DES_REGLES, derniere: ANNEE_COURANTE },
      acteurs: session.entities.map(acteur => ({ id: acteur.id, nom: acteur.name, genre: genreDe(acteur), verrouille: acteur.locked, reglages: reglagesDeLActeur(acteur, detaille) })),
      relations: session.relationships.map(r => ({ id: r.id, deId: r.fromId, versId: r.toId, type: r.type, phrase: phraseDeLaRelation(session, r) })),
      flux: session.annees.map(({ annee, monthlyData }) => {
        const flux = monthlyData.flatMap(m => m.flows)
        return { annee, nombreDeFlux: flux.length, nombreDeSeries: nombreDeSeries(flux) }
      }),
      comparateur: { activiteComparee: session.comparateur?.activiteComparee ?? null, activitesReglees: Object.keys(session.comparateur?.reglagesParActivite ?? {}) }
    })
})

// ===================================================================================
// == lister_flux
// ===================================================================================

interface LigneDeFlux {
  annee: number
  mois: number
  flux: FinancialFlow
}

const LigneSerieSchema = z.object({ annee: z.number(), acteurId: z.string(), acteur: z.string(), typeFlux: z.string(), libelle: z.string(), mois: z.array(z.number()), montants: z.array(z.number()), total: z.number() })
const LigneMoisSchema = z.object({ annee: z.number(), mois: z.number(), id: z.string(), acteurId: z.string(), acteur: z.string(), typeFlux: z.string(), libelle: z.string(), montant: z.number(), montantBrut: z.number().optional() })

const ParametresListe = z.strictObject({
  annee: AnneeSchema.optional().describe("Année à lister ; toutes les années si absente."),
  acteurId: IdentifiantSchema.optional().describe("Identifiant d'un acteur, pour ne lister que ses flux."),
  typeFlux: z.enum(TYPES_DE_FLUX).optional().describe("Type de flux à lister."),
  mois: ListeDeMoisSchema.optional(),
  regroupement: z.enum(["series", "mois"]).default("series").describe("« series » (par défaut) : une ligne par série (même acteur, même type, même libellé dans une année), avec ses mois et ses montants. « mois » : une ligne par flux, avec son identifiant.")
})

function lignesFiltrees(session: SessionState, filtres: z.output<typeof ParametresListe>): LigneDeFlux[] {
  if (filtres.annee !== undefined) anneeDeLaSession(session, filtres.annee)
  if (filtres.acteurId !== undefined) trouverActeur(session, filtres.acteurId)
  const mois = filtres.mois ? new Set(filtres.mois) : null
  return session.annees
    .filter(a => filtres.annee === undefined || a.annee === filtres.annee)
    .flatMap(({ annee, monthlyData }) => monthlyData.flatMap(m => m.flows.map(flux => ({ annee, mois: m.month + 1, flux }))))
    .filter(({ mois: m, flux }) => (!mois || mois.has(m)) && (filtres.acteurId === undefined || flux.entityId === filtres.acteurId) && (filtres.typeFlux === undefined || flux.type === filtres.typeFlux))
}

function enSeries(session: SessionState, lignes: LigneDeFlux[]): z.infer<typeof LigneSerieSchema>[] {
  const series = new Map<string, z.infer<typeof LigneSerieSchema>>()
  for (const { annee, mois, flux } of lignes) {
    const cle = JSON.stringify([annee, flux.entityId, flux.type, flux.label])
    const serie = series.get(cle) ?? { annee, acteurId: flux.entityId, acteur: nomDe(session, flux.entityId), typeFlux: flux.type, libelle: flux.label, mois: [], montants: [], total: 0 }
    serie.mois.push(mois)
    serie.montants.push(auCentime(flux.amount))
    serie.total = auCentime(serie.total + flux.amount)
    series.set(cle, serie)
  }
  return [...series.values()]
}

const enLignesDuMois = (session: SessionState, lignes: LigneDeFlux[]): z.infer<typeof LigneMoisSchema>[] =>
  lignes.map(({ annee, mois, flux }) => ({ annee, mois, id: flux.id, acteurId: flux.entityId, acteur: nomDe(session, flux.entityId), typeFlux: flux.type, libelle: flux.label, montant: auCentime(flux.amount), ...(flux.grossAmount === undefined ? {} : { montantBrut: auCentime(flux.grossAmount) }) }))

export const listerFlux = definirOutil({
  nom: "lister_flux",
  titre: "Lister les flux saisis",
  description: [
    "Liste les flux saisis dans la grille mensuelle (chiffre d'affaires, charges, salaires, rémunérations, dividendes…), filtrés par année, acteur, type et mois.",
    "Montants mensuels en euros, tels que saisis (hors taxe pour le chiffre d'affaires et les charges, net pour les salaires et les rémunérations). Mois de 1 (janvier) à 12 (décembre).",
    "Par défaut, regroupe les flux en séries (même acteur, même type, même libellé dans une année) : c'est ainsi que proposer_modification et proposer_suppression désignent un flux.",
    `Au plus ${LIMITES.lignesListees} lignes : « tronque » signale une liste coupée, à resserrer avec les filtres.`
  ].join(" "),
  lecture: true,
  parametres: ParametresListe,
  resultat: z.object({ nombreDeLignes: z.number(), tronque: z.boolean(), lignes: z.array(z.union([LigneSerieSchema, LigneMoisSchema])) }),
  executer: (session, filtres) => {
    const lignes = lignesFiltrees(session, filtres)
    const toutes = filtres.regroupement === "series" ? enSeries(session, lignes) : enLignesDuMois(session, lignes)
    return resultatSeul({ nombreDeLignes: toutes.length, tronque: toutes.length > LIMITES.lignesListees, lignes: toutes.slice(0, LIMITES.lignesListees) })
  }
})

// ===================================================================================
// == regles_de_l_annee
// ===================================================================================

/** La source officielle d'une partie des règles, quand le fichier des règles la donne. */
function source(partie: unknown): string | null {
  const valeur = (partie as { source?: unknown } | undefined)?.source
  return typeof valeur === "string" ? valeur : null
}

/** Les valeurs d'une partie des règles, sans leurs textes d'explication (description, source). */
function valeurs(partie: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(partie).filter(([cle]) => cle !== "source" && !cle.toLowerCase().includes("description")))
}

const RegleSchema = z.object({ sujet: z.string(), valeurs: z.record(z.string(), z.unknown()), source: z.string().nullable() })

/** Les seuils et taux qui expliquent le plus souvent un résultat, chacun avec sa source. */
function reglesCles(r: ReglesFiscales): z.infer<typeof RegleSchema>[] {
  const micro = r.microEntreprise
  return [
    { sujet: "Impôt sur le revenu : barème par part (revenu imposable par part, taux marginal)", valeurs: { tranches: r.IR.bareme.map(t => ({ jusqua: t.trancheJusqua, taux: t.taux })) }, source: source(r.IR) },
    { sujet: "Impôt sur le revenu : déduction forfaitaire de 10 % sur les salaires", valeurs: valeurs(r.IR.abattementSalaires), source: source(r.IR.abattementSalaires) },
    { sujet: "Impôt sur le revenu : parts par enfant et plafonnement du quotient familial", valeurs: { ...valeurs(r.IR.partsParEnfant), avantageMaxParDemiPart: r.IR.plafonnementQuotientFamilial.avantageMaxParDemiPart }, source: source(r.IR.partsParEnfant) },
    { sujet: "Plafond annuel de la sécurité sociale (PASS)", valeurs: { montant: r.regimeGeneral.plafondSecuriteSociale }, source: source(r.regimeGeneral) },
    { sujet: "Retraite : revenu soumis à cotisations qui valide un trimestre", valeurs: { montant: r.protectionSociale.revenuParTrimestre }, source: null },
    { sujet: "Impôt sur les sociétés", valeurs: { tauxReduit: r.IS.tauxReduit, plafondTauxReduit: r.IS.plafondTauxReduit, tauxNormal: r.IS.tauxNormal }, source: source(r.IS) },
    { sujet: "Impôt sur les sociétés : déficit d'une année imputé sur les bénéfices suivants (au plus le plafond fixe, plus cette part du bénéfice au-delà)", valeurs: valeurs(r.IS.reportEnAvantDesDeficits), source: source(r.IS.reportEnAvantDesDeficits) },
    { sujet: "Réserve légale des sociétés à l'IS : part du bénéfice mise en réserve jusqu'à cette part du capital", valeurs: valeurs(r.reserveLegale), source: source(r.reserveLegale) },
    { sujet: "Dividendes : prélèvement forfaitaire unique ou barème", valeurs: valeurs(r.dividendes), source: source(r.dividendes) },
    { sujet: "EURL : dividendes soumis à cotisations au-delà de cette part du capital", valeurs: valeurs(r.EURL), source: source(r.EURL) },
    { sujet: "Micro-entreprise : plafonds de chiffre d'affaires", valeurs: valeurs(micro.plafonds), source: source(micro.plafonds) },
    { sujet: "Micro-entreprise : taux de cotisations sur le chiffre d'affaires", valeurs: valeurs(micro.cotisations), source: source(micro.cotisations) },
    { sujet: "Micro-entreprise : contribution à la formation professionnelle sur le chiffre d'affaires, en plus des cotisations", valeurs: valeurs(micro.formationProfessionnelle), source: source(micro.formationProfessionnelle) },
    { sujet: "Micro-entreprise : abattement forfaitaire avant impôt", valeurs: valeurs(micro.abattement), source: source(micro.abattement) },
    { sujet: "Micro-entreprise : versement libératoire (taux sur le chiffre d'affaires, plafond de revenu fiscal de référence par part)", valeurs: { plafondRfrParPart: micro.versementLiberatoire.plafondRfrParPart, ...valeurs(micro.versementLiberatoire.taux) }, source: source(micro.versementLiberatoire) },
    { sujet: "Franchise en base de TVA (seuils de chiffre d'affaires)", valeurs: valeurs(r.TVA), source: source(r.TVA) },
    ...reglesDesLiberaux(r.liberauxReglementes)
  ]
}

/** Professions libérales réglementées : professions proposées et barèmes de leurs caisses (voir l'ADR 015). */
function reglesDesLiberaux(l: ReglesFiscales["liberauxReglementes"]): z.infer<typeof RegleSchema>[] {
  const { commun, CIPAV: cipav, CARPIMKO: carpimko } = l
  return [
    {
      sujet: "Professions libérales réglementées : profession (identifiant à donner au réglage profession), caisse (null : pas encore prise en compte, calcul d'une profession non réglementée), micro-entreprise permise, conventionnable, CURPS, avertissement sur les sociétés d'exercice libéral",
      valeurs: { professions: l.professions.liste.map(({ id, libelle, caisse, microEntreprise, conventionnable, curps, societeExerciceLiberal }) => ({ id, libelle, caisse, microEntreprise, conventionnable, curps, societeExerciceLiberal })) },
      source: source(l.professions)
    },
    { sujet: "Libéraux réglementés (CNAVPL) : retraite de base et indemnités journalières, par tranches en part du PASS ; assiettes minimales en euros ; CURPS des auxiliaires médicaux", valeurs: { retraiteDeBase: commun.retraiteDeBase.tranches, indemnitesJournalieres: commun.indemnitesJournalieres.tranches, ...valeurs(commun.cotisationsMinimales), curps: valeurs(commun.curps) }, source: source(commun.retraiteDeBase) },
    { sujet: "CIPAV : retraite complémentaire (tranches en part du PASS), invalidité-décès, taux global et répartition en micro-entreprise", valeurs: { retraiteComplementaire: cipav.retraiteComplementaire.tranches, invaliditeDeces: valeurs(cipav.invaliditeDeces), microEntreprise: { cotisations: cipav.microEntreprise.cotisations, repartition: cipav.microEntreprise.repartition } }, source: source(cipav.retraiteComplementaire) },
    { sujet: "CARPIMKO : retraite complémentaire (en euros ; sur le revenu de l'année précédente quand elle est simulée), invalidité-décès, ASV, prise en charge de la maladie des conventionnés ; micro-entreprise interdite", valeurs: { retraiteComplementaire: valeurs(carpimko.retraiteComplementaire), invaliditeDeces: valeurs(carpimko.invaliditeDeces), asv: valeurs(carpimko.asv), priseEnChargeMaladie: valeurs(carpimko.priseEnChargeMaladie) }, source: source(carpimko) }
  ]
}

export const reglesDeLAnneeOutil = definirOutil({
  nom: "regles_de_l_annee",
  titre: "Règles fiscales et sociales d'une année",
  description: [
    "Donne les principaux seuils et taux que le simulateur applique pour une année (barème de l'impôt sur le revenu, plafond de la sécurité sociale, impôt sur les sociétés, dividendes, plafonds et taux de la micro-entreprise, TVA, caisses des libéraux réglementés), avec leur source officielle.",
    "Pour expliquer un résultat ou vérifier une hypothèse, jamais pour refaire un calcul : les montants viennent de simuler, comparer_statuts et expliquer_resultat.",
    "Taux en fraction (0,15 = 15 %), montants annuels en euros. Une année plus récente que les dernières règles connues reprend celles-ci, avec un avertissement ; une année plus ancienne que les premières est refusée."
  ].join(" "),
  lecture: true,
  parametres: z.strictObject({ annee: AnneeSchema.optional().describe("Année des revenus ; par défaut, la plus récente de la simulation.") }),
  resultat: z.object({ annee: z.number(), anneeDesRegles: z.number(), avertissement: z.string().nullable(), regles: z.array(RegleSchema) }),
  executer: (session, { annee }) => {
    const anneeDemandee = annee ?? anneeDeLaSession(session)
    const regles = reglesDeLAnnee(anneeDemandee)
    if (regles.regles === null) throw new ErreurOutil(regles.erreur)
    return resultatSeul({ annee: anneeDemandee, anneeDesRegles: regles.regles.annee, avertissement: regles.avertissement, regles: reglesCles(regles.regles) })
  }
})
