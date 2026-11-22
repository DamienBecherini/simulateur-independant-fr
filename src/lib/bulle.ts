// src/lib/bulle.ts
// Place d'une bulle ouverte au clic sur un petit élément (pastille d'une note du comparateur) : sous lui, alignée sur
// son bord droit, ramenée dans l'écran si elle en sortait, et au-dessus quand la place manque dessous. Quand elle ne
// tient d'aucun côté (interface agrandie), elle est ramenée dans la partie libre de l'écran, quitte à couvrir sa
// pastille ; plus haute que cette partie, elle commence en haut de celle-ci : posée dans la page, elle se lit en
// faisant défiler.
// Au-dessus, elle ne passe jamais sous les barres collées en haut de l'écran (barre d'outils, barre de résumé) : elle
// y serait cachée, le début de la note illisible (interface agrandie surtout, où ces barres sont hautes).
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

/** L'écran, et le haut de sa partie libre : sous les barres collées en haut (0 sans barre). */
interface Ecran extends Taille {
  haut?: number
}

/** Sous sa pastille, au-dessus, ou ramenée dans la partie libre de l'écran faute de place d'un côté comme de l'autre. */
export type CoteDeLaBulle = "dessous" | "dessus" | "ramenee"

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
export function placerLaBulle(ancre: Cadre, bulle: Taille, ecran: Ecran, zoom = 1, cote?: CoteDeLaBulle): PlaceDeLaBulle {
  const aGauche = Math.max(MARGE, Math.min(ancre.right - bulle.largeur, ecran.largeur - bulle.largeur - MARGE))
  const dessous = ancre.bottom + ECART
  const dessus = ancre.top - ECART - bulle.hauteur
  const tientDessous = dessous + bulle.hauteur <= ecran.hauteur - MARGE
  const hautLibre = (ecran.haut ?? 0) + MARGE
  const retenu = cote ?? (tientDessous ? "dessous" : dessus >= hautLibre ? "dessus" : "ramenee")
  // Ramenée : le plus près possible de sous sa pastille, sans dépasser le bas de l'écran ni monter sous les barres.
  const ramenee = Math.max(hautLibre, Math.min(dessous, ecran.hauteur - MARGE - bulle.hauteur))
  const top = { dessous, dessus, ramenee }[retenu]
  return { left: Math.round(aGauche / zoom), top: Math.round(top / zoom), cote: retenu }
}
