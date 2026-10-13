// src/ui/components/GrilleDeLAnnee.test.tsx
// La grille de l'année affichée et son sélecteur d'année : changer, ajouter ou supprimer une année modifie la session
// par une seule mise à jour, et l'année ajoutée est affichée.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { anneesDeLaSession, donneesDeLAnnee } from "@/backend/logic/annees"
import type { SessionState } from "@/types"
import { emptySession, makePerson } from "@/ui/testing/fixtures"
import { GrilleDeLAnnee } from "./GrilleDeLAnnee"

function afficher() {
  const session: SessionState = { ...emptySession(), entities: [makePerson()] }
  const annee = anneesDeLaSession(session)[0]
  const rappels = { setSession: vi.fn(), onAnnee: vi.fn() }
  render(<GrilleDeLAnnee session={session} annee={annee} monthlyData={donneesDeLAnnee(session, annee).monthlyData} preferences={{ slotOrder: [] }} flowTypeToNumberMap={new Map()} {...rappels} />)
  /** La session après la dernière mise à jour demandée. */
  const apres = () => {
    const miseAJour = rappels.setSession.mock.lastCall![0] as (prev: SessionState) => SessionState
    return miseAJour(session)
  }
  return { user: userEvent.setup(), annee, apres, ...rappels }
}

describe("GrilleDeLAnnee", () => {
  it("ajoute l'année suivante à la session et l'affiche aussitôt", async () => {
    const { user, annee, apres, onAnnee } = afficher()
    await user.click(screen.getByRole("button", { name: "Ajouter une année" }))
    await user.click(within(screen.getByRole("dialog", { name: "Ajouter une année" })).getByRole("button", { name: `Ajouter ${annee + 1}` }))

    expect(onAnnee).toHaveBeenCalledWith(annee + 1)
    expect(anneesDeLaSession(apres())).toEqual([annee, annee + 1])
  })
})
