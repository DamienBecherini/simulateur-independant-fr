// src/lib/vues.test.ts

import { describe, expect, it } from "vitest"
import { VUES, VUE_PAR_DEFAUT, destinationDeLAdresse, libelleDeLaVue, titreDeLaFenetre, vueVoisine } from "./vues"

const aucunElement = () => null

describe("vues de l'affichage « Trois vues »", () => {
  it("propose trois vues dans l'ordre de la page : ma situation, mes résultats, comparer et optimiser", () => {
    expect(VUES.map(v => [v.valeur, v.libelle, v.libelleCourt])).toEqual([
      ["situation", "Ma situation", "Situation"],
      ["resultats", "Mes résultats", "Résultats"],
      ["comparer", "Comparer et optimiser", "Comparer"]
    ])
    expect(VUE_PAR_DEFAUT).toBe("situation")
    // Le nom court reprend un mot du nom : l'onglet garde un nom cohérent d'une largeur d'écran à l'autre.
    for (const v of VUES) expect(v.libelle.toLowerCase()).toContain(v.libelleCourt.toLowerCase())
  })

  it("lit la vue dans l'adresse", () => {
    expect(destinationDeLAdresse("#situation", aucunElement)).toEqual({ vue: "situation" })
    expect(destinationDeLAdresse("#resultats", aucunElement)).toEqual({ vue: "resultats" })
    expect(destinationDeLAdresse("comparer", aucunElement)).toEqual({ vue: "comparer" })
  })

  it("laisse la vue affichée sous les mentions légales, qui ont leur propre adresse", () => {
    expect(destinationDeLAdresse("#mentions-legales", () => "resultats")).toBeNull()
    expect(destinationDeLAdresse("#donner-mon-avis", () => "resultats")).toBeNull()
  })

  it("mène les liens de la barre de résumé à leur vue, même avant que le détail soit affiché", () => {
    expect(destinationDeLAdresse("#bilan", aucunElement)).toEqual({ vue: "resultats", detail: "bilan" })
    expect(destinationDeLAdresse("#resultats-titre", aucunElement)).toEqual({ vue: "resultats", detail: "resultats-titre" })
    expect(destinationDeLAdresse("#comparateur-verdict", aucunElement)).toEqual({ vue: "comparer", detail: "comparateur-verdict" })
  })

  it("trouve la vue de tout autre élément de la page, et ignore ce qui n'est dans aucune vue", () => {
    const vueDeLElement = (id: string) => (id === "note-comparateur-1" ? "comparer" : null)
    expect(destinationDeLAdresse("#note-comparateur-1", vueDeLElement)).toEqual({ vue: "comparer", detail: "note-comparateur-1" })
    expect(destinationDeLAdresse("#contenu", vueDeLElement)).toBeNull()
    expect(destinationDeLAdresse("", vueDeLElement)).toBeNull()
    expect(destinationDeLAdresse("#", vueDeLElement)).toBeNull()
  })

  it("lit une adresse encodée, et une adresse mal encodée telle quelle", () => {
    expect(destinationDeLAdresse("#r%C3%A9sultats", aucunElement)).toBeNull()
    expect(destinationDeLAdresse("#%72esultats", aucunElement)).toEqual({ vue: "resultats" })
    expect(destinationDeLAdresse("#%E0%A4%A", aucunElement)).toBeNull()
  })

  it("nomme la fenêtre d'après la vue puis la simulation", () => {
    expect(titreDeLaFenetre("resultats", "Famille Martin")).toBe("Mes résultats — Famille Martin")
    expect(libelleDeLaVue("comparer")).toBe("Comparer et optimiser")
  })

  it("passe d'un onglet à l'autre avec les flèches, en boucle, et va au premier ou au dernier avec Début et Fin", () => {
    expect(vueVoisine("situation", "ArrowRight")).toBe("resultats")
    expect(vueVoisine("comparer", "ArrowRight")).toBe("situation")
    expect(vueVoisine("situation", "ArrowLeft")).toBe("comparer")
    expect(vueVoisine("resultats", "ArrowLeft")).toBe("situation")
    expect(vueVoisine("resultats", "Home")).toBe("situation")
    expect(vueVoisine("resultats", "End")).toBe("comparer")
    expect(vueVoisine("resultats", "ArrowDown")).toBeNull()
    expect(vueVoisine("resultats", "Enter")).toBeNull()
  })
})
