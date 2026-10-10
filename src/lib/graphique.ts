// src/lib/graphique.ts
// Petits outils des graphiques en SVG : graduations lisibles et passage des valeurs aux pixels.

/**
 * Garde-fou : au-delà, la liste s'arrête. Avec un intervalle normal il y a environ `nombre` graduations ; ce plafond ne
 * sert que si le pas ne fait plus avancer les valeurs (pas trop petit devant les bornes, à la limite de la précision).
 */
export const MAXIMUM_DE_GRADUATIONS = 1000

/**
 * Graduations « rondes » (1, 2 ou 5 fois une puissance de 10) qui couvrent l'intervalle, environ `nombre` d'entre elles.
 * Un intervalle vide, inversé ou non fini (`NaN`, `Infinity`) ne donne que `min`.
 */
export function graduations(min: number, max: number, nombre = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min]
  const brut = (max - min) / Math.max(1, nombre)
  const puissance = 10 ** Math.floor(Math.log10(brut))
  const pas = [1, 2, 5, 10].map(m => m * puissance).find(p => p >= brut) ?? 10 * puissance
  if (!Number.isFinite(pas) || pas <= 0) return [min]
  const arrondie = (v: number) => Math.round(v * 1e6) / 1e6
  let v = Math.floor(min / pas) * pas
  let derniere = arrondie(v)
  const valeurs = [derniere]
  while (derniere < max && valeurs.length < MAXIMUM_DE_GRADUATIONS) {
    v += pas
    derniere = arrondie(v)
    valeurs.push(derniere)
  }
  return valeurs
}

/** Fonction linéaire qui envoie [domaine] sur [plage]. Un domaine vide envoie tout au début de la plage. */
export function echelle([d0, d1]: [number, number], [p0, p1]: [number, number]): (valeur: number) => number {
  if (d1 === d0) return () => p0
  return valeur => p0 + ((valeur - d0) / (d1 - d0)) * (p1 - p0)
}

/** Indice de l'élément le plus proche d'une valeur, dans une liste triée par ordre croissant. */
export function indiceLePlusProche(valeurs: number[], cible: number): number {
  let meilleur = 0
  for (let i = 1; i < valeurs.length; i++) {
    if (Math.abs(valeurs[i] - cible) < Math.abs(valeurs[meilleur] - cible)) meilleur = i
  }
  return meilleur
}

/** Montant court pour un axe : « 0 € », « 500 € », « 20 k€ », « 1,5 k€ ». */
export function montantCourt(montant: number): string {
  if (Math.abs(montant) < 1000) return `${Math.round(montant)} €`
  return `${(montant / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k€`
}

/** Position horizontale d'une infobulle : à droite du trait de survol s'il y a la place, sinon à gauche, toujours dans le cadre. */
export function positionInfoBulle(trait: number, largeurCadre: number, largeurInfoBulle: number, ecart = 12): number {
  const aDroite = trait + ecart
  if (aDroite + largeurInfoBulle <= largeurCadre) return aDroite
  return Math.max(0, Math.min(trait - ecart - largeurInfoBulle, largeurCadre - largeurInfoBulle))
}
