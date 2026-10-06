// src/lib/bande-des-mois.ts
// Bande des mois de la grille mensuelle : quels mois sont visibles dans la zone qui défile, et jusqu'où la faire
// défiler pour amener un mois juste après la première colonne, qui reste fixe. Toutes les positions sont en pixels,
// comptées depuis le bord gauche du contenu qui défile (comme `offsetLeft` et `scrollLeft`).

/** Une colonne de mois de la grille. */
export interface ColonneDuMois {
  gauche: number
  largeur: number
}

/** Ce qu'il faut savoir de la zone qui défile pour situer les mois. */
export interface GeometrieDeLaGrille {
  /** Défilement horizontal actuel (`scrollLeft`). */
  defilement: number
  /** Largeur visible de la zone (`clientWidth`). */
  largeurVisible: number
  /** Largeur totale du contenu (`scrollWidth`). */
  largeurTotale: number
  /** Largeur de la première colonne, fixe : elle recouvre ce qui défile dessous. */
  colonneFixe: number
  /** Les douze colonnes des mois, dans l'ordre. */
  mois: ColonneDuMois[]
}

/** Tolérance, en pixels, pour les positions fractionnaires du défilement. */
const TOLERANCE = 1

/** La grille déborde de sa zone : il y a de quoi faire défiler. */
export function deborde(g: Pick<GeometrieDeLaGrille, "largeurVisible" | "largeurTotale">): boolean {
  return g.largeurTotale > g.largeurVisible + TOLERANCE
}

/** Défilement maximal de la zone. */
export function defilementMaximal(g: GeometrieDeLaGrille): number {
  return Math.max(0, g.largeurTotale - g.largeurVisible)
}

/** La zone est tout à gauche : rien à voir avant. */
export function auDebut(g: GeometrieDeLaGrille): boolean {
  return g.defilement <= TOLERANCE
}

/** La zone est tout à droite : rien à voir après. */
export function aLaFin(g: GeometrieDeLaGrille): boolean {
  return g.defilement >= defilementMaximal(g) - TOLERANCE
}

/**
 * Mois visibles, de gauche à droite : ceux dont au moins la moitié de la colonne se voit à droite de la colonne fixe
 * (ou qui occupent au moins la moitié de la place, pour une colonne plus large que la zone). Si aucun ne l'est, celui
 * qui se voit le plus, pour que la bande montre toujours où l'on est dès qu'un mois apparaît.
 */
export function moisVisibles(g: GeometrieDeLaGrille): number[] {
  const debut = g.defilement + g.colonneFixe
  const fin = g.defilement + g.largeurVisible
  const parts = g.mois.map(({ gauche, largeur }) => Math.max(0, Math.min(fin, gauche + largeur) - Math.max(debut, gauche)))
  const place = Math.max(0, fin - debut)
  const visibles = parts.flatMap((part, index) => (part > 0 && part >= Math.min(g.mois[index].largeur, place) / 2 ? [index] : []))
  if (visibles.length > 0) return visibles
  const plusGrande = Math.max(0, ...parts)
  return plusGrande > 0 ? [parts.indexOf(plusGrande)] : []
}

/** Défilement qui amène le mois juste après la colonne fixe, dans les limites de la zone. */
export function defilementPourLeMois(g: GeometrieDeLaGrille, index: number): number {
  const colonne = g.mois[Math.min(Math.max(index, 0), g.mois.length - 1)]
  return Math.min(Math.max(colonne.gauche - g.colonneFixe, 0), defilementMaximal(g))
}

/** Mois dont la colonne touche le bord gauche de la zone, juste après la colonne fixe ; -1 avant janvier. */
function moisAuBord(g: GeometrieDeLaGrille): number {
  const bord = g.defilement + g.colonneFixe
  return g.mois.reduce((dernier, { gauche }, index) => (gauche <= bord + TOLERANCE ? index : dernier), -1)
}

/**
 * Défilement d'un mois vers la gauche (`sens` -1) ou vers la droite (`sens` 1). Vers la gauche, un mois coupé par le
 * bord est d'abord montré en entier ; avant janvier, la zone revient au début, sur le total annuel.
 */
export function defilementVoisin(g: GeometrieDeLaGrille, sens: -1 | 1): number {
  const index = moisAuBord(g)
  if (sens === 1) return defilementPourLeMois(g, index + 1)
  if (index < 0) return 0
  const coupe = g.mois[index].gauche < g.defilement + g.colonneFixe - TOLERANCE
  const cible = coupe ? index : index - 1
  return cible < 0 ? 0 : defilementPourLeMois(g, cible)
}

/**
 * Défilement pour une position le long de la bande (0 : bord gauche de janvier, 1 : bord droit de décembre) : le
 * point de la grille qui correspond vient se placer juste après la colonne fixe. Sert au glisser le long de la bande.
 */
export function defilementPourLaPosition(g: GeometrieDeLaGrille, position: number): number {
  const enMois = Math.min(Math.max(position, 0), 1) * g.mois.length
  const index = Math.min(Math.floor(enMois), g.mois.length - 1)
  const { gauche, largeur } = g.mois[index]
  const point = gauche + (enMois - index) * largeur
  return Math.min(Math.max(point - g.colonneFixe, 0), defilementMaximal(g))
}

/** Nom accessible d'un mois de la bande : « Aller à mars », complété du nombre de flux du mois s'il y en a. */
export function nomDuMoisDeLaBande(mois: string, flux: number): string {
  const nom = `Aller à ${mois.toLowerCase()}`
  return flux > 0 ? `${nom}, ${flux} flux` : nom
}
