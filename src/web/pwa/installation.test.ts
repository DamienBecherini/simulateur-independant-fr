// src/web/pwa/installation.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"

/** Le module rechargé à chaque test (il garde l'invitation du navigateur), avec une cible d'événements à part. */
async function charger() {
  vi.resetModules()
  const stockage = await import("../stockage-navigateur")
  const demanderUnStockagePersistant = vi.spyOn(stockage, "demanderUnStockagePersistant").mockResolvedValue(true)
  const installation = await import("./installation")
  const cible = new EventTarget()
  installation.suivreLInstallation(cible)
  return { ...installation, cible, demanderUnStockagePersistant }
}

/** L'événement `beforeinstallprompt` imité, avec la réponse de l'utilisateur. */
function invitation(reponse: "accepted" | "dismissed") {
  return Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt: vi.fn(async () => undefined), userChoice: Promise.resolve({ outcome: reponse }) })
}

beforeEach(() => vi.restoreAllMocks())

describe("installation de la démo", () => {
  it("n'est pas proposée tant que le navigateur ne l'annonce pas", async () => {
    const { installationPossible, installer } = await charger()
    expect(installationPossible()).toBe(false)
    expect(await installer()).toBe(false)
  })

  it("garde l'invitation du navigateur, à la place de son propre bandeau, et prévient l'interface", async () => {
    const { cible, installationPossible, surLInstallation } = await charger()
    const abonne = vi.fn()
    const desabonner = surLInstallation(abonne)
    const evenement = invitation("accepted")
    cible.dispatchEvent(evenement)
    expect(evenement.defaultPrevented).toBe(true)
    expect(installationPossible()).toBe(true)
    expect(abonne).toHaveBeenCalledOnce()

    desabonner()
    cible.dispatchEvent(invitation("accepted"))
    expect(abonne).toHaveBeenCalledOnce()
  })

  it("ouvre l'installation du navigateur une seule fois par invitation, et rend la réponse de l'utilisateur", async () => {
    const { cible, installationPossible, installer } = await charger()
    const acceptee = invitation("accepted")
    cible.dispatchEvent(acceptee)
    expect(await installer()).toBe(true)
    expect(acceptee.prompt).toHaveBeenCalledOnce()
    expect(installationPossible()).toBe(false)

    cible.dispatchEvent(invitation("dismissed"))
    expect(await installer()).toBe(false)
  })

  it("une fois la démo installée, ne la propose plus et demande un stockage persistant", async () => {
    const { cible, installationPossible, demanderUnStockagePersistant } = await charger()
    cible.dispatchEvent(invitation("accepted"))
    cible.dispatchEvent(new Event("appinstalled"))
    expect(installationPossible()).toBe(false)
    expect(demanderUnStockagePersistant).toHaveBeenCalledOnce()
  })
})
