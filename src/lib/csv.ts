// src/lib/csv.ts
// Écriture de fichiers CSV lisibles tels quels par Excel et LibreOffice réglés en français : point-virgule entre
// les colonnes, virgule décimale, fins de ligne CRLF et marque d'ordre des octets (BOM) pour qu'Excel lise l'UTF-8.

/** Montant en euros : écrit au centime, toujours avec deux décimales (« 1234,50 »). */
export interface MontantCsv {
  montant: number
}

/** Une cellule : du texte, un nombre (au plus deux décimales), un montant, ou rien. */
export type CelluleCsv = string | number | MontantCsv | null | undefined

export const SEPARATEUR_CSV = ";"
export const FIN_DE_LIGNE_CSV = "\r\n"
/** Marque d'ordre des octets : sans elle, Excel ouvre l'UTF-8 comme du Windows-1252 et abîme les accents. */
export const BOM = "\uFEFF"

export const montant = (valeur: number): MontantCsv => ({ montant: valeur })

/** Arrondit au centime, sans « -0 ». */
function arrondiAuCentime(valeur: number): number {
  const arrondi = Math.round(valeur * 100) / 100
  return arrondi === 0 ? 0 : arrondi
}

/** Nombre sans séparateur de milliers, avec une virgule décimale : le tableur le reconnaît comme un nombre. */
export function nombreCsv(valeur: number, decimalesFixes?: number): string {
  if (!Number.isFinite(valeur)) return ""
  const arrondi = arrondiAuCentime(valeur)
  const texte = decimalesFixes === undefined ? String(arrondi) : arrondi.toFixed(decimalesFixes)
  return texte.replace(".", ",")
}

/**
 * Texte d'une cellule : entre guillemets s'il contient un séparateur, un guillemet ou un retour à la ligne,
 * les guillemets étant doublés. Un texte qui commence comme une formule (=, +, -, @) est précédé d'une apostrophe,
 * pour que le tableur ne l'exécute pas à l'ouverture.
 */
export function texteCsv(valeur: string): string {
  const neutralise = /^[=+\-@\t\r]/.test(valeur) ? `'${valeur}` : valeur
  return /[;"\r\n]/.test(neutralise) ? `"${neutralise.replace(/"/g, '""')}"` : neutralise
}

export function celluleCsv(cellule: CelluleCsv): string {
  if (cellule === null || cellule === undefined) return ""
  if (typeof cellule === "number") return nombreCsv(cellule)
  if (typeof cellule === "string") return texteCsv(cellule)
  return nombreCsv(cellule.montant, 2)
}

/** Document CSV complet : BOM, une ligne par tableau de cellules, chaque ligne terminée par CRLF. */
export function documentCsv(lignes: CelluleCsv[][]): string {
  return BOM + lignes.map(ligne => ligne.map(celluleCsv).join(SEPARATEUR_CSV) + FIN_DE_LIGNE_CSV).join("")
}
