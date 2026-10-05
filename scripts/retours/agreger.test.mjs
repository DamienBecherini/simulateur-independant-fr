// scripts/retours/agreger.test.mjs

import { describe, expect, it } from "vitest"
import { agregerFichier, lireTickets, produireRetoursJson, SORTIE_PAR_DEFAUT } from "./agreger.mjs"

const MAINTENANT = new Date("2026-10-05T08:00:00.000Z")
const TICKETS = JSON.stringify([
  { body: "### Note\n\n★★★★★ 5/5\n\n### Affichage préféré\n\nRésumé", labels: [{ name: "retour" }] },
  { body: "### Note\n\n★★★★☆ 4/5\n\n### Affichage préféré\n\nSans préférence", labels: [] }
])

// Entrées et sorties factices : un fichier par chemin, 0 pour l'entrée standard.
function systemeDeFichiers(fichiers) {
  const ecrits = new Map()
  return {
    ecrits,
    lire: (chemin) => {
      if (!(chemin in fichiers)) throw new Error(`ENOENT ${chemin}`)
      return fichiers[chemin]
    },
    ecrire: (chemin, contenu) => ecrits.set(chemin, contenu),
    maintenant: MAINTENANT
  }
}

describe("lireTickets", () => {
  it("lit un tableau JSON", () => {
    expect(lireTickets(TICKETS)).toHaveLength(2)
    expect(lireTickets(`\uFEFF${TICKETS}`)).toHaveLength(2)
  })

  it("renvoie un tableau vide pour un texte vide, invalide ou qui n'est pas un tableau", () => {
    expect(lireTickets("")).toEqual([])
    expect(lireTickets("HTTP 401: Bad credentials")).toEqual([])
    expect(lireTickets('{"message":"Not Found"}')).toEqual([])
  })
})

describe("produireRetoursJson", () => {
  it("écrit l'agrégat en JSON indenté, terminé par un saut de ligne", () => {
    const texte = produireRetoursJson(TICKETS, MAINTENANT)
    expect(texte.endsWith("}\n")).toBe(true)
    expect(JSON.parse(texte)).toEqual({
      nombreDeNotes: 2,
      moyenne: 4.5,
      preferencesAffichage: { resume: 1, classique: 0, vues: 0 },
      resume: "4,5/5 (2 notes)",
      misAJour: "2026-10-05T08:00:00.000Z"
    })
  })

  it("écrit un agrégat vide pour une entrée invalide", () => {
    expect(JSON.parse(produireRetoursJson("erreur", MAINTENANT))).toMatchObject({ nombreDeNotes: 0, moyenne: null })
  })
})

describe("agregerFichier", () => {
  it("lit l'entrée standard et écrit public/retours.json par défaut", () => {
    const es = systemeDeFichiers({ 0: TICKETS })
    expect(agregerFichier([], es)).toBe(SORTIE_PAR_DEFAUT)
    expect(SORTIE_PAR_DEFAUT).toBe("public/retours.json")
    expect(JSON.parse(es.ecrits.get(SORTIE_PAR_DEFAUT)).nombreDeNotes).toBe(2)
  })

  it("lit et écrit les fichiers demandés ; « - » désigne l'entrée standard", () => {
    const es = systemeDeFichiers({ "bruts.json": TICKETS, 0: "[]" })
    agregerFichier(["bruts.json", "sortie/retours.json"], es)
    agregerFichier(["-", "vide.json"], es)
    expect(JSON.parse(es.ecrits.get("sortie/retours.json")).moyenne).toBe(4.5)
    expect(JSON.parse(es.ecrits.get("vide.json")).resume).toBe("pas encore de note")
  })

  it("écrit un agrégat vide quand l'entrée est illisible", () => {
    const es = systemeDeFichiers({})
    agregerFichier(["absent.json", "retours.json"], es)
    expect(JSON.parse(es.ecrits.get("retours.json"))).toMatchObject({ nombreDeNotes: 0, moyenne: null })
  })

  it("date l'agrégat de l'instant présent par défaut", () => {
    const { lire, ecrire, ecrits } = systemeDeFichiers({ 0: "[]" })
    agregerFichier([], { lire, ecrire })
    expect(Date.parse(JSON.parse(ecrits.get(SORTIE_PAR_DEFAUT)).misAJour)).not.toBeNaN()
  })
})
