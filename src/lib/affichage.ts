// src/lib/affichage.ts
// Affichages de la page proposés pendant la bêta (phase 13 ter) : l'affichage d'origine et les propositions retenues
// de l'étude docs/conception/allegement-ecran.md, à choisir dans la barre d'outils. Le choix est une préférence de
// l'utilisateur, pas une donnée de la simulation.

import type { Affichage } from "@/types"

/** « Résumé » (proposition A) : l'affichage par défaut, retenu après l'essai des propositions. */
export const AFFICHAGE_PAR_DEFAUT: Affichage = "resume"

interface DescriptionDAffichage {
  valeur: Affichage
  /** Nom court, affiché dans le sélecteur. */
  libelle: string
  /** Ce que change l'affichage, en une phrase (info-bulle du choix). */
  description: string
}

/** Les affichages, dans l'ordre du sélecteur : celui par défaut, l'original, puis la proposition B. */
export const AFFICHAGES: readonly DescriptionDAffichage[] = [
  { valeur: "resume", libelle: "Résumé", description: "Un résumé toujours visible en haut, le détail replié." },
  { valeur: "classique", libelle: "Classique", description: "La page d'origine, tout affiché." },
  { valeur: "vues", libelle: "Trois vues", description: "Le résumé, et trois vues : ma situation, mes résultats, comparer." }
]

/** Affichage à appliquer : celui des préférences s'il existe encore, l'affichage par défaut sinon. */
export function affichageApplicable(valeur: unknown): Affichage {
  return AFFICHAGES.find(a => a.valeur === valeur)?.valeur ?? AFFICHAGE_PAR_DEFAUT
}

/** Vrai pour les affichages qui reprennent la proposition A (résumé collant, détail replié) : A, et B qui s'y ajoute. */
export function avecResume(affichage: Affichage): boolean {
  return affichage === "resume" || affichage === "vues"
}

/** Vrai pour l'affichage B : la page partagée en trois vues, ma situation, mes résultats, comparer et optimiser. */
export function avecVues(affichage: Affichage): boolean {
  return affichage === "vues"
}

/** Libellé d'un affichage, pour le sélecteur et les lecteurs d'écran. */
export function libelleDeLAffichage(affichage: Affichage): string {
  return AFFICHAGES.find(a => a.valeur === affichage)?.libelle ?? affichage
}
