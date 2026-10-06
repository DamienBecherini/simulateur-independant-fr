// src/lib/mentions-legales.test.ts

import { readFileSync, writeFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { ADRESSE_E_MAIL_DES_RETOURS, DEPOT_GITHUB } from "./adresses-des-retours"
import { ADRESSE_DE_LA_LICENCE, DATE_DE_MISE_A_JOUR, RUBRIQUES, TITRE_DES_MENTIONS_LEGALES, estUnLienExterne, mentionsLegalesEnMarkdown, type Lien, type Morceau } from "./mentions-legales"

const FICHIER = "documentation/mentions-legales.md"

const morceaux = (): Morceau[] => RUBRIQUES.flatMap(r => r.blocs.flatMap(b => ("paragraphe" in b ? b.paragraphe : b.liste.flat())))
const liens = (): Lien[] => morceaux().filter((m): m is Lien => typeof m === "object" && "adresse" in m)

describe("mentions légales et confidentialité", () => {
  it("a les rubriques attendues, dans l'ordre", () => {
    expect(RUBRIQUES.map(r => r.titre)).toEqual(["Éditeur", "Hébergement", "Données personnelles et confidentialité", "Cookies et traceurs", "Avertissement", "Licence et code source", "Mise à jour"])
  })

  it("prend l'adresse de contact et le dépôt dans les constantes partagées", () => {
    expect(liens()).toContainEqual({ texte: ADRESSE_E_MAIL_DES_RETOURS, adresse: `mailto:${ADRESSE_E_MAIL_DES_RETOURS}` })
    expect(liens().map(l => l.adresse)).toContain(DEPOT_GITHUB)
    expect(ADRESSE_DE_LA_LICENCE.startsWith(DEPOT_GITHUB)).toBe(true)
    // Aucune autre copie de ces adresses dans le texte.
    const texte = morceaux().filter((m): m is string => typeof m === "string").join(" ")
    expect(texte).not.toContain("@")
    expect(texte).not.toContain("github.com/")
  })

  it("n'a que des liens sûrs : https, ou l'e-mail de contact", () => {
    for (const lien of liens()) expect(estUnLienExterne(lien.adresse) || lien.adresse === `mailto:${ADRESSE_E_MAIL_DES_RETOURS}`).toBe(true)
    expect(estUnLienExterne("mailto:x@y.fr")).toBe(false)
  })

  it("écrit le Markdown : titres, liens, listes et noms de dossiers", () => {
    const markdown = mentionsLegalesEnMarkdown()
    expect(markdown.startsWith(`# ${TITRE_DES_MENTIONS_LEGALES}\n\n`)).toBe(true)
    expect(markdown).toContain("\n## Hébergement\n")
    expect(markdown).toContain(`[licence MIT](${ADRESSE_DE_LA_LICENCE})`)
    expect(markdown).toContain("- dans la démo web,")
    expect(markdown).toContain("`%APPDATA%\\simulateur-independant-fr`")
    expect(markdown).toContain(DATE_DE_MISE_A_JOUR)
    expect(markdown.endsWith(".\n")).toBe(true)
  })

  // `npm run mentions-legales` réécrit le fichier depuis le texte de l'application.
  it(`${FICHIER} suit le texte de l'application`, () => {
    if (process.env.ECRIRE_MENTIONS_LEGALES === "1") writeFileSync(FICHIER, mentionsLegalesEnMarkdown().replace(/\n/g, "\r\n"), "utf-8")
    expect(readFileSync(FICHIER, "utf-8").replace(/\r\n/g, "\n")).toBe(mentionsLegalesEnMarkdown())
  })
})
