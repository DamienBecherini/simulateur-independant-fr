// src/ui/components/ChampProfession.test.tsx
// Fenêtre de réglages d'une activité : profession libérale réglementée et part conventionnée (voir l'ADR 015).

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Entity } from "@/types"
import { makeCompany, makeMicro, makePerson } from "@/ui/testing/fixtures"
import EditEntityModal from "./EditEntityModal"

function ouvrir(entity: Entity, annee = 2026) {
  const onSave = vi.fn()
  render(<EditEntityModal entity={entity} isOpen onClose={() => {}} onSave={onSave} allEntities={[entity]} relationships={[]} annee={annee} />)
  return { onSave, user: userEvent.setup() }
}

async function choisirLaProfession(user: ReturnType<typeof userEvent.setup>, profession: string) {
  await user.click(screen.getByRole("combobox", { name: "Profession" }))
  await user.click(await screen.findByRole("option", { name: profession }))
}

describe("profession d'une activité BNC", () => {
  it("« Non réglementée » en tête et par défaut, puis la santé (CARPIMKO), la CIPAV et « Autre profession réglementée »", async () => {
    const { user } = ouvrir(makeMicro())
    const liste = screen.getByRole("combobox", { name: "Profession" })
    expect(liste).toHaveTextContent("Non réglementée")
    expect(liste).toHaveAccessibleDescription(/Sécurité sociale des indépendants/)

    await user.click(liste)
    const options = (await screen.findAllByRole("option")).map(o => o.textContent)
    expect(options[0]).toBe("Non réglementée")
    expect(options.indexOf("Masseur-kinésithérapeute")).toBeLessThan(options.indexOf("Ostéopathe"))
    expect(options[options.length - 1]).toBe("Autre profession réglementée")
    expect(screen.getByRole("group", { name: "Santé (CARPIMKO)" })).toBeInTheDocument()
    expect(within(screen.getByRole("group", { name: "CIPAV" })).getByRole("option", { name: "Psychologue" })).toBeInTheDocument()
  })

  it("une profession de la CIPAV : micro-entreprise possible à 23,2 %, sans part conventionnée ; enregistrée sur l'activité", async () => {
    const { onSave, user } = ouvrir(makeMicro())
    await choisirLaProfession(user, "Ostéopathe")

    expect(screen.getByRole("combobox", { name: "Profession" })).toHaveAccessibleDescription(/Caisse : CIPAV\. Micro-entreprise possible, au taux de 23,2 %/)
    expect(screen.queryByLabelText("Part conventionnée (%)")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0]).toMatchObject({ profession: "osteopathe" })
  })

  it("un auxiliaire médical : micro-entreprise interdite, part conventionnée à 100 % par défaut, enregistrée en fraction", async () => {
    const { onSave, user } = ouvrir(makeCompany({ legalStatus: "EI" }))
    await choisirLaProfession(user, "Masseur-kinésithérapeute")

    expect(screen.getByRole("combobox", { name: "Profession" })).toHaveAccessibleDescription(/Caisse : CARPIMKO\. Micro-entreprise interdite/)
    const part = screen.getByLabelText("Part conventionnée (%)")
    expect(part).toHaveValue(null)
    expect(part).toHaveAttribute("placeholder", "100")
    expect(part).toHaveAccessibleDescription(/nettes de dépassements d'honoraires/)
    await user.clear(part)
    await user.type(part, "80")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0]).toMatchObject({ profession: "masseur-kinesitherapeute", partConventionnee: 0.8 })
  })

  it("revenir à « Non réglementée » retire la profession et la part conventionnée", async () => {
    const { onSave, user } = ouvrir(makeCompany({ legalStatus: "EURL", profession: "infirmier", partConventionnee: 0.5 }))
    expect(screen.getByLabelText("Part conventionnée (%)")).toHaveValue(50)

    await choisirLaProfession(user, "Non réglementée")
    expect(screen.queryByLabelText("Part conventionnée (%)")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("profession")
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("partConventionnee")
  })

  it("la ligne d'information décrit les règles de l'année affichée, pas celles de l'année en cours", () => {
    // CARPIMKO : complémentaire forfaitaire (2 312 € plus 3 % au-delà de 25 246 €) jusqu'en 2025, 8,70 % en 2026.
    ouvrir(makeCompany({ legalStatus: "EI", profession: "infirmier" }), 2025)
    const description = screen.getByRole("combobox", { name: "Profession" }).getAttribute("aria-describedby")
    const ligne = document.getElementById(description ?? "")?.textContent?.replace(/\s/g, " ")
    expect(ligne).toContain("En 2025 : ")
    expect(ligne).toContain("complémentaire de 2 312 € plus 3 % au-delà de 25 246 €")
  })

  it("une profession de la CIPAV affichée en 2024 : micro-entreprise au taux de 2024", () => {
    ouvrir(makeMicro({ profession: "osteopathe" }), 2024)
    expect(screen.getByRole("combobox", { name: "Profession" })).toHaveAccessibleDescription(/Caisse : CIPAV\. Micro-entreprise possible, au taux de 21,2 %/)
  })

  it("« Autre profession réglementée » : la caisse n'est pas prise en compte, et la ligne le dit", async () => {
    const { user } = ouvrir(makeCompany({ legalStatus: "EI" }))
    await choisirLaProfession(user, "Autre profession réglementée")
    expect(screen.getByRole("combobox", { name: "Profession" })).toHaveAccessibleDescription(/Caisse pas encore prise en compte/)
  })

  it("n'est pas proposée à une SASU", () => {
    ouvrir(makeCompany({ legalStatus: "SASU" }))
    expect(screen.queryByRole("combobox", { name: "Profession" })).not.toBeInTheDocument()
  })

  it("n'est pas proposée à une personne", () => {
    ouvrir(makePerson())
    expect(screen.queryByRole("combobox", { name: "Profession" })).not.toBeInTheDocument()
  })
})
