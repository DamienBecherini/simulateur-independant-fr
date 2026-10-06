// scripts/identite-store.test.mjs
// Identité du paquet du Microsoft Store : un paquet à publier exige l'identité recopiée de Partner Center ; sans elle,
// seul un paquet d'essai se construit, sous une identité fictive.

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { A_REMPLIR, erreursDeLIdentite, IDENTITE_D_ESSAI, identiteDuPaquet, lireLIdentite } from "./identite-store.mjs"

const remplie = { identityName: "12345Damien.SimulateurIndependantFR", publisher: "CN=0A1B2C3D-0000-1111-2222-333344445555", publisherDisplayName: "Damien Becherini" }

describe("identité du paquet du Microsoft Store", () => {
  it("est, dans le dépôt, encore à remplir ou bien valide", () => {
    const fichier = JSON.parse(readFileSync(new URL("../build/store/identite.json", import.meta.url), "utf-8"))
    const { identite, complete } = lireLIdentite(fichier)
    if (complete) expect(erreursDeLIdentite(identite)).toEqual([])
    else expect(Object.values(identite)).toEqual([A_REMPLIR, `CN=${A_REMPLIR}`, A_REMPLIR])
  })

  it("refuse de construire un paquet à publier sans identité, et donne l'identité d'essai avec --essai", () => {
    const fichier = { identityName: A_REMPLIR, publisher: `CN=${A_REMPLIR}`, publisherDisplayName: A_REMPLIR }
    expect(() => identiteDuPaquet(fichier, {}, { essai: false })).toThrow(/build\/store\/identite.json.*--essai/)
    expect(identiteDuPaquet(fichier, {}, { essai: true })).toEqual({ identite: IDENTITE_D_ESSAI, essai: true })
  })

  it("prend l'identité remplie, même avec --essai", () => {
    expect(identiteDuPaquet({ ...remplie, publisher: " " + remplie.publisher }, {}, { essai: true })).toEqual({ identite: remplie, essai: false })
  })

  it("laisse l'environnement remplacer le fichier", () => {
    const env = { STORE_IDENTITY_NAME: remplie.identityName, STORE_PUBLISHER: remplie.publisher, STORE_PUBLISHER_DISPLAY_NAME: remplie.publisherDisplayName }
    expect(identiteDuPaquet({}, env, { essai: false }).identite).toEqual(remplie)
  })

  it("signale les formats refusés par le manifeste", () => {
    expect(() => identiteDuPaquet({ ...remplie, identityName: "Nom avec espaces", publisher: "Damien" }, {}, { essai: false })).toThrow(/identityName.*\n.*publisher.*CN=/)
  })
})
