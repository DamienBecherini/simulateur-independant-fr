// src/ui/components/ComparatorPanel.test.tsx

import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ComparaisonResult, ScenarioStatut, SessionState, StatutCompare } from "@/types"
import { emptySession, makeCompany, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { ComparatorPanel } from "./ComparatorPanel"

function scenario(statut: StatutCompare, libelle: string, net: number, overrides: Partial<ScenarioStatut> = {}): ScenarioStatut {
  return { statut, libelle, actuel: false, fraisFonctionnement: 0, protectionSociale: { etoiles: 3, trimestres: 4, resume: `Couverture ${libelle}.` }, netApresImpots: net, revenusAvantPrelevements: 50000, totalPrelevements: 50000 - net, cotisationsSociales: 10000, impotSocietes: 0, impotSurLeRevenu: 1000, prelevementsSociaux: 0, resultatConserve: 0, warnings: [], ...overrides }
}

function comparison(overrides: Partial<ComparaisonResult> = {}): ComparaisonResult {
  return {
    scenarios: [scenario("SASU", "SASU", 30000), scenario("EURL", "EURL", 28000), scenario("EI", "EI au réel", 27000), scenario("micro", "Micro-entreprise", 32000, { actuel: true }), scenario("micro-vfl", "Micro + versement libératoire", 35000, { warnings: ["Seuil à vérifier."] })],
    meilleur: "micro-vfl",
    couples: [],
    warnings: [],
    ...overrides
  }
}

// toHaveTextContent ramène les espaces insécables à des espaces simples : on fait de même.
const money = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`.replace(/\s/g, " ")

function withActivity(): SessionState {
  return { ...emptySession(), entities: [makePerson(), makeMicro({ name: "Mon atelier" })] }
}

describe("ComparatorPanel", () => {
  it("n'affiche rien sans activité ni couple en union libre", async () => {
    const { container } = render(<ComparatorPanel session={emptySession()} />)

    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it("compare la première activité et met en évidence le statut actuel et le meilleur net", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(<ComparatorPanel session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(window.api.compareStatuts).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ activityId: "micro-atelier", remunerationNette: 0, distribuerToutLeBenefice: true, partBncPrestations: 1 }))
    expect(within(table).getByRole("columnheader", { name: /Micro-entreprise\s*actuel/ })).toBeInTheDocument()
    expect(within(table).getByRole("columnheader", { name: /versement libératoire\s*meilleur net/ })).toBeInTheDocument()

    const ecart = within(table).getByRole("row", { name: /Écart avec le statut actuel/ })
    expect(ecart).toHaveTextContent(`+${money(3000)}`)
    expect(ecart).toHaveTextContent(`−${money(2000)}`)
  })

  it("ne propose la part BNC des prestations que pour une activité qui n'est pas déjà une micro", async () => {
    render(<ComparatorPanel session={withActivity()} />)
    await screen.findByLabelText("Activité comparée")
    expect(screen.queryByLabelText(/prestations en BNC/)).not.toBeInTheDocument()
  })

  it("note la protection sociale de chaque statut en étoiles", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(<ComparatorPanel session={withActivity()} />)

    const ligne = await screen.findByRole("row", { name: /^Protection sociale/ })
    expect(ligne).toHaveTextContent("★★★☆☆")
    expect(ligne).toHaveTextContent("3 sur 5")
    expect(screen.getByText(/Couverture SASU./)).toBeInTheDocument()
  })

  it("affiche les avertissements de chaque statut", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(<ComparatorPanel session={withActivity()} />)

    expect(await screen.findByText("Seuil à vérifier.")).toBeInTheDocument()
  })

  it("compare un couple en union libre avec une imposition commune, même sans activité", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue({ scenarios: [], meilleur: null, couples: [{ personIds: ["person-alice", "person-bob"], netApresImpotsActuel: 48500, impotSurLeRevenuActuel: 6500, netApresImpotsMaries: 52050, impotSurLeRevenuMaries: 2950 }], warnings: ["Choisissez une activité à comparer."] })
    const session = { ...emptySession(), entities: [makePerson(), makePerson({ id: "person-bob", name: "Bob Durand" })] }
    render(<ComparatorPanel session={session} />)

    const phrase = await screen.findByText(/Alice Martin et Bob Durand/)
    expect(phrase).toHaveTextContent(`${money(6500)} en union libre, ${money(2950)} avec une imposition commune`)
    expect(phrase).toHaveTextContent(`+${money(3550)}`)
    expect(screen.queryByText("Choisissez une activité à comparer.")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Activité comparée")).not.toBeInTheDocument()
  })

  it("propose la part BNC pour une société", async () => {
    render(<ComparatorPanel session={{ ...emptySession(), entities: [makePerson(), makeCompany()] }} />)
    expect(await screen.findByLabelText(/prestations en BNC : 100 %/)).toBeInTheDocument()
  })
})
