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
    const { cible, installationPossible, demoInstallee, demanderUnStockagePersistant } = await charger()
    expect(demoInstallee(dansUnOnglet)).toBe(false)
    cible.dispatchEvent(invitation("accepted"))
    cible.dispatchEvent(new Event("appinstalled"))
    expect(installationPossible()).toBe(false)
    expect(demoInstallee(dansUnOnglet)).toBe(true)
    expect(demanderUnStockagePersistant).toHaveBeenCalledOnce()
  })
})

const dansUnOnglet = { matchMedia: () => ({ matches: false }), navigator: {} }

describe("démo déjà installée", () => {
  it("se reconnaît à sa fenêtre à part (display-mode: standalone), ou sur iPhone à navigator.standalone", async () => {
    const { demoInstallee } = await charger()
    const requetes: string[] = []
    expect(demoInstallee({ matchMedia: requete => (requetes.push(requete), { matches: true }), navigator: {} })).toBe(true)
    expect(requetes).toEqual(["(display-mode: standalone)"])
    expect(demoInstallee({ navigator: { standalone: true } })).toBe(true)
    expect(demoInstallee(dansUnOnglet)).toBe(false)
    expect(demoInstallee({ navigator: {} })).toBe(false)
  })
})

describe("famille du navigateur", () => {
  it("reconnaît Edge, Chrome et les autres navigateurs Chromium", async () => {
    const { familleDuNavigateur } = await charger()
    expect(familleDuNavigateur({ userAgent: "", userAgentData: { brands: [{ brand: "Not)A;Brand" }, { brand: "Chromium" }, { brand: "Microsoft Edge" }] } })).toBe("chromium")
    expect(familleDuNavigateur({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0" })).toBe("chromium")
    expect(familleDuNavigateur({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36" })).toBe("chromium")
  })

  it("classe à part Firefox, Safari et les navigateurs d'iPhone, qui n'installent pas un site de la même façon", async () => {
    const { familleDuNavigateur } = await charger()
    expect(familleDuNavigateur({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0" })).toBe("autre")
    expect(familleDuNavigateur({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15" })).toBe("autre")
    expect(familleDuNavigateur({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1" })).toBe("autre")
    expect(familleDuNavigateur({ userAgent: "", userAgentData: { brands: [] } })).toBe("autre")
  })
})
