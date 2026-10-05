// src/ui/exports-texte.test.tsx
// Exports CSV et Markdown de la fenêtre « Exporter » : nom et contenu du fichier, notification de succès ou d'échec.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionState, SimulationReport } from "@/types"
import { emptyReport, emptySession, makeCompany, makeFlow, makePerson } from "@/ui/testing/fixtures"
import { ExportDialog } from "./components/ExportDialog"

function sessionAvecSociete(): SessionState {
  const session = { ...emptySession(), entities: [makePerson(), makeCompany()] }
  session.annees[0].monthlyData[0] = { month: 0, flows: [makeFlow({ entityId: "company-sasu", type: "ca_services", amount: 5000 })] }
  return session
}

function ouvrir(session: SessionState = sessionAvecSociete(), report: SimulationReport | null = emptyReport()) {
  const onClose = vi.fn()
  render(<ExportDialog isOpen onClose={onClose} session={session} annee={2026} simulationReport={report} onExportJson={vi.fn()} />)
  return onClose
}

const fichierEnregistre = () => vi.mocked(window.api.saveTextFile).mock.calls[0][0]

describe("exports CSV et Markdown de la fenêtre « Exporter »", () => {
  beforeEach(() => {
    vi.spyOn(toast, "success").mockImplementation(() => 0)
    vi.spyOn(toast, "error").mockImplementation(() => 0)
  })

  it("exporte la grille mensuelle en CSV, se referme et confirme l'enregistrement", async () => {
    const onClose = ouvrir()
    await userEvent.click(screen.getByRole("button", { name: /Grille mensuelle \(CSV\)/ }))

    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Export enregistré : nouvelle-simulation-grille-2026.csv"))
    expect(onClose).toHaveBeenCalled()
    const { defaultName, content, format } = fichierEnregistre()
    expect(defaultName).toBe("nouvelle-simulation-grille-2026.csv")
    expect(format).toBe("csv")
    expect(content.startsWith("\uFEFFActeur;Nature;Flux;Sens;Janvier;")).toBe(true)
    expect(content).toContain("\r\nMa SASU;SASU;CA - Prestation de services;Entrée;5000,00;0,00;")
  })

  it("nomme la grille d'après l'année affichée, même sans résultats", async () => {
    ouvrir(sessionAvecSociete(), null)
    await userEvent.click(screen.getByRole("button", { name: /Grille mensuelle \(CSV\)/ }))
    await vi.waitFor(() => expect(fichierEnregistre().defaultName).toBe("nouvelle-simulation-grille-2026.csv"))
  })

  it("ne dit rien quand l'utilisateur annule l'enregistrement", async () => {
    vi.mocked(window.api.saveTextFile).mockResolvedValue(false)
    ouvrir()
    await userEvent.click(screen.getByRole("button", { name: /Grille mensuelle \(CSV\)/ }))

    await vi.waitFor(() => expect(window.api.saveTextFile).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("signale un enregistrement qui échoue", async () => {
    vi.mocked(window.api.saveTextFile).mockRejectedValue(new Error("disque plein"))
    ouvrir()
    await userEvent.click(screen.getByRole("button", { name: /Grille mensuelle \(CSV\)/ }))
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("L'export n'a pas pu être enregistré."))
  })

  it("exporte les résultats en CSV", async () => {
    ouvrir()
    await userEvent.click(screen.getByRole("button", { name: /Résultats \(CSV\)/ }))

    await vi.waitFor(() => expect(window.api.saveTextFile).toHaveBeenCalled())
    expect(fichierEnregistre().defaultName).toBe("nouvelle-simulation-resultats-2026.csv")
    expect(fichierEnregistre().content).toContain("Bilan;Montant\r\nAnnée simulée;2025\r\nAnnée des règles fiscales;2025\r\n")
  })

  it("explique que les résultats ne sont pas encore calculés, sans rien enregistrer", async () => {
    ouvrir(sessionAvecSociete(), null)
    await userEvent.click(screen.getByRole("button", { name: /Résultats \(CSV\)/ }))

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/^Les résultats ne sont pas encore calculés/)))
    expect(window.api.saveTextFile).not.toHaveBeenCalled()
  })

  it("exporte le rapport Markdown, avec le comparateur calculé pour la première activité aux réglages par défaut tant que rien n'est choisi", async () => {
    ouvrir()
    await userEvent.click(screen.getByRole("button", { name: /Rapport complet \(Markdown\)/ }))

    await vi.waitFor(() => expect(window.api.saveTextFile).toHaveBeenCalled())
    expect(window.api.compareStatuts).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ activityId: "company-sasu", remunerationNette: 0, repartition: { mode: "meilleurNet", partDistribuee: 1 }, partBncPrestations: 1 }), 2026)
    const { defaultName, content, format } = fichierEnregistre()
    expect(defaultName).toBe("nouvelle-simulation-rapport-2026.md")
    expect(format).toBe("markdown")
    expect(content).toMatch(/^# Simulation « Nouvelle Simulation »\n/)
    expect(content).toContain("## Comparateur de statuts : « Ma SASU »")
    expect(toast.success).toHaveBeenCalledWith("Export enregistré : nouvelle-simulation-rapport-2026.md")
  })

  it("calcule le comparateur du rapport Markdown avec l'activité et les réglages enregistrés", async () => {
    const atelier = { ...makeCompany({ id: "company-eurl", name: "Mon EURL", legalStatus: "EURL" }) }
    const frais = { expertComptable: 0, banque: 0, logiciel: 0, assurance: 0, cfe: 0 }
    const fraisFonctionnement = { SASU: frais, EURL: { ...frais, cfe: 700 }, EI: frais, micro: frais }
    const session: SessionState = { ...sessionAvecSociete(), entities: [makePerson(), makeCompany(), atelier], comparateur: { activiteComparee: "company-eurl", reglagesParActivite: { "company-eurl": { repartition: { mode: "personnalisee", partDistribuee: 0.25 }, remunerationParAnnee: { "2026": 15000 }, partBncPrestations: 0.5, fraisFonctionnement } } } }
    ouvrir(session)
    await userEvent.click(screen.getByRole("button", { name: /Rapport complet \(Markdown\)/ }))

    await vi.waitFor(() => expect(window.api.saveTextFile).toHaveBeenCalled())
    expect(window.api.compareStatuts).toHaveBeenCalledWith(session, { activityId: "company-eurl", remunerationNette: 15000, repartition: { mode: "personnalisee", partDistribuee: 0.25 }, partBncPrestations: 0.5, fraisFonctionnement }, 2026)
    expect(fichierEnregistre().content).toContain("## Comparateur de statuts : « Mon EURL »")
    expect(fichierEnregistre().content).toContain("avec les réglages du comparateur")
  })

  it.each([
    [new Error("Moteur indisponible."), "Comparaison indisponible : Moteur indisponible."],
    ["erreur inconnue", "Comparaison indisponible : la comparaison a échoué."]
  ])("rédige le rapport même si la comparaison échoue (%s)", async (erreur, attendu) => {
    vi.mocked(window.api.compareStatuts).mockRejectedValue(erreur)
    ouvrir()
    await userEvent.click(screen.getByRole("button", { name: /Rapport complet \(Markdown\)/ }))
    await vi.waitFor(() => expect(fichierEnregistre().content).toContain(attendu))
  })

  it("rédige le rapport sans comparateur quand aucune activité n'est à comparer", async () => {
    ouvrir({ ...emptySession(), entities: [makePerson()] })
    await userEvent.click(screen.getByRole("button", { name: /Rapport complet \(Markdown\)/ }))
    await vi.waitFor(() => expect(fichierEnregistre().content).toContain("## Comparateur de statuts\n\nAucune activité à comparer."))
    expect(window.api.compareStatuts).not.toHaveBeenCalled()
  })
})
