// src/web/pwa/enregistrement.ts
// Enregistrement du service worker de la démo web (service-worker.ts), et annonce d'une nouvelle version.
//
// Une nouvelle publication s'installe en arrière-plan ; l'ancienne version reste en service tant qu'une fenêtre de la
// démo est ouverte, et la nouvelle prend sa place à l'ouverture suivante, sans rien demander. En attendant, une
// notification « Nouvelle version disponible » propose de recharger tout de suite.

import { toast } from "sonner"
import { FICHIER_DU_SERVICE_WORKER } from "./manifeste"
import { MESSAGE_PRENDRE_LA_MAIN } from "./messages"

/** Ce qui sert ici de l'interface ServiceWorker du navigateur. */
export interface Travailleur {
  state: string
  postMessage(message: unknown): void
  addEventListener(type: "statechange", ecouteur: () => void): void
}

export interface Inscription {
  waiting: Travailleur | null
  installing: Travailleur | null
  addEventListener(type: "updatefound", ecouteur: () => void): void
}

/** Ce qui sert ici de `navigator.serviceWorker`. */
export interface ConteneurDeServiceWorkers {
  /** Le service worker qui sert la page ; absent à la première visite. */
  controller: unknown
  /** Rend `undefined` quand l'outil de test bloque les service workers (Playwright, `serviceWorkers: "block"`). */
  register(adresse: string, options: { scope: string }): Promise<Inscription | undefined>
  addEventListener(type: "controllerchange", ecouteur: () => void, options: { once: boolean }): void
}

export interface OptionsDEnregistrement {
  conteneur: ConteneurDeServiceWorkers
  /** Montre la proposition de mise à jour ; `accepter` active la nouvelle version, puis la page se recharge. */
  proposerLaMiseAJour: (accepter: () => void) => void
  recharger: () => void
}

/** Enregistre le service worker de la démo publiée sous `base` ; `null` si le navigateur le refuse. */
export async function enregistrerLeServiceWorker(base: string, { conteneur, proposerLaMiseAJour, recharger }: OptionsDEnregistrement): Promise<Inscription | null> {
  let inscription: Inscription | undefined
  try {
    inscription = await conteneur.register(`${base}${FICHIER_DU_SERVICE_WORKER}`, { scope: base })
  } catch (error) {
    // Navigation privée de certains navigateurs, ou service workers bloqués : la démo fonctionne, en ligne seulement.
    console.warn("Démo web : service worker indisponible, pas de fonctionnement hors ligne.", error instanceof Error ? error.message : error)
    return null
  }
  if (!inscription) return null

  // À la première visite, aucune version n'est en service : la nouvelle s'active seule, sans rien proposer.
  const proposer = (enAttente: Travailleur) => {
    if (!conteneur.controller) return
    proposerLaMiseAJour(() => {
      conteneur.addEventListener("controllerchange", recharger, { once: true })
      enAttente.postMessage(MESSAGE_PRENDRE_LA_MAIN)
    })
  }

  if (inscription.waiting) proposer(inscription.waiting)
  inscription.addEventListener("updatefound", () => {
    const nouvelle = inscription.installing
    nouvelle?.addEventListener("statechange", () => {
      if (nouvelle.state === "installed") proposer(nouvelle)
    })
  })
  return inscription
}

/** La notification de mise à jour, avec son bouton « Recharger » ; elle reste affichée jusqu'au clic ou à sa fermeture. */
export function proposerParUneNotification(accepter: () => void) {
  toast.info("Nouvelle version disponible", {
    id: "nouvelle-version",
    description: "Rechargez pour l'utiliser ; vos simulations sont conservées.",
    duration: Infinity,
    action: { label: "Recharger", onClick: accepter }
  })
}
