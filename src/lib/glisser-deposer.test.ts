// src/lib/glisser-deposer.test.ts

import { describe, expect, it } from "vitest"
import type { Active, Over } from "@dnd-kit/core"
import { annoncesDeTri, consignesDeTri } from "./glisser-deposer"

const actif = (id: string) => ({ id }) as Active
const survole = (id: string) => ({ id }) as Over

describe("annoncesDeTri", () => {
  const annonces = annoncesDeTri([
    { id: "a", nom: "Camille" },
    { id: "b", nom: "Julien" },
    { id: "c", nom: "Conseil SASU" }
  ])

  it("annonce l'élément saisi et sa position", () => {
    expect(annonces.onDragStart({ active: actif("b") })).toBe("« Julien » saisi, position 2 sur 3.")
  })

  it("annonce la position survolée, ou que l'élément a quitté la liste", () => {
    expect(annonces.onDragOver({ active: actif("a"), over: survole("c") })).toBe("« Camille » déplacé en position 3 sur 3.")
    expect(annonces.onDragOver({ active: actif("a"), over: null })).toBe("« Camille » n'est plus au-dessus de la liste.")
  })

  it("annonce le dépôt, ou le retour à sa place", () => {
    expect(annonces.onDragEnd({ active: actif("c"), over: survole("a") })).toBe("« Conseil SASU » déposé en position 1 sur 3.")
    expect(annonces.onDragEnd({ active: actif("c"), over: null })).toBe("« Conseil SASU » déposé à sa place.")
  })

  it("annonce l'annulation, et nomme un élément inconnu par son identifiant", () => {
    expect(annonces.onDragCancel({ active: actif("b"), over: null })).toBe("Déplacement annulé : « Julien » reste en position 2 sur 3.")
    expect(annonces.onDragStart({ active: actif("z") })).toBe("« z » saisi, position 0 sur 3.")
  })
})

describe("consignesDeTri", () => {
  it("explique le déplacement au clavier", () => {
    expect(consignesDeTri.draggable).toMatch(/Espace ou Entrée.*flèches.*Échap/)
  })
})
