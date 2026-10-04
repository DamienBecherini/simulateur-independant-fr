import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import "./App.css"
import { NotificationProvider } from "./components/NotificationProvider.tsx"

// Dans la démo web, il n'y a pas de process Electron : window.api est fourni par le navigateur.
async function demarrer() {
  if (import.meta.env.VITE_CIBLE === "web") {
    const { creerApiNavigateur } = await import("@/web/api-navigateur")
    window.api = creerApiNavigateur()
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <NotificationProvider />
      <App />
    </StrictMode>
  )
}

demarrer().catch(console.error)
