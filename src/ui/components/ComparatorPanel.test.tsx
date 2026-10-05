// src/ui/components/ComparatorPanel.test.tsx

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Affichage, ComparaisonResult, ScenarioStatut, SessionState, StatutCompare } from "@/types"
import { emptySession, makeCompany, makeFlow, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { ComparateurDeTest } from "@/ui/testing/comparateur"
import { AffichageContext } from "../hooks/useAffichage"

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

/** La session, où l'activité facture des prestations : la part BNC sert alors à la convertir en micro. */
function avecPrestations(session: SessionState, entityId = "company-sasu"): SessionState {
  const prestations = makeFlow({ id: "prestations", entityId, type: "ca_services", amount: 5000 })
  return { ...session, annees: session.annees.map(annee => ({ ...annee, monthlyData: annee.monthlyData.map(mois => (mois.month === 0 ? { ...mois, flows: [...mois.flows, prestations] } : mois)) })) }
}

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
    const { rerender } = render(<ComparateurDeTest annee={2025} session={session} />)

    expect(screen.getByText(/^Année 2025\./)).toBeInTheDocument()
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.objectContaining({ annees: session.annees }), expect.objectContaining({ remunerationNette: 20000 }), 2025))

    rerender(<ComparateurDeTest annee={2026} session={session} />)
    expect(screen.getByText(/^Année 2026\./)).toBeInTheDocument()
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.objectContaining({ annees: session.annees }), expect.objectContaining({ remunerationNette: 30000 }), 2026))
    // Au meilleur net, le comparateur calcule lui-même l'arbitrage rémunération / dividendes : il n'est pas refait à part.
    expect(window.api.optimiserRemuneration).not.toHaveBeenCalled()
  })

  it("hors du meilleur net, l'arbitrage rémunération / dividendes porte sur l'année affichée", async () => {
    const session = deuxAnnees()
    render(<ComparateurDeTest annee={2026} session={session} />)
    await userEvent.click(screen.getByRole("radio", { name: "Tout en rémunération" }))

    await vi.waitFor(() => expect(window.api.optimiserRemuneration).toHaveBeenLastCalledWith(expect.objectContaining({ annees: session.annees }), expect.anything(), "SASU", 2026))
  })

  it("reprend la rémunération de la nouvelle année quand on en change, mais garde les frais saisis", async () => {
    const session = deuxAnnees()
    const { rerender } = render(<ComparateurDeTest annee={2025} session={session} />)
    await userEvent.click(screen.getByRole("radio", { name: "Ma rémunération" }))
    const remuneration = screen.getByLabelText("Rémunération nette annuelle (SASU, EURL)")
    await userEvent.clear(remuneration)
    await userEvent.type(remuneration, "25000")
    const banque = screen.getByRole("spinbutton", { name: "Compte bancaire professionnel, SASU" })
    await userEvent.clear(banque)
    await userEvent.type(banque, "500")
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.objectContaining({ annees: session.annees }), expect.objectContaining({ remunerationNette: 25000 }), 2025))

    rerender(<ComparateurDeTest annee={2026} session={session} />)

    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.objectContaining({ annees: session.annees }), expect.objectContaining({ remunerationNette: 30000, repartition: { mode: "dividendes", partDistribuee: 1 }, fraisFonctionnement: expect.objectContaining({ SASU: expect.objectContaining({ banque: 500 }) }) }), 2026))

    // De retour sur 2025, la rémunération saisie pour cette année-là revient.
    rerender(<ComparateurDeTest annee={2025} session={session} />)
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ remunerationNette: 25000 }), 2025))
  })

  it("n'enregistre que les réglages changés : la rémunération saisie pour son année, le reste pour toutes", async () => {
    const enregistre = vi.fn()
    render(<ComparateurDeTest annee={2025} session={deuxAnnees()} onComparateur={enregistre} />)
    await userEvent.click(screen.getByRole("radio", { name: "Ma rémunération" }))
    const remuneration = screen.getByLabelText("Rémunération nette annuelle (SASU, EURL)")
    await userEvent.clear(remuneration)
    await userEvent.type(remuneration, "25000")

    expect(enregistre).toHaveBeenLastCalledWith({ activiteComparee: "company-sasu", reglagesParActivite: { "company-sasu": { repartition: { mode: "dividendes", partDistribuee: 1 }, remunerationParAnnee: { "2025": 25000 } } } })
  })
})

describe("ComparatorPanel et ses réglages enregistrés", () => {
  function deuxActivites(): SessionState {
    return avecPrestations({ ...emptySession(), entities: [makePerson(), makeCompany(), makeMicro({ name: "Mon atelier" })] })
  }

  it("reprend les réglages enregistrés dans la session : activité comparée, partage, frais et statut étudié", async () => {
    const frais = { SASU: { expertComptable: 0, banque: 0, logiciel: 0, assurance: 0, cfe: 0 }, EURL: { expertComptable: 1, banque: 0, logiciel: 0, assurance: 0, cfe: 0 }, EI: { expertComptable: 2, banque: 0, logiciel: 0, assurance: 0, cfe: 0 }, micro: { expertComptable: 3, banque: 0, logiciel: 0, assurance: 0, cfe: 0 } }
    const session: SessionState = { ...deuxActivites(), comparateur: { activiteComparee: "company-sasu", reglagesParActivite: { "company-sasu": { repartition: { mode: "personnalisee", partDistribuee: 0.4 }, remunerationParAnnee: { "2026": 18000 }, partBncPrestations: 0.3, fraisFonctionnement: frais, statutEtudie: "EURL" } } } }
    render(<ComparateurDeTest annee={2026} session={session} />)

    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(session, { activityId: "company-sasu", remunerationNette: 18000, repartition: { mode: "personnalisee", partDistribuee: 0.4 }, partBncPrestations: 0.3, fraisFonctionnement: frais }, 2026))
    expect(screen.getByRole("radio", { name: "Sur mesure" })).toBeChecked()
    expect(screen.getByLabelText(/prestations en BNC : 30 %/)).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "EURL", pressed: true }).length).toBeGreaterThan(0)
  })

  it("garde les réglages de chaque activité, et retient l'activité comparée", async () => {
    const enregistre = vi.fn()
    render(<ComparateurDeTest annee={2026} session={deuxActivites()} onComparateur={enregistre} />)
    const banque = screen.getByRole("spinbutton", { name: "Compte bancaire professionnel, SASU" })
    await userEvent.clear(banque)
    await userEvent.type(banque, "9")

    await userEvent.click(screen.getByRole("combobox", { name: "Activité comparée" }))
    await userEvent.click(await screen.findByRole("option", { name: "Mon atelier" }))

    expect(enregistre).toHaveBeenLastCalledWith(expect.objectContaining({ activiteComparee: "micro-atelier", reglagesParActivite: { "company-sasu": { fraisFonctionnement: expect.objectContaining({ SASU: expect.objectContaining({ banque: 9 }) }) } } }))
    // Chaque activité a ses frais : la micro repart des frais proposés par défaut.
    expect(screen.getByRole("spinbutton", { name: "Compte bancaire professionnel, SASU" })).toHaveValue(200)
  })

  it("retient le statut étudié dans « Rémunération ou dividendes ? »", async () => {
    const enregistre = vi.fn()
    render(<ComparateurDeTest annee={2026} session={deuxActivites()} onComparateur={enregistre} />)
    await userEvent.click(screen.getAllByRole("button", { name: "EURL", pressed: false })[0])

    expect(enregistre).toHaveBeenLastCalledWith({ activiteComparee: "company-sasu", reglagesParActivite: { "company-sasu": { statutEtudie: "EURL" } } })
  })
})

describe("ComparatorPanel", () => {
  it("n'affiche rien sans activité ni couple en union libre", async () => {
    const { container } = render(<ComparateurDeTest annee={2026} session={emptySession()} />)

    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it("compare la première activité et met en évidence le statut actuel et le meilleur net", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(window.api.compareStatuts).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ activityId: "micro-atelier", remunerationNette: 0, repartition: { mode: "meilleurNet", partDistribuee: 1, avecRetraite: true }, partBncPrestations: 1 }), 2026)
    expect(within(table).getByRole("columnheader", { name: /Micro-entreprise\s*actuel/ })).toBeInTheDocument()
    expect(within(table).getByRole("columnheader", { name: /versement libératoire\s*meilleur net/ })).toBeInTheDocument()

    const ecart = within(table).getByRole("row", { name: /Écart avec le statut actuel/ })
    expect(ecart).toHaveTextContent(`+${money(3000)}`)
    expect(ecart).toHaveTextContent(`−${money(2000)}`)
  })

  it("au meilleur net, chaque colonne de société affiche sa propre rémunération, et les 4 trimestres quand ils sont demandés", async () => {
    const optimale = (remunerationNette: number, avecRetraite = false, retraiteHorsDAtteinte = false) => ({ remunerationOptimale: { remunerationNette, avecRetraite, retraiteHorsDAtteinte } })
    const horsDAtteinte = "Aucune rémunération possible en EURL ne valide 4 trimestres de retraite."
    const scenarios = comparison().scenarios.map(s => (s.statut === "SASU" ? { ...s, ...optimale(12300, true) } : s.statut === "EURL" ? { ...s, ...optimale(25700, false, true), warnings: [horsDAtteinte] } : s))
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(within(table).getByRole("columnheader", { name: /^SASU/ })).toHaveTextContent(`rémunération optimale : ${money(12300)} netsavec 4 trimestres de retraite`)
    const eurl = within(table).getByRole("columnheader", { name: /^EURL/ })
    expect(eurl).toHaveTextContent(`rémunération optimale : ${money(25700)} nets4 trimestres hors d'atteinte`)
    expect(within(eurl).getByRole("link", { name: "Voir la note 1" })).toBeInTheDocument()
    expect(document.getElementById("note-comparateur-1")).toHaveTextContent(`EURL : ${horsDAtteinte}`)
    expect(within(table).getByRole("columnheader", { name: /^EI au réel/ })).not.toHaveTextContent("rémunération optimale")
  })

  it("au meilleur net, la case « avec 4 trimestres de retraite », cochée d'office, rejoint décochée les réglages du comparateur", async () => {
    const enregistre = vi.fn()
    render(<ComparateurDeTest annee={2026} session={withActivity()} onComparateur={enregistre} />)

    const caseRetraite = await screen.findByRole("checkbox", { name: "Avec 4 trimestres de retraite" })
    expect(caseRetraite).toBeChecked()
    await userEvent.click(caseRetraite)

    expect(caseRetraite).not.toBeChecked()
    expect(enregistre).toHaveBeenLastCalledWith({ activiteComparee: "micro-atelier", reglagesParActivite: { "micro-atelier": { repartition: { mode: "meilleurNet", partDistribuee: 1, avecRetraite: false } } } })
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ repartition: { mode: "meilleurNet", partDistribuee: 1, avecRetraite: false } }), 2026))
    // Décochée, elle le reste en passant par un autre mode.
    await userEvent.click(screen.getByRole("radio", { name: "Tout en rémunération" }))
    await userEvent.click(screen.getByRole("radio", { name: "Meilleur net" }))
    expect(screen.getByRole("checkbox", { name: "Avec 4 trimestres de retraite" })).not.toBeChecked()
    await userEvent.click(screen.getByRole("radio", { name: "Ma rémunération" }))
    expect(screen.queryByRole("checkbox", { name: "Avec 4 trimestres de retraite" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Rémunération nette annuelle (SASU, EURL)")).toBeInTheDocument()
  })

  it("ne propose la part BNC des prestations que pour une activité qui n'est pas déjà une micro", async () => {
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)
    await screen.findByLabelText("Activité comparée")
    expect(screen.queryByLabelText(/prestations en BNC/)).not.toBeInTheDocument()
  })

  it("note la protection sociale de chaque statut en étoiles", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const ligne = await screen.findByRole("row", { name: /^Protection sociale/ })
    expect(ligne).toHaveTextContent("★★★☆☆")
    expect(ligne).toHaveTextContent("3 sur 5")
    expect(screen.getByText(/Couverture SASU./)).toBeInTheDocument()
  })

  it("numérote les avertissements sous le tableau, avec un renvoi dans l'en-tête de chaque colonne concernée", async () => {
    const seuil = "Seuil à vérifier."
    const tva = "TVA due."
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: comparison().scenarios.map(s => (s.statut === "micro" ? { ...s, warnings: [tva] } : s.statut === "micro-vfl" ? { ...s, warnings: [tva, seuil] } : s)) }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

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
    render(<ComparateurDeTest annee={2026} session={session} />)

    const phrase = await screen.findByText(/Alice Martin et Bob Durand/)
    expect(phrase).toHaveTextContent(`${money(6500)} en union libre, ${money(2950)} avec une imposition commune`)
    expect(phrase).toHaveTextContent(`+${money(3550)}`)
    expect(screen.queryByText("Choisissez une activité à comparer.")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Activité comparée")).not.toBeInTheDocument()
  })

  it("propose la part BNC pour une société qui facture des prestations, dans la section des frais", async () => {
    render(<ComparateurDeTest annee={2026} session={avecPrestations({ ...emptySession(), entities: [makePerson(), makeCompany()] })} />)
    const bnc = await screen.findByLabelText(/prestations en BNC : 100 %/)
    expect(bnc.closest("details")).toHaveTextContent(/^Frais de fonctionnement et part BNC/)
  })

  it("sans prestations à répartir, la section ne parle que des frais de fonctionnement", async () => {
    render(<ComparateurDeTest annee={2026} session={{ ...emptySession(), entities: [makePerson(), makeCompany()] }} />)
    await screen.findByLabelText("Activité comparée")
    expect(screen.queryByLabelText(/prestations en BNC/)).not.toBeInTheDocument()
    expect(screen.getByRole("spinbutton", { name: "Compte bancaire professionnel, SASU" }).closest("details")).toHaveTextContent(/^Frais de fonctionnement\s*\(afficher\)/)
  })

  it("exporte le tableau de comparaison en CSV, avec les réglages utilisés", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    await userEvent.click(await screen.findByRole("button", { name: "Exporter en CSV le tableau de comparaison" }))

    expect(window.api.saveTextFile).toHaveBeenCalledWith({ defaultName: "nouvelle-simulation-comparateur-mon-atelier-2026.csv", content: expect.stringContaining("Indicateur;SASU;EURL;EI au réel;Micro-entreprise;Micro + versement libératoire\r\n"), format: "csv" })
    expect(vi.mocked(window.api.saveTextFile).mock.calls[0][0].content).toContain("Activité comparée;Mon atelier\r\n")
  })

  it("ne propose pas d'export sans statut comparé", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: [] }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenCalled())
    expect(screen.queryByRole("button", { name: /Exporter en CSV/ })).not.toBeInTheDocument()
  })

  it("signale dans l'en-tête une colonne micro hors plafond", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: comparison().scenarios.map(s => (s.statut === "micro-vfl" ? { ...s, horsPlafond: true } : s)), meilleur: "micro" }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(within(table).getByRole("columnheader", { name: /versement libératoire/ })).toHaveTextContent("hors plafond · 2 ans au plus")
    expect(within(table).getByRole("columnheader", { name: /^Micro-entreprise/ })).toHaveTextContent("meilleur net")
  })

  it("signale les deux colonnes micro hors plafond, et met en évidence le meilleur statut tenable", async () => {
    const horsPlafond = comparison().scenarios.map(s => (s.statut === "micro" || s.statut === "micro-vfl" ? { ...s, horsPlafond: true } : s))
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: horsPlafond, meilleur: "SASU" }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    for (const colonne of [/^Micro-entreprise/, /versement libératoire/]) {
      const entete = within(table).getByRole("columnheader", { name: colonne })
      expect(entete).toHaveTextContent("hors plafond · 2 ans au plus")
      expect(entete).not.toHaveTextContent("meilleur net")
    }
    expect(within(table).getByRole("columnheader", { name: /^SASU/ })).toHaveTextContent("meilleur net")
  })

  it("marque les colonnes micro plus accessibles après la sortie du régime micro", async () => {
    const sortie = { depuis: 2028, depassements: [2026, 2027] as [number, number] }
    const fermees = comparison().scenarios.map(s => (s.statut === "micro" || s.statut === "micro-vfl" ? { ...s, actuel: false, horsPlafond: true, regimeMicroFerme: sortie } : { ...s, actuel: s.statut === "EI" }))
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: fermees, meilleur: "SASU" }))
    render(<ComparateurDeTest annee={2028} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    for (const colonne of [/^Micro-entreprise/, /versement libératoire/]) {
      const entete = within(table).getByRole("columnheader", { name: colonne })
      expect(entete).toHaveTextContent("plus accessible · sortie au 1er janvier 2028")
      expect(entete).not.toHaveTextContent("hors plafond")
    }
    expect(within(table).getByRole("columnheader", { name: /^EI au réel/ })).toHaveTextContent("actuel")
  })

  it("dit sous le tableau des frais ce qui est retenu de la CFE l'année de création", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ noteCFE: "CFE exonérée l'année de création (2026) : le poste CFE des frais de fonctionnement n'est pas compté.", partCFE: 0 }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const frais = await screen.findByRole("table", { name: "Frais de fonctionnement annuels" })
    await vi.waitFor(() => expect(within(frais).getByRole("rowheader", { name: /Cotisation foncière/ })).toHaveTextContent("non comptée cette année"))
    expect(frais.closest("details")).toHaveTextContent("CFE exonérée l'année de création (2026)")
  })
})

describe("réglages essentiels du comparateur", () => {
  const optimale = (remunerationNette: number, avecRetraite: boolean, coutDesQuatreTrimestres?: number) => ({ remunerationOptimale: { remunerationNette, avecRetraite, retraiteHorsDAtteinte: false, ...(coutDesQuatreTrimestres ? { coutDesQuatreTrimestres } : {}) } })
  /** Au meilleur net : les 4 trimestres coûtent 1 234 € en SASU, rien en EURL où le meilleur net les valide déjà. */
  const avecCouts = () => comparison({ scenarios: comparison().scenarios.map(s => (s.statut === "SASU" ? { ...s, ...optimale(5800, true, 1234) } : s.statut === "EURL" ? { ...s, ...optimale(20000, true) } : s)) })
  const dans = (affichage: Affichage) => (
    <AffichageContext.Provider value={affichage}>
      <ComparateurDeTest annee={2026} session={avecPrestations({ ...emptySession(), entities: [makePerson(), makeCompany()] })} />
    </AffichageContext.Provider>
  )

  it.each(["classique", "resume", "vues"] as const)("affichage %s : l'activité, le partage du bénéfice et la case des 4 trimestres sont visibles sans rien déplier", async affichage => {
    render(dans(affichage))
    const caseRetraite = await screen.findByRole("checkbox", { name: "Avec 4 trimestres de retraite" })
    expect(caseRetraite).toBeChecked()
    expect(caseRetraite.closest("details")).toBeNull()
    expect(screen.getByRole("combobox", { name: "Activité comparée" }).closest("details")).toBeNull()
    expect(screen.getByRole("group", { name: "Bénéfice de la société (SASU, EURL)" }).closest("details")).toBeNull()
    // Part BNC et frais de fonctionnement : une seule section repliée, un seul clic pour les voir, dans tous les affichages.
    const bnc = screen.getByRole("slider", { name: /En micro, prestations en BNC/ })
    const frais = screen.getByRole("table", { name: "Frais de fonctionnement annuels" })
    expect(bnc.closest("details")).toHaveTextContent(/^Frais de fonctionnement et part BNC/)
    expect(frais.closest("details")).toBe(bnc.closest("details"))
    expect(frais.closest("details")!.parentElement!.closest("details")).toBeNull()
  })

  it("dit ce que coûtent les 4 trimestres en net, près de la case et dans l'en-tête des colonnes où ils coûtent", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(avecCouts())
    render(dans("resume"))

    const caseRetraite = await screen.findByRole("checkbox", { name: "Avec 4 trimestres de retraite" })
    await vi.waitFor(() => expect(caseRetraite).toHaveAccessibleDescription(/^coût en net : SASU −1\s234\s€$/))
    const table = screen.getByRole("table", { name: "Comparaison des statuts" })
    expect(within(table).getByRole("columnheader", { name: /^SASU/ })).toHaveTextContent(`4 trimestres : −${money(1234)} de net`)
    expect(within(table).getByRole("columnheader", { name: /^EURL/ })).not.toHaveTextContent("4 trimestres :")
  })

  it("ne parle d'aucun coût quand le meilleur net valide déjà 4 trimestres", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(dans("classique"))
    const caseRetraite = await screen.findByRole("checkbox", { name: "Avec 4 trimestres de retraite" })
    await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(caseRetraite).not.toHaveAttribute("aria-describedby")
    expect(screen.queryByText(/coût en net/)).not.toBeInTheDocument()
  })
})
