// src/ui/colonne-fixe.ts
// Première colonne d'un tableau qui défile en largeur, gardée visible comme celle de la grille mensuelle.

/**
 * Une cellule fixe recouvre celles qui défilent dessous : elle a donc un fond opaque (à donner par l'appelant) et un
 * trait à droite (une ombre : en `border-collapse`, une bordure ne suivrait pas la cellule). À l'impression, rien ne
 * défile : la cellule redevient ordinaire.
 */
export const COLONNE_FIXE = "sticky left-0 z-10 shadow-[inset_-1px_0_0_var(--border)] print:static print:shadow-none"
