// src/lib/testing/exports-fixtures.ts
// Petite simulation et ses résultats, aux chiffres ronds, pour les tests des exports CSV et Markdown.

import type { ComparaisonOptions, ComparaisonResult, OptimisationRemuneration, ScenarioStatut, SimulationAnnuelle, SimulationReport } from "@/types"
import { defaultFraisFonctionnement } from "@/lib/comparateur-options"

const avatar = { type: "initials" as const, value: "A", color: "#000000" }

/** Alice, présidente de « Ma SASU », mariée à Bob ; la SASU facture 3 000 € par mois et paie 100 € de charges en mars. */
export function sessionExemple(): SimulationAnnuelle {
  return {
    name: "Famille Martin",
    entities: [
      { id: "p1", type: "person", name: "Alice", fiscalParts: 1, avatar, locked: false },
      { id: "p2", type: "person", name: "Bob", fiscalParts: 1.5, avatar, locked: false },
      { id: "c1", type: "company", name: "Ma SASU", legalStatus: "SASU", capitalSocial: 1000, avatar, locked: false }
    ],
    relationships: [
      { id: "r1", fromId: "p1", toId: "p2", type: "Marié(e)" },
      { id: "r2", fromId: "p1", toId: "c1", type: "Président" }
    ],
    annee: 2026,
    monthlyData: Array.from({ length: 12 }, (_, month) => ({
      month,
      flows: [{ id: `ca-${month}`, entityId: "c1", type: "ca_services" as const, label: "Mission", amount: 3000 }, ...(month === 2 ? [{ id: "charge", entityId: "c1", type: "deductible_expense" as const, label: "Logiciel", amount: 100.5 }] : [])]
    }))
  }
}

export function rapportExemple(): SimulationReport {
  return {
    annee: 2026,
    anneeDesRegles: 2026,
    avertissements: [],
    bilan: {
      chiffreAffaires: 36000,
      charges: 100.5,
      revenusDirects: 0,
      cotisationsSalariales: 0,
      revenusAvantPrelevements: 35899.5,
      cotisationsSociales: 8000,
      impotSocietes: 1000,
      impotSurLeRevenu: 1500,
      prelevementsSociaux: 0,
      totalPrelevements: 10500,
      resultatConserve: 400,
      nonRattache: 0
    },
    activities: [
      {
        entityId: "c1",
        name: "Ma SASU",
        type: "company",
        statut: "SASU",
        chiffreAffaires: 36000,
        charges: 100.5,
        cotisationsSociales: 8000,
        impotSocietes: 1000,
        revenuVerse: 26499.5,
        resultatConserve: 400,
        beneficiaireIds: ["p1"],
        warnings: ["Société peu rentable."]
      }
    ],
    persons: [
      { entityId: "p1", name: "Alice", revenusDirects: 0, revenusActivites: 26499.5, detail: { salaires: 0, allocationsChomage: 0, autresRevenus: 0, remunerationsDirigeant: 20000, dividendes: 6499.5, benefices: 0 }, cotisationsSalariales: 0, depenses: 0 },
      { entityId: "p2", name: "Bob", revenusDirects: 0, revenusActivites: 0, detail: { salaires: 0, allocationsChomage: 0, autresRevenus: 0, remunerationsDirigeant: 0, dividendes: 0, benefices: 0 }, cotisationsSalariales: 0, depenses: 0 }
    ],
    foyers: [
      {
        personIds: ["p1", "p2"],
        totalParts: 2.5,
        revenusEncaisses: 26499.5,
        revenuImposableGlobal: 18000,
        revenuFiscalDeReference: 18000,
        impotSurLeRevenu: 1500,
        prelevementsSociaux: 0,
        optionDividendes: "pfu",
        netApresImpots: 24999.5,
        revenusAvantPrelevements: 35899.5,
        totalPrelevements: 10500,
        resultatConserve: 400,
        depenses: 0,
        warnings: ["Vérifier les parts."]
      }
    ],
    totalNetApresImpots: 24999.5
  }
}

function scenario(statut: ScenarioStatut["statut"], libelle: string, net: number, changements: Partial<ScenarioStatut> = {}): ScenarioStatut {
  return {
    statut,
    libelle,
    actuel: false,
    fraisFonctionnement: 1000,
    resultatConserveActivite: 0,
    horsPlafond: false,
    protectionSociale: { etoiles: 3, trimestres: 4, resume: "Régime général." },
    netApresImpots: net,
    revenusAvantPrelevements: 30000,
    totalPrelevements: 7500,
    cotisationsSociales: 6000,
    impotSocietes: 0,
    impotSurLeRevenu: 1500,
    prelevementsSociaux: 0,
    resultatConserve: 0,
    warnings: [],
    ...changements
  }
}

export function comparaisonExemple(): ComparaisonResult {
  return {
    scenarios: [scenario("SASU", "SASU", 20000, { actuel: true, resultatConserveActivite: 400 }), scenario("micro", "Micro-entreprise", 22500.5, { warnings: ["Plafond dépassé."], protectionSociale: { etoiles: 2, trimestres: 4, resume: "Indépendant." } })],
    meilleur: "micro",
    couples: [],
    warnings: ["Comparaison indicative."]
  }
}

export function optionsExemple(): ComparaisonOptions {
  return {
    activityId: "c1",
    remunerationNette: 20000,
    distribuerToutLeBenefice: true,
    partBncPrestations: 0.5,
    fraisFonctionnement: defaultFraisFonctionnement()
  }
}

export function optimisationExemple(): OptimisationRemuneration {
  const point = (remunerationNette: number, netApresImpots: number, trimestres: number) => ({ remunerationNette, dividendes: 10000 - remunerationNette, netApresImpots, cotisationsSociales: remunerationNette * 0.8, impotSocietes: 500, impotSurLeRevenu: 300, prelevementsSociaux: 100, trimestres })
  const points = [point(0, 9000, 0), point(5000, 9500, 4), point(10000, 9200, 4)]
  return { statut: "SASU", remunerationMaximale: 10000, points, meilleur: points[1], meilleurAvecRetraite: points[1], warnings: [] }
}
