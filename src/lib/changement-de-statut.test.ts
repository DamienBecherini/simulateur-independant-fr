// src/lib/changement-de-statut.test.ts

import { describe, expect, it } from "vitest"
import { euros } from "@/backend/logic/format"
import { reglesDeTest } from "@/backend/logic/testing/regles-de-test"
import { micro, personne, relation, session as donneesDeLAnnee, societe, type Flux } from "@/backend/logic/testing/session-de-test"
import { CAPITAL_SOCIAL_PAR_DEFAUT, type Company, type Entity, type MicroEntreprise, type Relationship, type SessionState } from "@/types"
import { appliquerLeChangement, examinerLeChangement, natureProposee, nomDuStatut } from "./changement-de-statut"

function sessionDe(entities: Entity[], relationships: Relationship[], flux: Flux[], libelles: Record<number, string> = {}): SessionState {
  const { monthlyData } = donneesDeLAnnee(entities, relationships, flux)
  const avecLibelles = monthlyData.map(m => ({ ...m, flows: m.flows.map((f, i) => ({ ...f, label: libelles[i] ?? f.label })) }))
  return { name: "Test", entities, relationships, annees: [{ annee: 2026, monthlyData: avecLibelles }] }
}

const microComplete: MicroEntreprise = { ...micro("m1", { beneficieACRE: true, opteVFL: true }), name: "Atelier", rfrN2: 25000, horsPlafondAnneePrecedente: true }

describe("examinerLeChangement", () => {
  it("micro-entreprise vers EI : chiffre d'affaires renommé, charges devenues déductibles, réglages de la micro retirés un par un", () => {
    const s = sessionDe([personne("alice"), microComplete], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 30000], ["m1", "expense", 2000]])
    const { refus, consequences, prestationsAQualifier } = examinerLeChangement(s, microComplete, "EI", reglesDeTest, "bnc")
    expect(refus).toBeNull()
    expect(prestationsAQualifier).toBe(false)
    expect(consequences).toEqual([
      `« Prestations libérales (BNC) » (${euros(30000)}) devient « CA - Prestation de services ».`,
      `Les charges de la micro-entreprise (${euros(2000)}) deviennent des charges déductibles : vérifiez qu'elles sont toutes professionnelles.`,
      "L'ACRE est retirée : l'aide existe aussi au réel, mais le simulateur ne la calcule qu'en micro-entreprise.",
      "Le versement libératoire est retiré : il n'existe qu'en micro-entreprise ; l'impôt est calculé au barème.",
      `Le revenu fiscal de référence N-2 (${euros(25000)}) est retiré : il ne sert qu'au versement libératoire.`,
      "« Plafonds dépassés l'année précédente » est retiré : il ne concerne que la micro-entreprise.",
      "Gardés : le nom, la pastille, la date de création, les déplacements professionnels, la profession et sa part conventionnée. Toutes les années de la simulation sont converties."
    ])
  })

  it("EI vers micro-entreprise : la nature des prestations est demandée, les charges ne sont plus déduites mais restent", () => {
    const ei = societe("e1", "EI", 0)
    const s = sessionDe([personne("alice"), ei], [relation("alice", "e1", "Titulaire")], [["e1", "ca_services", 30000], ["e1", "deductible_expense", 4000]])
    const bic = examinerLeChangement(s, ei, "micro", reglesDeTest, "bic")
    expect(bic.prestationsAQualifier).toBe(true)
    expect(bic.consequences[0]).toBe(`« CA - Prestation de services » (${euros(30000)}) devient « Prestations artisanales ou commerciales (BIC) ».`)
    expect(bic.consequences[1]).toMatch(/^Les charges déductibles \(4\s000\s€\) ne sont plus déduites : en micro-entreprise, un abattement forfaitaire en tient lieu\. Elles restent saisies/)
    expect(bic.consequences).toContain("ACRE et versement libératoire ne sont pas choisis : réglez-les sur la carte de l'activité.")
    expect(examinerLeChangement(s, ei, "micro", reglesDeTest, "bnc").consequences[0]).toMatch(/devient « Prestations libérales \(BNC\) »/)
  })

  it("SASU vers EI : rémunération, dividendes, réserves et associés retirés, le président devient titulaire", () => {
    const sasu: Company = { ...societe("s1", "SASU", 5000), reservesInitiales: 8000 }
    const s = sessionDe([personne("alice"), personne("bob"), sasu], [relation("alice", "s1", "Président"), relation("bob", "s1", "Associé")], [["s1", "ca_services", 90000], ["s1", "director_remuneration", 30000], ["s1", "dividends_payment", 5000]])
    const { consequences } = examinerLeChangement(s, sasu, "EI", reglesDeTest, "bnc")
    expect(consequences).toEqual([
      `La rémunération du dirigeant (${euros(30000)}) est retirée : une entreprise individuelle n'en verse pas, son bénéfice est le revenu de son titulaire.`,
      `Les dividendes (${euros(5000)}) sont retirés : une entreprise individuelle n'en distribue pas.`,
      `Les réserves au début (${euros(8000)}) sont retirées : une entreprise individuelle n'en a pas, son bénéfice est imposé chaque année chez son titulaire.`,
      "alice : « Président » devient « Titulaire ».",
      "bob n'est plus associé : une entreprise individuelle n'a pas d'associé.",
      expect.stringMatching(/^Gardés :/)
    ])
  })

  it("SASU vers EURL : rémunération et dividendes gardés, le président devient gérant", () => {
    const sasu = societe("s1", "SASU")
    const s = sessionDe([personne("alice"), sasu], [relation("alice", "s1", "Président")], [["s1", "director_remuneration", 30000]])
    const { consequences } = examinerLeChangement(s, sasu, "EURL", reglesDeTest, "bnc")
    expect(consequences).toContain("La rémunération du dirigeant et les dividendes saisis sont gardés ; leurs cotisations suivent le régime du dirigeant en EURL (non salarié).")
    expect(consequences).toContain("alice : « Président » devient « Gérant ».")
  })

  it("micro-entreprise vers SASU : capital par défaut, aucune rémunération, la profession gardée sans effet sur les cotisations", () => {
    const osteo: MicroEntreprise = { ...micro("m1"), profession: "osteopathe" }
    const s = sessionDe([osteo], [], [["m1", "ca_micro_services_bnc", 30000]])
    const { consequences } = examinerLeChangement(s, osteo, "SASU", reglesDeTest, "bnc")
    expect(consequences).toContain("Aucune rémunération du dirigeant n'est saisie : sans elle, le bénéfice reste dans la société, soumis à l'impôt sur les sociétés. Saisissez-la dans la grille ; « Rémunération ou dividendes ? » aide à la choisir.")
    expect(consequences).toContain(`Capital social : ${euros(CAPITAL_SOCIAL_PAR_DEFAUT)} par défaut, à remplacer par le vôtre dans cette fiche.`)
    expect(consequences).toContain("La profession (Ostéopathe) est gardée, sans effet sur les cotisations : le dirigeant, assimilé salarié en SASU, cotise au régime général. Elle sert aux avertissements et à un retour au statut d'indépendant.")
    expect(consequences).toContain("Aucune personne n'en est titulaire ou dirigeante : reliez-en une pour que son revenu rejoigne un foyer.")
  })

  it("un salarié reste salarié d'une micro-entreprise, et le texte dit ce que son coût y change", () => {
    const ei = societe("e1", "EI", 0)
    const s = sessionDe([personne("alice"), personne("bob"), ei], [relation("alice", "e1", "Titulaire"), relation("bob", "e1", "Salarié")], [])
    expect(examinerLeChangement(s, ei, "micro", reglesDeTest, "bnc").consequences).toContain("Les salariés restent : en micro-entreprise, leur coût réduit le net encaissé, mais plus les cotisations ni l'impôt.")
  })

  it("refuse la micro-entreprise à un masseur-kinésithérapeute, sans rien convertir", () => {
    const kine: Company = { ...societe("e1", "EI", 0), profession: "masseur-kinesitherapeute" }
    const examen = examinerLeChangement(sessionDe([kine], [], [["e1", "ca_services", 1000]]), kine, "micro", reglesDeTest, "bnc")
    expect(examen.refus).toMatch(/interdite aux praticiens et auxiliaires médicaux/)
    expect(examen.consequences).toEqual([])
    expect(examen.prestationsAQualifier).toBe(false)
  })
})

describe("appliquerLeChangement", () => {
  it("les libellés laissés par défaut suivent le nouveau type, ceux saisis par l'utilisateur restent", () => {
    const s = sessionDe([personne("alice"), microComplete], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 30000], ["m1", "ca_micro_services_bnc", 1000], ["m1", "expense", 2000]], { 0: "Prestations libérales (BNC)", 1: "Formations", 2: "Charge de l'activité (non déductible en micro)" })
    const { session: apres, activite } = appliquerLeChangement(s, microComplete, "EI", "bnc")
    expect(activite).toMatchObject({ type: "company", legalStatus: "EI" })
    expect(apres.annees[0].monthlyData[0].flows.map(f => f.label)).toEqual(["CA - Prestation de services", "Formations", "Charge déductible"])
  })
})

describe("natureProposee et nomDuStatut", () => {
  it("la nature suit le réglage du comparateur de l'activité, libérale par défaut", () => {
    const s = sessionDe([micro("m1")], [], [])
    expect(natureProposee(s, "m1")).toBe("bnc")
    expect(natureProposee({ ...s, comparateur: { reglagesParActivite: { m1: { partBncPrestations: 0 } } } }, "m1")).toBe("bic")
  })

  it("nomme le statut dans une phrase", () => {
    expect(nomDuStatut("micro")).toBe("micro-entreprise")
    expect(nomDuStatut("EI")).toBe("EI au réel")
  })
})
