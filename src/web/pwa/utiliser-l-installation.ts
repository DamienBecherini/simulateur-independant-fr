// src/web/pwa/utiliser-l-installation.ts
// L'état de l'installation de la démo pour les composants : il se met à jour quand la démo est installée depuis cet onglet.

import { useSyncExternalStore } from "react"
import { demoInstallee, surLInstallation } from "./installation"

/** Vrai si la démo est installée. */
export const useDemoInstallee = () => useSyncExternalStore(surLInstallation, () => demoInstallee(), () => false)
