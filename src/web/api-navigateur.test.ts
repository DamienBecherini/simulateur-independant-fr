// @vitest-environment jsdom
// src/web/api-navigateur.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SaveSlot } from "@/types"
import { FORMAT_VERSION_ACTUEL } from "@/backend/logic/migrations"
import { ADRESSE_E_MAIL_DES_RETOURS, ADRESSE_NOUVEAU_TICKET } from "@/lib/adresses-des-retours"
import { VERSION_DE_L_APPLICATION } from "@/lib/version"
import { creerApiNavigateur } from "./api-navigateur"
import { sessionExemple } from "./session-exemple"
import { CLES } from "./stockage-navigateur"

const stocke = (cle: string) => JSON.parse(window.localStorage.getItem(cle)!)

/** Fait choisir au sélecteur de fichiers un fichier au contenu donné. */
function choisirLeFichier(contenu: string) {
  vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
    Object.defineProperty(this, "files", { value: [new File([contenu], "export.json", { type: "application/json" })] })
    this.dispatchEvent(new Event("change"))
  })
}

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe("pont de la démo web", () => {
  it("ouvre la simulation d'exemple à la première visite, et la session enregistrée ensuite", async () => {
    const api = creerApiNavigateur()
    expect(await api.getCurrentSession()).toEqual(sessionExemple())

    const session = { ...sessionExemple(), name: "Ma simulation" }
    await api.saveCurrentSession(session)
    // La session enregistrée porte la version de l'application qui l'a écrite.
    expect(stocke(CLES.session)).toMatchObject({ name: "Ma simulation", formatVersion: FORMAT_VERSION_ACTUEL, appVersion: VERSION_DE_L_APPLICATION })
    expect(await api.getCurrentSession()).toEqual({ ...session, appVersion: VERSION_DE_L_APPLICATION })
  })

  it("enregistre aussi la session de façon synchrone, à la fermeture de la page", () => {
    creerApiNavigateur().saveCurrentSessionSync({ ...sessionExemple(), name: "Fermeture" })
    expect(stocke(CLES.session).name).toBe("Fermeture")
  })

  it("repart de l'exemple si le stockage est illisible", async () => {
    window.localStorage.setItem(CLES.session, "{pas du json")
    expect(await creerApiNavigateur().getCurrentSession()).toEqual(sessionExemple())
  })

  it("continue sans planter si le stockage est plein ou bloqué", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota dépassé", "QuotaExceededError")
    })
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {})

    await creerApiNavigateur().saveCurrentSession(sessionExemple())

    expect(erreur).toHaveBeenCalledWith("Stockage du navigateur indisponible :", expect.any(DOMException))
  })

  it("calcule une session vide si l'interface envoie une session invalide", async () => {
    const { annees: [{ report: rapport }] } = await creerApiNavigateur().simulerLesAnnees({ name: 42 } as never)
    expect(rapport?.foyers).toEqual([])
  })

  it("calcule la simulation et la comparaison dans la page", async () => {
    const api = creerApiNavigateur()
    const { annees: [{ report: rapport }] } = await api.simulerLesAnnees(sessionExemple())
    expect(rapport?.foyers.length).toBeGreaterThan(0)

    const comparaison = await api.compareStatuts(sessionExemple(), { activityId: "micro-atelier", remunerationNette: 0, repartition: { mode: "dividendes", partDistribuee: 1 }, partBncPrestations: 1 }, 2026)
    expect(comparaison.scenarios.map(s => s.statut)).toContain("SASU")
  })

  it("conserve les sauvegardes et prévient l'interface", async () => {
    const api = creerApiNavigateur()
    const notification = vi.fn()
    const seDesabonner = api.onShowNotification(notification)
    const slot: SaveSlot = { ...sessionExemple(), id: "slot-1", lastModified: 1 }

    await api.saveSlots([slot])
    expect(await api.getSaveSlots()).toEqual([slot])
    expect(notification).toHaveBeenCalledWith({ message: "Sauvegarde réussie !", type: "success" })

    await api.saveSlots([slot], { silencieux: true })
    expect(notification).toHaveBeenCalledTimes(1)

    seDesabonner()
    await api.saveSlots([])
    expect(notification).toHaveBeenCalledTimes(1)
  })

  it("écarte une sauvegarde invalide avant de l'écrire", async () => {
    const api = creerApiNavigateur()
    const valide: SaveSlot = { ...sessionExemple(), id: "slot-1", lastModified: 1 }
    await api.saveSlots([valide, { id: 42 } as unknown as SaveSlot])
    expect(await api.getSaveSlots()).toEqual([valide])
  })

  it("conserve les préférences, avec une valeur par défaut", async () => {
    const api = creerApiNavigateur()
    expect(await api.getUserPreferences()).toEqual({ slotOrder: [] })
    await api.saveUserPreferences({ slotOrder: ["slot-1"] })
    expect(await api.getUserPreferences()).toEqual({ slotOrder: ["slot-1"] })
  })

  it("écarte un champ invalide des préférences, sans perdre les autres", async () => {
    window.localStorage.setItem(CLES.preferences, JSON.stringify({ slotOrder: "abîmé", zoom: 7, loadedSlotId: "slot-1", affichage: "vues", sectionsOuvertes: { "legende-des-flux": "oui" } }))
    expect(await creerApiNavigateur().getUserPreferences()).toEqual({ slotOrder: [], loadedSlotId: "slot-1", affichage: "vues" })
  })

  it("repart des préférences par défaut si le stockage n'en contient pas d'utilisables", async () => {
    window.localStorage.setItem(CLES.preferences, "[1, 2]")
    expect(await creerApiNavigateur().getUserPreferences()).toEqual({ slotOrder: [] })
    window.localStorage.setItem(CLES.preferences, "{pas du json")
    expect(await creerApiNavigateur().getUserPreferences()).toEqual({ slotOrder: [] })
  })

  it("valide aussi les préférences avant de les écrire", async () => {
    await creerApiNavigateur().saveUserPreferences({ slotOrder: ["slot-1"], zoom: -3 })
    expect(stocke(CLES.preferences)).toEqual({ slotOrder: ["slot-1"] })
  })

  it("exporte en faisant télécharger un fichier JSON", async () => {
    const creerUrl = vi.fn(() => "blob:export")
    Object.assign(URL, { createObjectURL: creerUrl, revokeObjectURL: vi.fn() })
    const telechargement = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    const { entities, relationships, annees } = sessionExemple()

    await creerApiNavigateur().exportState({ entities, relationships, annees })

    expect(telechargement).toHaveBeenCalledOnce()
    const fichier = (creerUrl.mock.calls[0] as unknown as [Blob])[0]
    expect(JSON.parse(await fichier.text())).toMatchObject({ entities, formatVersion: FORMAT_VERSION_ACTUEL, appVersion: VERSION_DE_L_APPLICATION })
  })

  it("garde à l'import la version de l'application qui a écrit le fichier", async () => {
    const { entities, relationships, annees } = sessionExemple()
    choisirLeFichier(JSON.stringify({ entities, relationships, annees, formatVersion: FORMAT_VERSION_ACTUEL, appVersion: "0.8.0" }))
    expect((await creerApiNavigateur().importState()).data?.appVersion).toBe("0.8.0")
  })

  it("importe un fichier choisi par l'utilisateur, nettoyé comme dans l'application de bureau", async () => {
    const { entities, relationships, annees } = sessionExemple()
    choisirLeFichier(JSON.stringify({ entities, relationships: [...relationships, { id: "orpheline", fromId: "inconnu", toId: "person-lea", type: "Enfant" }], annees, formatVersion: FORMAT_VERSION_ACTUEL }))

    const resultat = await creerApiNavigateur().importState()

    expect(resultat.data?.entities).toEqual(entities)
    expect(resultat.report?.relationshipsRemoved).toBe(1)
  })

  it("importe une simulation exportée au format 2 dans l'année 2026", async () => {
    const { entities, relationships, annees } = sessionExemple()
    choisirLeFichier(JSON.stringify({ entities, relationships, monthlyData: annees[0].monthlyData, formatVersion: 2 }))

    const resultat = await creerApiNavigateur().importState()

    expect(resultat.data?.annees).toEqual([{ annee: 2026, monthlyData: annees[0].monthlyData }])
    expect(resultat.report?.migrationNotes).toEqual([expect.stringContaining("placée en 2026")])
  })

  it("importe une simulation au format 1, sans numéro de format, jusqu'au format actuel", async () => {
    // Format 1 : ni numéro de format, ni capital social pour l'EURL, une seule grille.
    const eurl = { id: "company-eurl", type: "company", name: "Mon EURL", legalStatus: "EURL", avatar: { type: "icon", value: "Building", color: "#22c55e" }, locked: false }
    const { annees } = sessionExemple()
    choisirLeFichier(JSON.stringify({ name: "Ancienne", entities: [eurl], relationships: [], monthlyData: annees[0].monthlyData.map(mois => ({ ...mois, flows: [] })) }))

    const resultat = await creerApiNavigateur().importState()

    expect(resultat.data?.entities).toEqual([expect.objectContaining({ id: "company-eurl", capitalSocial: 1000 })])
    expect(resultat.data?.annees.map(a => a.annee)).toEqual([2026])
    expect(resultat.report?.migrationNotes).toEqual(expect.arrayContaining([expect.stringContaining("capital social"), expect.stringContaining("placée en 2026")]))
  })

  it("importe un fichier de plusieurs années écrit à la main : années triées, doublon écarté avec ses flux", async () => {
    const { entities, relationships, annees } = sessionExemple()
    const grille = annees[0].monthlyData
    choisirLeFichier(JSON.stringify({ entities, relationships, annees: [{ annee: 2026, monthlyData: grille }, { annee: 2025, monthlyData: grille }, { annee: 2026, monthlyData: grille }], formatVersion: FORMAT_VERSION_ACTUEL }))

    const resultat = await creerApiNavigateur().importState()

    expect(resultat.data?.annees.map(a => a.annee)).toEqual([2025, 2026])
    expect(resultat.report?.flowsRemoved).toBe(grille.reduce((n, mois) => n + mois.flows.length, 0))
    expect(resultat.report?.anneesEcartees).toEqual([2026])
  })

  it("refuse un fichier dont les années ne se suivent pas, et dit lesquelles manquent", async () => {
    const { entities, relationships, annees } = sessionExemple()
    choisirLeFichier(JSON.stringify({ entities, relationships, annees: [2024, 2026].map(annee => ({ annee, monthlyData: annees[0].monthlyData })), formatVersion: FORMAT_VERSION_ACTUEL }))
    const api = creerApiNavigateur()
    const notification = vi.fn()
    api.onShowNotification(notification)

    const resultat = await api.importState()

    expect(resultat).toEqual({ error: expect.stringContaining("il manque 2025 entre 2024 et 2026") })
    expect(notification).toHaveBeenCalledWith({ message: expect.stringMatching(/^Import impossible\. Les années de cette simulation ne se suivent pas/), type: "error" })
  })

  it("repart d'une session vierge si la session du navigateur a été modifiée avec des années refusées", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const { entities, relationships, annees } = sessionExemple()
    window.localStorage.setItem(CLES.session, JSON.stringify({ entities, relationships, annees: [2024, 2026].map(annee => ({ annee, monthlyData: annees[0].monthlyData })), formatVersion: FORMAT_VERSION_ACTUEL }))

    const session = await creerApiNavigateur().getCurrentSession()

    expect(session.entities).toEqual([])
    expect(session.annees.map(a => a.annee)).toEqual([2026])
  })

  it("n'importe rien si l'utilisateur ferme le sélecteur de fichiers", async () => {
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
      this.dispatchEvent(new Event("cancel"))
    })
    expect(await creerApiNavigateur().importState()).toEqual({ data: undefined })
  })

  it("fait télécharger un fichier texte, au bon type", async () => {
    const creerUrl = vi.fn(() => "blob:texte")
    Object.assign(URL, { createObjectURL: creerUrl, revokeObjectURL: vi.fn() })
    const telechargement = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    expect(await creerApiNavigateur().saveTextFile({ defaultName: "grille.csv", content: "a;b", format: "csv" })).toBe(true)

    expect(telechargement).toHaveBeenCalledOnce()
    const fichier = (creerUrl.mock.calls[0] as unknown as [Blob])[0]
    expect(fichier.type).toBe("text/csv;charset=utf-8")
    expect(await fichier.text()).toBe("a;b")
  })

  it("ouvre un fichier texte choisi par l'utilisateur", async () => {
    choisirLeFichier("contenu du fichier")
    expect(await creerApiNavigateur().openTextFile({ title: "Importer", format: "json" })).toBe("contenu du fichier")
  })

  it("ouvre l'impression du navigateur pour le PDF", async () => {
    const imprimer = vi.spyOn(window, "print").mockImplementation(() => {})
    expect(await creerApiNavigateur().printToPdf("simulation.pdf")).toBe(true)
    expect(imprimer).toHaveBeenCalledOnce()
  })

  it("ouvre le formulaire de ticket dans un nouvel onglet détaché, l'e-mail des retours dans la messagerie, et rien d'autre", async () => {
    const ouvrir = vi.spyOn(window, "open").mockImplementation(() => null)
    const api = creerApiNavigateur()
    const ticket = `${ADRESSE_NOUVEAU_TICKET}?template=retour.yml&note=%E2%98%85`
    const eMail = `mailto:${ADRESSE_E_MAIL_DES_RETOURS}?subject=Retour`

    expect(await api.ouvrirAdresseExterne(ticket)).toBe(true)
    expect(ouvrir).toHaveBeenLastCalledWith(ticket, "_blank", "noopener,noreferrer")
    expect(await api.ouvrirAdresseExterne(eMail)).toBe(true)
    expect(ouvrir).toHaveBeenLastCalledWith(eMail, "_self")

    expect(await api.ouvrirAdresseExterne("https://example.org/")).toBe(false)
    expect(await api.ouvrirAdresseExterne("mailto:quelquun@example.org")).toBe(false)
    expect(ouvrir).toHaveBeenCalledTimes(2)
  })

  it("signale un fichier importé illisible", async () => {
    choisirLeFichier("{pas du json")
    const api = creerApiNavigateur()
    const notification = vi.fn()
    api.onShowNotification(notification)

    const resultat = await api.importState()

    expect(resultat.error).toBeDefined()
    expect(notification).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }))
  })

  it("réinitialise la démo sans que la sauvegarde du rechargement réécrive la session", async () => {
    vi.resetModules()
    const { creerApiNavigateur: creer } = await import("./api-navigateur")
    const { reinitialiserDemo } = await import("./stockage-navigateur")
    const api = creer()
    await api.saveCurrentSession({ ...sessionExemple(), name: "Modifiée" })

    reinitialiserDemo()
    api.saveCurrentSessionSync({ ...sessionExemple(), name: "Modifiée" })

    expect(window.localStorage.getItem(CLES.session)).toBeNull()
  })
})
