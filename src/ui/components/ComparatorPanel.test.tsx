// src/ui/components/ComparatorPanel.test.tsx

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Affichage, ComparaisonResult, ScenarioStatut, SessionState, StatutCompare } from "@/types"
import { emptySession, makeCompany, makeFlow, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { ComparateurDeTest } from "@/ui/testing/comparateur"
import { AUCUNE_CHARGE, SANS_CHIFFRE_D_AFFAIRES } from "@/backend/logic/options-du-comparateur"
import { AffichageContext } from "../hooks/useAffichage"
import { ComparatorPanel } from "./ComparatorPanel"
import { GARANTIES_DE_TEST } from "@/backend/logic/testing/garanties-de-test"
import { enTexteBrut } from "@/backend/logic/format"

function scenario(statut: StatutCompare, libelle: string, net: number, overrides: Partial<ScenarioStatut> = {}): ScenarioStatut {
  return { statut, libelle, actuel: false, telleQueSaisie: false, ecartDeFrais: { total: 0, postes: {} }, resultatConserveActivite: 0, horsPlafond: false, protectionSociale: { etoiles: 3, trimestres: 4, resume: `Couverture ${libelle}.`, garanties: GARANTIES_DE_TEST }, netApresImpots: net, revenusAvantPrelevements: 50000, totalPrelevements: 50000 - net, cotisationsSociales: 10000, impotSocietes: 0, impotSurLeRevenu: 1000, prelevementsSociaux: 0, resultatConserve: 0, warnings: [], ...overrides }
}

function comparison(overrides: Partial<ComparaisonResult> = {}): ComparaisonResult {
  return {
    scenarios: [scenario("SASU", "SASU", 30000), scenario("EURL", "EURL", 28000), scenario("EI", "EI au réel", 27000), scenario("micro", "Micro-entreprise", 32000, { actuel: true, telleQueSaisie: true }), scenario("micro-vfl", "Micro + versement libératoire", 35000, { warnings: ["Seuil à vérifier."] })],
    meilleur: "micro-vfl",
    situationSaisie: { statut: "micro", libelle: "Micro-entreprise", netApresImpots: 32000 },
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

    expect(screen.getByRole("heading", { level: 3, name: /Résultat 2025 :/ })).toBeInTheDocument()
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.objectContaining({ annees: session.annees }), expect.objectContaining({ remunerationNette: 20000 }), 2025))

    rerender(<ComparateurDeTest annee={2026} session={session} />)
    expect(screen.getByRole("heading", { level: 3, name: /Résultat 2026 :/ })).toBeInTheDocument()
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.objectContaining({ annees: session.annees }), expect.objectContaining({ remunerationNette: 30000 }), 2026))
    // Au meilleur net, le comparateur calcule lui-même l'arbitrage rémunération / dividendes : il n'est pas refait à part.
    expect(window.api.optimiserRemuneration).not.toHaveBeenCalled()
  })

  it("ajoute « Sur toutes les années », dont la part gardée chaque année est enregistrée avec les réglages", async () => {
    const onComparateur = vi.fn()
    render(<ComparateurDeTest annee={2026} session={deuxAnnees()} onComparateur={onComparateur} />)

    expect(screen.getByRole("heading", { name: "Sur toutes les années" })).toBeInTheDocument()
    await vi.waitFor(() => expect(window.api.comparerStrategies).toHaveBeenCalledWith(expect.anything(), "company-sasu"))
    const part = screen.getByLabelText("Part gardée chaque année (%)")
    await userEvent.clear(part)
    await userEvent.type(part, "40")

    expect(onComparateur).toHaveBeenLastCalledWith(expect.objectContaining({ reglagesParActivite: { "company-sasu": expect.objectContaining({ partMiseEnReserve: 0.4 }) } }))
    await vi.waitFor(() => expect(window.api.comparerStrategies).toHaveBeenLastCalledWith(expect.objectContaining({ comparateur: expect.objectContaining({ reglagesParActivite: { "company-sasu": expect.objectContaining({ partMiseEnReserve: 0.4 }) } }) }), "company-sasu"))
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

  it("rappelle l'activité comparée sous le titre du résultat, et y ramène pour en changer", async () => {
    render(<ComparateurDeTest annee={2026} session={deuxActivites()} />)
    const liste = await screen.findByRole("combobox", { name: "Activité comparée" })
    // La liste est dans le titre de l'étape 1.
    expect(liste.closest("section")?.querySelector("h3")).toHaveTextContent(/Activité comparée$/)
    const resultat = screen.getByRole("heading", { level: 3, name: /^Étape 2 :/ }).closest("section") as HTMLElement
    expect(within(resultat).getByText(/^Pour « /)).toHaveTextContent(/^Pour « .+ » · changer d'activité ↑$/)
    liste.scrollIntoView = vi.fn()
    await userEvent.click(within(resultat).getByRole("button", { name: "changer d'activité ↑" }))
    expect(liste).toHaveFocus()
    expect(liste.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "center" }))
  })

  it("sans autre activité à comparer, pas de rappel", async () => {
    render(<ComparateurDeTest annee={2026} session={{ ...emptySession(), entities: [makePerson(), makeCompany()] }} />)
    await screen.findByRole("combobox", { name: "Activité comparée" })
    expect(screen.queryByRole("button", { name: "changer d'activité ↑" })).not.toBeInTheDocument()
  })
})

describe("ComparatorPanel", () => {
  it("n'affiche rien sans activité ni couple en union libre", async () => {
    const { container } = render(<ComparateurDeTest annee={2026} session={emptySession()} />)

    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it("suit trois étapes : ce qui est comparé, le résultat, puis les réglages de la société, où mènent les colonnes SASU et EURL", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)
    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })

    const etape = (nom: RegExp) => screen.getByRole("heading", { level: 3, name: nom }).closest("section") as HTMLElement
    const activite = etape(/^Étape 1 :\s*Activité comparée$/)
    const resultat = etape(/^Étape 2 :\s*Résultat 2026 : net dans la poche selon le statut$/)
    // Une micro-entreprise : l'étape 3 la suppose en société.
    const societe = etape(/^Étape 3 :\s*Et en société \? Régler la SASU et l'EURL$/)
    expect([...document.querySelectorAll("[data-etape]")]).toEqual([activite, resultat, societe])
    expect(within(activite).getByRole("combobox", { name: "Activité comparée" })).toBeInTheDocument()
    expect(within(resultat).getByRole("table", { name: "Comparaison des statuts" })).toBe(table)
    // Comment lire le tableau : replié, juste au-dessus de lui, et plus sous le titre du comparateur.
    expect(within(resultat).getByText("Comment lire le tableau").closest("details")).not.toHaveAttribute("open")
    expect(screen.queryByText(/ce que compare le tableau/)).not.toBeInTheDocument()
    expect(within(societe).getByRole("group", { name: "Bénéfice de la société (SASU, EURL)" })).toBeInTheDocument()
    // Sous les réglages du tableau, l'étude d'une société, avec un seul choix SASU / EURL.
    const approfondir = within(societe).getByRole("region", { name: "Approfondir une société" })
    expect(within(approfondir).getAllByRole("group", { name: "Société étudiée" })).toHaveLength(1)
    expect(within(approfondir).getByRole("heading", { level: 5, name: "Rémunération ou dividendes ?" })).toBeInTheDocument()

    // L'étape 3 rappelle le net des colonnes qu'elle règle, et le meilleur net.
    expect(enTexteBrut(within(societe).getByRole("status", { name: "Colonnes SASU et EURL du tableau" }).textContent)).toBe(`Dans le tableau :SASU ${money(30000)}EURL ${money(28000)}meilleur net : Micro + versement libératoire, ${money(35000)}`)
    // Les en-têtes SASU et EURL y mènent, et eux seuls.
    const liens = within(table).getAllByRole("link", { name: /^régler à l'étape 3/ })
    expect(liens.map(lien => lien.closest("th")?.firstChild?.textContent)).toEqual(["SASU", "EURL"])
    for (const lien of liens) expect(lien).toHaveAttribute("href", "#comparateur-societe")
    expect(societe.querySelector("h3")).toHaveAttribute("id", "comparateur-societe")
    // Un clic y descend en douceur (pas un saut), donne le focus au titre et met l'ancre dans l'adresse.
    const defiler = vi.spyOn(Element.prototype, "scrollIntoView")
    await userEvent.click(liens[0])
    expect(defiler).toHaveBeenCalledWith({ block: "start", behavior: "smooth" })
    expect(societe.querySelector("h3")).toHaveFocus()
    expect(window.location.hash).toBe("#comparateur-societe")
    defiler.mockRestore()
    window.history.replaceState(null, "", window.location.pathname)
  })

  it("pour une société, l'étape 3 parle de l'optimiser", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(<ComparateurDeTest annee={2026} session={{ ...emptySession(), entities: [makePerson(), makeCompany()] }} />)
    expect(await screen.findByRole("heading", { level: 3, name: /^Étape 3 :\s*Optimiser la société : SASU et EURL$/ })).toBeInTheDocument()
  })

  it("compare la première activité et met en évidence le statut actuel et le meilleur net", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(window.api.compareStatuts).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ activityId: "micro-atelier", remunerationNette: 0, repartition: { mode: "meilleurNet", partDistribuee: 1, avecRetraite: true }, partBncPrestations: 1 }), 2026)
    expect(within(table).getByRole("columnheader", { name: /Micro-entreprise\s*actuel/ })).toBeInTheDocument()
    expect(within(table).getByRole("columnheader", { name: /^Meilleur net\s*Micro \+ versement libératoire/ })).toBeInTheDocument()

    const ecart = within(table).getByRole("row", { name: /Écart avec votre situation actuelle/ })
    expect(ecart).toHaveTextContent(`+${money(3000)}`)
    expect(ecart).toHaveTextContent(`−${money(2000)}`)
  })

  it("a une colonne « Portage salarial », désignable meilleur net, grisée quand elle n'est pas retenue, et envoie ses conditions au calcul", async () => {
    const portage = scenario("portage", "Portage salarial", 36000, { protectionSociale: { etoiles: 5, trimestres: 4, resume: "Salarié cadre du régime général.", garanties: GARANTIES_DE_TEST } })
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: [...comparison().scenarios, portage], meilleur: "portage" }))
    const { unmount } = render(<ComparateurDeTest annee={2026} session={{ ...withActivity(), comparateur: { activiteComparee: "micro-atelier", reglagesParActivite: { "micro-atelier": { portage: { tauxFraisDeGestion: 0.06 } } } } }} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ portage: { tauxFraisDeGestion: 0.06 } }), 2026)
    expect(within(table).getByRole("columnheader", { name: /^Meilleur net\s*Portage salarial/ })).toBeInTheDocument()
    expect(within(table).getByRole("row", { name: /Protection sociale/ })).toHaveTextContent("★★★★★")
    unmount()

    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: [...comparison().scenarios, { ...portage, netApresImpots: 20000, portageNonRetenu: "salaries" }] }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)
    const ecart = within(await screen.findByRole("table", { name: "Comparaison des statuts" })).getByRole("row", { name: /Écart avec votre situation actuelle/ })
    expect(ecart).toHaveTextContent("non retenue : salariés de l'activité")
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
    expect(within(eurl).getByRole("button", { name: "Voir la note 1" })).toBeInTheDocument()
    expect(document.getElementById("note-comparateur-1")).toHaveTextContent(`EURL : ${horsDAtteinte}`)
    expect(within(table).getByRole("columnheader", { name: /^EI au réel/ })).not.toHaveTextContent("rémunération optimale")
  })

  it("au meilleur net, une société dont la répartition saisie fait aussi bien reste « actuel », sans écart ni rémunération conseillée", async () => {
    const gardee = { telleQueSaisie: true, actuel: true, saisieAuMeilleurNet: true as const, remunerationOptimale: { remunerationNette: 0, avecRetraite: false, retraiteHorsDAtteinte: false, coutDesQuatreTrimestres: 1429 } }
    const scenarios = comparison().scenarios.map(s => (s.statut === "SASU" ? { ...s, ...gardee } : { ...s, telleQueSaisie: false, actuel: false }))
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios, meilleur: "SASU" }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    const sasu = within(table).getByRole("columnheader", { name: /^Meilleur net\s*SASU/ })
    expect((sasu.textContent ?? "").replace(/\s/g, " ")).toMatch(/^Meilleur netSASU ?actuel/)
    expect((sasu.textContent ?? "").replace(/\s/g, " ")).toContain(`votre répartition, au meilleur net à moins de ${money(100)} près`)
    expect(sasu).not.toHaveTextContent("rémunération optimale")
    // Ce que coûteraient les 4 trimestres reste dit : le choix se fait en connaissance de cause.
    expect((sasu.textContent ?? "").replace(/\s/g, " ")).toContain(`4 trimestres : −${money(1429)} de net`)
    const ecart = within(table).getByRole("row", { name: /Écart avec votre situation actuelle/ })
    expect(within(ecart).getAllByRole("cell")[scenarios.findIndex(s => s.statut === "SASU")]).toHaveTextContent(/^—$/)
  })

  it("au meilleur net, une case des 4 trimestres par colonne, cochées d'office : décocher la SASU laisse l'EURL avec ses 4 trimestres", async () => {
    const enregistre = vi.fn()
    render(<ComparateurDeTest annee={2026} session={withActivity()} onComparateur={enregistre} />)

    const groupe = await screen.findByRole("group", { name: "Exiger 4 trimestres de retraite" })
    const sasu = within(groupe).getByRole("checkbox", { name: "en SASU" })
    const eurl = within(groupe).getByRole("checkbox", { name: "en EURL" })
    expect(sasu).toBeChecked()
    expect(eurl).toBeChecked()
    await userEvent.click(sasu)

    expect(sasu).not.toBeChecked()
    expect(eurl).toBeChecked()
    const repartition = { mode: "meilleurNet", partDistribuee: 1, avecRetraite: true, retraiteEn: { SASU: false } }
    expect(enregistre).toHaveBeenLastCalledWith({ activiteComparee: "micro-atelier", reglagesParActivite: { "micro-atelier": { repartition } } })
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ repartition }), 2026))
    expect(document.getElementById("comparateur-mode-choisi")).toHaveTextContent("Chaque société verse la rémunération qui donne le meilleur net, le reste en dividendes ; en EURL, parmi celles qui valident 4 trimestres de retraite.")
    // Le choix de la colonne le reste en passant par un autre mode.
    await userEvent.click(screen.getByRole("radio", { name: "Tout en rémunération" }))
    await userEvent.click(screen.getByRole("radio", { name: "Meilleur net" }))
    expect(screen.getByRole("checkbox", { name: "en SASU" })).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: "en EURL" })).toBeChecked()
    await userEvent.click(screen.getByRole("radio", { name: "Ma rémunération" }))
    expect(screen.queryByRole("group", { name: "Exiger 4 trimestres de retraite" })).not.toBeInTheDocument()
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
  })

  it("détaille la protection sociale dans un tableau, garantie par garantie, le résumé de chaque régime dans une bulle", async () => {
    const tns = { ...GARANTIES_DE_TEST, arretMaladie: { niveau: "limite" as const, precision: "après 1 an" }, accidentDuTravail: { niveau: "non" as const } }
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: comparison().scenarios.map(s => (s.statut === "EURL" ? { ...s, protectionSociale: { ...s.protectionSociale, garanties: tns } } : s)) }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const tableau = await screen.findByRole("table", { name: "Protection sociale selon le statut" })
    expect(within(tableau).getAllByRole("columnheader").map(c => c.textContent)).toEqual(expect.arrayContaining([expect.stringMatching(/^SASU★★★☆☆ : 3 sur 5$/)]))
    const ligne = (nom: string) => within(tableau).getByRole("row", { name: new RegExp(`^${nom}`) })
    expect(within(ligne("Arrêt maladie")).getAllByRole("cell").map(c => c.textContent)).toEqual(expect.arrayContaining(["✓oui", "après 1 an"]))
    expect(ligne("Chômage")).toHaveTextContent("✗non")
    expect(ligne("Trimestres de retraite")).toHaveTextContent("4 / 4")

    await userEvent.click(within(ligne("En détail")).getAllByRole("button", { name: /^Protection sociale en / })[0])
    expect(screen.getByRole("tooltip")).toHaveTextContent(/Couverture SASU\./)
  })

  it("écrit dans l'en-tête qu'une rémunération choisie a été limitée à ce que la société peut verser", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(
      comparison({ scenarios: comparison().scenarios.map(s => (s.statut === "SASU" ? { ...s, remunerationPlafonnee: { demandee: 80000000, retenue: 38000 } } : s.statut === "EURL" ? { ...s, remunerationPlafonnee: { demandee: 80000000, retenue: 0 } } : s)) })
    )
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(within(table).getByRole("columnheader", { name: /^SASU/ })).toHaveTextContent(/rémunération limitée à 38\s000\s€/)
    expect(within(table).getByRole("columnheader", { name: /^EURL/ })).toHaveTextContent("aucune rémunération possible")
    expect(within(table).getByRole("columnheader", { name: /^EI au réel/ })).not.toHaveTextContent(/rémunération/)
  })

  it("grise une société dont la grille verse plus que le bénéfice, et écrit pourquoi elle n'est pas retenue", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: comparison().scenarios.map(s => (s.statut === "SASU" ? { ...s, remunerationNonCouverte: true as const } : s)) }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(within(table).getByRole("row", { name: /^Écart avec votre situation actuelle/ })).toHaveTextContent("non retenue : rémunération supérieure au bénéfice")
    // L'en-tête le dit aussi, comme « meilleur net » : le fond grisé ne suffit pas à le faire lire.
    expect(within(table).getByRole("columnheader", { name: /^SASU/ })).toHaveTextContent("non retenue")
    expect(within(table).getByRole("columnheader", { name: /^EI/ })).not.toHaveTextContent("non retenue")
  })

  it("sous le net d'une société déficitaire, dit la perte restée dans la société, et ajoute au détail le net une fois la perte déduite", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: comparison().scenarios.map(s => (s.statut === "SASU" ? { ...s, netApresImpots: 0, perteConservee: 20000 } : s)) }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(within(table).getByRole("row", { name: /^Net dans la poche/ })).toHaveTextContent(/et 20\s000\s€ de perte restée dans la société/)
    const deduite = within(table).getByRole("row", { name: /^Net, perte restée dans l'activité déduite/ })
    expect(deduite).toHaveTextContent(/-20\s000\s€/)
  })

  it("sous le net d'une société qui garde un bénéfice, le dit, et explique sous le tableau qu'il n'est pas compté", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: comparison().scenarios.map(s => (s.statut === "SASU" ? { ...s, beneficeGarde: 12000 } : s)) }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(within(table).getByRole("row", { name: /^Net dans la poche/ })).toHaveTextContent(/et 12\s000\s€ gardés dans la société/)
    expect(within(table).queryByRole("row", { name: /^Net, perte restée dans l'activité déduite/ })).not.toBeInTheDocument()
    expect(screen.getByText(/^Un bénéfice gardé dans la société n'est pas compté dans le net ni dans le classement/)).toBeInTheDocument()
  })

  it("sans bénéfice gardé, ni mention sous le net ni explication", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)
    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(table).not.toHaveTextContent("gardés dans la société")
    expect(screen.queryByText(/^Un bénéfice gardé dans la société/)).not.toBeInTheDocument()
  })

  it("sans perte, pas de ligne « Net, perte restée dans l'activité déduite »", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)
    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(within(table).queryByRole("row", { name: /^Net, perte restée dans l'activité déduite/ })).not.toBeInTheDocument()
    expect(table).not.toHaveTextContent("perte restée dans la société")
  })

  it("écrit « société déficitaire » dans l'en-tête d'une société que la rémunération de la grille met en déficit", async () => {
    const partage = { beneficeAvantRemuneration: 10000, remunerationNette: 20000, cotisationsRemuneration: 15000, impotSocietes: 0, dividendesNets: 0, cotisationsSurDividendes: 0, resultatConserve: -25000 }
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: comparison().scenarios.map(s => (s.statut === "SASU" ? { ...s, partage } : s.statut === "EURL" ? { ...s, partage: { ...partage, resultatConserve: 0 } } : s)) }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(within(table).getByRole("columnheader", { name: /^SASU/ })).toHaveTextContent("société déficitaire")
    expect(within(table).getByRole("columnheader", { name: /^EURL/ })).not.toHaveTextContent("société déficitaire")
    expect(within(table).getByRole("columnheader", { name: /^EI au réel/ })).not.toHaveTextContent("société déficitaire")
  })

  it("numérote les avertissements sous le tableau, avec un renvoi dans l'en-tête de chaque colonne concernée", async () => {
    const seuil = "Seuil à vérifier."
    const tva = "TVA due."
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: comparison().scenarios.map(s => (s.statut === "micro" ? { ...s, warnings: [tva] } : s.statut === "micro-vfl" ? { ...s, warnings: [tva, seuil] } : s)) }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    const enTeteMicro = within(table).getByRole("columnheader", { name: /^Micro-entreprise/ })
    expect(within(enTeteMicro).getByRole("button", { name: "Voir la note 1" })).toHaveAttribute("aria-expanded", "false")
    const enTeteVfl = within(table).getByRole("columnheader", { name: /versement libératoire/ })
    expect(within(enTeteVfl).getAllByRole("button").map(pastille => pastille.getAttribute("aria-label"))).toEqual(["Voir la note 1", "Voir la note 2"])
    expect(within(within(table).getByRole("columnheader", { name: /^SASU/ })).queryByRole("button")).not.toBeInTheDocument()

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

    // Le gain en grand, sous les noms du couple ; puis les deux impôts.
    expect(await screen.findByText("Alice Martin et Bob Durand")).toBeInTheDocument()
    const gain = screen.getByText(`+${money(3550)}`)
    expect(gain).toHaveClass("text-emerald-700")
    expect(gain.parentElement).toHaveTextContent(`+${money(3550)}de net après impôts par an`)
    expect(enTexteBrut(screen.getByText(/^Impôt sur le revenu :/).textContent)).toBe(enTexteBrut(`Impôt sur le revenu :${money(6500)}en union libre→,${money(2950)}imposés ensemble`))
    expect(screen.queryByText("Choisissez une activité à comparer.")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Activité comparée")).not.toBeInTheDocument()
    // Mariage et Pacs ne sont pas distingués : la section dit pourquoi.
    const section = screen.getByRole("region", { name: "Et si vous étiez mariés ou pacsés ?" })
    expect(section).toHaveTextContent("Le couple formerait un seul foyer fiscal, imposé en commun.")
    expect(section).toHaveTextContent("Mariage et Pacs ont le même effet sur l'impôt sur le revenu.")
    expect(within(section).getByRole("heading", { level: 3 })).toHaveAttribute("id", "comparaison-du-couple")
  })

  it("un couple qui perdrait à être imposé ensemble : le montant en gris, jamais en vert", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue({ scenarios: [], meilleur: null, couples: [{ personIds: ["person-alice", "person-bob"], netApresImpotsActuel: 48500, impotSurLeRevenuActuel: 6120, netApresImpotsMaries: 48080, impotSurLeRevenuMaries: 6540 }], warnings: [] })
    const session = { ...emptySession(), entities: [makePerson(), makePerson({ id: "person-bob", name: "Bob Durand" })] }
    render(<ComparateurDeTest annee={2026} session={session} />)
    const perte = await screen.findByText(`−${money(420)}`)
    expect(perte).not.toHaveClass("text-emerald-700")
    expect(perte.parentElement).toHaveTextContent("par an : l'union libre est plus avantageuse")
  })

  it("place la comparaison du couple avant la courbe « Rémunération ou dividendes ? » de l'activité comparée", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ couples: [{ personIds: ["person-alice", "person-bob"], netApresImpotsActuel: 48500, impotSurLeRevenuActuel: 6500, netApresImpotsMaries: 52050, impotSurLeRevenuMaries: 2950 }] }))
    const session = { ...withActivity(), entities: [...withActivity().entities, makePerson({ id: "person-bob", name: "Bob Durand" })] }
    render(<ComparateurDeTest annee={2026} session={session} />)

    const couple = await screen.findByRole("region", { name: "Et si vous étiez mariés ou pacsés ?" })
    const courbe = screen.getByRole("region", { name: "Rémunération ou dividendes ?" })
    expect(couple.compareDocumentPosition(courbe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("transmet à la barre de résumé l'arbitrage d'une société à l'IS, pas celui d'une micro-entreprise passée en société", async () => {
    const point = { remunerationNette: 5800, dividendes: 40000, netApresImpots: 45780, cotisationsSociales: 0, impotSocietes: 0, impotSurLeRevenu: 0, prelevementsSociaux: 0, trimestres: 4 }
    const optimisation = { statut: "SASU" as const, remunerationMaximale: 60000, points: [point], meilleur: point, meilleurAvecRetraite: point, warnings: [] }
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ optimisations: { SASU: optimisation } }))
    vi.mocked(window.api.optimiserRemuneration).mockResolvedValue(optimisation)
    const onComparaison = vi.fn()

    const { unmount } = render(<ComparatorPanel session={{ ...emptySession(), entities: [makePerson(), makeCompany()] }} annee={2026} onComparateurChange={() => {}} onComparaison={onComparaison} />)
    await vi.waitFor(() => expect(onComparaison).toHaveBeenLastCalledWith(expect.objectContaining({ activite: "Ma SASU", optimisation })))
    unmount()

    onComparaison.mockClear()
    render(<ComparatorPanel session={withActivity()} annee={2026} onComparateurChange={() => {}} onComparaison={onComparaison} />)
    await vi.waitFor(() => expect(onComparaison).toHaveBeenLastCalledWith(expect.objectContaining({ activite: "Mon atelier", result: expect.anything(), optimisation: null })))
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
    expect(screen.getByRole("spinbutton", { name: "Compte bancaire professionnel, SASU" }).closest("details")).toHaveTextContent(/^Frais de fonctionnement\s*toutes les colonnes\s*\(afficher\)/)
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
    expect(within(table).getByRole("columnheader", { name: /^Meilleur net\s*Micro-entreprise/ })).toBeInTheDocument()
  })

  it("grise une colonne micro hors plafond et écrit dans la cellule de l'écart qu'elle n'est pas retenue (P-14)", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: comparison().scenarios.map(s => (s.statut === "micro-vfl" ? { ...s, horsPlafond: true } : s)), meilleur: "micro" }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    const cellules = within(within(table).getByRole("row", { name: /Écart avec votre situation actuelle/ })).getAllByRole("cell")
    const vfl = cellules[4]
    expect(vfl).toHaveTextContent(`+${money(3000)}non retenue : plafond dépassé`)
    // Pas de vert pour un gain qui n'est pas retenu : la cellule est grisée.
    expect(vfl.className).not.toMatch(/emerald/)
    expect(vfl.className).toMatch(/bg-slate-100/)
    expect(cellules[0]).not.toHaveTextContent("non retenue")
  })

  it("sans chiffre d'affaires, invite à en saisir un et ne désigne aucun statut (P-13)", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ meilleur: null, sansChiffreDAffaires: true, warnings: [SANS_CHIFFRE_D_AFFAIRES] }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    // L'autre zone d'annonce du comparateur est celle de la bulle d'une note, vide tant qu'aucune n'est ouverte.
    const annonces = await screen.findAllByRole("status")
    expect(annonces.filter(zone => zone.textContent?.includes(SANS_CHIFFRE_D_AFFAIRES))).toHaveLength(1)
    // Le message n'est écrit qu'une fois, et aucune colonne n'est marquée « meilleur net ».
    expect(screen.getAllByText(SANS_CHIFFRE_D_AFFAIRES)).toHaveLength(1)
    const table = screen.getByRole("table", { name: "Comparaison des statuts" })
    expect(within(table).queryByText("meilleur net")).not.toBeInTheDocument()
  })

  it("calcule à l'envers, pour un net visé, avec les réglages du comparateur et l'année affichée", async () => {
    const user = userEvent.setup()
    const session = withActivity()
    render(<ComparateurDeTest annee={2026} session={session} />)

    // La section suit les résultats de la comparaison, sous le tableau dans l'affichage classique.
    await user.type(await screen.findByLabelText("Net visé du foyer (€ par an)"), "30000")
    await vi.waitFor(() => expect(window.api.chiffreDAffairesPourUnNet).toHaveBeenLastCalledWith(expect.objectContaining({ entities: session.entities }), vi.mocked(window.api.compareStatuts).mock.lastCall?.[1], 30000, 2026))
  })

  it("sans charge saisie pour l'activité, l'alerte remplace le rappel des frais sous le tableau, une seule fois", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ warnings: [AUCUNE_CHARGE] }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const note = await screen.findByRole("note")
    expect(note).toHaveTextContent(AUCUNE_CHARGE)
    expect(screen.getAllByText(new RegExp(`^${AUCUNE_CHARGE.slice(0, 40)}`))).toHaveLength(1)
    expect(screen.queryByText(/^Vos frais réels sont ceux que vous avez saisis/)).not.toBeInTheDocument()
  })

  it("en société hors partage « grille », nomme la colonne du statut actuel par son partage et rappelle la situation saisie (P-04)", async () => {
    const scenarios = comparison().scenarios.map(s => (s.statut === "SASU" ? { ...s, libelle: "SASU, rémunération optimisée", actuel: true, netApresImpots: 41000 } : { ...s, actuel: false, telleQueSaisie: false }))
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios, meilleur: "SASU", situationSaisie: { statut: "SASU", libelle: "SASU", netApresImpots: 40000 } }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    const entete = within(table).getByRole("columnheader", { name: /^Meilleur net\s*SASU, rémunération optimisée/ })
    expect(entete).not.toHaveTextContent("actuel")
    expect(screen.getByText(/^Votre situation telle que saisie \(SASU\)/)).toHaveTextContent(`Votre situation telle que saisie (SASU) : ${money(40000)} de net, comme dans les résultats.`)
    const ecart = within(table).getByRole("row", { name: /Écart avec votre situation actuelle/ })
    expect(within(ecart).getAllByRole("cell")[0]).toHaveTextContent(`+${money(1000)}`)
  })

  it("signale les deux colonnes micro hors plafond, et met en évidence le meilleur statut tenable", async () => {
    const horsPlafond = comparison().scenarios.map(s => (s.statut === "micro" || s.statut === "micro-vfl" ? { ...s, horsPlafond: true } : s))
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: horsPlafond, meilleur: "SASU" }))
    render(<ComparateurDeTest annee={2026} session={withActivity()} />)

    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    for (const colonne of [/^Micro-entreprise/, /versement libératoire/]) {
      const entete = within(table).getByRole("columnheader", { name: colonne })
      expect(entete).toHaveTextContent("hors plafond · 2 ans au plus")
      expect(entete).not.toHaveTextContent("Meilleur net")
    }
    expect(within(table).getByRole("columnheader", { name: /^Meilleur net\s*SASU/ })).toBeInTheDocument()
  })

  it("marque les colonnes micro plus accessibles après la sortie du régime micro", async () => {
    const sortie = { depuis: 2028, depassements: [2026, 2027] as [number, number] }
    const fermees = comparison().scenarios.map(s => (s.statut === "micro" || s.statut === "micro-vfl" ? { ...s, actuel: false, telleQueSaisie: false, horsPlafond: true, regimeMicroFerme: sortie } : { ...s, actuel: s.statut === "EI", telleQueSaisie: s.statut === "EI" }))
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison({ scenarios: fermees, meilleur: "SASU", situationSaisie: { statut: "EI", libelle: "EI au réel", netApresImpots: 27000 } }))
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
    const caseRetraite = await screen.findByRole("checkbox", { name: "en SASU" })
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

    const caseRetraite = await screen.findByRole("checkbox", { name: "en SASU" })
    await vi.waitFor(() => expect(caseRetraite).toHaveAccessibleDescription(/^coût : −1\s234\s€ de net$/))
    const table = screen.getByRole("table", { name: "Comparaison des statuts" })
    expect(within(table).getByRole("columnheader", { name: /^SASU/ })).toHaveTextContent(`4 trimestres : −${money(1234)} de net`)
    expect(within(table).getByRole("columnheader", { name: /^EURL/ })).not.toHaveTextContent("4 trimestres :")
  })

  it("ne parle d'aucun coût quand le meilleur net valide déjà 4 trimestres", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparison())
    render(dans("classique"))
    const caseRetraite = await screen.findByRole("checkbox", { name: "en SASU" })
    await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(caseRetraite).not.toHaveAttribute("aria-describedby")
    expect(screen.queryByText(/^coût :/)).not.toBeInTheDocument()
  })
})
