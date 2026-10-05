// src/ui/components/ComparatorPanel.test.tsx

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { ComparaisonResult, ScenarioStatut, SessionState, StatutCompare } from "@/types"
import { emptySession, makeCompany, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { ComparatorPanel } from "./ComparatorPanel"

function scenario(statut: StatutCompare, libelle: string, net: number, overrides: Partial<ScenarioStatut> = {}): ScenarioStatut {
  return { statut, libelle, actuel: false, fraisFonctionnement: 0, resultatConserveActivite: 0, horsPlafond: false, protectionSociale: { etoiles: 3, trimestres: 4, resume: `Couverture ${libelle}.` }, netApresImpots: net, revenusAvantPrelevements: 50000, totalPrelevements: 50000 - net, cotisationsSociales: 10000, impotSocietes: 0, impotSurLeRevenu: 1000, prelevementsSociaux: 0, resultatConserve: 0, warnings: [], ...overrides }
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

describe("ComparatorPanel sur plusieurs années", () => {
  /** Une SASU qui verse 20 000 € de rémunération en 2025 et 30 000 € en 2026. */
  function deuxAnnees(): SessionState {
    const remuneration = (annee: number, montant: number) => ({ annee, monthlyData: emptySession().annees[0].monthlyData.map(mois => (mois.month === 0 ? { ...mois, flows: [{ id: `r-${annee}`, label: "Rémunération", amount: montant, entityId: "company-sasu", type: "director_remuneration" as const }] } : mois)) })
    return { ...emptySession(), entities: [makePerson(), makeCompany()], relationships: [{ id: "r", fromId: "person-alice", toId: "company-sasu", type: "Président" }], annees: [remuneration(2025, 20000), remuneration(2026, 30000)] }
  }

  it("compare l'année affichée, avec la rémunération saisie cette année-là", async () => {
    const session = deuxAnnees()
    const { rerender } = render(<ComparatorPanel annee={2025} session={session} />)

    expect(screen.getByText(/^Année 2025\./)).toBeInTheDocument()
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(session, expect.objectContaining({ remunerationNette: 20000 }), 2025))

    rerender(<ComparatorPanel annee={2026} session={session} />)
    expect(screen.getByText(/^Année 2026\./)).toBeInTheDocument()
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(session, expect.objectContaining({ remunerationNette: 30000 }), 2026))
    await vi.waitFor(() => expect(window.api.optimiserRemuneration).toHaveBeenLastCalledWith(session, expect.anything(), "SASU", 2026))
  })

  it("reprend la rémunération de la nouvelle année quand on en change, mais garde les frais saisis", async () => {
    const session = deuxAnnees()
    const { rerender } = render(<ComparatorPanel annee={2025} session={session} />)
    const remuneration = screen.getByLabelText("Rémunération nette annuelle (SASU, EURL)")
    await userEvent.clear(remuneration)
    await userEvent.type(remuneration, "25000")
    const banque = screen.getByRole("spinbutton", { name: "Compte bancaire professionnel, SASU" })
    await userEvent.clear(banque)
    await userEvent.type(banque, "500")
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(session, expect.objectContaining({ remunerationNette: 25000 }), 2025))

    rerender(<ComparatorPanel annee={2026} session={session} />)

    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(session, expect.objectContaining({ remunerationNette: 30000, fraisFonctionnement: expect.objectContaining({ SASU: expect.objectContaining({ banque: 500 }) }) }), 2026))
  })
})

describe("ComparatorPanel", () => {
  it("n'affiche rien sans activité ni couple en union libre", async () => {
    const { container } = render(<ComparatorPanel annee={2026} session={emptySession()} />)

    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it("compare la première activité et met en évidence le statut actuel et le meilleur net", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(<ComparatorPanel annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(window.api.compareStatuts).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ activityId: "micro-atelier", remunerationNette: 0, distribuerToutLeBenefice: true, partBncPrestations: 1 }), 2026)
    expect(within(table).getByRole("columnheader", { name: /Micro-entreprise\s*actuel/ })).toBeInTheDocument()
    expect(within(table).getByRole("columnheader", { name: /versement libératoire\s*meilleur net/ })).toBeInTheDocument()

    const ecart = within(table).getByRole("row", { name: /Écart avec le statut actuel/ })
    expect(ecart).toHaveTextContent(`+${money(3000)}`)
    expect(ecart).toHaveTextContent(`−${money(2000)}`)
  })

  it("ne propose la part BNC des prestations que pour une activité qui n'est pas déjà une micro", async () => {
    render(<ComparatorPanel annee={2026} session={withActivity()} />)
    await screen.findByLabelText("Activité comparée")
    expect(screen.queryByLabelText(/prestations en BNC/)).not.toBeInTheDocument()
  })

  it("note la protection sociale de chaque statut en étoiles", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(<ComparatorPanel annee={2026} session={withActivity()} />)

    const ligne = await screen.findByRole("row", { name: /^Protection sociale/ })
    expect(ligne).toHaveTextContent("★★★☆☆")
    expect(ligne).toHaveTextContent("3 sur 5")
    expect(screen.getByText(/Couverture SASU./)).toBeInTheDocument()
  })

  it("numérote les avertissements sous le tableau, avec un renvoi dans l'en-tête de chaque colonne concernée", async () => {
    const seuil = "Seuil à vérifier."
    const tva = "TVA due."
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: comparison().scenarios.map(s => (s.statut === "micro" ? { ...s, warnings: [tva] } : s.statut === "micro-vfl" ? { ...s, warnings: [tva, seuil] } : s)) }))
    render(<ComparatorPanel annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    const enTeteMicro = within(table).getByRole("columnheader", { name: /^Micro-entreprise/ })
    expect(within(enTeteMicro).getByRole("link", { name: "Voir la note 1" })).toHaveAttribute("href", "#note-comparateur-1")
    const enTeteVfl = within(table).getByRole("columnheader", { name: /versement libératoire/ })
    expect(within(enTeteVfl).getAllByRole("link").map(lien => lien.getAttribute("href"))).toEqual(["#note-comparateur-1", "#note-comparateur-2"])
    expect(within(within(table).getByRole("columnheader", { name: /^SASU/ })).queryByRole("link")).not.toBeInTheDocument()

    const note1 = document.getElementById("note-comparateur-1")!
    expect(note1).toHaveTextContent(`Micro-entreprise, Micro + versement libératoire : ${tva}`)
    expect(document.getElementById("note-comparateur-2")).toHaveTextContent(`Micro + versement libératoire : ${seuil}`)
    expect(screen.getByText("Notes sur « Mon atelier »")).toBeInTheDocument()
    expect(screen.getByRole("row", { name: /^Conservé dans « Mon atelier »/ })).toBeInTheDocument()
  })

  it("compare un couple en union libre avec une imposition commune, même sans activité", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue({ scenarios: [], meilleur: null, couples: [{ personIds: ["person-alice", "person-bob"], netApresImpotsActuel: 48500, impotSurLeRevenuActuel: 6500, netApresImpotsMaries: 52050, impotSurLeRevenuMaries: 2950 }], warnings: ["Choisissez une activité à comparer."] })
    const session = { ...emptySession(), entities: [makePerson(), makePerson({ id: "person-bob", name: "Bob Durand" })] }
    render(<ComparatorPanel annee={2026} session={session} />)

    const phrase = await screen.findByText(/Alice Martin et Bob Durand/)
    expect(phrase).toHaveTextContent(`${money(6500)} en union libre, ${money(2950)} avec une imposition commune`)
    expect(phrase).toHaveTextContent(`+${money(3550)}`)
    expect(screen.queryByText("Choisissez une activité à comparer.")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Activité comparée")).not.toBeInTheDocument()
  })

  it("propose la part BNC pour une société", async () => {
    render(<ComparatorPanel annee={2026} session={{ ...emptySession(), entities: [makePerson(), makeCompany()] }} />)
    expect(await screen.findByLabelText(/prestations en BNC : 100 %/)).toBeInTheDocument()
  })

  it("exporte le tableau de comparaison en CSV, avec les réglages utilisés", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(<ComparatorPanel annee={2026} session={withActivity()} />)

    await userEvent.click(await screen.findByRole("button", { name: "Exporter en CSV le tableau de comparaison" }))

    expect(window.api.saveTextFile).toHaveBeenCalledWith({ defaultName: "nouvelle-simulation-comparateur-mon-atelier-2026.csv", content: expect.stringContaining("Indicateur;SASU;EURL;EI au réel;Micro-entreprise;Micro + versement libératoire\r\n"), format: "csv" })
    expect(vi.mocked(window.api.saveTextFile).mock.calls[0][0].content).toContain("Activité comparée;Mon atelier\r\n")
  })

  it("ne propose pas d'export sans statut comparé", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: [] }))
    render(<ComparatorPanel annee={2026} session={withActivity()} />)
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenCalled())
    expect(screen.queryByRole("button", { name: /Exporter en CSV/ })).not.toBeInTheDocument()
  })

  it("signale dans l'en-tête une colonne micro hors plafond", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: comparison().scenarios.map(s => (s.statut === "micro-vfl" ? { ...s, horsPlafond: true } : s)), meilleur: "micro" }))
    render(<ComparatorPanel annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(within(table).getByRole("columnheader", { name: /versement libératoire/ })).toHaveTextContent("hors plafond · 2 ans au plus")
    expect(within(table).getByRole("columnheader", { name: /^Micro-entreprise/ })).toHaveTextContent("meilleur net")
  })

  it("signale les deux colonnes micro hors plafond, et met en évidence le meilleur statut tenable", async () => {
    const horsPlafond = comparison().scenarios.map(s => (s.statut === "micro" || s.statut === "micro-vfl" ? { ...s, horsPlafond: true } : s))
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: horsPlafond, meilleur: "SASU" }))
    render(<ComparatorPanel annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    for (const colonne of [/^Micro-entreprise/, /versement libératoire/]) {
      const entete = within(table).getByRole("columnheader", { name: colonne })
      expect(entete).toHaveTextContent("hors plafond · 2 ans au plus")
      expect(entete).not.toHaveTextContent("meilleur net")
    }
    expect(within(table).getByRole("columnheader", { name: /^SASU/ })).toHaveTextContent("meilleur net")
  })
})
