// src/web/pwa/strategie.test.ts

import { describe, expect, it } from "vitest"
import { cachesPerimes, nomDuCache, strategiePour } from "./strategie"

const PORTEE = "https://damienbecherini.github.io/simulateur-independant-fr/"
const EN_CACHE = new Set(["index.html", "assets/index-abc.js", "icones/icone-192.png"])
const requete = (chemin: string, mode = "no-cors", method = "GET") => ({ url: `${PORTEE}${chemin}`, mode, method })

describe("cache du service worker", () => {
  it("nomme un cache par version, et efface ceux des versions précédentes seulement", () => {
    const actuel = nomDuCache("b2")
    expect(actuel).toBe("simulateur-demo-b2")
    expect(cachesPerimes([nomDuCache("a1"), actuel, "autre-site", nomDuCache("a0")], actuel)).toEqual([nomDuCache("a1"), nomDuCache("a0")])
  })
})

describe("réponse à une requête", () => {
  it("sert depuis le cache un fichier de la démo, quels que soient ses paramètres", () => {
    expect(strategiePour(requete("assets/index-abc.js"), PORTEE, EN_CACHE)).toEqual({ type: "cache", chemin: "assets/index-abc.js" })
    expect(strategiePour(requete("icones/icone-192.png?v=2#a"), PORTEE, EN_CACHE)).toEqual({ type: "cache", chemin: "icones/icone-192.png" })
    expect(strategiePour(requete("index.html", "navigate"), PORTEE, EN_CACHE)).toEqual({ type: "cache", chemin: "index.html" })
  })

  it("répond à l'ouverture de toute adresse de la démo par la page de l'application", () => {
    expect(strategiePour(requete("", "navigate"), PORTEE, EN_CACHE)).toEqual({ type: "page", chemin: "index.html" })
    expect(strategiePour(requete("?source=pwa", "navigate"), PORTEE, EN_CACHE)).toEqual({ type: "page", chemin: "index.html" })
    expect(strategiePour(requete("", "navigate"), PORTEE, new Set())).toEqual({ type: "reseau" })
  })

  it("laisse au réseau les autres sites, les autres méthodes et les fichiers hors du cache", () => {
    expect(strategiePour({ url: "https://github.com/DamienBecherini", mode: "navigate", method: "GET" }, PORTEE, EN_CACHE)).toEqual({ type: "reseau" })
    expect(strategiePour({ url: "https://damienbecherini.github.io/autre-projet/", mode: "navigate", method: "GET" }, PORTEE, EN_CACHE)).toEqual({ type: "reseau" })
    expect(strategiePour(requete("assets/index-abc.js", "cors", "POST"), PORTEE, EN_CACHE)).toEqual({ type: "reseau" })
    expect(strategiePour(requete("retours.json", "cors"), PORTEE, EN_CACHE)).toEqual({ type: "reseau" })
  })
})
