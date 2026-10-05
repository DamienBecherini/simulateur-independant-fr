// src/lib/montages/montages.reference.test.ts
// Chiffres de référence des montages types : chaque montage passe par le vrai moteur, avec les règles 2026, et ses
// résultats clés sont figés ici. Un changement de règle ou de calcul qui les modifie fait échouer ce test : il faut
// alors vérifier le nouvel écart, puis mettre à jour ces chiffres et, si besoin, les explications des montages.

import { describe, expect, it } from "vitest"
import { vueDeLAnnee } from "@/backend/logic/annees"
import { casDeReference, verifierIdentiteDuBilan } from "@/backend/logic/testing/cas-de-reference"
import { comparerStatutsDeLAnnee, simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { reglagesDeLActiviteComparee } from "@/lib/comparateur-options"
import type { StatutCompare } from "@/types"
import { ANNEE_DES_MONTAGES } from "./construction"
import { MONTAGES_TYPES, sessionDUnMontage, type MontageType } from "./montages"

interface FoyerAttendu {
  personIds: string[]
  impotSurLeRevenu: number
  prelevementsSociaux: number
  totalPrelevements: number
  netApresImpots: number
}

interface ChiffresAttendus {
  totalNetApresImpots: number
  foyers: FoyerAttendu[]
  /** Cotisations sociales et impôt sur les sociétés, par activité. */
  activites: Record<string, { cotisationsSociales: number; impotSocietes: number; resultatConserve: number }>
  /** Activité ouverte dans le comparateur et statut au meilleur net. */
  comparateur: { activite: string; meilleur: StatutCompare | null }
}

const foyer = (personIds: string[], impotSurLeRevenu: number, prelevementsSociaux: number, totalPrelevements: number, netApresImpots: number): FoyerAttendu => ({ personIds, impotSurLeRevenu, prelevementsSociaux, totalPrelevements, netApresImpots })
const activite = (cotisationsSociales: number, impotSocietes: number, resultatConserve = 0) => ({ cotisationsSociales, impotSocietes, resultatConserve })

const ATTENDUS: Record<string, ChiffresAttendus> = {
  "micro-bnc-seule": {
    // 36 000 € : cotisations 25,6 % = 9 216 € ; versement libératoire 2,2 % = 792 €.
    totalNetApresImpots: 25992,
    foyers: [foyer(["p-sophie"], 792, 0, 10008, 25992)],
    activites: { "m-sophie": activite(9216, 0) },
    comparateur: { activite: "m-sophie", meilleur: "micro-vfl" }
  },
  "sasu-sans-salaire": {
    // Bénéfice 78 000 € ; IS 42 500 x 15 % + 35 500 x 25 % = 15 250 € ; 62 750 € de dividendes, imposés au barème.
    totalNetApresImpots: 47960,
    foyers: [foyer(["p-thomas"], 3119, 11672, 30041, 47960)],
    activites: { "s-thomas": activite(0, 15250) },
    comparateur: { activite: "s-thomas", meilleur: "SASU" }
  },
  "sasu-salaire-4-trimestres": {
    totalNetApresImpots: 46296,
    foyers: [foyer(["p-antoine"], 3962, 8742, 31552, 46296)],
    activites: { "s-antoine": activite(8797, 10051, 152) },
    comparateur: { activite: "s-antoine", meilleur: "SASU" }
  },
  "eurl-is-remuneration-gerant": {
    totalNetApresImpots: 28666,
    foyers: [foyer(["p-nicolas"], 1741, 93, 20613, 28666)],
    activites: { "e-nicolas": activite(13623, 5157, 28721) },
    comparateur: { activite: "e-nicolas", meilleur: "SASU" }
  },
  "salarie-et-micro": {
    totalNetApresImpots: 31409,
    foyers: [foyer(["p-lucas"], 2133, 0, 12031, 31409)],
    activites: { "m-lucas": activite(2458, 0) },
    comparateur: { activite: "m-lucas", meilleur: "micro-vfl" }
  },
  "micro-et-sasu-du-conjoint": {
    totalNetApresImpots: 63119,
    foyers: [foyer(["p-claire", "p-marc"], 3551, 4650, 38036, 63119)],
    activites: { "m-claire": activite(7680, 0), "s-marc": activite(17594, 4561, 845) },
    comparateur: { activite: "m-claire", meilleur: "micro-vfl" }
  },
  "conjoint-salarie-sasu": {
    totalNetApresImpots: 62909,
    foyers: [foyer(["p-paul", "p-julie"], 3511, 5580, 38103, 62909)],
    activites: { "s-paul": activite(18805, 5468, 988) },
    comparateur: { activite: "s-paul", meilleur: "EI" }
  },
  "couple-union-libre": {
    totalNetApresImpots: 46484,
    foyers: [foyer(["p-hugo"], 4444, 0, 16444, 37556), foyer(["p-emma"], 0, 0, 3072, 8928)],
    activites: { "m-emma": activite(3072, 0) },
    comparateur: { activite: "m-emma", meilleur: "micro" }
  }
}

function simulerLeMontage(montage: MontageType) {
  const session = sessionDUnMontage(montage)
  const [{ report, erreur }] = simulerLesAnnees(session).annees
  if (!report) throw new Error(`${montage.id} : ${erreur}`)
  const reglages = reglagesDeLActiviteComparee(vueDeLAnnee(session, ANNEE_DES_MONTAGES), session.comparateur)
  if (!reglages) throw new Error(`${montage.id} : aucune activité à comparer`)
  return { report, activite: reglages.activite.id, comparaison: comparerStatutsDeLAnnee(session, reglages.options, ANNEE_DES_MONTAGES) }
}

casDeReference("Montages types : chiffres de référence", () => {
  it("chaque montage a ses chiffres de référence", () => {
    expect(Object.keys(ATTENDUS).sort()).toEqual(MONTAGES_TYPES.map(m => m.id).sort())
  })

  describe.each(MONTAGES_TYPES.map(montage => [montage.id, montage] as const))("%s", (id, montage) => {
    const attendus = ATTENDUS[id]
    const { report, activite: activiteComparee, comparaison } = simulerLeMontage(montage)

    it("net du foyer, impôt et prélèvements", () => {
      expect(report.totalNetApresImpots).toBe(attendus.totalNetApresImpots)
      expect(report.foyers.map(f => ({ personIds: f.personIds, impotSurLeRevenu: f.impotSurLeRevenu, prelevementsSociaux: f.prelevementsSociaux, totalPrelevements: f.totalPrelevements, netApresImpots: f.netApresImpots }))).toEqual(attendus.foyers)
      verifierIdentiteDuBilan(report)
    })

    it("cotisations et impôt sur les sociétés des activités", () => {
      const activites = Object.fromEntries(report.activities.map(a => [a.entityId, activite(a.cotisationsSociales, a.impotSocietes, a.resultatConserve)]))
      expect(activites).toEqual(attendus.activites)
    })

    it("sans avertissement, et meilleur statut du comparateur", () => {
      expect([...report.avertissements, ...report.activities.flatMap(a => a.warnings), ...report.foyers.flatMap(f => f.warnings)]).toEqual([])
      expect({ activite: activiteComparee, meilleur: comparaison.meilleur }).toEqual(attendus.comparateur)
    })
  })

  it("micro-entreprise seule : le versement libératoire s'applique, avec 24 000 € de revenu fiscal de référence saisis", () => {
    const { report } = simulerLeMontage(MONTAGES_TYPES.find(m => m.id === "micro-bnc-seule")!)
    expect(report.activities[0].versementLiberatoire).toMatchObject({ plafondRfr: 29315, rfrN2: 24000, eligible: true, applique: true })
  })

  it("SASU sans salaire : valider 4 trimestres coûte 828 € de net au foyer, pour 5 800 € nets de rémunération", () => {
    const { comparaison } = simulerLeMontage(MONTAGES_TYPES.find(m => m.id === "sasu-sans-salaire")!)
    const sasu = comparaison.scenarios.find(s => s.statut === "SASU")
    expect(sasu?.remunerationOptimale).toMatchObject({ remunerationNette: 5800, avecRetraite: true, coutDesQuatreTrimestres: 828 })
    expect(sasu?.protectionSociale.trimestres).toBe(4)
    // 84 000 € de chiffre d'affaires dépassent le plafond de la micro-entreprise : elle n'est jamais désignée meilleur choix.
    expect(comparaison.scenarios.find(s => s.statut === "micro-vfl")?.horsPlafond).toBe(true)
  })

  it("SASU avec salaire : 12 000 € nets valident 4 trimestres", () => {
    const { report } = simulerLeMontage(MONTAGES_TYPES.find(m => m.id === "sasu-salaire-4-trimestres")!)
    // 4 trimestres en 2026 : 4 x 1 803 € de revenu cotisé au moins.
    expect(report.activities[0].cotisationsPresident?.brut).toBeGreaterThan(4 * 1803)
  })

  it("couple en union libre : marié ou pacsé, il paierait 2 115 € d'impôt au lieu de 4 444 €", () => {
    const { comparaison } = simulerLeMontage(MONTAGES_TYPES.find(m => m.id === "couple-union-libre")!)
    expect(comparaison.couples).toEqual([{ personIds: ["p-hugo", "p-emma"], netApresImpotsActuel: 46484, impotSurLeRevenuActuel: 4444, netApresImpotsMaries: 48813, impotSurLeRevenuMaries: 2115 }])
  })
})
