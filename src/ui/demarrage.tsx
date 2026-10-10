// src/ui/demarrage.tsx
// Affichage de l'interface, commun aux deux cibles : la racine de composition de chacune (src/ui/main.tsx pour le
// bureau, src/web/main.tsx pour la démo) l'appelle avec sa plateforme, une fois window.api en place.

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import "./App.css"
import "./impression.css"
import { suivreImpression } from "./impression"
import { NotificationProvider } from "./components/NotificationProvider.tsx"
import { PlateformeContext, type Plateforme } from "./plateforme"

export function afficherLInterface(plateforme: Plateforme) {
  // À l'impression du navigateur (Ctrl+P), les sections repliables sont dépliées.
  suivreImpression()

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <PlateformeContext value={plateforme}>
        <NotificationProvider />
        <App />
      </PlateformeContext>
    </StrictMode>
  )
}
