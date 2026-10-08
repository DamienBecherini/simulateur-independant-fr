// src/lib/testing/exports-fixtures.ts
// Petite simulation et ses résultats, aux chiffres ronds, pour les tests des exports CSV et Markdown.

import type { ComparaisonOptions, ComparaisonResult, OptimisationRemuneration, ScenarioStatut, SimulationAnnuelle, SimulationPluriannuelle, SimulationReport } from "@/types"
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
        revenuFiscalDeReference: 19500,
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

/**
 * La même simulation avec des frais au barème kilométrique : Alice a saisi deux trajets domicile-travail et 500 € d'autres
 * frais réels, la SASU 5 000 km de déplacements professionnels ; s'y ajoute « Atelier », micro-entreprise de Bob au
 * versement libératoire.
 */
export function sessionAvecFrais(): SimulationAnnuelle {
  const session = sessionExemple()
  const trajets = [
    { libelle: "Bureau", kmParTrajet: 20, joursTravailles: 120, puissanceFiscale: "5" as const, electrique: false, distanceJustifiee: false },
    { libelle: "", kmParTrajet: 50, joursTravailles: 25, puissanceFiscale: "3" as const, electrique: true, distanceJustifiee: true }
  ]
  session.entities = [
    ...session.entities.map(e => {
      if (e.type === "person" && e.id === "p1") return { ...e, fraisReels: { trajets, autresFrais: 500 } }
      return e.type === "company" ? { ...e, deplacementsProfessionnels: { kmParAn: 5000, puissanceFiscale: "5" as const, electrique: false } } : e
    }),
    { id: "m1", type: "micro-entreprise", name: "Atelier", beneficieACRE: false, opteVFL: true, rfrN2: 25000, deplacementsProfessionnels: { kmParAn: 1000, puissanceFiscale: "4", electrique: false }, avatar, locked: false }
  ]
  session.relationships = [...session.relationships, { id: "r3", fromId: "p2", toId: "m1", type: "Titulaire" }]
  return session
}

/** Les résultats de cette simulation : frais réels retenus pour Alice, déplacements et versement libératoire. */
export function rapportAvecFrais(): SimulationReport {
  const rapport = rapportExemple()
  const [alice, bob] = rapport.persons
  const voitures = [
    { puissanceFiscale: "5" as const, electrique: false, distance: 4800, montant: 2880 },
    { puissanceFiscale: "3" as const, electrique: true, distance: 2500, montant: 1500 }
  ]
  rapport.persons = [{ ...alice, fraisProfessionnels: { revenusSalariaux: 20000, deductionForfaitaire: 2000, fraisReels: 4880, fraisDeTrajet: 4380, distanceRetenue: 7300, nombreDeTrajets: 2, voitures, autresFrais: 500, retenue: "reels", deduction: 4880 } }, bob]
  const atelier = {
    ...rapport.activities[0],
    entityId: "m1",
    name: "Atelier",
    type: "micro-entreprise" as const,
    statut: "Micro-entreprise",
    impotSocietes: 0,
    resultatConserve: 0,
    beneficiaireIds: ["p2"],
    versementLiberatoire: { plafondRfr: 28797, partsFiscales: 1, rfrN2: 25000, anneeRfr: 2024, origineRfr: "saisi" as const, eligible: true, applique: true },
    fraisDeDeplacement: { kilometres: 1000, montant: 606, deductible: false },
    warnings: []
  }
  rapport.activities = [{ ...rapport.activities[0], fraisDeDeplacement: { kilometres: 5000, montant: 3180, deductible: true } }, atelier]
  return rapport
}

/** Trois années : 2026 (le rapport d'exemple), 2027 (un foyer au revenu plus élevé, un dispositif) et 2028 en erreur. */
export function pluriannuelleExemple(): SimulationPluriannuelle {
  const annee2026 = rapportExemple()
  const annee2027 = rapportExemple()
  annee2027.annee = 2027
  annee2027.anneeDesRegles = 2027
  annee2027.totalNetApresImpots = 26000
  annee2027.foyers = annee2027.foyers.map(f => ({ ...f, revenuFiscalDeReference: 21000 }))
  annee2027.activities = annee2027.activities.map(a => ({ ...a, dispositifs: ["Plafonds au prorata."] }))
  return {
    annees: [
      { annee: 2026, report: annee2026, erreur: null },
      { annee: 2027, report: annee2027, erreur: null },
      { annee: 2028, report: null, erreur: "Grille invalide." }
    ]
  }
}

/**
 * Le rapport d'exemple, la SASU ayant des réserves : 1 000 € au 1er janvier, 400 € gardés dans l'année (dont 20 € de
 * réserve légale), 1 380 € au 31 décembre et 100 € de réserve légale.
 */
export function rapportAvecReserves(): SimulationReport {
  const rapport = rapportExemple()
  const reserves = { auDebut: { reserves: 1000, reserveLegale: 80, deficitReportable: 0 }, aLaFin: { reserves: 1380, reserveLegale: 100, deficitReportable: 0 }, deficitImpute: 0, dotationReserveLegale: 20, beneficeDistribuableDeLAnnee: 6879.5, distribuable: 7879.5, dividendesPrisSurLesReserves: 0 }
  rapport.activities = rapport.activities.map(a => ({ ...a, reserves }))
  return rapport
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
    repartition: { mode: "dividendes", partDistribuee: 1 },
    partBncPrestations: 0.5,
    fraisFonctionnement: defaultFraisFonctionnement()
  }
}

export function optimisationExemple(): OptimisationRemuneration {
  const point = (remunerationNette: number, netApresImpots: number, trimestres: number) => ({ remunerationNette, dividendes: 10000 - remunerationNette, netApresImpots, cotisationsSociales: remunerationNette * 0.8, impotSocietes: 500, impotSurLeRevenu: 300, prelevementsSociaux: 100, trimestres })
  const points = [point(0, 9000, 0), point(5000, 9500, 4), point(10000, 9200, 4)]
  return { statut: "SASU", remunerationMaximale: 10000, points, meilleur: points[1], meilleurAvecRetraite: points[1], warnings: [] }
}
