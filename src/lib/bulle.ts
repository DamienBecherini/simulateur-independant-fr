// src/lib/bulle.ts
// Place d'une bulle ouverte au clic sur un petit élément (pastille d'une note du comparateur) : sous lui, alignée sur
// son bord droit, ramenée dans l'écran si elle en sortait, et au-dessus quand la place manque dessous. Une bulle plus
// haute que la place restante s'ouvre quand même dessous : elle est posée dans la page, on la lit en faisant défiler.
//
// Les mesures sont celles de `getBoundingClientRect`, en pixels de l'écran. La bulle est posée dans la page zoomée
// (CSS `zoom` sur le body, voir zoom.ts) : ses coordonnées s'écrivent en pixels de la page, soit ceux de l'écran
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

export type CoteDeLaBulle = "dessous" | "dessus"

export interface PlaceDeLaBulle {
  left: number
  top: number
  /** Le côté retenu : à redonner quand la bulle est replacée, pour qu'elle ne saute pas d'un côté à l'autre. */
  cote: CoteDeLaBulle
}

/** Marge gardée avec les bords de l'écran, en pixels de l'écran. */
const MARGE = 8
/** Écart entre l'élément et sa bulle. */
const ECART = 6

/**
 * Coordonnées `left` et `top` de la bulle dans l'écran, en pixels de la page zoomée.
 * @param cote Le côté déjà retenu, quand la bulle est replacée ; absent, il est choisi selon la place.
 */
export function placerLaBulle(ancre: Cadre, bulle: Taille, ecran: Taille, zoom = 1, cote?: CoteDeLaBulle): PlaceDeLaBulle {
  const aGauche = Math.max(MARGE, Math.min(ancre.right - bulle.largeur, ecran.largeur - bulle.largeur - MARGE))
  const dessous = ancre.bottom + ECART
  const dessus = ancre.top - ECART - bulle.hauteur
  const tientDessous = dessous + bulle.hauteur <= ecran.hauteur - MARGE
  const retenu = cote ?? (tientDessous || dessus < MARGE ? "dessous" : "dessus")
  return { left: Math.round(aGauche / zoom), top: Math.round((retenu === "dessous" ? dessous : dessus) / zoom), cote: retenu }
}
