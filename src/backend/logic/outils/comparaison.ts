// src/backend/logic/outils/comparaison.ts
// Comparateur de statuts et arbitrage rémunération / dividendes, avec les réglages du comparateur de la session :
// l'outil compare ce que l'utilisateur voit à l'écran, sauf réglages passés en paramètres pour essayer une variante.

import { z } from "zod"
import { MODES_REPARTITION, STATUTS_SOCIETE, type ComparaisonOptions, type Entity, type PointRemuneration, type ScenarioStatut, type SessionState } from "../../../types.js"
import { vueDeLAnnee } from "../annees.js"
import { optionsDuComparateur } from "../options-du-comparateur.js"
import type { SituationActuelle } from "../comparateur.js"
import { arbitrageDeLAnnee, comparerStatutsDeLAnnee } from "../simulation-pluriannuelle.js"
import { anneeDeLaSession, arrondir, ErreurOutil, nomDe, trouverActeur } from "./commun.js"
import { AnneeSchema, IdentifiantSchema, MontantSchema } from "./limites.js"
import { definirOutil, resultatSeul } from "./outil.js"
import { arrondirTout } from "./resultats.js"

/** L'activité demandée, ou celle ouverte dans le comparateur, ou la première de la session. */
function activiteDemandee(session: SessionState, activiteId: string | undefined): Entity {
  if (activiteId !== undefined) {
    const acteur = trouverActeur(session, activiteId)
    if (acteur.type === "person") throw new ErreurOutil(`« ${acteur.name} » est une personne : le comparateur porte sur une activité (société, EI ou micro-entreprise).`)
    return acteur
  }
  const activites = session.entities.filter(e => e.type !== "person")
  const activite = activites.find(a => a.id === session.comparateur?.activiteComparee) ?? activites[0]
  if (!activite) throw new ErreurOutil("La simulation ne contient aucune activité à comparer : proposez-en une avec proposer_acteur.")
  return activite
}

const ParametresVariante = {
  activiteId: IdentifiantSchema.optional().describe("Identifiant de l'activité ; par défaut, celle ouverte dans le comparateur de l'application."),
  annee: AnneeSchema.optional().describe("Année ; par défaut, la plus récente de la simulation.")
}

/** Les réglages enregistrés de l'activité pour l'année, comme le comparateur de l'application les affiche. */
function optionsEnregistrees(session: SessionState, activiteId: string | undefined, annee: number | undefined): { options: ComparaisonOptions; annee: number; activite: Entity } {
  const anneeRetenue = anneeDeLaSession(session, annee)
  const activite = activiteDemandee(session, activiteId)
  const options = optionsDuComparateur(vueDeLAnnee(session, anneeRetenue), activite.id, session.comparateur?.reglagesParActivite[activite.id])
  return { options, annee: anneeRetenue, activite }
}

// ===================================================================================
// == comparer_statuts
// ===================================================================================

const ScenarioSchema = z.object({
  statut: z.string(),
  libelle: z.string(),
  actuel: z.boolean(),
  netApresImpots: z.number(),
  totalPrelevements: z.number(),
  cotisationsSociales: z.number(),
  impotSocietes: z.number(),
  impotSurLeRevenu: z.number(),
  prelevementsSociaux: z.number(),
  resultatConserveActivite: z.number(),
  fraisFonctionnement: z.number(),
  horsPlafond: z.boolean(),
  protectionSociale: z.object({ etoiles: z.number(), trimestres: z.number(), resume: z.string() }),
  remunerationRetenue: z.number().nullable(),
  avertissements: z.array(z.string())
})

const resumeDuScenario = (s: ScenarioStatut): z.infer<typeof ScenarioSchema> => ({
  statut: s.statut,
  libelle: s.libelle,
  actuel: s.actuel,
  ...arrondirTout({ netApresImpots: s.netApresImpots, totalPrelevements: s.totalPrelevements, cotisationsSociales: s.cotisationsSociales, impotSocietes: s.impotSocietes, impotSurLeRevenu: s.impotSurLeRevenu, prelevementsSociaux: s.prelevementsSociaux, resultatConserveActivite: s.resultatConserveActivite, fraisFonctionnement: s.fraisFonctionnement }),
  horsPlafond: s.horsPlafond,
  protectionSociale: s.protectionSociale,
  remunerationRetenue: s.remunerationOptimale ? arrondir(s.remunerationOptimale.remunerationNette) : s.partage ? arrondir(s.partage.remunerationNette) : null,
  avertissements: s.warnings
})

export const comparerStatuts = definirOutil({
  nom: "comparer_statuts",
  titre: "Comparer les statuts d'une activité",
  description: [
    "Simule une activité dans chaque statut (SASU, EURL, EI au réel, micro-entreprise avec et sans versement libératoire), le reste de la simulation inchangé, et désigne le statut au meilleur net après impôts du foyer.",
    "Utilise les réglages du comparateur enregistrés (partage du bénéfice, frais de fonctionnement par statut) ; les paramètres essaient une variante sans rien enregistrer (pour l'enregistrer : proposer_reglages_comparateur).",
    "Les frais de fonctionnement (fraisFonctionnement : expert-comptable, banque, logiciel, assurance, CFE) s'ajoutent aux charges de la grille, statut actuel compris : comparez les scénarios entre eux, pas avec simuler.",
    "Montants annuels en euros, arrondis, pour toute la simulation (tous les foyers) ; resultatConserveActivite porte sur l'activité seule ; remunerationRetenue est la rémunération nette annuelle du dirigeant en SASU et EURL.",
    "Pas de colonne micro pour un auxiliaire médical (CARPIMKO) : la raison est dans les avertissements."
  ].join(" "),
  lecture: true,
  parametres: z.strictObject({
    ...ParametresVariante,
    mode: z.enum(MODES_REPARTITION).optional().describe("Partage du bénéfice en SASU et EURL : meilleurNet (rémunération au meilleur net, reste en dividendes), dividendes (rémunération saisie, reste en dividendes), remuneration (tout), personnalisee (rémunération saisie et part distribuée), grille (montants saisis)."),
    remunerationNette: MontantSchema.optional().describe("Rémunération nette annuelle du dirigeant en SASU et EURL, en euros (modes dividendes et personnalisee)."),
    partDistribuee: z.number().min(0).max(1).optional().describe("Mode personnalisee : part du bénéfice distribuable versée en dividendes, de 0 à 1."),
    avecRetraite: z.boolean().optional().describe("Mode meilleurNet : ne retenir que les rémunérations qui valident 4 trimestres de retraite."),
    partBncPrestations: z.number().min(0).max(1).optional().describe("Part des prestations de services classée en BNC si l'activité devient une micro-entreprise, de 0 à 1.")
  }),
  resultat: z.object({ annee: z.number(), activiteId: z.string(), activite: z.string(), reglages: z.object({ mode: z.string(), remunerationNette: z.number(), partDistribuee: z.number(), avecRetraite: z.boolean(), partBncPrestations: z.number() }), meilleur: z.string().nullable(), scenarios: z.array(ScenarioSchema), couples: z.array(z.object({ personnes: z.array(z.string()), netActuel: z.number(), netMaries: z.number() })), notes: z.array(z.string()) }),
  executer: (session, { activiteId, annee, mode, remunerationNette, partDistribuee, avecRetraite, partBncPrestations }) => {
    const enregistrees = optionsEnregistrees(session, activiteId, annee)
    const base = enregistrees.options
    const repartition = { ...base.repartition, ...(mode ? { mode } : {}), ...(partDistribuee === undefined ? {} : { partDistribuee }), ...(avecRetraite === undefined ? {} : { avecRetraite }) }
    const options: ComparaisonOptions = { ...base, repartition, remunerationNette: remunerationNette ?? base.remunerationNette, partBncPrestations: partBncPrestations ?? base.partBncPrestations }
    const comparaison = comparerStatutsDeLAnnee(session, options, enregistrees.annee)
    return resultatSeul({
      annee: enregistrees.annee,
      activiteId: enregistrees.activite.id,
      activite: enregistrees.activite.name,
      reglages: { mode: repartition.mode, remunerationNette: arrondir(options.remunerationNette), partDistribuee: repartition.partDistribuee, avecRetraite: repartition.avecRetraite ?? false, partBncPrestations: options.partBncPrestations },
      meilleur: comparaison.meilleur,
      scenarios: comparaison.scenarios.map(resumeDuScenario),
      couples: comparaison.couples.map(c => ({ personnes: c.personIds.map(id => nomDe(session, id)), netActuel: arrondir(c.netApresImpotsActuel), netMaries: arrondir(c.netApresImpotsMaries) })),
      notes: [...comparaison.warnings, ...(comparaison.noteCFE ? [comparaison.noteCFE] : [])]
    })
  }
})

// ===================================================================================
// == optimiser_remuneration
// ===================================================================================

const PointSchema = z.object({ remunerationNette: z.number(), dividendes: z.number(), netApresImpots: z.number(), cotisationsSociales: z.number(), impotSocietes: z.number(), impotSurLeRevenu: z.number(), prelevementsSociaux: z.number(), trimestres: z.number() })

const resumeDuPoint = (p: PointRemuneration): z.infer<typeof PointSchema> => ({ ...arrondirTout({ remunerationNette: p.remunerationNette, dividendes: p.dividendes, netApresImpots: p.netApresImpots, cotisationsSociales: p.cotisationsSociales, impotSocietes: p.impotSocietes, impotSurLeRevenu: p.impotSurLeRevenu, prelevementsSociaux: p.prelevementsSociaux }), trimestres: p.trimestres })

/** Points de la courbe gardés dans le résultat : assez pour en voir la forme, sans la centaine de points calculés. */
const POINTS_DE_LA_COURBE = 11

/** Quelques points régulièrement espacés de la courbe, le premier et le dernier compris. */
export function echantillon<T>(points: T[], nombre: number): T[] {
  if (points.length <= nombre) return points
  const indices = new Set(Array.from({ length: nombre }, (_, i) => Math.round((i * (points.length - 1)) / (nombre - 1))))
  return [...indices].map(i => points[i])
}

/** La situation actuelle de l'activité, comme un point de la courbe, avec son statut et ses frais de fonctionnement. */
const SituationSchema = PointSchema.extend({ statut: z.string(), remunerationNette: z.number().nullable(), dividendes: z.number().nullable(), fraisFonctionnement: z.number() })

function resumeDeLaSituation({ scenario, remunerationNette, dividendes }: SituationActuelle): z.infer<typeof SituationSchema> {
  const montants = arrondirTout({ netApresImpots: scenario.netApresImpots, cotisationsSociales: scenario.cotisationsSociales, impotSocietes: scenario.impotSocietes, impotSurLeRevenu: scenario.impotSurLeRevenu, prelevementsSociaux: scenario.prelevementsSociaux, fraisFonctionnement: scenario.fraisFonctionnement })
  return { statut: scenario.statut, remunerationNette: remunerationNette === null ? null : arrondir(remunerationNette), dividendes: dividendes === null ? null : arrondir(dividendes), ...montants, trimestres: scenario.protectionSociale.trimestres }
}

/** Net d'un point moins celui de la situation actuelle : ce que le foyer gagnerait (ou perdrait, si négatif). */
const ecart = (point: PointRemuneration | null, actuelle: SituationActuelle | null) => (point && actuelle ? arrondir(point.netApresImpots - actuelle.scenario.netApresImpots) : null)

export const optimiserRemuneration = definirOutil({
  nom: "optimiser_remuneration",
  titre: "Arbitrer rémunération et dividendes",
  description: [
    "Pour une activité en SASU ou en EURL (son statut actuel ou étudié), cherche la rémunération nette du dirigeant au meilleur net après impôts du foyer, le reste du bénéfice en dividendes, et la meilleure parmi celles qui valident 4 trimestres de retraite.",
    `Rend la rémunération maximale, ces deux points, ${POINTS_DE_LA_COURBE} points de la courbe, et situationActuelle : l'activité telle que saisie (statut, rémunération et dividendes de la grille), avec ecartAuMeilleur et ecartAuMeilleurAvecRetraite, le net que le foyer gagnerait à chaque point (« vous êtes à X € du meilleur net »). Montants annuels en euros, arrondis ; calcul à 100 € près.`,
    "Ces nets comptent les frais de fonctionnement du comparateur (fraisFonctionnement du statut étudié, situationActuelle.fraisFonctionnement de l'actuel ; noteCFE si la CFE est réduite après une création) : ils diffèrent de ceux de simuler ; comparez-les entre eux.",
    "Les points ne distribuent que le bénéfice de l'année ; les dividendes de la grille peuvent puiser dans les réserves des années précédentes : un écart négatif peut venir de là.",
    "Ne modifie rien : pour retenir une rémunération, proposez un flux director_remuneration mensuel (montant annuel / 12) et ajustez les dividendes saisis (dividends_payment) ; l'aperçu de la proposition donne le net obtenu."
  ].join(" "),
  lecture: true,
  parametres: z.strictObject({ ...ParametresVariante, statut: z.enum(STATUTS_SOCIETE).describe("Statut de société étudié.") }),
  resultat: z.object({
    annee: z.number(),
    activiteId: z.string(),
    activite: z.string(),
    statut: z.string(),
    remunerationMaximale: z.number(),
    fraisFonctionnement: z.number(),
    noteCFE: z.string().nullable(),
    situationActuelle: SituationSchema.nullable(),
    meilleur: PointSchema.nullable(),
    meilleurAvecRetraite: PointSchema.nullable(),
    ecartAuMeilleur: z.number().nullable(),
    ecartAuMeilleurAvecRetraite: z.number().nullable(),
    courbe: z.array(PointSchema),
    avertissements: z.array(z.string())
  }),
  executer: (session, { activiteId, annee, statut }) => {
    const { options, annee: anneeRetenue, activite } = optionsEnregistrees(session, activiteId, annee)
    const { optimisation, situationActuelle, fraisFonctionnement, noteCFE } = arbitrageDeLAnnee(session, options, statut, anneeRetenue)
    return resultatSeul({
      annee: anneeRetenue,
      activiteId: activite.id,
      activite: activite.name,
      statut,
      remunerationMaximale: arrondir(optimisation.remunerationMaximale),
      fraisFonctionnement: arrondir(fraisFonctionnement),
      noteCFE: noteCFE ?? null,
      situationActuelle: situationActuelle ? resumeDeLaSituation(situationActuelle) : null,
      meilleur: optimisation.meilleur ? resumeDuPoint(optimisation.meilleur) : null,
      meilleurAvecRetraite: optimisation.meilleurAvecRetraite ? resumeDuPoint(optimisation.meilleurAvecRetraite) : null,
      ecartAuMeilleur: ecart(optimisation.meilleur, situationActuelle),
      ecartAuMeilleurAvecRetraite: ecart(optimisation.meilleurAvecRetraite, situationActuelle),
      courbe: echantillon(optimisation.points, POINTS_DE_LA_COURBE).map(resumeDuPoint),
      avertissements: optimisation.warnings
    })
  }
})
