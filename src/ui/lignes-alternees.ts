// src/ui/lignes-alternees.ts
// Lignes alternées (« zébrage ») des tableaux de données et de la grille mensuelle : une ligne sur deux, à partir de
// la deuxième, reçoit une teinte très légère qui guide l'œil d'une colonne à l'autre. Teinte et règles : App.css.

/** Classe d'une ligne de tableau (`tr`) selon son rang, à partir de 0 : ses cases reçoivent la teinte une fois sur deux. */
export function ligneAlternee(rang: number): string | undefined {
  return rang % 2 === 1 ? "ligne-de-bande" : undefined
}

/** Classe d'une case de la grille mensuelle (pas de `tr` : chaque case de la ligne reçoit la teinte), selon le rang de sa ligne. */
export function caseAlternee(rang: number): string | undefined {
  return rang % 2 === 1 ? "case-de-bande" : undefined
}
