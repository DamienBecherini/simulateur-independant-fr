// src/backend/logic/format.ts
// Le seul module de mise en forme des montants et des taux, pour les messages du moteur, l'interface, les exports et
// les outils pour les clients d'IA : un montant s'écrit partout de la même façon.

/** L'espace insécable que `Intl.NumberFormat` met en français avant « € » et « % » : le signe ne passe jamais seul à la ligne. */
export const ESPACE_INSECABLE = "\u00A0"

/** Remplace toute espace (insécable ou fine) par une espace ordinaire : pour un texte brut ou destiné à un modèle. */
export function enTexteBrut(texte: string): string {
  return texte.replace(/[\u00A0\u202F]/g, " ")
}

/** Montant arrondi à l'euro, séparateur de milliers français : « 12 345 € ». Jamais « -0 € ». */
export function euros(montant: number): string {
  return `${(Math.round(montant) || 0).toLocaleString("fr-FR")}${ESPACE_INSECABLE}€`
}

/**
 * Le même montant, avec des espaces ordinaires au lieu des espaces insécables du séparateur de milliers : pour un
 * texte brut (Markdown, terminal) ou destiné à un modèle, qui recopie mal les espaces insécables.
 */
export function eurosEnTexteBrut(montant: number): string {
  return enTexteBrut(euros(montant))
}

/** Écart signé : « +1 234 € », « −850 € » (vrai signe moins), « 0 € ». */
export function ecartSigne(ecart: number): string {
  const signe = ecart > 0 ? "+" : ecart < 0 ? "−" : ""
  return `${signe}${euros(Math.abs(ecart))}`
}

/**
 * Formate un taux pour un message : « 25,6 % », « 10 % ». Un texte qui cite un taux des règles le lit dans les règles
 * de l'année au lieu de le recopier : recopié, il deviendrait faux en silence à l'année suivante.
 */
export function pourcent(taux: number): string {
  return pourcentDeNombre(taux * 100, 2)
}

/** Un nombre déjà exprimé en pourcents (25,6 ; 80), arrondi à `decimales` chiffres au plus : « 25,6 % ». */
export function pourcentDeNombre(valeur: number, decimales = 0): string {
  return `${valeur.toLocaleString("fr-FR", { maximumFractionDigits: decimales })}${ESPACE_INSECABLE}%`
}
