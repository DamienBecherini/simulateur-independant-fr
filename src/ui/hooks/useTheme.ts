// src/ui/hooks/useTheme.ts
// Thème clair ou sombre, partagé par tous les interrupteurs de thème (barre d'outils et panneau des paramètres) :
// un seul état, gardé dans le navigateur et appliqué à la page.

import { useSyncExternalStore } from "react"

export type Theme = "light" | "dark"

const ecouteurs = new Set<() => void>()

function themeDeDepart(): Theme {
  try {
    const enregistre = localStorage.getItem("theme")
    if (enregistre === "light" || enregistre === "dark") return enregistre
  } catch {
    // Stockage indisponible (navigation privée stricte) : on suit le système.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

let themeCourant: Theme | null = null

function lire(): Theme {
  themeCourant ??= appliquer(themeDeDepart())
  return themeCourant
}

/** Classe du thème sur la racine du document, et mémoire du choix. */
function appliquer(theme: Theme): Theme {
  const racine = document.documentElement
  racine.classList.remove("light", "dark")
  racine.classList.add(theme)
  try {
    localStorage.setItem("theme", theme)
  } catch {
    // Le thème s'applique quand même, sans être retenu.
  }
  return theme
}

export function definirLeTheme(theme: Theme) {
  themeCourant = appliquer(theme)
  for (const ecouteur of ecouteurs) ecouteur()
}

function sAbonner(ecouteur: () => void) {
  ecouteurs.add(ecouteur)
  return () => ecouteurs.delete(ecouteur)
}

/** Le thème courant et de quoi le changer ; chaque interrupteur suit les autres. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  return [useSyncExternalStore(sAbonner, lire), definirLeTheme]
}

/** Pour les tests : oublie le thème lu, pour repartir du stockage et du système. */
export function oublierLeTheme() {
  themeCourant = null
}
