// src/lib/contraste.ts
// Contraste entre deux couleurs, selon la formule des WCAG : sert à écrire lisiblement sur une couleur choisie
// par l'utilisateur (pastille d'une entité).

const TEXTE_CLAIR = "#ffffff"
const TEXTE_SOMBRE = "#0f172a"

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

/** Couleur de texte, blanc ou presque noir, la plus contrastée sur ce fond. Blanc si le fond n'est pas lisible. */
export function couleurDeTexteSur(fond: string): string {
  const clair = rapportDeContraste(fond, TEXTE_CLAIR)
  const sombre = rapportDeContraste(fond, TEXTE_SOMBRE)
  if (clair === null || sombre === null) return TEXTE_CLAIR
  return sombre > clair ? TEXTE_SOMBRE : TEXTE_CLAIR
}
