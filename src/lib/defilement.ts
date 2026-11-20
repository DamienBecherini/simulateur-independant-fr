// src/lib/defilement.ts
// Défilement horizontal d'un tableau plus large que sa zone : où en est-on, et de combien avancer d'un clic sur une
// flèche. Toutes les longueurs sont en pixels, comme `scrollLeft`, `clientWidth` et `scrollWidth`.

/** Ce qu'il faut savoir de la zone qui défile. */
export interface GeometrieDeLaZone {
  /** Défilement horizontal actuel (`scrollLeft`). */
  defilement: number
  /** Largeur visible de la zone (`clientWidth`). */
  largeurVisible: number
  /** Largeur totale du contenu (`scrollWidth`). */
  largeurTotale: number
  /** Largeur de la première colonne quand elle reste fixe (0 sinon) : elle recouvre ce qui défile dessous. */
  colonneFixe: number
}

/** Ce que la zone montre de son défilement : une ombre et une flèche de chaque côté où des colonnes sont cachées. */
export interface EtatDuDefilement {
  deborde: boolean
  auDebut: boolean
  aLaFin: boolean
  colonneFixe: number
}

export const SANS_DEFILEMENT: EtatDuDefilement = { deborde: false, auDebut: true, aLaFin: true, colonneFixe: 0 }

/** Tolérance, en pixels, pour les positions fractionnaires du défilement. */
const TOLERANCE = 1

/** Part de la largeur qui défile parcourue d'un clic : il reste de quoi se repérer d'une vue à la suivante. */
const PART_D_UN_PAS = 0.8

/** Pas minimal, pour une zone où presque rien ne se voit à côté de la colonne fixe. */
const PAS_MINIMAL = 96

export function etatDuDefilement(g: GeometrieDeLaZone): EtatDuDefilement {
  const maximal = Math.max(0, g.largeurTotale - g.largeurVisible)
  return { deborde: g.largeurTotale > g.largeurVisible + TOLERANCE, auDebut: g.defilement <= TOLERANCE, aLaFin: g.defilement >= maximal - TOLERANCE, colonneFixe: g.colonneFixe }
}

export const memeDefilement = (a: EtatDuDefilement, b: EtatDuDefilement) => a.deborde === b.deborde && a.auDebut === b.auDebut && a.aLaFin === b.aLaFin && a.colonneFixe === b.colonneFixe

/** Défilement après un clic sur la flèche de gauche (`sens` -1) ou de droite (`sens` 1), dans les limites de la zone. */
export function defilementDUnPas(g: GeometrieDeLaZone, sens: -1 | 1): number {
  const pas = Math.max(PAS_MINIMAL, (g.largeurVisible - g.colonneFixe) * PART_D_UN_PAS)
  return Math.min(Math.max(g.defilement + sens * pas, 0), Math.max(0, g.largeurTotale - g.largeurVisible))
}
