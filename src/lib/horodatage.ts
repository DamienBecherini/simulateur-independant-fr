// src/lib/horodatage.ts

/**
 * Date et heure locales, à la seconde, pour nommer une copie mise de côté : `20261009-143005`. Partagé par
 * l'application de bureau (fichiers) et la démo web (clés du stockage du navigateur).
 */
export function horodatage(date: Date): string {
  const deux = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}${deux(date.getMonth() + 1)}${deux(date.getDate())}-${deux(date.getHours())}${deux(date.getMinutes())}${deux(date.getSeconds())}`
}
