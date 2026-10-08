// src/lib/scenarios-de-test.test.ts
// Les scénarios de test du mode développement se chargent tels quels et se calculent, sur des années consécutives.

import { describe, expect, it } from "vitest"
import { erreurDesAnnees } from "@/backend/logic/annees"
import { sanitizeStateAndFillDefaults } from "@/backend/logic/data-sanitizer"
import { withFormatVersion } from "@/backend/logic/fichiers-de-donnees"
import { simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { SCENARIOS_DE_TEST } from "./scenarios-de-test"

const doublons = (valeurs: string[]) => valeurs.filter((valeur, i) => valeurs.indexOf(valeur) !== i)

describe("Scénarios de test", () => {
  it("des identifiants et des titres uniques", () => {
    expect(doublons(SCENARIOS_DE_TEST.map(s => s.id))).toEqual([])
    expect(doublons(SCENARIOS_DE_TEST.map(s => s.titre))).toEqual([])
  })

  describe.each(SCENARIOS_DE_TEST.map(scenario => [scenario.id, scenario] as const))("%s", (_id, scenario) => {
    const session = scenario.session()

    it("dit ce qu'il faut vérifier", () => {
      expect(scenario.aVerifier.length).toBeGreaterThan(0)
    })

    it("des années consécutives, sans identifiant de flux en double", () => {
      expect(erreurDesAnnees(session.annees.map(a => a.annee))).toBeNull()
      expect(doublons(session.annees.flatMap(a => a.monthlyData.flatMap(m => m.flows.map(f => f.id))))).toEqual([])
    })

    it("passe le nettoyage au format actuel sans rien perdre ni changer", () => {
      const { safeState, report } = sanitizeStateAndFillDefaults(withFormatVersion(session))
      expect(report).toEqual({ entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0, reglagesRemoved: 0, professionsRemoved: 0, anneesEcartees: [], migrationNotes: [] })
      expect(safeState).toEqual(session)
    })

    it("se calcule sur chacune de ses années", () => {
      expect(() => simulerLesAnnees(session)).not.toThrow()
    })
  })
})
