// src/web/stockage-navigateur.ts
// Stockage de la démo web dans le navigateur (localStorage), séparé du pont pour que le bandeau
// puisse réinitialiser la démo sans charger le moteur de calcul.

export const CLES = {
  session: "simulateur.session",
  sauvegardes: "simulateur.sauvegardes",
  preferences: "simulateur.preferences"
} as const

type Cle = (typeof CLES)[keyof typeof CLES]

// Passe à vrai quand la démo est réinitialisée : la sauvegarde déclenchée par le rechargement de la page
// ne doit pas réécrire la session qu'on vient d'effacer.
let reinitialisationEnCours = false

/** Lit une valeur JSON du stockage ; `null` si elle est absente, illisible, ou si le stockage est indisponible. */
export function lire(cle: Cle): unknown {
  try {
    const brut = window.localStorage.getItem(cle)
    return brut === null ? null : JSON.parse(brut)
  } catch {
    return null
  }
}

export function ecrire(cle: Cle, valeur: unknown) {
  if (reinitialisationEnCours) return
  try {
    window.localStorage.setItem(cle, JSON.stringify(valeur))
  } catch (error) {
    console.error("Stockage du navigateur indisponible :", error)
  }
}

/** Efface la session en cours et recharge la page, qui repart de la simulation d'exemple. Les sauvegardes sont conservées. */
export function reinitialiserDemo() {
  reinitialisationEnCours = true
  try {
    window.localStorage.removeItem(CLES.session)
  } catch (error) {
    console.error("Stockage du navigateur indisponible :", error)
  }
  window.location.reload()
}
