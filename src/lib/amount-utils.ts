// src/lib/amount-utils.ts

/**
 * Analyse un montant saisi par l'utilisateur.
 * Accepte la virgule ou le point décimal, les espaces de séparation des milliers et le symbole €.
 * @returns Le montant (positif ou nul), ou `null` si la saisie est vide ou invalide.
 */
export function parseAmount(input: string): number | null {
  const normalized = input.replace(/[\s€]/g, "").replace(",", ".")
  // Des chiffres, avec au plus un point suivi de chiffres : une seule lecture possible de la saisie (pas de retour arrière).
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : null
}

/** Formate un montant pour un champ de saisie : séparateur de milliers et virgule décimale. */
export function formatAmount(amount: number): string {
  return amount.toLocaleString("fr-FR", { maximumFractionDigits: 20 })
}
