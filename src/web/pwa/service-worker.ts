// src/web/pwa/service-worker.ts
// Service worker de la démo web, compilé par esbuild en dist-web/sw.js (vite-plugin-demo-installable.ts), qui y
// inscrit la liste des fichiers publiés et la version du cache. Il garde toute la démo (page, scripts, styles, polices,
// icônes) pour l'ouvrir hors ligne : le moteur de calcul tourne dans la page, rien d'autre n'est nécessaire.
//
// Mise à jour : à chaque publication, sw.js change, le navigateur installe la nouvelle version à côté de l'ancienne,
// qui reste en service jusqu'à la fermeture de toutes les fenêtres de la démo, ou jusqu'au clic sur « Recharger » de
// la notification « Nouvelle version disponible » (enregistrement.ts), qui envoie MESSAGE_PRENDRE_LA_MAIN.

import { cachesPerimes, nomDuCache, strategiePour } from "./strategie"
import { MESSAGE_PRENDRE_LA_MAIN } from "./messages"

declare const __FICHIERS_DU_CACHE__: string[]
declare const __VERSION_DU_CACHE__: string

// Les types du contexte d'un service worker (lib « webworker ») ne cohabitent pas avec ceux de la page (lib « DOM ») :
// seul ce qui sert ici est décrit.
interface EvenementProlongeable extends Event {
  waitUntil(promesse: Promise<unknown>): void
}
interface EvenementDeRequete extends EvenementProlongeable {
  request: Request
  respondWith(reponse: Promise<Response>): void
}
interface ContexteDuServiceWorker {
  registration: { scope: string }
  clients: { claim(): Promise<void> }
  skipWaiting(): Promise<void>
  addEventListener(type: "install" | "activate", ecouteur: (evenement: EvenementProlongeable) => void): void
  addEventListener(type: "fetch", ecouteur: (evenement: EvenementDeRequete) => void): void
  addEventListener(type: "message", ecouteur: (evenement: MessageEvent) => void): void
}

const contexte = self as unknown as ContexteDuServiceWorker
const CACHE = nomDuCache(__VERSION_DU_CACHE__)
const EN_CACHE = new Set(__FICHIERS_DU_CACHE__)
const adresse = (chemin: string) => new URL(chemin, contexte.registration.scope).href

// Les fichiers sont redemandés au serveur, sans passer par le cache HTTP du navigateur : une page index.html encore en
// cache HTTP désignerait les scripts de la publication précédente.
contexte.addEventListener("install", evenement => {
  const requetes = __FICHIERS_DU_CACHE__.map(chemin => new Request(adresse(chemin), { cache: "reload" }))
  evenement.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requetes)))
})

// La nouvelle version efface les caches des précédentes et prend aussitôt en charge les pages ouvertes : à la première
// visite, la page n'a donc pas besoin d'être rechargée pour fonctionner ensuite hors ligne.
contexte.addEventListener("activate", evenement => {
  evenement.waitUntil(
    caches
      .keys()
      .then(noms => Promise.all(cachesPerimes(noms, CACHE).map(nom => caches.delete(nom))))
      .then(() => contexte.clients.claim())
  )
})

contexte.addEventListener("message", evenement => {
  if (evenement.data === MESSAGE_PRENDRE_LA_MAIN) void contexte.skipWaiting()
})

contexte.addEventListener("fetch", evenement => {
  const strategie = strategiePour(evenement.request, contexte.registration.scope, EN_CACHE)
  if (strategie.type === "reseau") return
  // Si le fichier manque au cache (effacé par le navigateur), il est redemandé au réseau.
  evenement.respondWith(caches.match(adresse(strategie.chemin), { cacheName: CACHE }).then(reponse => reponse ?? fetch(evenement.request)))
})
