// src/ui/components/ThemeToggle.test.tsx

import { afterEach, describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ThemeToggle } from "./ThemeToggle"
import { oublierLeTheme } from "../hooks/useTheme"

afterEach(() => {
  localStorage.removeItem("theme")
  document.documentElement.classList.remove("light", "dark")
  oublierLeTheme()
})

describe("ThemeToggle", () => {
  it("reprend le thème retenu et l'applique à la page", () => {
    localStorage.setItem("theme", "dark")
    render(<ThemeToggle />)
    expect(screen.getByRole("switch", { name: "Changer de thème" })).toBeChecked()
    expect(document.documentElement).toHaveClass("dark")
  })

  it("deux interrupteurs (barre d'outils, paramètres) partagent le même thème", async () => {
    localStorage.setItem("theme", "light")
    render(
      <>
        <ThemeToggle />
        <ThemeToggle id="theme-parametres" />
      </>
    )
    const [barre, parametres] = screen.getAllByRole("switch", { name: "Changer de thème" })
    await userEvent.click(parametres)
    expect(barre).toBeChecked()
    expect(parametres).toBeChecked()
    expect(document.documentElement).toHaveClass("dark")
    expect(localStorage.getItem("theme")).toBe("dark")
  })
})
