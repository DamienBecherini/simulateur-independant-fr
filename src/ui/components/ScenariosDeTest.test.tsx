// src/ui/components/ScenariosDeTest.test.tsx
// Bouton « Tests » du mode développement (les tests tournent dans ce mode) : la fenêtre liste les scénarios et en
// charge un.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { SCENARIOS_DE_TEST } from "@/lib/scenarios-de-test"
import { BoutonDesTests } from "./BoutonDesTests"

describe("Scénarios de test", () => {
  it("le bouton ouvre la liste des scénarios, et « Charger ce scénario » remplace la session puis ferme la fenêtre", async () => {
    const onCharger = vi.fn()
    const user = userEvent.setup({ delay: null })
    render(<BoutonDesTests onCharger={onCharger} />)

    // La fenêtre est chargée à la demande : sous mesure de couverture, ce chargement peut dépasser une seconde.
    await user.click(await screen.findByRole("button", { name: "Scénarios de test" }, { timeout: 10_000 }))
    const fenetre = screen.getByRole("dialog", { name: "Scénarios de test" })
    expect(within(fenetre).getAllByRole("heading", { level: 3 }).map(titre => titre.textContent)).toEqual(SCENARIOS_DE_TEST.map(s => s.titre))

    await user.click(within(fenetre).getByRole("button", { name: "Charger le scénario « Réserves sur deux années »" }))
    expect(onCharger).toHaveBeenCalledWith(expect.objectContaining({ name: "Test : réserves sur deux années" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
