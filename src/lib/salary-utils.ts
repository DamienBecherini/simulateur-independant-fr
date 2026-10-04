// src/lib/salary-utils.ts

/** Part du brut qui reste en net, proposée par défaut (salarié non cadre du secteur privé, ordre de grandeur). */
export const DEFAULT_NET_RATIO = 0.78

const roundToCents = (amount: number) => Math.round(amount * 100) / 100

export function netFromGross(gross: number, ratio: number): number {
  return roundToCents(gross * ratio)
}

export function grossFromNet(net: number, ratio: number): number {
  return roundToCents(net / ratio)
}

/** Ratio net / brut d'un salaire, ou `null` si le brut n'est pas renseigné. */
export function netRatio(net: number, gross: number | undefined): number | null {
  if (gross === undefined || gross <= 0) return null
  return net / gross
}

/**
 * Analyse un pourcentage saisi par l'utilisateur (« 78 », « 78,5 », « 78 % »).
 * @returns Le ratio (0,78), ou `null` si la saisie est vide ou hors de l'intervalle ]0 % ; 100 %].
 */
export function parsePercent(input: string): number | null {
  const normalized = input.replace(/[\s%]/g, "").replace(",", ".")
  if (!/^(\d+\.?\d*|\.\d+)$/.test(normalized)) return null
  const ratio = Number(normalized) / 100
  return ratio > 0 && ratio <= 1 ? ratio : null
}

/** Formate un ratio pour un champ de saisie : « 78 » ou « 78,5 ». */
export function formatPercent(ratio: number): string {
  return (ratio * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })
}
