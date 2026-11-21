// src/ui/components/AlerteCourte.test.tsx

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { AlerteCourte } from "./AlerteCourte"

const DEFICIT = "La société est déficitaire de 5 000 € : les charges et la rémunération (cotisations comprises) dépassent le chiffre d'affaires."

function rendre(texte: string) {
  const user = userEvent.setup()
  const { container } = render(
    <ul>
      <li>
        <AlerteCourte texte={texte} />
      </li>
    </ul>
  )
  return { user, item: container.querySelector("li")! }
}

describe("AlerteCourte", () => {
  it("affiche une alerte courte entière, sans bouton", () => {
    const { item } = rendre("Plusieurs dirigeants liés : la rémunération est attribuée au premier.")
    expect(item).toHaveTextContent("Plusieurs dirigeants liés : la rémunération est attribuée au premier.")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("garde le texte entier dans la page, la suite réservée à l'impression derrière la ligne courte", () => {
    const { item } = rendre(DEFICIT)
    expect(item.textContent?.trim()).toBe(DEFICIT)
    expect(screen.getByText("La société est déficitaire de 5 000 €")).not.toHaveClass("print:hidden")
    expect(screen.getByText(/^: les charges/)).toHaveClass("hidden", "print:inline")
  })

  it("ouvre le détail dans une bulle au clic sur (?), l'annonce, et le ferme d'un second clic ou à Échap", async () => {
    const { user } = rendre(DEFICIT)
    const bouton = screen.getByRole("button", { name: "Détail de l'alerte" })
    expect(bouton).toHaveAttribute("aria-expanded", "false")

    await user.click(bouton)
    expect(bouton).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("tooltip")).toHaveTextContent("Les charges et la rémunération (cotisations comprises) dépassent le chiffre d'affaires.")
    expect(bouton).toHaveAccessibleDescription("Les charges et la rémunération (cotisations comprises) dépassent le chiffre d'affaires.")
    expect(screen.getByRole("status")).toHaveTextContent("Les charges et la rémunération")

    await user.click(bouton)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

    await user.click(bouton)
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
    expect(bouton).toHaveFocus()
  })

  it("une ligne courte écrite à la main est remplacée par le texte entier à l'impression", () => {
    const texte = "« Sophie » est titulaire de plusieurs entreprises en nom propre (« Conseil » et « Atelier ») : une personne n'a qu'une entreprise individuelle, qui réunit toutes ses activités."
    rendre(texte)
    expect(screen.getByText("« Sophie » : une seule entreprise individuelle par personne")).toHaveClass("print:hidden")
    expect(screen.getByText(texte)).toHaveClass("hidden", "print:inline")
  })
})
