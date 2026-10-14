// src/ui/components/CombienFacturer.test.tsx

import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ChiffreDAffairesPourUnNet, ComparaisonOptions, Entity } from "@/types"
import userEvent from "@testing-library/user-event"
import { emptySession } from "@/ui/testing/fixtures"
import { AffichageContext } from "../hooks/useAffichage"
import { CombienFacturer } from "./CombienFacturer"

const money = (n: number) => `${n.toLocaleString("fr-FR")} €`.replace(/\s/g, " ")
const espaces = (texte: string | null) => texte?.replace(/\s/g, " ") ?? ""

const options: ComparaisonOptions = { activityId: "m1", remunerationNette: 0, repartition: { mode: "meilleurNet", partDistribuee: 1 }, partBncPrestations: 1 }
const activite = { id: "m1", type: "micro-entreprise", name: "Mon activité", beneficieACRE: false, opteVFL: false, avatar: { type: "initials", value: "MA", color: "#3b82f6" }, locked: false } as Entity

const resultat: ChiffreDAffairesPourUnNet = {
  netVise: 30000,
  chiffreDAffairesSaisi: 40000,
  colonnes: [
    { statut: "SASU", libelle: "SASU, rémunération optimisée", telleQueSaisie: false, chiffreDAffaires: 48111, netApresImpots: 30000 },
    { statut: "EI", libelle: "EI au réel", telleQueSaisie: false, chiffreDAffaires: 50036, netApresImpots: 30000 },
    { statut: "micro", libelle: "Micro-entreprise", telleQueSaisie: true, chiffreDAffaires: 42808, netApresImpots: 30001 },
    { statut: "micro-vfl", libelle: "Micro + versement libératoire", telleQueSaisie: false, chiffreDAffaires: null, netApresImpots: null, horsDePortee: "plafondMicro" }
  ],
  warnings: ["Une note du calcul."]
}

function afficher() {
  const session = emptySession()
  render(<CombienFacturer session={session} annee={2026} options={options} activite={activite} />)
  return session
}

const champ = () => screen.getByLabelText("Net visé du foyer (€ par an)")

describe("CombienFacturer", () => {
  it("propose un champ « Net visé du foyer », et ne calcule rien tant qu'il est vide", async () => {
    afficher()
    expect(screen.getByRole("heading", { name: "Combien facturer pour un net visé ?" })).toBeInTheDocument()
    expect(champ()).toHaveAccessibleDescription(/comme la ligne « Net dans la poche » du tableau/)
    await new Promise(resolve => setTimeout(resolve, 350))
    expect(window.api.chiffreDAffairesPourUnNet).not.toHaveBeenCalled()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("donne pour chaque statut le chiffre d'affaires annuel et mensuel nécessaire, et l'écart avec celui saisi", async () => {
    vi.mocked(window.api.chiffreDAffairesPourUnNet).mockResolvedValue(resultat)
    const session = afficher()
    fireEvent.change(champ(), { target: { value: "30000" } })
    expect(screen.getByText("Calcul en cours…")).toHaveAttribute("aria-live", "polite")

    const tableau = await screen.findByRole("table", { name: /« Mon activité » nécessaire pour 30\s000\s€ nets par an, selon le statut/ })
    expect(window.api.chiffreDAffairesPourUnNet).toHaveBeenCalledWith(session, options, 30000, 2026)
    const reponse = screen.getByText(/il faut au moins/)
    expect(reponse).toHaveAttribute("aria-live", "polite")
    expect(espaces(reponse.textContent)).toBe("Pour 30 000 € nets par an, il faut au moins 42 808 € de chiffre d'affaires par an (3 567 € par mois), en Micro-entreprise.")
    expect(within(tableau).getByRole("columnheader", { name: /^Écart avec le chiffre d'affaires saisi \(40\s000\s€\)$/ })).toBeInTheDocument()

    const ei = within(tableau).getByRole("row", { name: /EI au réel/ })
    expect(within(ei).getAllByRole("cell").map(c => espaces(c.textContent))).toEqual([money(50036), money(4170), `+${money(10036)}`])
    const micro = within(tableau).getByRole("row", { name: /^Micro-entreprise/ })
    expect(within(micro).getByRole("rowheader")).toHaveTextContent("Micro-entrepriseactuel")
    expect(espaces(within(micro).getAllByRole("cell")[2].textContent)).toBe(`+${money(2808)}`)
  })

  it("dit hors de portée un statut sans chiffre d'affaires possible, au lieu d'un montant", async () => {
    vi.mocked(window.api.chiffreDAffairesPourUnNet).mockResolvedValue(resultat)
    afficher()
    fireEvent.change(champ(), { target: { value: "30000" } })
    const tableau = await screen.findByRole("table")
    const vfl = within(tableau).getByRole("row", { name: /Micro \+ versement libératoire/ })
    expect(within(vfl).getAllByRole("cell").map(c => c.textContent)).toEqual(["—hors de portée : plafond dépassé", "—", "—"])
    expect(screen.getByText("Une note du calcul.")).toBeInTheDocument()
  })

  it("montre aussi, sur téléphone, une carte par statut", async () => {
    vi.mocked(window.api.chiffreDAffairesPourUnNet).mockResolvedValue(resultat)
    afficher()
    fireEvent.change(champ(), { target: { value: "30000" } })
    const cartes = await screen.findByRole("list", { name: "Chiffre d'affaires nécessaire selon le statut" })
    const [sasu, , micro, vfl] = within(cartes).getAllByRole("listitem")
    expect(espaces(sasu.textContent)).toBe(`SASU, rémunération optimisée${money(48111)}soit ${money(4009)} par mois · +${money(8111)} par rapport au chiffre d'affaires saisi`)
    expect(espaces(micro.textContent)).toContain("Micro-entreprise · actuel")
    expect(vfl.textContent).toBe("Micro + versement libératoire—hors de portée : plafond dépassé")
  })

  it("dit l'échec du calcul", async () => {
    vi.mocked(window.api.chiffreDAffairesPourUnNet).mockRejectedValue(new Error("chiffreDAffairesPourUnNet : paramètres invalides."))
    afficher()
    fireEvent.change(champ(), { target: { value: "30000" } })
    expect(await screen.findByText("chiffreDAffairesPourUnNet : paramètres invalides.")).toBeInTheDocument()
    expect(screen.queryByText("Calcul en cours…")).not.toBeInTheDocument()
  })

  it("dans l'affichage « Résumé », tient sur une ligne à déplier", async () => {
    const user = userEvent.setup()
    render(
      <AffichageContext.Provider value="resume">
        <CombienFacturer session={emptySession()} annee={2026} options={options} activite={activite} />
      </AffichageContext.Provider>
    )
    const section = screen.getByRole("region", { name: "Combien facturer pour un net visé ?" })
    expect(within(section).queryByRole("heading")).not.toBeInTheDocument()
    expect(champ()).not.toBeVisible()
    await user.click(within(section).getByText("Combien facturer pour un net visé ?"))
    expect(champ()).toBeVisible()
  })

  it("n'apparaît pas sans activité comparée", () => {
    const { container } = render(<CombienFacturer session={emptySession()} annee={2026} options={options} activite={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})
