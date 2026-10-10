// src/ui/plateforme.ts
// Ce qui distingue la démo web de l'application de bureau, vu de l'interface. La racine de composition de chaque cible
// le fournit (src/ui/main.tsx pour le bureau, src/web/main.tsx pour la démo) : l'interface n'importe jamais src/web,
// et la version de bureau ne contient pas une ligne de la démo, sans compter sur l'élimination du code mort.

import { createContext, useContext, type ComponentType } from "react"
import type { ButtonProps } from "@/components/ui/button"

/** Les réglages d'un bouton du panneau des paramètres. */
export type BoutonDesParametres = Pick<ButtonProps, "variant" | "className">

export interface Plateforme {
  /** Démo web (navigateur) ou application de bureau : écrit dans le diagnostic d'un avis. */
  web: boolean
  /** Vrai si la démo est installée comme une application (diagnostic d'un avis). */
  installee: () => boolean
  /** Bandeau sous le titre de la page (la démo : où vont les données, installation). */
  Bandeau?: ComponentType
  /** Bouton du panneau des paramètres qui aide à installer la démo. */
  BoutonInstaller?: ComponentType<BoutonDesParametres>
  /**
   * Contenu de la fenêtre « Utiliser avec une IA (MCP) » là où il n'y a pas de serveur MCP local : ce que cela permet,
   * et les liens vers l'application de bureau. Absent, la fenêtre donne la configuration du serveur de l'installation.
   */
  RenvoiVersLApplicationDeBureau?: ComponentType
}

/** L'application de bureau : ni bandeau, ni installation, et le serveur MCP local. */
export const PLATEFORME_DE_BUREAU: Plateforme = { web: false, installee: () => false }

export const PlateformeContext = createContext<Plateforme>(PLATEFORME_DE_BUREAU)

/** La plateforme fournie par la racine de composition ; l'application de bureau par défaut (tests des composants). */
export const usePlateforme = () => useContext(PlateformeContext)
