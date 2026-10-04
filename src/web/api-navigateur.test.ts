// @vitest-environment jsdom
// src/web/api-navigateur.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SaveSlot } from "@/types"
import { FORMAT_VERSION_ACTUEL } from "@/backend/logic/migrations"
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
    expect(stocke(CLES.session)).toMatchObject({ name: "Ma simulation", formatVersion: FORMAT_VERSION_ACTUEL })
    expect(await api.getCurrentSession()).toEqual(session)
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
    const rapport = await creerApiNavigateur().runMetaSimulation({ name: 42 } as never)
    expect(rapport.foyers).toEqual([])
  })

  it("calcule la simulation et la comparaison dans la page", async () => {
    const api = creerApiNavigateur()
    const rapport = await api.runMetaSimulation(sessionExemple())
    expect(rapport.foyers.length).toBeGreaterThan(0)

    const comparaison = await api.compareStatuts(sessionExemple(), { activityId: "micro-atelier", remunerationNette: 0, distribuerToutLeBenefice: true, partBncPrestations: 1 })
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

  it("exporte en faisant télécharger un fichier JSON", async () => {
    const creerUrl = vi.fn(() => "blob:export")
    Object.assign(URL, { createObjectURL: creerUrl, revokeObjectURL: vi.fn() })
    const telechargement = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    const { entities, relationships, monthlyData } = sessionExemple()

    await creerApiNavigateur().exportState({ entities, relationships, monthlyData })

    expect(telechargement).toHaveBeenCalledOnce()
    const fichier = (creerUrl.mock.calls[0] as unknown as [Blob])[0]
    expect(JSON.parse(await fichier.text())).toMatchObject({ entities, formatVersion: FORMAT_VERSION_ACTUEL })
  })

  it("importe un fichier choisi par l'utilisateur, nettoyé comme dans l'application de bureau", async () => {
    const { entities, relationships, monthlyData } = sessionExemple()
    choisirLeFichier(JSON.stringify({ entities, relationships: [...relationships, { id: "orpheline", fromId: "inconnu", toId: "person-lea", type: "Enfant" }], monthlyData }))

    const resultat = await creerApiNavigateur().importState()

    expect(resultat.data?.entities).toEqual(entities)
    expect(resultat.report?.relationshipsRemoved).toBe(1)
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
