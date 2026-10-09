// src/lib/scenarios-de-test.test.ts
// Les scénarios de test du mode développement se chargent tels quels et se calculent, sur des années consécutives.

import { describe, expect, it } from "vitest"
import { erreurDesAnnees } from "@/backend/logic/annees"
import { sanitizeStateAndFillDefaults } from "@/backend/logic/data-sanitizer"
import { withFormatVersion } from "@/backend/logic/fichiers-de-donnees"
import { simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { vueDeLAnnee } from "@/backend/logic/annees"
import { optionsDuComparateur } from "@/backend/logic/options-du-comparateur"
import { comparerStatutsDeLAnnee } from "@/backend/logic/simulation-pluriannuelle"
import type { SessionState } from "@/types"
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

describe("chiffres « À vérifier » des scénarios des professions libérales réglementées", () => {
  const scenario = (id: string) => SCENARIOS_DE_TEST.find(s => s.id === id)!.session()
  const rapport = (session: SessionState, annee: number) => simulerLesAnnees(session).annees.find(a => a.annee === annee)!.report!
  const activite = (session: SessionState, annee = 2026) => rapport(session, annee).activities.find(a => a.entityId === "a-test")!
  const comparer = (session: SessionState) => comparerStatutsDeLAnnee(session, optionsDuComparateur(vueDeLAnnee(session, 2026), "a-test", session.comparateur?.reglagesParActivite["a-test"]), 2026)
  const arrondi = Math.round

  it("ostéopathe en micro-entreprise", () => {
    const session = scenario("osteopathe-micro")
    expect(activite(session).cotisationsSociales).toBe(9360)
    expect(rapport(session, 2026).foyers[0]).toMatchObject({ revenuImposableGlobal: 26400, impotSurLeRevenu: 1468, netApresImpots: 29172 })
    const { scenarios } = comparer(session)
    expect(scenarios.find(s => s.statut === "micro")?.protectionSociale.trimestres).toBe(4)
    expect(scenarios.find(s => s.statut === "SASU")?.warnings).toContainEqual(expect.stringContaining("exerce en principe en société d'exercice libéral"))
    expect(scenarios.find(s => s.statut === "EI")?.protectionSociale.resume).toMatch(/^Profession libérale de la CIPAV/)
    const nonReglementee = { ...session, entities: session.entities.map(e => (e.id === "a-test" ? { ...e, profession: undefined } : e)) }
    expect(activite(nonReglementee).cotisationsSociales).toBe(10320)
  })

  it("kinésithérapeute conventionné sur deux années", () => {
    const session = scenario("kine-deux-annees")
    const a2026 = activite(session)
    const tns = a2026.cotisationsTNS!
    expect(a2026.cotisationsSociales).toBe(14535)
    expect([tns.cotisations.maladieMaternite, tns.caisse!.priseEnCharge.maladie, tns.cotisations.retraiteDeBase, tns.cotisations.retraiteComplementaire, tns.cotisations.invaliditeDeces, tns.caisse!.asv, tns.caisse!.priseEnCharge.asv, tns.caisse!.curps].map(arrondi)).toEqual([44, 2451, 4706, 3863, 1022, 295, 554, 44])
    const tns2025 = activite(session, 2025).cotisationsTNS!
    expect([tns2025.cotisations.retraiteComplementaire, tns2025.caisse!.asv].map(arrondi)).toEqual([2887, 292])
    expect(tns2025.caisse!.baseDesCotisationsDeLAnneePrecedente).toMatchObject({ annee: 2025, anneePrecedenteConnue: false })

    const baisse2025 = { ...session, annees: session.annees.map(a => (a.annee === 2025 ? { ...a, monthlyData: a.monthlyData.map(m => ({ ...m, flows: m.flows.map(f => ({ ...f, amount: 40000 })) })) } : a)) }
    const apres = activite(baisse2025).cotisationsTNS!
    expect([apres.cotisations.retraiteComplementaire, apres.caisse!.asv, apres.cotisations.retraiteDeBase].map(arrondi)).toEqual([2575, 271, 4706])
    expect(comparer(session).warnings).toContainEqual(expect.stringContaining("Micro-entreprise non proposée"))
    // La SASU et l'EURL classiques ne sont pas désignées : le kiné exerce en principe en société d'exercice libéral.
    expect(comparer(session).meilleur).toBe("EI")
    expect(comparer(session).warnings).toContainEqual(expect.stringContaining("ne sont pas désignées comme meilleur statut"))
  })

  it("psychologue en EI au réel", () => {
    const session = scenario("psychologue-ei")
    const a = activite(session)
    expect(a.cotisationsSociales).toBe(6317)
    expect([a.cotisationsTNS!.cotisations.retraiteDeBase, a.cotisationsTNS!.cotisations.retraiteComplementaire, a.cotisationsTNS!.cotisations.invaliditeDeces, a.cotisationsTNS!.cotisations.maladieMaternite].map(arrondi)).toEqual([1961, 2035, 93, 257])
    const { scenarios } = comparer(session)
    expect(scenarios.find(s => s.statut === "EI")?.protectionSociale.trimestres).toBe(4)
    const micro = scenarios.find(s => s.statut === "micro")!
    expect(micro.cotisationsSociales).toBe(5850)
    const sansProfession = { ...session, entities: session.entities.map(e => (e.id === "a-test" ? { ...e, profession: undefined } : e)) }
    expect(activite(sansProfession).cotisationsSociales).toBe(7312)
  })

  it("infirmière : comparer les statuts", () => {
    const session = scenario("infirmiere-statuts")
    expect(activite(session).cotisationsSociales).toBe(6572)
    const { scenarios, warnings } = comparer(session)
    expect(scenarios.map(s => s.statut)).toEqual(["SASU", "EURL", "EI"])
    expect(warnings).toContainEqual(expect.stringContaining("Micro-entreprise non proposée : elle est interdite aux praticiens et auxiliaires médicaux"))
    for (const statut of ["SASU", "EURL"]) expect(scenarios.find(s => s.statut === statut)?.warnings).toContainEqual(expect.stringContaining("société d'exercice libéral"))
  })
})
