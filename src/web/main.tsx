// src/web/main.tsx
// Racine de composition de la démo web (vite --mode web : vite.config.ts la met à la place de src/ui/main.tsx dans
// index.html). Il n'y a pas de process Electron : window.api est fourni par le navigateur (api-navigateur.ts), et la
// plateforme de la démo apporte à l'interface son bandeau, son bouton d'installation et ses liens vers l'application
// de bureau.

import { afficherLInterface } from "@/ui/demarrage"
import { creerApiNavigateur } from "./api-navigateur"
import { PLATEFORME_WEB } from "./plateforme-web"
import { suivreLInstallation } from "./pwa/installation"
import { enregistrerLeServiceWorker, proposerParUneNotification } from "./pwa/enregistrement"

/**
 * Démo installable et utilisable hors ligne (voir l'ADR 012). Le service worker n'existe que dans la démo compilée
 * (vite build --mode web) ; il est enregistré une fois la page chargée, pour ne pas retarder son affichage, et pour que
 * les notifications soient en place s'il annonce aussitôt une nouvelle version.
 */
function rendreLaDemoInstallable() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return
  const enregistrer = () => void enregistrerLeServiceWorker(import.meta.env.BASE_URL, { conteneur: navigator.serviceWorker, proposerLaMiseAJour: proposerParUneNotification, recharger: () => window.location.reload() })
  if (document.readyState === "complete") enregistrer()
  else window.addEventListener("load", enregistrer, { once: true })
}

// Avant tout : le navigateur peut annoncer tôt que la démo est installable.
suivreLInstallation()
window.api = creerApiNavigateur()
afficherLInterface(PLATEFORME_WEB)
rendreLaDemoInstallable()
