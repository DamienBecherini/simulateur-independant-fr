// src/ui/components/BarreDeResume.test.tsx
// La barre de résumé réduite une fois la page défilée (sur un téléphone) : une ligne, un bouton pour la déplier, et
// le meilleur statut coupé à l'écran mais lu en entier.

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ComparaisonResult, ScenarioStatut, SimulationReport } from "@/types"
import { emptyReport } from "@/ui/testing/fixtures"
import { BarreDeResume } from "./BarreDeResume"

const MEILLEUR = "Micro + versement libératoire (actuel)"

function report(avertissements: string[] = []): SimulationReport {
  const vide = emptyReport()
  return { ...vide, annee: 2026, avertissements, bilan: { ...vide.bilan, revenusAvantPrelevements: 100000, totalPrelevements: 30000 }, totalNetApresImpots: 70000 }
}

/** Une comparaison dont le meilleur statut, la situation saisie, a un long libellé. */
function comparaison(): ComparaisonResult {
  const vfl: ScenarioStatut = { statut: "micro-vfl", libelle: "Micro + versement libératoire", actuel: true, telleQueSaisie: true, ecartDeFrais: { total: 0, postes: {} }, resultatConserveActivite: 0, horsPlafond: false, protectionSociale: { etoiles: 3, trimestres: 4, resume: "" }, netApresImpots: 50000, revenusAvantPrelevements: 80000, totalPrelevements: 30000, cotisationsSociales: 0, impotSocietes: 0, impotSurLeRevenu: 0, prelevementsSociaux: 0, resultatConserve: 0, warnings: [] }
  return { scenarios: [vfl], meilleur: "micro-vfl", situationSaisie: { statut: "micro-vfl", libelle: vfl.libelle, netApresImpots: 50000 }, couples: [], warnings: [] }
}

/** Place le repère de la barre au-dessus de la barre d'outils (page défilée) ou en dessous, puis fait défiler. */
async function defiler(position: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: position, bottom: position, left: 0, right: 0, width: 0, height: 0, x: 0, y: position, toJSON: () => ({}) })
  await act(async () => {
    fireEvent.scroll(window)
    await new Promise(fin => requestAnimationFrame(() => fin(null)))
  })
}

afterEach(() => vi.restoreAllMocks())

const afficher = (avertissements: string[] = []) => render(<BarreDeResume report={report(avertissements)} annees={[2026]} annee={2026} onAnnee={() => {}} comparaison={{ activite: "Conseil", result: null }} />)

describe("barre de résumé réduite au défilement", () => {
  it("en haut de la page, la barre est entière et sans bouton pour la déplier", () => {
    const { container } = afficher()
    expect(container.querySelector("[data-barre-collante]")).not.toHaveAttribute("data-reduite")
    expect(screen.queryByRole("button", { name: /Taux et alertes/ })).not.toBeInTheDocument()
  })

  it("une fois la page défilée, elle se réduit ; un bouton la déplie et la replie, aria-expanded à l'appui", async () => {
    const { container } = afficher()
    const barre = container.querySelector("[data-barre-collante]")
    await defiler(-200)
    await waitFor(() => expect(barre).toHaveAttribute("data-reduite"))
    // Réduite, elle garde sa hauteur pleine dans le flux (le contenu ne bouge pas), transparente aux clics dessous.
    expect((barre as HTMLElement).style.height).toMatch(/px$/)
    expect(barre).toHaveClass("pointer-events-none")
    expect(container.querySelector("[data-barre-visible]")).toHaveClass("pointer-events-auto")
    // Réduite, sur un téléphone : le taux et les alertes attendent le bouton (masqués sous 640 px).
    expect(screen.getByRole("link", { name: /Prélèvements/ })).toHaveClass("max-sm:hidden")
    expect(screen.getByRole("link", { name: /Alertes/ })).toHaveClass("max-sm:hidden")
    expect(screen.getByRole("link", { name: /Net du foyer/ })).not.toHaveClass("max-sm:hidden")

    const bouton = screen.getByRole("button", { name: "Taux et alertes" })
    expect(bouton).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(bouton)
    expect(bouton).toHaveAttribute("aria-expanded", "true")
    expect(barre).not.toHaveAttribute("data-reduite")
    expect((barre as HTMLElement).style.height).toBe("")
    expect(screen.getByRole("link", { name: /Prélèvements/ })).not.toHaveClass("max-sm:hidden")
    await userEvent.click(bouton)
    expect(barre).toHaveAttribute("data-reduite")

    // De retour en haut, la barre reprend sa place, entière, et le bouton disparaît.
    await defiler(300)
    await waitFor(() => expect(barre).not.toHaveAttribute("data-reduite"))
    expect(screen.queryByRole("button", { name: /Taux et alertes/ })).not.toBeInTheDocument()
  })

  it("le bouton dit combien d'alertes la barre réduite cache", async () => {
    afficher(["Règles de 2026 reprises de 2025.", "Autre avertissement."])
    await defiler(-200)
    expect(await screen.findByRole("button", { name: "Taux et alertes (2 alertes)" })).toBeInTheDocument()
  })

  it("le meilleur statut, coupé à l'écran, reste lu en entier et s'affiche en entier au survol", async () => {
    render(<BarreDeResume report={report()} annees={[2026]} annee={2026} onAnnee={() => {}} comparaison={{ activite: "Conseil", result: comparaison() }} />)
    await defiler(-200)
    const lien = await screen.findByRole("link", { name: /Meilleur statut pour « Conseil ».*Micro \+ versement libératoire \(actuel\)/ })
    const valeur = within(lien).getByText(MEILLEUR)
    expect(valeur).toHaveClass("max-sm:truncate")
    expect(valeur).toHaveAttribute("title", MEILLEUR)
  })
})
