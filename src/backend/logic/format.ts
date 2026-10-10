// src/backend/logic/format.ts
// Le seul module de mise en forme des montants et des taux, pour les messages du moteur, l'interface, les exports et
// les outils pour les clients d'IA : un montant s'écrit partout de la même façon.

/** Montant arrondi à l'euro, séparateur de milliers français : « 12 345 € ». Jamais « -0 € ». */
export function euros(montant: number): string {
  return `${(Math.round(montant) || 0).toLocaleString("fr-FR")} €`
}

/**
 * Le même montant, avec des espaces ordinaires au lieu des espaces insécables du séparateur de milliers : pour un
 * texte brut (Markdown, terminal) ou destiné à un modèle, qui recopie mal les espaces insécables.
 */
export function eurosEnTexteBrut(montant: number): string {
  return euros(montant).replace(/\s/g, " ")
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
  return `${(taux * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`
}
