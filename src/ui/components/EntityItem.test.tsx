// src/ui/components/EntityItem.test.tsx

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Entity, Relationship } from "@/types"
import { makeCompany, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { EntityItem } from "./EntityItem"

const alice = makePerson()
const sasu = makeCompany()
const micro = makeMicro()

/** Rend la carte d'une entité ; les rappels sont des espions. */
function renderItem(entity: Entity, { allEntities = [entity] as Entity[], relationships = [] as Relationship[] } = {}) {
  const props = {
    entity,
    allEntities,
    relationships,
    onUpdate: vi.fn<(entity: Entity) => void>(),
    onDelete: vi.fn(),
    onToggleLock: vi.fn(),
    onEdit: vi.fn(),
    onAddRelationship: vi.fn<(relationship: Relationship) => void>(),
    onDeleteRelationship: vi.fn<(relationshipId: string) => void>()
  }
  // `delay: null` enchaîne les frappes sans minuterie : les tests restent rapides.
  const user = userEvent.setup({ delay: null })
  render(<EntityItem {...props} />)
  return { user, ...props }
}

describe("EntityItem : nom modifiable sur place", () => {
  it("renomme avec Entrée et met à jour les initiales d'une personne", async () => {
    const { user, onUpdate } = renderItem(alice)
    const name = screen.getByRole("textbox", { name: "Nom" })

    await user.clear(name)
    await user.type(name, "Bob Durand{Enter}")

    expect(name).not.toHaveFocus()
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith({ ...alice, name: "Bob Durand", avatar: { ...alice.avatar, value: "BD" } })
  })

  it("garde l'icône d'une activité renommée", async () => {
    const { user, onUpdate } = renderItem(sasu)
    const name = screen.getByRole("textbox", { name: "Nom" })

    await user.clear(name)
    await user.type(name, "Conseil SAS{Enter}")

    expect(onUpdate).toHaveBeenCalledWith({ ...sasu, name: "Conseil SAS" })
  })

  it("annule la saisie avec Échap et restaure l'ancien nom", async () => {
    const { user, onUpdate } = renderItem(alice)
    const name = screen.getByRole("textbox", { name: "Nom" })

    await user.clear(name)
    await user.type(name, "Bob Durand{Escape}")

    expect(onUpdate).not.toHaveBeenCalled()
    expect(name).toHaveValue(alice.name)
    expect(name).not.toHaveFocus()
  })

  it("refuse un nom vide et restaure l'ancien", async () => {
    const { user, onUpdate } = renderItem(alice)
    const name = screen.getByRole("textbox", { name: "Nom" })

    await user.clear(name)
    await user.type(name, "   {Enter}")

    expect(name).toHaveValue("Alice Martin")
    expect(onUpdate).not.toHaveBeenCalled()
  })
})

describe("EntityItem : réglages rapides", () => {
  it("enregistre les parts propres d'une personne, virgule acceptée", async () => {
    const { user, onUpdate } = renderItem(alice)
    const parts = screen.getByRole("textbox", { name: "Parts propres" })

    await user.clear(parts)
    await user.type(parts, "1,5{Enter}")

    expect(onUpdate).toHaveBeenCalledWith({ ...alice, fiscalParts: 1.5 })
  })

  it("ignore un nombre de parts nul ou invalide", async () => {
    const { user, onUpdate } = renderItem(alice)
    const parts = screen.getByRole("textbox", { name: "Parts propres" })

    await user.clear(parts)
    await user.type(parts, "0{Enter}")
    await user.clear(parts)
    await user.type(parts, "deux{Enter}")

    expect(onUpdate).not.toHaveBeenCalled()
    expect(parts).toHaveValue("1")
  })

  it("active l'ACRE et le versement libératoire d'une micro-entreprise", async () => {
    const { user, onUpdate } = renderItem(micro)

    expect(screen.queryByRole("textbox", { name: "Parts propres" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("switch", { name: "ACRE" }))
    await user.click(screen.getByRole("switch", { name: "Versement libératoire" }))

    expect(onUpdate).toHaveBeenNthCalledWith(1, { ...micro, beneficieACRE: true })
    expect(onUpdate).toHaveBeenNthCalledWith(2, { ...micro, opteVFL: true })
    expect(screen.queryByText("(retraite réduite)")).not.toBeInTheDocument()
  })

  it("rappelle que l'ACRE réduit les droits à la retraite", () => {
    renderItem({ ...micro, beneficieACRE: true })

    expect(screen.getByText("(retraite réduite)")).toBeInTheDocument()
  })
})

describe("EntityItem : relations", () => {
  it("crée la relation dès le choix de l'entité quand un seul lien est possible", async () => {
    const { user, onAddRelationship } = renderItem(alice, { allEntities: [alice, micro] })

    await user.click(screen.getByRole("button", { name: "Relation" }))
    await user.click(screen.getByRole("combobox", { name: "Avec qui" }))
    await user.click(await screen.findByRole("option", { name: "Mon atelier" }))

    expect(onAddRelationship).toHaveBeenCalledWith({ id: expect.stringMatching(/^rel-/), fromId: alice.id, toId: micro.id, type: "Titulaire" })
    // Le formulaire se referme.
    expect(screen.getByRole("button", { name: "Relation" })).toBeInTheDocument()
  })

  it("demande le lien quand plusieurs sont possibles", async () => {
    const { user, onAddRelationship } = renderItem(alice, { allEntities: [alice, sasu] })

    await user.click(screen.getByRole("button", { name: "Relation" }))
    await user.click(screen.getByRole("combobox", { name: "Avec qui" }))
    await user.click(await screen.findByRole("option", { name: "Ma SASU" }))
    expect(onAddRelationship).not.toHaveBeenCalled()

    await user.click(screen.getByRole("combobox", { name: "Type de relation" }))
    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["Président", "Associé"])
    await user.click(screen.getByRole("option", { name: "Président" }))

    expect(onAddRelationship).toHaveBeenCalledWith(expect.objectContaining({ fromId: alice.id, toId: sasu.id, type: "Président" }))
  })

  it("ne propose pas l'ajout quand aucun lien n'est possible", () => {
    renderItem(sasu, { allEntities: [sasu, micro] })
    expect(screen.queryByRole("button", { name: "Relation" })).not.toBeInTheDocument()
  })

  it("supprime une relation avec sa croix", async () => {
    const relationship: Relationship = { id: "rel-1", fromId: alice.id, toId: micro.id, type: "Titulaire" }
    const { user, onDeleteRelationship } = renderItem(alice, { allEntities: [alice, micro], relationships: [relationship] })

    expect(screen.getByText("Titulaire")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Supprimer la relation avec Mon atelier" }))

    expect(onDeleteRelationship).toHaveBeenCalledWith("rel-1")
  })
})
