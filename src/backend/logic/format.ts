// src/backend/logic/format.ts

/** Formate un montant pour un message : arrondi à l'euro, séparateur de milliers français. */
export function euros(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} €`
}
