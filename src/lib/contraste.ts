// src/lib/contraste.ts
// Contraste entre deux couleurs, selon la formule des WCAG : sert à écrire lisiblement en blanc sur une couleur
// choisie par l'utilisateur (pastille d'une entité).

const BLANC = "#ffffff"
/** Contraste minimal d'un texte de taille normale (WCAG 1.4.3, niveau AA). */
export const CONTRASTE_TEXTE = 4.5

/** Composantes rouge, vert, bleu (0 à 255) d'une couleur « #rgb » ou « #rrggbb » ; `null` si elle n'est pas lisible. */
function composantes(couleur: string): [number, number, number] | null {
  const hex = couleur.trim().replace(/^#/, "")
  const complet = hex.length === 3 ? [...hex].map(c => c + c).join("") : hex
  if (!/^[0-9a-f]{6}$/i.test(complet)) return null
  return [0, 2, 4].map(i => parseInt(complet.slice(i, i + 2), 16)) as [number, number, number]
}

/** Luminance relative d'une couleur, de 0 (noir) à 1 (blanc). */
export function luminanceRelative(couleur: string): number | null {
  const rgb = composantes(couleur)
  if (!rgb) return null
  const [r, g, b] = rgb.map(c => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Rapport de contraste entre deux couleurs, de 1 à 21 ; `null` si l'une n'est pas lisible. */
export function rapportDeContraste(a: string, b: string): number | null {
  const la = luminanceRelative(a)
  const lb = luminanceRelative(b)
  if (la === null || lb === null) return null
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const hex = (rgb: number[]) => `#${rgb.map(c => Math.round(c).toString(16).padStart(2, "0")).join("")}`

/**
 * Fond sur lequel du texte blanc atteint le contraste demandé : la couleur elle-même si elle est assez sombre,
 * sinon la même teinte, assombrie juste ce qu'il faut (mélange progressif avec du noir, par pas de 2 %).
 * Une couleur illisible est renvoyée telle quelle.
 */
export function fondPourTexteBlanc(couleur: string, contrasteMinimal = CONTRASTE_TEXTE): string {
  const rgb = composantes(couleur)
  if (!rgb) return couleur
  for (let part = 0; part <= 1; part += 0.02) {
    const fond = hex(rgb.map(c => c * (1 - part)))
    if (rapportDeContraste(fond, BLANC)! >= contrasteMinimal) return part === 0 ? couleur : fond
  }
  return "#000000"
}

/** Couleur de texte, blanc ou presque noir, la plus contrastée sur ce fond : pour un petit numéro posé sur une couleur. */
export function couleurDeTexteSur(fond: string): string {
  const blanc = rapportDeContraste(fond, BLANC)
  const sombre = rapportDeContraste(fond, "#0f172a")
  if (blanc === null || sombre === null) return BLANC
  return sombre > blanc ? "#0f172a" : BLANC
}
