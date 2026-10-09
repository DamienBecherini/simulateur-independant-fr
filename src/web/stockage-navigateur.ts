// src/web/stockage-navigateur.ts
// Stockage de la démo web dans le navigateur (localStorage), séparé du pont pour que le bandeau
// puisse réinitialiser la démo sans charger le moteur de calcul.

import { horodatage } from "@/lib/horodatage"

export const CLES = {
  session: "simulateur.session",
  sauvegardes: "simulateur.sauvegardes",
  preferences: "simulateur.preferences"
} as const

type Cle = (typeof CLES)[keyof typeof CLES]

// Passe à vrai quand la démo est réinitialisée : la sauvegarde déclenchée par le rechargement de la page
// ne doit pas réécrire la session qu'on vient d'effacer.
let reinitialisationEnCours = false

/** Ce que donne la lecture d'une clé : absente, lue, illisible (le texte brut, pour le mettre de côté) ou stockage bloqué. */
export type LectureDuStockage = { etat: "absent" } | { etat: "lu"; valeur: unknown; brut: string } | { etat: "illisible"; brut: string } | { etat: "inaccessible" }

export function lireAvecEtat(cle: Cle): LectureDuStockage {
  let brut: string | null
  try {
    brut = window.localStorage.getItem(cle)
  } catch {
    return { etat: "inaccessible" }
  }
  if (brut === null) return { etat: "absent" }
  try {
    return { etat: "lu", valeur: JSON.parse(brut) as unknown, brut }
  } catch {
    return { etat: "illisible", brut }
  }
}

/** Lit une valeur JSON du stockage ; `null` si elle est absente, illisible, ou si le stockage est indisponible. */
export function lire(cle: Cle): unknown {
  const lecture = lireAvecEtat(cle)
  return lecture.etat === "lu" ? lecture.valeur : null
}

// Clés illisibles qu'on n'a pas pu mettre de côté : elles ne sont plus écrites pendant la visite.
const clesProtegees = new Set<string>()

/**
 * Écrit une valeur JSON dans le stockage. Faux si l'écriture a échoué (stockage plein ou bloqué par le navigateur, clé
 * protégée) : l'ancienne valeur reste alors intacte.
 */
export function ecrire(cle: Cle, valeur: unknown): boolean {
  if (reinitialisationEnCours) return true
  if (clesProtegees.has(cle)) return false
  try {
    window.localStorage.setItem(cle, JSON.stringify(valeur))
    return true
  } catch (error) {
    console.error("Stockage du navigateur indisponible :", error)
    return false
  }
}

/**
 * Met de côté une valeur illisible, telle quelle, sous une clé horodatée (`simulateur.sauvegardes.illisible-20261009-143005`)
 * qui ne remplace aucune copie existante, puis retire l'originale. Rend la clé de la copie, ou `null` si la copie a
 * échoué (stockage plein ou bloqué) : la clé d'origine est alors protégée jusqu'à la fin de la visite.
 */
export function mettreDeCote(cle: Cle, brut: string, maintenant = new Date()): string | null {
  try {
    const base = `${cle}.illisible-${horodatage(maintenant)}`
    let copie = base
    for (let rang = 2; window.localStorage.getItem(copie) !== null; rang += 1) copie = `${base}-${rang}`
    window.localStorage.setItem(copie, brut)
    window.localStorage.removeItem(cle)
    return copie
  } catch (error) {
    console.error("Valeur illisible impossible à mettre de côté :", error)
    clesProtegees.add(cle)
    return null
  }
}

/** Ce qui sert ici de `navigator.storage`. */
export type GestionnaireDuStockage = Pick<StorageManager, "persist" | "persisted">

let persistanceDemandee = false

/**
 * Demande au navigateur, une fois par visite, de ne pas effacer de lui-même les données de la démo quand l'espace
 * manque (stockage « persistant »). Appelée à la première sauvegarde et à l'installation de la démo. Chrome et Edge
 * répondent sans rien demander, selon l'usage du site (accordé à une application installée) ; Firefox demande
 * l'autorisation. Rien de tout cela ne protège d'un effacement des données de navigation par l'utilisateur.
 * Vrai si le stockage est persistant ; faux aussi quand la demande a déjà été faite pendant la visite.
 */
export async function demanderUnStockagePersistant(stockage: GestionnaireDuStockage | undefined = globalThis.navigator?.storage): Promise<boolean> {
  if (persistanceDemandee || !stockage?.persist) return false
  persistanceDemandee = true
  try {
    return (await stockage.persisted()) || (await stockage.persist())
  } catch {
    return false
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
