// src/backend/logic/format.ts

/** Formate un montant pour un message : arrondi à l'euro, séparateur de milliers français. */
export function euros(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} €`
}

/**
 * Formate un taux pour un message : « 25,6 % », « 10 % ». Un texte qui cite un taux des règles le lit dans les règles
 * de l'année au lieu de le recopier : recopié, il deviendrait faux en silence à l'année suivante.
 */
export function pourcent(taux: number): string {
  return `${(taux * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`
}
