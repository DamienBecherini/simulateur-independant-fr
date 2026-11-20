// src/lib/bulle.ts
// Place d'une bulle ouverte au clic sur un petit élément (pastille d'une note du comparateur) : sous lui, alignée sur
// son bord droit, ramenée dans l'écran si elle en sortait, et au-dessus quand la place manque dessous.
//
// Les mesures sont celles de `getBoundingClientRect`, en pixels de l'écran. La bulle est en position fixe dans la page
// zoomée (CSS `zoom` sur le body, voir zoom.ts) : ses coordonnées s'écrivent en pixels de la page, soit ceux de l'écran
// divisés par le zoom.

export interface Cadre {
  left: number
  right: number
  top: number
  bottom: number
}

interface Taille {
  largeur: number
  hauteur: number
}

/** Marge gardée avec les bords de l'écran, en pixels de l'écran. */
const MARGE = 8
/** Écart entre l'élément et sa bulle. */
const ECART = 6

/** Coordonnées `left` et `top` de la bulle, en pixels de la page zoomée. */
export function placerLaBulle(ancre: Cadre, bulle: Taille, ecran: Taille, zoom = 1): { left: number; top: number } {
  const aGauche = Math.max(MARGE, Math.min(ancre.right - bulle.largeur, ecran.largeur - bulle.largeur - MARGE))
  const dessous = ancre.bottom + ECART
  const dessus = ancre.top - ECART - bulle.hauteur
  const tientDessous = dessous + bulle.hauteur <= ecran.hauteur - MARGE
  const enHaut = tientDessous || dessus < MARGE ? dessous : dessus
  return { left: Math.round(aGauche / zoom), top: Math.round(enHaut / zoom) }
}
