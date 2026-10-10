// src/lib/limites-du-modele.test.ts

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { LIMITES } from "./limites-du-modele"

/** Les puces de la section « Limites connues » du README, jusqu'à la section suivante. */
function limitesDuReadme(): string[] {
  const readme = readFileSync("README.md", "utf-8").replace(/\r\n/g, "\n")
  const section = readme.split(/^## /m).find(s => s.includes("Limites connues"))
  if (!section) throw new Error("Section « Limites connues » absente du README")
  return section
    .split("\n")
    .filter(ligne => ligne.startsWith("- "))
    .map(ligne => ligne.slice(2))
}

describe("hypothèses et limites", () => {
  it("le README recopie la liste de l'application, mot pour mot et dans le même ordre", () => {
    expect(limitesDuReadme()).toEqual(LIMITES)
  })

  it("la liste dit ce que les utilisateurs cherchent : appel provisionnel, prévoyance, crédits d'impôt, autres caisses", () => {
    const texte = LIMITES.join(" ")
    for (const sujet of ["acomptes provisionnels", "régularisation", "prévoyance", "crédits d'impôt", "CARMF"]) expect(texte).toContain(sujet)
  })

  it("ne cite aucun chiffre des règles, qui changent chaque année", () => {
    for (const limite of LIMITES) expect(limite).not.toMatch(/\d/)
  })
})
