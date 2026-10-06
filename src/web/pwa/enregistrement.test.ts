// src/web/pwa/enregistrement.test.ts

import { afterEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { enregistrerLeServiceWorker, proposerParUneNotification, type ConteneurDeServiceWorkers, type Inscription, type Travailleur } from "./enregistrement"
import { MESSAGE_PRENDRE_LA_MAIN } from "./messages"

const BASE = "/simulateur-independant-fr/"

afterEach(() => vi.restoreAllMocks())

/** Un service worker imité, dont on fait changer l'état. */
function travailleur(): Travailleur & { changer(etat: string): void } {
  const ecouteurs: (() => void)[] = []
  return {
    state: "installing",
    postMessage: vi.fn(),
    addEventListener: (_type, ecouteur) => void ecouteurs.push(ecouteur),
    changer(etat) {
      this.state = etat
      ecouteurs.forEach(ecouteur => ecouteur())
    }
  }
}

/** `navigator.serviceWorker` imité ; `trouverUneMiseAJour` imite l'arrivée d'une nouvelle version. */
function navigateur({ controller = {} as unknown, waiting = null as Travailleur | null } = {}) {
  const surMiseAJour: (() => void)[] = []
  const surChangement: (() => void)[] = []
  const inscription: Inscription = { waiting, installing: null, addEventListener: (_type, ecouteur) => void surMiseAJour.push(ecouteur) }
  const conteneur: ConteneurDeServiceWorkers = {
    controller,
    register: vi.fn(async () => inscription),
    addEventListener: (_type, ecouteur) => void surChangement.push(ecouteur)
  }
  return {
    conteneur,
    inscription,
    trouverUneMiseAJour(nouvelle: Travailleur) {
      inscription.installing = nouvelle
      surMiseAJour.forEach(ecouteur => ecouteur())
    },
    prendreLaMain: () => surChangement.forEach(ecouteur => ecouteur())
  }
}

describe("enregistrement du service worker", () => {
  it("enregistre sw.js à la racine de la démo, pour toutes ses adresses", async () => {
    const { conteneur, inscription } = navigateur()
    expect(await enregistrerLeServiceWorker(BASE, { conteneur, proposerLaMiseAJour: vi.fn(), recharger: vi.fn() })).toBe(inscription)
    expect(conteneur.register).toHaveBeenCalledWith(`${BASE}sw.js`, { scope: BASE })
  })

  it("laisse la démo fonctionner en ligne si le navigateur refuse ou bloque le service worker", async () => {
    const avertissement = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const refuse = navigateur()
    refuse.conteneur.register = vi.fn(async () => Promise.reject(new Error("refusé")))
    expect(await enregistrerLeServiceWorker(BASE, { conteneur: refuse.conteneur, proposerLaMiseAJour: vi.fn(), recharger: vi.fn() })).toBeNull()
    expect(avertissement).toHaveBeenCalledOnce()

    const bloque = navigateur()
    bloque.conteneur.register = vi.fn(async () => undefined)
    expect(await enregistrerLeServiceWorker(BASE, { conteneur: bloque.conteneur, proposerLaMiseAJour: vi.fn(), recharger: vi.fn() })).toBeNull()
  })

  it("à la première visite, la version installée s'active sans rien proposer", async () => {
    const { conteneur, trouverUneMiseAJour } = navigateur({ controller: null })
    const proposerLaMiseAJour = vi.fn()
    await enregistrerLeServiceWorker(BASE, { conteneur, proposerLaMiseAJour, recharger: vi.fn() })
    const premiere = travailleur()
    trouverUneMiseAJour(premiere)
    premiere.changer("installed")
    expect(proposerLaMiseAJour).not.toHaveBeenCalled()
  })

  it("propose une nouvelle version une fois installée ; accepter l'active, puis recharge la page", async () => {
    const { conteneur, trouverUneMiseAJour, prendreLaMain } = navigateur()
    const proposerLaMiseAJour = vi.fn()
    const recharger = vi.fn()
    await enregistrerLeServiceWorker(BASE, { conteneur, proposerLaMiseAJour, recharger })

    const nouvelle = travailleur()
    trouverUneMiseAJour(nouvelle)
    expect(proposerLaMiseAJour).not.toHaveBeenCalled()
    nouvelle.changer("installed")
    expect(proposerLaMiseAJour).toHaveBeenCalledOnce()

    const accepter = proposerLaMiseAJour.mock.calls[0][0] as () => void
    accepter()
    expect(nouvelle.postMessage).toHaveBeenCalledWith(MESSAGE_PRENDRE_LA_MAIN)
    expect(recharger).not.toHaveBeenCalled()
    prendreLaMain()
    expect(recharger).toHaveBeenCalledOnce()
  })

  it("propose aussi la version déjà en attente à l'ouverture de la page", async () => {
    const enAttente = travailleur()
    const { conteneur } = navigateur({ waiting: enAttente })
    const proposerLaMiseAJour = vi.fn()
    await enregistrerLeServiceWorker(BASE, { conteneur, proposerLaMiseAJour, recharger: vi.fn() })
    expect(proposerLaMiseAJour).toHaveBeenCalledOnce()
  })

  it("annonce la nouvelle version par une notification qui reste affichée, avec un bouton « Recharger »", () => {
    const info = vi.spyOn(toast, "info").mockReturnValue("nouvelle-version")
    const accepter = vi.fn()
    proposerParUneNotification(accepter)
    expect(info).toHaveBeenCalledWith("Nouvelle version disponible", expect.objectContaining({ duration: Infinity, action: { label: "Recharger", onClick: accepter } }))
  })
})
