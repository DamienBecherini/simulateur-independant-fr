// src/lib/ligne-de-flux.ts
// Mise en page d'une ligne de flux de la saisie mensuelle (FlowItem.tsx, NewFlowItem.tsx), selon la largeur de la
// fenêtre de saisie (conteneur de MonthlyFlowsModal.tsx, donc la largeur zoomée, pas celle de l'écran).
//
// Étroite : le type occupe la première ligne, le libellé et les montants la suivante. Large : tout tient sur une ligne.
// Le seuil dépend de ce que la ligne porte : celle d'un salaire a deux champs de plus (brut, part du net), soit 176 px.
// Largeurs mesurées dans Chromium, libellé non compris : 523 px pour une ligne existante, 699 px pour un salaire. Les
// seuils leur ajoutent la place du libellé (au moins 5rem, de quoi lire son texte indicatif « Libellé ») et celle des
// boutons plus larges d'un écran tactile. Avec un seuil unique de 34rem, le libellé d'un salaire tombait à 0 px entre
// 560 et 760 px, et ses champs sortaient de la ligne.
//
// Classes écrites en entier : Tailwind les lit dans le source.

export type FormeDeLigneDeFlux = "simple" | "salaire"

interface ClassesDeLigneDeFlux {
  /** La ligne : sur une seule ligne à partir du seuil. */
  rangee: string
  /** La ligne dont le montant est refusé : le message d'erreur passe dessous, même au-delà du seuil. */
  avecErreur: string
  /** Le sélecteur du type : toute la première ligne sous le seuil, une largeur fixe au-delà. */
  type: string
  /** Le retour à la ligne après le type, sous le seuil seulement. */
  retour: string
  /** Le libellé : il prend la place qui reste, sans descendre sous son texte indicatif. */
  libelle: string
}

export const LIGNE_DE_FLUX: Record<FormeDeLigneDeFlux, ClassesDeLigneDeFlux> = {
  simple: {
    rangee: "@min-[41rem]:flex-nowrap",
    avecErreur: "@min-[41rem]:flex-wrap",
    type: "@min-[41rem]:w-60 @min-[41rem]:flex-none",
    retour: "@min-[41rem]:hidden",
    libelle: "min-w-32 flex-1 @min-[41rem]:min-w-20"
  },
  salaire: {
    rangee: "@min-[52rem]:flex-nowrap",
    avecErreur: "@min-[52rem]:flex-wrap",
    type: "@min-[52rem]:w-60 @min-[52rem]:flex-none",
    retour: "@min-[52rem]:hidden",
    libelle: "min-w-32 flex-1 @min-[52rem]:min-w-20"
  }
}

/** Texte indicatif du libellé : court, pour rester entier dans le champ le plus étroit. L'info-bulle dit qu'il est facultatif. */
export const LIBELLE_INDICATIF = "Libellé"
export const AIDE_DU_LIBELLE = "Libellé (optionnel) : il nomme ce flux dans la liste et dans les exports."
