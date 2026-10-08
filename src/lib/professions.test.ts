// src/lib/professions.test.ts

import { describe, expect, it } from "vitest"
import { reglesDeLAnnee } from "@/backend/logic/regles"
import { makeCompany, makeMicro } from "@/ui/testing/fixtures"
import { avecLaProfession, estConventionnable, groupesDeProfessions, informationSurLaProfession as informationBrute, proposeLaProfession } from "./professions"

/** La ligne, espaces insécables ramenés à des espaces simples. */
const informationSurLaProfession = (...args: Parameters<typeof informationBrute>) => informationBrute(...args).replace(/\s/g, " ")

describe("liste des professions", () => {
  it("santé (CARPIMKO), puis CIPAV, et « Autre profession réglementée » à part", () => {
    const { groupes, autres } = groupesDeProfessions()
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
    expect(informationSurLaProfession({})).toMatch(/Sécurité sociale des indépendants/)
    expect(informationSurLaProfession({ profession: "psychologue" })).toBe("Caisse : CIPAV. Micro-entreprise possible, au taux de 23,2 % du chiffre d'affaires. Au réel, en 2026 : retraite de base des libéraux (10,6 % jusqu'au plafond de la sécurité sociale), complémentaire de 11 % puis 21 %, invalidité-décès de 0,5 %.")
    expect(informationSurLaProfession({ profession: "orthoptiste" })).toMatch(/^Caisse : CARPIMKO\. Micro-entreprise interdite aux praticiens et auxiliaires médicaux\. En 2026 : .*complémentaire de 8,7 % \(2 091 € au moins\), invalidité-décès de 1 022 €/)
    expect(informationSurLaProfession({ profession: "autre-reglementee" })).toMatch(/^Caisse pas encore prise en compte/)
  })

  it("décrit la complémentaire forfaitaire de la CARPIMKO jusqu'en 2025", () => {
    expect(informationSurLaProfession({ profession: "infirmier" }, reglesDeLAnnee(2025).regles!)).toContain("complémentaire de 2 312 € plus 3 % au-delà de 25 246 €")
  })
})

describe("choix d'une profession", () => {
  it("garde la part conventionnée pour une autre profession conventionnable, la retire sinon, et retire tout pour « non réglementée »", () => {
    const kine = makeCompany({ legalStatus: "EI", profession: "masseur-kinesitherapeute", partConventionnee: 0.7 })
    expect(avecLaProfession(kine, "infirmier")).toMatchObject({ profession: "infirmier", partConventionnee: 0.7 })
    expect(avecLaProfession(kine, "osteopathe")).not.toHaveProperty("partConventionnee")
    const sans = avecLaProfession(kine, "non-reglementee")
    expect(sans).not.toHaveProperty("profession")
    expect(sans).not.toHaveProperty("partConventionnee")
    expect(estConventionnable({ profession: "infirmier" })).toBe(true)
    expect(estConventionnable({})).toBe(false)
  })
})
