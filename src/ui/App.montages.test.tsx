// src/ui/App.montages.test.tsx
// Montages types dans l'application entière : chargés depuis les paramètres ou depuis une simulation vide, ils
// remplacent la session comme une sauvegarde chargée (nouvel historique) et la page remonte en haut.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { SessionState } from "@/types"
import { emptySession, makePerson } from "@/ui/testing/fixtures"
import { delaiDesTestsDIntegration } from "@/ui/testing/delais"
import App from "./App"

// L'application entière, pilotée comme par un utilisateur : un délai plus long, expliqué dans testing/delais.ts.
delaiDesTestsDIntegration()

async function renderApp(session: SessionState) {
  vi.mocked(window.api.getCurrentSession).mockResolvedValue(session)
  const user = userEvent.setup({ delay: null })
  render(<App />)
  await screen.findByRole("heading", { level: 1, name: session.name })
  return user
}

const undoButton = () => screen.getByRole("button", { name: "Annuler" })

describe("App : montages types", () => {
  it("depuis une simulation vide, charge un montage sans confirmation, le nomme et remonte en haut", async () => {
    const remonter = vi.spyOn(window, "scrollTo")
    const user = await renderApp(emptySession())

    await user.click(screen.getByRole("button", { name: "Partir d'un montage type..." }))
    await user.click(screen.getByRole("button", { name: "Charger le montage « SASU sans salaire, tout en dividendes »" }))

    expect(await screen.findByRole("heading", { level: 1, name: "SASU sans salaire, tout en dividendes" })).toBeInTheDocument()
    expect(screen.getAllByText("SASU de Thomas").length).toBeGreaterThan(0)
    expect(remonter).toHaveBeenCalledWith(0, 0)
    expect(undoButton()).toBeDisabled()
  })

  it("depuis les paramètres, demande confirmation avant de remplacer une simulation non enregistrée, et repart d'un historique vide", async () => {
    const session = { ...emptySession(), name: "Mon brouillon", entities: [makePerson()] }
    const user = await renderApp(session)
    await user.clear(screen.getByRole("textbox", { name: "Nom" }))
    await user.type(screen.getByRole("textbox", { name: "Nom" }), "Bob{Enter}")
    expect(undoButton()).toBeEnabled()

    await user.click(screen.getByRole("button", { name: "Paramètres" }))
    await user.click(screen.getByRole("button", { name: "Partir d'un montage type..." }))
    await user.click(screen.getByRole("button", { name: "Détails du montage « Salarié avec une micro-entreprise à côté »" }))
    await user.click(screen.getByRole("button", { name: "Charger ce montage" }))
    const confirmation = screen.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })
    expect(confirmation).toHaveTextContent("« Mon brouillon »")
    await user.click(within(confirmation).getByRole("button", { name: "Remplacer" }))

    expect(await screen.findByRole("heading", { level: 1, name: "Salarié avec une micro-entreprise à côté" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(undoButton()).toBeDisabled()
  })
  it("depuis la barre d'outils, ouvre la même fenêtre et demande confirmation avant de remplacer une simulation non enregistrée", async () => {
    const user = await renderApp({ ...emptySession(), name: "Mon brouillon", entities: [makePerson()] })
    await user.clear(screen.getByRole("textbox", { name: "Nom" }))
    await user.type(screen.getByRole("textbox", { name: "Nom" }), "Bob{Enter}")

    await user.click(within(screen.getByRole("navigation", { name: "Barre d'outils" })).getByRole("button", { name: "Montages types" }))
    await user.click(screen.getByRole("button", { name: "Charger le montage « SASU sans salaire, tout en dividendes »" }))
    await user.click(within(screen.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })).getByRole("button", { name: "Remplacer" }))

    expect(await screen.findByRole("heading", { level: 1, name: "SASU sans salaire, tout en dividendes" })).toBeInTheDocument()
    expect(undoButton()).toBeDisabled()
  })
})
