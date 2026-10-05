// src/lib/champ-numerique.ts
// Pas des boutons − et + d'un champ numérique (voir ChampNumerique).

/** Pas effectif : celui de l'attribut `step` quand il est un nombre positif, sinon `pas` (pour « any » ou rien). */
export function pasDuChamp(step: string | number | undefined, pas: number): number {
  const valeur = Number(step)
  return Number.isFinite(valeur) && valeur > 0 ? valeur : pas
}

/** Nouvelle valeur après un pas, bornée par `min` et `max`, sans les décimales parasites du calcul flottant. */
export function valeurApresUnPas(actuelle: number, pas: number, sens: 1 | -1, min?: number, max?: number): number {
  const decimales = (String(pas).split(".")[1] ?? "").length
  let valeur = Number(((Number.isFinite(actuelle) ? actuelle : 0) + sens * pas).toFixed(decimales))
  if (min !== undefined && Number.isFinite(min)) valeur = Math.max(min, valeur)
  if (max !== undefined && Number.isFinite(max)) valeur = Math.min(max, valeur)
  return valeur
}
