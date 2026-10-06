// src/backend/logic/outils/comparaison.ts
// Comparateur de statuts et arbitrage rémunération / dividendes, avec les réglages du comparateur de la session :
// l'outil compare ce que l'utilisateur voit à l'écran, sauf réglages passés en paramètres pour essayer une variante.

import { z } from "zod"
import { MODES_REPARTITION, type ComparaisonOptions, type Entity, type PointRemuneration, type ScenarioStatut, type SessionState } from "../../../types.js"
import { vueDeLAnnee } from "../annees.js"
import { optionsDuComparateur } from "../options-du-comparateur.js"
import { comparerStatutsDeLAnnee, optimiserRemunerationDeLAnnee } from "../simulation-pluriannuelle.js"
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
    "Simule une activité dans chaque statut (SASU, EURL, EI au réel, micro-entreprise avec et sans versement libératoire), le reste de la simulation inchangé, et désigne le statut au meilleur net après impôts pour le foyer.",
    "Utilise les réglages du comparateur enregistrés dans la simulation (partage du bénéfice, frais de fonctionnement par statut) ; les paramètres facultatifs permettent d'essayer une variante sans rien enregistrer (pour l'enregistrer, proposer_reglages_comparateur).",
    "Montants annuels en euros, arrondis, pour toute la simulation (net de tous les foyers) ; resultatConserveActivite porte sur l'activité seule. Calcul plus long que simuler : plusieurs dizaines de simulations."
  ].join(" "),
  lecture: true,
  parametres: z.strictObject({
    ...ParametresVariante,
    mode: z.enum(MODES_REPARTITION).optional().describe("Partage du bénéfice en SASU et EURL : meilleurNet (rémunération au meilleur net, le reste en dividendes), dividendes (rémunération saisie, le reste en dividendes), remuneration (tout en rémunération), personnalisee (rémunération saisie et part distribuée), grille (montants de la grille)."),
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

export const optimiserRemuneration = definirOutil({
  nom: "optimiser_remuneration",
  titre: "Arbitrer rémunération et dividendes",
  description: [
    "Pour une activité exercée en SASU ou en EURL (son statut actuel ou celui étudié), cherche la rémunération nette du dirigeant qui donne le meilleur net après impôts au foyer, tout le reste du bénéfice étant versé en dividendes ; donne aussi le meilleur choix parmi les rémunérations qui valident 4 trimestres de retraite.",
    `Rend la rémunération maximale que la société peut verser, les deux meilleurs points et ${POINTS_DE_LA_COURBE} points de la courbe. Montants annuels en euros, arrondis ; calcul à 100 € près.`,
    "Utilise les frais de fonctionnement enregistrés dans le comparateur. Ne modifie rien : pour retenir une rémunération, proposez un flux director_remuneration avec proposer_flux ou proposer_modification."
  ].join(" "),
  lecture: true,
  parametres: z.strictObject({ ...ParametresVariante, statut: z.enum(["SASU", "EURL"]).describe("Statut de société étudié.") }),
  resultat: z.object({ annee: z.number(), activiteId: z.string(), activite: z.string(), statut: z.string(), remunerationMaximale: z.number(), meilleur: PointSchema.nullable(), meilleurAvecRetraite: PointSchema.nullable(), courbe: z.array(PointSchema), avertissements: z.array(z.string()) }),
  executer: (session, { activiteId, annee, statut }) => {
    const { options, annee: anneeRetenue, activite } = optionsEnregistrees(session, activiteId, annee)
    const optimisation = optimiserRemunerationDeLAnnee(session, options, statut, anneeRetenue)
    return resultatSeul({
      annee: anneeRetenue,
      activiteId: activite.id,
      activite: activite.name,
      statut,
      remunerationMaximale: arrondir(optimisation.remunerationMaximale),
      meilleur: optimisation.meilleur ? resumeDuPoint(optimisation.meilleur) : null,
      meilleurAvecRetraite: optimisation.meilleurAvecRetraite ? resumeDuPoint(optimisation.meilleurAvecRetraite) : null,
      courbe: echantillon(optimisation.points, POINTS_DE_LA_COURBE).map(resumeDuPoint),
      avertissements: optimisation.warnings
    })
  }
})
