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

  it("un champ sans pas imposé accepte toute valeur, et garde le pas de ses boutons au clavier", async () => {
    render(<ChampAuPasLibre />)
    const champ = screen.getByRole<HTMLInputElement>("spinbutton", { name: "Capital social" })
    // 4 637 n'est pas un multiple de 100 : avec un pas imposé, le navigateur refuserait d'envoyer le formulaire.
    expect(champ.validity.valid).toBe(true)

    await userEvent.click(champ)
    await userEvent.keyboard("{ArrowUp}")
    expect(champ).toHaveValue(4737)
    await userEvent.keyboard("{ArrowDown}{ArrowDown}")
    expect(champ).toHaveValue(4537)
    await userEvent.click(screen.getByRole("button", { name: "Augmenter le capital social de 100" }))
    expect(champ).toHaveValue(4637)
  })

  it("un champ au pas imposé, ou sans pas pour ses boutons, laisse les flèches du clavier au navigateur", async () => {
    // jsdom ne fait pas avancer un champ numérique aux flèches : la valeur ne bouge pas, le composant n'y touche pas.
    const { unmount } = render(<Champ step="50" />)
    await userEvent.click(screen.getByRole("spinbutton"))
    await userEvent.keyboard("{ArrowUp}")
    expect(screen.getByRole("spinbutton")).toHaveValue(2000)
    unmount()

    // Un champ à décimales (12,5 km) : le navigateur avance de 1 en gardant la décimale, le composant l'arrondirait.
    render(<Champ depart={12.5} step="any" />)
    await userEvent.click(screen.getByRole("spinbutton"))
    await userEvent.keyboard("{ArrowUp}")
    expect(screen.getByRole("spinbutton")).toHaveValue(12.5)
  })
})

/** Un champ sans pas imposé (`step="any"`), dont les boutons avancent de 100. */
function ChampAuPasLibre() {
  const [valeur, setValeur] = useState(4637)
  return <ChampNumerique aria-label="Capital social" quoi="le capital social" step="any" pas={100} min="0" value={valeur} onChange={e => setValeur(parseFloat(e.target.value) || 0)} />
}
