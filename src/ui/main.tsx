import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import "./App.css"
import "./impression.css"
import { suivreImpression } from "./impression"
import { NotificationProvider } from "./components/NotificationProvider.tsx"
import { suivreLInstallation } from "@/web/pwa/installation"
import { enregistrerLeServiceWorker, proposerParUneNotification } from "@/web/pwa/enregistrement"

const WEB = import.meta.env.VITE_CIBLE === "web"

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

// Dans la démo web, il n'y a pas de process Electron : window.api est fourni par le navigateur.
async function demarrer() {
  if (WEB) {
    // Avant tout : le navigateur peut annoncer tôt que la démo est installable.
    suivreLInstallation()
    const { creerApiNavigateur } = await import("@/web/api-navigateur")
    window.api = creerApiNavigateur()
  }

  // À l'impression du navigateur (Ctrl+P), les sections repliables sont dépliées.
  suivreImpression()

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <NotificationProvider />
      <App />
    </StrictMode>
  )

  if (WEB) rendreLaDemoInstallable()
}

demarrer().catch(console.error)
