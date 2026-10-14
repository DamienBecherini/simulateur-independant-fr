// src/lib/montages/adresse.test.ts
// Adresse d'une situation type dans la démo web (#situation=<identifiant>) : lecture du fragment, liens à partager, et
// identifiants publics figés.

import { describe, expect, it } from "vitest"
import { MONTAGES_TYPES } from "./montages"
import { fragmentDeLaSituation, identifiantDeLAdresse, lienVersLaSituation, situationDeLIdentifiant } from "./adresse"

/**
 * Les identifiants publiés dans des liens (articles, pages extérieures). Un renommage doit faire échouer ce test plutôt
 * que casser ces liens : une situation retirée garde sa ligne ici, avec la raison, et le README la signale.
 */
const IDENTIFIANTS_PUBLICS = [
  "micro-bnc-seule",
  "osteopathe-micro",
  "kinesitherapeute-ei",
  "sasu-sans-salaire",
  "sasu-salaire-4-trimestres",
  "eurl-is-remuneration-gerant",
  "salarie-et-micro",
  "micro-et-sasu-du-conjoint",
  "conjoint-salarie-sasu",
  "couple-union-libre"
]

describe("Adresse d'une situation type", () => {
  it("les identifiants publics ne changent pas : chacun désigne toujours sa situation", () => {
    // L'ordre des cartes peut changer ; l'ensemble des identifiants, non (une nouvelle situation s'ajoute à la liste).
    expect(MONTAGES_TYPES.map(montage => montage.id).sort()).toEqual([...IDENTIFIANTS_PUBLICS].sort())
    for (const identifiant of IDENTIFIANTS_PUBLICS) expect(situationDeLIdentifiant(identifiant)?.id).toBe(identifiant)
  })

  it("les identifiants sont uniques et s'écrivent tels quels dans une adresse (minuscules, chiffres, tirets)", () => {
    expect(new Set(IDENTIFIANTS_PUBLICS).size).toBe(IDENTIFIANTS_PUBLICS.length)
    for (const identifiant of IDENTIFIANTS_PUBLICS) {
      expect(identifiant).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(fragmentDeLaSituation(identifiant)).toBe(`#situation=${identifiant}`)
    }
  })

  it("lit l'identifiant dans le fragment #situation=…, avec ou sans dièse, décodé", () => {
    expect(identifiantDeLAdresse("#situation=couple-union-libre")).toBe("couple-union-libre")
    expect(identifiantDeLAdresse("situation=salarie-et-micro")).toBe("salarie-et-micro")
    expect(identifiantDeLAdresse("#situation=caf%C3%A9")).toBe("café")
    // Mal encodé : lu tel quel, il ne désignera aucune situation.
    expect(identifiantDeLAdresse("#situation=%E0%A4%A")).toBe("%E0%A4%A")
    // Vide : c'est bien une adresse de situation, que l'on signalera introuvable.
    expect(identifiantDeLAdresse("#situation=")).toBe("")
  })

  it("ignore les autres adresses : vues, ancres, fenêtres", () => {
    for (const adresse of ["", "#", "#situation", "#resultats", "#bilan", "#mentions-legales", "#donner-mon-avis", "#autre=couple-union-libre"]) expect(identifiantDeLAdresse(adresse), adresse).toBeNull()
  })

  it("ne trouve aucune situation pour un identifiant inconnu", () => {
    expect(situationDeLIdentifiant("inconnue")).toBeNull()
    expect(situationDeLIdentifiant("")).toBeNull()
    // Les identifiants se comparent exactement : ni majuscules, ni nom hérité d'un objet.
    expect(situationDeLIdentifiant("Couple-Union-Libre")).toBeNull()
    expect(situationDeLIdentifiant("toString")).toBeNull()
  })

  it("compose le lien à partager depuis l'adresse de la page, dont il remplace le fragment", () => {
    const demo = "https://damienbecherini.github.io/simulateur-independant-fr/"
    expect(lienVersLaSituation(demo, "couple-union-libre")).toBe(`${demo}#situation=couple-union-libre`)
    expect(lienVersLaSituation(`${demo}#resultats`, "salarie-et-micro")).toBe(`${demo}#situation=salarie-et-micro`)
    expect(lienVersLaSituation(`${demo}?source=article#situation=micro-bnc-seule`, "osteopathe-micro")).toBe(`${demo}?source=article#situation=osteopathe-micro`)
  })
})
