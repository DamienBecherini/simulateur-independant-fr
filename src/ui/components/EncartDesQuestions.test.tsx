// src/ui/components/EncartDesQuestions.test.tsx
// L'encart « Que voulez-vous savoir ? » : une question charge sa situation type, avec la même confirmation que la
// fenêtre des situations types ; une question sans situation mène à sa section ; « Partir de zéro » et la fermeture.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { MONTAGES_TYPES } from "@/lib/montages/montages"
import { ID_DE_L_AJOUT_D_UNE_PERSONNE, QUESTIONS_DE_DEPART } from "@/lib/questions-de-depart"
import { EncartDesQuestions } from "./EncartDesQuestions"

const montage = (id: string) => MONTAGES_TYPES.find(m => m.id === id)

function afficher(confirmationNecessaire = false) {
  const actions = { onCharger: vi.fn(), onPartirDeZero: vi.fn(), onFermer: vi.fn() }
  const user = userEvent.setup({ delay: null })
  render(
    <>
      <EncartDesQuestions {...actions} confirmationNecessaire={confirmationNecessaire} nomDeLaSession="Famille Martin" />
      <button id={ID_DE_L_AJOUT_D_UNE_PERSONNE}>+ Ajouter une personne</button>
    </>
  )
  return { user, ...actions }
}

const encart = () => screen.getByRole("region", { name: "Que voulez-vous savoir ?" })

describe("encart « Que voulez-vous savoir ? »", () => {
  it("s'annonce par un titre et propose chaque question, puis « Partir de zéro », chacune décrite", () => {
    afficher()
    expect(within(encart()).getByRole("heading", { level: 2, name: "Que voulez-vous savoir ?" })).toBeInTheDocument()
    expect(within(encart()).getAllByRole("listitem")).toHaveLength(QUESTIONS_DE_DEPART.length + 1)
    expect(screen.getByRole("button", { name: "Combien me restera-t-il ?" })).toHaveAccessibleDescription("Une micro-entreprise seule : le net après cotisations et impôt.")
    for (const nom of ["Société ou micro-entreprise ?", "Mariage ou Pacs ?", "Rémunération ou dividendes ?", "Partir de zéro"]) expect(screen.getByRole("button", { name: nom })).toBeInTheDocument()
  })

  it("chaque question désigne la situation type qui y répond", () => {
    const situations = QUESTIONS_DE_DEPART.flatMap(q => ("montage" in q ? [[q.question, q.montage.id]] : []))
    expect(situations).toEqual([
      ["Combien me restera-t-il ?", "micro-bnc-seule"],
      ["Société ou micro-entreprise ?", "micro-bnc-seule"],
      ["Mariage ou Pacs ?", "couple-union-libre"],
      ["Rémunération ou dividendes ?", "sasu-salaire-4-trimestres"],
      ["Mes cotisations sont-elles justes ?", "kinesitherapeute-ei"]
    ])
    for (const [, id] of situations) expect(montage(id)).toBeDefined()
  })

  it("charge la situation type d'une question sans confirmation quand rien n'est perdu", async () => {
    const { user, onCharger } = afficher()
    await user.click(screen.getByRole("button", { name: "Mariage ou Pacs ?" }))
    expect(onCharger).toHaveBeenCalledWith(montage("couple-union-libre"))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("demande la même confirmation que la fenêtre des situations types ; « Annuler » ne charge rien et rend le focus", async () => {
    const { user, onCharger } = afficher(true)
    const question = screen.getByRole("button", { name: "Rémunération ou dividendes ?" })
    await user.click(question)
    const confirmation = screen.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })
    expect(confirmation).toHaveTextContent("« Famille Martin » n'est pas enregistrée dans une sauvegarde. La situation « SASU avec un salaire qui valide 4 trimestres » la remplacera")

    await user.click(within(confirmation).getByRole("button", { name: "Annuler" }))
    expect(onCharger).not.toHaveBeenCalled()
    expect(question).toHaveFocus()

    await user.click(question)
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remplacer" }))
    expect(onCharger).toHaveBeenCalledWith(montage("sasu-salaire-4-trimestres"))
  })

  it("charge le kinésithérapeute au réel pour « Mes cotisations sont-elles justes ? », décrit par le détail de ses cotisations", async () => {
    const { user, onCharger } = afficher()
    const question = screen.getByRole("button", { name: "Mes cotisations sont-elles justes ?" })
    expect(question).toHaveAccessibleDescription("Un kinésithérapeute au réel : chaque cotisation, avec son assiette et son taux.")
    await user.click(question)
    expect(onCharger).toHaveBeenCalledWith(montage("kinesitherapeute-ei"))
  })

  it("« Partir de zéro » sur une simulation vide : rien à confirmer, le focus va à l'ajout d'une personne", async () => {
    const { user, onPartirDeZero } = afficher()
    await user.click(screen.getByRole("button", { name: "Partir de zéro" }))
    expect(onPartirDeZero).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "+ Ajouter une personne" })).toHaveFocus())
  })

  it("« Partir de zéro » sur l'exemple : confirmation, puis simulation vierge et focus sur l'ajout d'une personne", async () => {
    const { user, onPartirDeZero } = afficher(true)
    await user.click(screen.getByRole("button", { name: "Partir de zéro" }))
    const confirmation = screen.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })
    expect(confirmation).toHaveTextContent("Une simulation vierge la remplacera")
    expect(onPartirDeZero).not.toHaveBeenCalled()

    await user.click(within(confirmation).getByRole("button", { name: "Remplacer" }))
    expect(onPartirDeZero).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "+ Ajouter une personne" })).toHaveFocus())
  })

  it("se ferme par son bouton, au clavier", async () => {
    const { user, onFermer } = afficher()
    screen.getByRole("button", { name: "Fermer « Que voulez-vous savoir ? »" }).focus()
    await user.keyboard("{Enter}")
    expect(onFermer).toHaveBeenCalledOnce()
  })
})
