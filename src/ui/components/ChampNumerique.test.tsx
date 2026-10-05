// src/ui/components/ChampNumerique.test.tsx

import { useState } from "react"
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ChampNumerique } from "./ChampNumerique"

/** Un champ contrôlé, comme dans l'application : la valeur ne change que par son onChange. */
function Champ({ depart = 2000, ...props }: { depart?: number; min?: string; max?: string; step?: string; disabled?: boolean }) {
  const [valeur, setValeur] = useState(depart)
  return <ChampNumerique aria-label="Expert-comptable, SASU" value={valeur} onChange={e => setValeur(parseFloat(e.target.value) || 0)} {...props} />
}

describe("ChampNumerique", () => {
  it("les boutons − et + changent la valeur d'un pas, par le onChange habituel", async () => {
    render(<Champ step="50" />)
    const champ = screen.getByRole("spinbutton", { name: "Expert-comptable, SASU" })
    await userEvent.click(screen.getByRole("button", { name: "Augmenter Expert-comptable, SASU de 50" }))
    expect(champ).toHaveValue(2050)
    await userEvent.click(screen.getByRole("button", { name: "Diminuer Expert-comptable, SASU de 50" }))
    await userEvent.click(screen.getByRole("button", { name: "Diminuer Expert-comptable, SASU de 50" }))
    expect(champ).toHaveValue(1950)
  })

  it("ne descend pas sous le minimum", async () => {
    render(<Champ depart={30} step="50" min="0" />)
    await userEvent.click(screen.getByRole("button", { name: /^Diminuer/ }))
    expect(screen.getByRole("spinbutton")).toHaveValue(0)
  })

  it("les boutons ne prennent pas le focus : la tabulation passe du champ au suivant", async () => {
    render(
      <>
        <Champ step="50" />
        <button type="button">Suivant</button>
      </>
    )
    await userEvent.tab()
    expect(screen.getByRole("spinbutton")).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole("button", { name: "Suivant" })).toHaveFocus()
  })

  it("le pas par défaut sert quand le champ accepte toute valeur, et les boutons suivent un champ désactivé", () => {
    render(<Champ step="any" disabled />)
    const plus = screen.getByRole("button", { name: "Augmenter Expert-comptable, SASU de 1" })
    expect(plus).toBeDisabled()
  })
})
