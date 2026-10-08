// src/backend/logic/professions.test.ts

import { describe, expect, it } from "vitest"
import type { Company, MicroEntreprise } from "../../types.js"
import { comparerStatuts } from "./comparateur.js"
import { defaultComparisonOptions } from "./options-du-comparateur.js"
import { evaluerProtectionSociale } from "./protection-sociale.js"
import { avertissementsDeLaProfession, caisseDe, microInterdite, partConventionneeDe, PROFESSION_NON_REGLEMENTEE, professionDe, professionDeLActivite, professionsConnues, reglesDeLaMicro, retraiteMicroDeLaProfession } from "./professions.js"
import { reglesEnVigueur } from "./regles.js"
import { runMetaSimulation } from "./simulation-engine.js"
import { micro, personne, relation, session, societe, type Flux } from "./testing/session-de-test.js"

const regles = reglesEnVigueur
const alice = personne("alice")
const profession = (id: string) => professionDe({ profession: id }, regles)!

describe("professions des règles", () => {
  it("connaît chaque profession des règles et le défaut « non réglementée »", () => {
    const connues = professionsConnues()
    expect(connues.has(PROFESSION_NON_REGLEMENTEE)).toBe(true)
    expect(connues.has("masseur-kinesitherapeute")).toBe(true)
    expect(connues.has("astronaute")).toBe(false)
  })

  it("lit la profession, sa caisse et sa part conventionnée ; rien pour une activité non réglementée ou une profession inconnue", () => {
    expect(professionDe({}, regles)).toBeNull()
    expect(professionDe({ profession: PROFESSION_NON_REGLEMENTEE }, regles)).toBeNull()
    expect(professionDe({ profession: "astronaute" }, regles)).toBeNull()
    expect(caisseDe(profession("orthophoniste"))).toBe("CARPIMKO")
    expect(caisseDe(profession("guide-conferencier"))).toBe("CIPAV")
    expect(caisseDe(profession("autre-reglementee"))).toBeNull()
    expect(caisseDe(null)).toBeNull()
    expect(partConventionneeDe({}, profession("infirmier"))).toBe(1)
    expect(partConventionneeDe({ partConventionnee: 0.4 }, profession("infirmier"))).toBe(0.4)
    expect(partConventionneeDe({ partConventionnee: 0.4 }, profession("osteopathe"))).toBe(0)
  })

  it("donne à un micro-entrepreneur de la CIPAV son taux et sa part de retraite de base, et rien aux autres", () => {
    expect(reglesDeLaMicro(regles, profession("osteopathe")).microEntreprise.cotisations.servicesBnc).toBe(0.232)
    expect(reglesDeLaMicro(regles, profession("infirmier"))).toBe(regles)
    expect(reglesDeLaMicro(regles, null)).toBe(regles)
    expect(retraiteMicroDeLaProfession(regles, profession("psychologue"))).toEqual({ partRetraiteDeBase: 0.295, tauxRetraiteDeBase: 0.106 })
    expect(retraiteMicroDeLaProfession(regles, profession("autre-reglementee"))).toBeUndefined()
    expect(professionDeLActivite(profession("osteopathe"), regles, true)).toEqual({ id: "osteopathe", libelle: "Ostéopathe", caisse: "CIPAV", tauxMicro: 0.232 })
    expect(professionDeLActivite(profession("osteopathe"), regles, false)).toEqual({ id: "osteopathe", libelle: "Ostéopathe", caisse: "CIPAV" })
    expect(professionDeLActivite(null, regles, true)).toBeUndefined()
  })

  it("interdit la micro-entreprise aux praticiens et auxiliaires médicaux seulement", () => {
    expect(microInterdite(profession("pedicure-podologue"))).toBe(true)
    expect(microInterdite(profession("ergotherapeute"))).toBe(false)
    expect(microInterdite(null)).toBe(false)
  })
})

describe("avertissements de la profession", () => {
  it("rien sans profession ; « autre profession réglementée » : caisse pas encore prise en compte, dans tous les statuts", () => {
    expect(avertissementsDeLaProfession(null, "EI")).toEqual([])
    expect(avertissementsDeLaProfession(profession("autre-reglementee"), "micro")).toEqual([expect.stringContaining("n'est pas encore prise en compte")])
  })

  it("société d'exercice libéral en SASU et en EURL, pour les professions concernées seulement", () => {
    expect(avertissementsDeLaProfession(profession("psychologue"), "SASU")).toEqual([expect.stringMatching(/^Psychologue en SASU : cette profession exerce en principe en société d'exercice libéral/)])
    expect(avertissementsDeLaProfession(profession("infirmier"), "EURL")[0]).toContain("Les cotisations du gérant sont calculées avec celles de sa caisse")
    expect(avertissementsDeLaProfession(profession("psychologue"), "EI")).toEqual([])
    expect(avertissementsDeLaProfession(profession("ingenieur-conseil"), "SASU")).toEqual([])
  })
})

describe("moteur : la profession dans chaque statut", () => {
  const titulaire = (id: string) => [relation("alice", id, "Titulaire")]

  it("gérant d'EURL kinésithérapeute : cotisations de la CARPIMKO et avertissement sur les sociétés d'exercice libéral", () => {
    const eurl: Company = { ...societe("c1", "EURL", 1000), profession: "masseur-kinesitherapeute" }
    const flux: Flux[] = [["c1", "ca_services", 80000], ["c1", "director_remuneration", 30000]]
    const resultat = runMetaSimulation(session([alice, eurl], [relation("alice", "c1", "Gérant")], flux)).activities[0]
    expect(resultat.cotisationsTNS?.caisse).toMatchObject({ caisse: "CARPIMKO", profession: "masseur-kinesitherapeute" })
    expect(resultat.cotisationsTNS?.cotisations.invaliditeDeces).toBe(1022)
    expect(resultat.profession).toEqual({ id: "masseur-kinesitherapeute", libelle: "Masseur-kinésithérapeute", caisse: "CARPIMKO" })
    expect(resultat.warnings).toContainEqual(expect.stringContaining("société d'exercice libéral"))
  })

  it("président de SASU ostéopathe : régime général inchangé, avec l'avertissement", () => {
    const sasu: Company = { ...societe("c1", "SASU", 1000), profession: "osteopathe" }
    const resultat = runMetaSimulation(session([alice, sasu], [relation("alice", "c1", "Président")], [["c1", "ca_services", 80000], ["c1", "director_remuneration", 30000]])).activities[0]
    expect(resultat.cotisationsPresident).toBeDefined()
    expect(resultat.warnings).toContainEqual(expect.stringContaining("Ostéopathe en SASU"))
  })

  it("« autre profession réglementée » en EI : calcul des indépendants, avec l'avertissement", () => {
    const ei: Company = { ...societe("e1", "EI", 0), profession: "autre-reglementee" }
    const sans = runMetaSimulation(session([alice, societe("e1", "EI", 0)], titulaire("e1"), [["e1", "ca_services", 50000]])).activities[0]
    const avec = runMetaSimulation(session([alice, ei], titulaire("e1"), [["e1", "ca_services", 50000]])).activities[0]
    expect(avec.cotisationsSociales).toBe(sans.cotisationsSociales)
    expect(avec.cotisationsTNS?.caisse).toBeUndefined()
    expect(avec.profession).toEqual({ id: "autre-reglementee", libelle: "Autre profession réglementée", caisse: null })
    expect(avec.warnings).toContainEqual(expect.stringContaining("pas encore prise en compte"))
  })

  it("micro-entreprise de la CIPAV avec l'ACRE : la réduction porte sur son taux de 23,2 %", () => {
    const m: MicroEntreprise = { ...micro("m1", { beneficieACRE: true }), profession: "psychologue" }
    const resultat = runMetaSimulation(session([alice, m], titulaire("m1"), [["m1", "ca_micro_services_bnc", 20000]])).activities[0]
    // 20 000 x 23,2 % x 50 % = 2 320 €, plus 40 € de formation professionnelle.
    expect(resultat.cotisationsSociales).toBe(2360)
  })

  it("le comparateur garde la profession dans chaque colonne : caisse en EI et en EURL, taux de la CIPAV en micro, avertissement en SASU", () => {
    const ei: Company = { ...societe("e1", "EI", 0), profession: "osteopathe" }
    const donnees = session([alice, ei], titulaire("e1"), [["e1", "ca_services", 40000]])
    const { scenarios } = comparerStatuts(donnees, { ...defaultComparisonOptions(donnees, "e1"), partBncPrestations: 1 })
    const colonne = (statut: string) => scenarios.find(s => s.statut === statut)!
    expect(colonne("SASU").warnings).toContainEqual(expect.stringContaining("Ostéopathe en SASU"))
    expect(colonne("EURL").warnings).toContainEqual(expect.stringContaining("Ostéopathe en EURL"))
    expect(colonne("EI").protectionSociale.resume).toMatch(/^Profession libérale de la CIPAV/)
    expect(colonne("micro").protectionSociale.resume).toMatch(/^Profession libérale de la CIPAV/)
    expect(colonne("micro").cotisationsSociales).toBe(9360)
  })
})

describe("protection sociale selon la caisse", () => {
  it("décrit la couverture de la CARPIMKO et compte les trimestres sur l'assiette minimale de la CNAVPL", () => {
    const protection = evaluerProtectionSociale("EI", { remunerationBrute: 0, assietteTNS: 2000, chiffreAffairesMicro: { caVente: 0, caServicesBic: 0, caServicesBnc: 0 }, caisse: "CARPIMKO" }, regles)
    expect(protection.trimestres).toBe(3)
    expect(protection.resume).toMatch(/^Auxiliaire médical de la CARPIMKO/)
  })
})
