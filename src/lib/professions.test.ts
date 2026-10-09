// src/lib/professions.test.ts

import { describe, expect, it } from "vitest"
import { reglesPubliees } from "@/backend/logic/regles"
import { makeCompany, makeMicro } from "@/ui/testing/fixtures"
import { avecLaProfession, estConventionnable, groupesDeProfessions, informationSurLaProfession as informationBrute, proposeLaProfession, reglesDesProfessions } from "./professions"

const regles2026 = reglesPubliees(2026)

/** La ligne, espaces insécables ramenés à des espaces simples. */
const informationSurLaProfession = (...args: Parameters<typeof informationBrute>) => informationBrute(...args).replace(/\s/g, " ")

describe("liste des professions", () => {
  it("santé (CARPIMKO), puis CIPAV, et « Autre profession réglementée » à part", () => {
    const { groupes, autres } = groupesDeProfessions(regles2026)
    expect(groupes.map(g => g.titre)).toEqual(["Santé (CARPIMKO)", "CIPAV"])
    expect(groupes[0].professions.map(p => p.libelle)).toEqual(["Infirmier ou infirmière", "Masseur-kinésithérapeute", "Orthophoniste", "Orthoptiste", "Pédicure-podologue"])
    expect(groupes[1].professions).toHaveLength(21)
    expect(autres).toEqual([{ id: "autre-reglementee", libelle: "Autre profession réglementée" }])
  })

  it("proposée en micro-entreprise, en EI et en EURL, pas en SASU", () => {
    expect(proposeLaProfession(makeMicro())).toBe(true)
    expect(proposeLaProfession(makeCompany({ legalStatus: "EI" }))).toBe(true)
    expect(proposeLaProfession(makeCompany({ legalStatus: "EURL" }))).toBe(true)
    expect(proposeLaProfession(makeCompany({ legalStatus: "SASU" }))).toBe(false)
  })
})

describe("ligne d'information sous la liste", () => {
  it("dit la caisse, la micro-entreprise possible ou non, et les taux de l'année des règles", () => {
    expect(informationSurLaProfession({}, regles2026)).toMatch(/Sécurité sociale des indépendants/)
    expect(informationSurLaProfession({ profession: "psychologue" }, regles2026)).toBe("Caisse : CIPAV. Micro-entreprise possible, au taux de 23,2 % du chiffre d'affaires. Au réel, en 2026 : retraite de base des libéraux (10,6 % jusqu'au plafond de la sécurité sociale), complémentaire de 11 % puis 21 %, invalidité-décès de 0,5 %.")
    expect(informationSurLaProfession({ profession: "orthoptiste" }, regles2026)).toMatch(/^Caisse : CARPIMKO\. Micro-entreprise interdite aux praticiens et auxiliaires médicaux\. En 2026 : .*complémentaire de 8,7 % \(2 091 € au moins\), invalidité-décès de 1 022 €/)
    expect(informationSurLaProfession({ profession: "autre-reglementee" }, regles2026)).toMatch(/^Caisse pas encore prise en compte/)
  })

  it("décrit la complémentaire forfaitaire de la CARPIMKO jusqu'en 2025", () => {
    expect(informationSurLaProfession({ profession: "infirmier" }, reglesPubliees(2025))).toContain("complémentaire de 2 312 € plus 3 % au-delà de 25 246 €")
  })
})

describe("choix d'une profession", () => {
  it("garde la part conventionnée pour une autre profession conventionnable, la retire sinon, et retire tout pour « non réglementée »", () => {
    const kine = makeCompany({ legalStatus: "EI", profession: "masseur-kinesitherapeute", partConventionnee: 0.7 })
    expect(avecLaProfession(kine, "infirmier", regles2026)).toMatchObject({ profession: "infirmier", partConventionnee: 0.7 })
    expect(avecLaProfession(kine, "osteopathe", regles2026)).not.toHaveProperty("partConventionnee")
    const sans = avecLaProfession(kine, "non-reglementee", regles2026)
    expect(sans).not.toHaveProperty("profession")
    expect(sans).not.toHaveProperty("partConventionnee")
    expect(estConventionnable({ profession: "infirmier" }, regles2026)).toBe(true)
    expect(estConventionnable({}, regles2026)).toBe(false)
  })
})

describe("règles des professions d'une année affichée", () => {
  it("celles de l'année, les dernières connues au-delà, les premières connues avant", () => {
    expect(reglesDesProfessions(2025)).toBe(reglesPubliees(2025))
    expect(reglesDesProfessions(2040)).toBe(reglesPubliees(2026))
    expect(reglesDesProfessions(2010)).toBe(reglesPubliees(2024))
  })
})
