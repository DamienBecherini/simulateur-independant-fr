// @vitest-environment jsdom
// src/web/stockage-plein.test.ts
// Démo web : stockage du navigateur plein ou bloqué, valeurs illisibles. Un échec d'écriture est signalé au lieu de
// « Sauvegarde réussie ! », et une valeur illisible est mise de côté avant d'être remplacée.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { NotificationPayload, SaveSlot } from "@/types"
import { sessionExemple } from "./session-exemple"
import { CLES } from "./stockage-navigateur"

const MAINTENANT = new Date(2026, 9, 9, 14, 30, 5)

/** Un pont neuf (les clés protégées ne survivent pas d'un test à l'autre), abonné aux notifications. */
async function pont() {
  vi.resetModules()
  const { creerApiNavigateur, MESSAGES_DE_LA_DEMO } = await import("./api-navigateur")
  const api = creerApiNavigateur()
  const notifications: NotificationPayload[] = []
  api.onShowNotification(notification => notifications.push(notification))
  return { api, notifications, MESSAGES_DE_LA_DEMO }
}

function stockagePlein() {
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Quota dépassé", "QuotaExceededError")
  })
}

const sauvegarde = (id: string, name: string): SaveSlot => ({ ...sessionExemple(), id, name, lastModified: 1 })

beforeEach(() => {
  window.localStorage.clear()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(MAINTENANT)
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("démo web : stockage plein ou bloqué", () => {
  it("quota dépassé : la sauvegarde échoue avec un message, et les sauvegardes précédentes sont intactes", async () => {
    const { api, notifications } = await pont()
    expect(await api.saveSlots([sauvegarde("slot-1", "A")])).toBe(true)
    const avant = window.localStorage.getItem(CLES.sauvegardes)
    stockagePlein()

    expect(await api.saveSlots([sauvegarde("slot-1", "A"), sauvegarde("slot-2", "B")])).toBe(false)

    expect(notifications).toEqual([
      { message: "Sauvegarde réussie !", type: "success" },
      { message: "Échec de la sauvegarde : le stockage du navigateur est plein ou bloqué. Vos sauvegardes précédentes sont intactes.", type: "error" }
    ])
    expect(window.localStorage.getItem(CLES.sauvegardes)).toBe(avant)
  })

  it("un échec de la sauvegarde automatique est signalé une fois, puis à nouveau après une réussite", async () => {
    const { api, notifications, MESSAGES_DE_LA_DEMO } = await pont()
    const plein = stockagePlein()
    await api.saveCurrentSession(sessionExemple())
    api.saveCurrentSessionSync(sessionExemple())
    await api.saveUserPreferences({ slotOrder: [] })
    plein.mockRestore()
    await api.saveCurrentSession(sessionExemple())
    stockagePlein()
    await api.saveCurrentSession(sessionExemple())

    expect(notifications).toEqual([
      { message: MESSAGES_DE_LA_DEMO.echecDeLaSession, type: "error" },
      { message: MESSAGES_DE_LA_DEMO.echecDesPreferences, type: "error" },
      { message: MESSAGES_DE_LA_DEMO.echecDeLaSession, type: "error" }
    ])
  })

  it("stockage bloqué par le navigateur : la démo démarre sur l'exemple et le dit", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Accès refusé", "SecurityError")
    })
    const { api, notifications, MESSAGES_DE_LA_DEMO } = await pont()

    expect(await api.getCurrentSession()).toEqual(sessionExemple())
    expect(notifications).toEqual([{ message: MESSAGES_DE_LA_DEMO.stockageBloque, type: "warning" }])
  })

  it("les messages du chargement attendent que l'interface soit abonnée", async () => {
    vi.resetModules()
    const { creerApiNavigateur } = await import("./api-navigateur")
    window.localStorage.setItem(CLES.sauvegardes, "[{ tronqué")
    const api = creerApiNavigateur()
    await api.getSaveSlots()

    const recues: NotificationPayload[] = []
    api.onShowNotification(notification => recues.push(notification))
    expect(recues).toEqual([expect.objectContaining({ type: "warning" })])
  })
})

describe("démo web : valeurs illisibles", () => {
  it("des sauvegardes illisibles sont mises de côté, telles quelles, avant la prochaine sauvegarde", async () => {
    window.localStorage.setItem(CLES.sauvegardes, "[{ tronqué")
    const { api, notifications } = await pont()

    expect(await api.getSaveSlots()).toEqual([])

    const copie = `${CLES.sauvegardes}.illisible-20261009-143005`
    expect(window.localStorage.getItem(copie)).toBe("[{ tronqué")
    expect(notifications).toEqual([{ message: `Vos sauvegardes enregistrées dans ce navigateur n'ont pas pu être lues. Une copie, telle quelle, a été gardée sous la clé « ${copie} » du stockage du navigateur. La liste des sauvegardes est vide.`, type: "warning" }])

    expect(await api.saveSlots([sauvegarde("slot-1", "Nouvelle")])).toBe(true)
    expect(window.localStorage.getItem(copie)).toBe("[{ tronqué")
  })

  it("une seconde copie à la même seconde ne remplace pas la première", async () => {
    const { api } = await pont()
    window.localStorage.setItem(CLES.sauvegardes, '{"pas": "une liste"}')
    await api.getSaveSlots()
    window.localStorage.setItem(CLES.sauvegardes, "autre")
    await api.getSaveSlots()

    expect(window.localStorage.getItem(`${CLES.sauvegardes}.illisible-20261009-143005`)).toBe('{"pas": "une liste"}')
    expect(window.localStorage.getItem(`${CLES.sauvegardes}.illisible-20261009-143005-2`)).toBe("autre")
  })

  it("une session illisible est mise de côté ; la démo repart de l'exemple", async () => {
    window.localStorage.setItem(CLES.session, "{pas du json")
    const { api, notifications } = await pont()

    expect(await api.getCurrentSession()).toEqual(sessionExemple())

    expect(window.localStorage.getItem(`${CLES.session}.illisible-20261009-143005`)).toBe("{pas du json")
    expect(window.localStorage.getItem(CLES.session)).toBeNull()
    expect(notifications[0]).toMatchObject({ type: "warning", message: expect.stringContaining("La démo a redémarré sur la simulation d'exemple.") })
  })

  it("illisible et impossible à mettre de côté (stockage plein) : n'est jamais remplacée pendant la visite", async () => {
    window.localStorage.setItem(CLES.sauvegardes, "[{ tronqué")
    window.localStorage.setItem(CLES.session, "[1]")
    const { api, notifications, MESSAGES_DE_LA_DEMO } = await pont()
    stockagePlein()

    expect(await api.getSaveSlots()).toEqual([])
    expect(await api.getCurrentSession()).toEqual(sessionExemple())
    vi.mocked(Storage.prototype.setItem).mockRestore()

    expect(await api.saveSlots([sauvegarde("slot-1", "Nouvelle")])).toBe(false)
    await api.saveCurrentSession(sessionExemple())
    expect(window.localStorage.getItem(CLES.sauvegardes)).toBe("[{ tronqué")
    expect(window.localStorage.getItem(CLES.session)).toBe("[1]")
    expect(notifications.map(n => n.message)).toEqual([
      "Vos sauvegardes enregistrées dans ce navigateur n'ont pas pu être lues. Elles n'ont pas pu être mises de côté (stockage plein ?) : elles ne seront pas remplacées pendant cette visite. La liste des sauvegardes est vide.",
      "Votre session enregistrée dans ce navigateur n'a pas pu être lue. Elle n'a pas pu être mise de côté (stockage plein ?) : elle ne sera pas remplacée pendant cette visite. La démo a redémarré sur la simulation d'exemple.",
      MESSAGES_DE_LA_DEMO.echecDesSauvegardes,
      MESSAGES_DE_LA_DEMO.echecDeLaSession
    ])
  })
})
