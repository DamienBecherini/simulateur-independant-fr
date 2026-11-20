// src/lib/raccourcis-clavier.ts
// Raccourcis de la page. Annulation (Ctrl+Z, Ctrl+Y, Ctrl+Maj+Z ; Cmd sur Mac) : quelle touche annule ou rétablit une
// modification de la simulation, et quand le raccourci appartient au champ où l'on écrit. Zoom : Ctrl+0 ramène
// l'interface à 100 %. Fonctions pures, sans DOM : les hooks `useRaccourcisDAnnulation` et `useZoom` les branchent sur
// le clavier.

/** Ce que demande un raccourci de la page. */
export type ActionDuRaccourci = "annuler" | "retablir"

/** Ce que les raccourcis lisent d'un appui de touche (un `KeyboardEvent` convient). */
export interface Touche {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey?: boolean
  /** Touche physique (« Digit0 », « Numpad0 ») : sur un clavier AZERTY, le zéro du haut écrit « à » sans la touche Maj. */
  code?: string
}

/** Ce que les raccourcis lisent de l'élément qui a le focus (un `HTMLElement` convient). */
export interface CibleDuClavier {
  tagName?: string
  type?: string
  isContentEditable?: boolean
}

/** Champs `<input>` où l'on n'écrit pas de texte : le navigateur n'y a rien à annuler, la page garde ses raccourcis. */
const ENTREES_SANS_TEXTE = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"])

/** Système de Apple, d'après l'identification du navigateur : la touche Cmd y remplace Ctrl. */
export function estUnMac(userAgent: string): boolean {
  return /Mac|iPhone|iPad|iPod/.test(userAgent)
}

/**
 * Le focus est dans un champ où l'on écrit (zone de texte, champ de saisie, contenu modifiable) : Ctrl+Z et Ctrl+Y y
 * annulent et rétablissent la frappe, comme partout ailleurs. La page n'y remplace pas l'annulation du champ par
 * celle de la simulation.
 */
export function saisieDeTexte(cible: CibleDuClavier | null): boolean {
  if (!cible) return false
  if (cible.isContentEditable) return true
  const balise = cible.tagName?.toUpperCase()
  if (balise === "TEXTAREA") return true
  return balise === "INPUT" && !ENTREES_SANS_TEXTE.has((cible.type ?? "text").toLowerCase())
}

/**
 * L'action demandée par une touche : Ctrl+Z annule, Ctrl+Maj+Z et Ctrl+Y rétablissent (sur Mac : Cmd+Z, Cmd+Maj+Z ;
 * Cmd+Y n'y rétablit rien). `null` pour toute autre touche.
 */
export function actionDuRaccourci(touche: Touche, mac: boolean): ActionDuRaccourci | null {
  const commande = mac ? touche.metaKey : touche.ctrlKey
  if (!commande) return null
  const lettre = touche.key.toLowerCase()
  if (lettre === "z") return touche.shiftKey ? "retablir" : "annuler"
  if (lettre === "y" && !mac) return "retablir"
  return null
}

/**
 * Ctrl+0 (Cmd+0 sur Mac) : le retour de l'interface à 100 %, par le zéro du haut du clavier ou celui du pavé numérique.
 * On lit la touche physique : en AZERTY, le zéro du haut écrit « à ». Avec Alt, ce n'est pas le raccourci : sous
 * Windows, AltGr vaut Ctrl+Alt, et AltGr+0 écrit « @ ».
 */
export function demandeLeZoomNormal(touche: Touche, mac: boolean): boolean {
  const commande = mac ? touche.metaKey : touche.ctrlKey
  if (!commande || touche.altKey) return false
  return touche.key === "0" || touche.code === "Digit0" || touche.code === "Numpad0"
}
