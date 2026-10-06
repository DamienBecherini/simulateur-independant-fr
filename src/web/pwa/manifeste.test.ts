// src/web/pwa/manifeste.test.ts

import { describe, expect, it } from "vitest"
import { balisesDeLaDemo, COULEUR_CLAIRE, COULEUR_SOMBRE, fichiersAMettreEnCache, manifesteDeLaDemo } from "./manifeste"

const BASE = "/simulateur-independant-fr/"

describe("manifeste de la démo installable", () => {
  it("décrit la démo en français, ouverte comme une application sous l'adresse de publication", () => {
    const manifeste = manifesteDeLaDemo(BASE)
    expect(manifeste).toMatchObject({ id: BASE, name: "Simulateur indépendant FR", lang: "fr", start_url: BASE, scope: BASE, display: "standalone", theme_color: COULEUR_CLAIRE, background_color: COULEUR_CLAIRE })
    // Au-delà de 12 caractères, le nom court est tronqué sous l'icône.
    expect(manifeste.short_name.length).toBeLessThanOrEqual(12)
  })

  it("donne des icônes de 192 et 512 px, ordinaires et masquables, relatives au manifeste", () => {
    expect(manifesteDeLaDemo(BASE).icons).toEqual([
      { src: "icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "icones/icone-masquable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "icones/icone-masquable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ])
  })

  it("annonce le manifeste, l'icône d'iOS et la couleur de la barre de titre selon le thème", () => {
    expect(balisesDeLaDemo(BASE)).toEqual([
      { tag: "link", attrs: { rel: "manifest", href: `${BASE}manifest.webmanifest` } },
      { tag: "link", attrs: { rel: "apple-touch-icon", href: `${BASE}icones/apple-touch-icon.png` } },
      { tag: "meta", attrs: { name: "theme-color", media: "(prefers-color-scheme: light)", content: COULEUR_CLAIRE } },
      { tag: "meta", attrs: { name: "theme-color", media: "(prefers-color-scheme: dark)", content: COULEUR_SOMBRE } }
    ])
  })
})

describe("fichiers mis en cache pour le hors-ligne", () => {
  it("garde la page, les scripts, les styles, les polices, les icônes et le manifeste, triés, en chemins web", () => {
    expect(fichiersAMettreEnCache(["index.html", "assets\\index-abc.js", "assets/index-abc.css", "assets/inter.woff2", "icones/icone-192.png", "manifest.webmanifest", "favicon.svg"])).toEqual([
      "assets/index-abc.css",
      "assets/index-abc.js",
      "assets/inter.woff2",
      "favicon.svg",
      "icones/icone-192.png",
      "index.html",
      "manifest.webmanifest"
    ])
  })

  it("écarte le service worker, les cartes de sources et le badge des retours", () => {
    expect(fichiersAMettreEnCache(["sw.js", "assets/index-abc.js.map", "retours.json", "index.html"])).toEqual(["index.html"])
  })
})
