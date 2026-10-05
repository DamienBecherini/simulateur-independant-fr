// src/lib/affichage.ts
// Affichages de la page proposés pendant la bêta (phase 13 ter) : l'affichage d'origine et les propositions de
// l'étude docs/conception/allegement-ecran.md, à choisir dans la barre d'outils. Le choix est une préférence de
// l'utilisateur, pas une donnée de la simulation.

import type { Affichage } from "@/types"

export const AFFICHAGE_PAR_DEFAUT: Affichage = "classique"

interface DescriptionDAffichage {
  valeur: Affichage
  /** Nom court, affiché dans le sélecteur. */
  libelle: string
  /** Ce que change l'affichage, en une phrase (info-bulle du choix). */
  description: string
  /** Faux tant que l'affichage n'est pas réalisé : il est proposé, grisé, avec la mention « bientôt ». */
  disponible: boolean
}

/** Les affichages, dans l'ordre du sélecteur : l'original, puis A, C et B dans l'ordre de leur réalisation. */
export const AFFICHAGES: readonly DescriptionDAffichage[] = [
  { valeur: "classique", libelle: "Classique", description: "La page d'origine, tout affiché.", disponible: true },
  { valeur: "resume", libelle: "Résumé", description: "Un résumé toujours visible en haut, le détail replié.", disponible: true },
  { valeur: "panneaux", libelle: "Panneaux", description: "Le résumé, et les réglages de chaque acteur dans un panneau latéral.", disponible: true },
  { valeur: "vues", libelle: "Trois vues", description: "Le résumé, et trois vues : ma situation, mes résultats, comparer.", disponible: false }
]

/** Affichage à appliquer : celui des préférences s'il existe et est disponible, l'affichage par défaut sinon. */
export function affichageApplicable(valeur: unknown): Affichage {
  return AFFICHAGES.find(a => a.valeur === valeur && a.disponible)?.valeur ?? AFFICHAGE_PAR_DEFAUT
}

/** Vrai pour les affichages qui reprennent la proposition A (résumé collant, détail replié) : A, et C qui s'y ajoute. */
export function avecResume(affichage: Affichage): boolean {
  return affichage === "resume" || affichage === "panneaux"
}

/** Vrai pour l'affichage C : les acteurs en liste courte, les réglages et résultats de chacun dans un panneau latéral. */
export function avecPanneaux(affichage: Affichage): boolean {
  return affichage === "panneaux"
}

/** Libellé d'un affichage, pour le sélecteur et les lecteurs d'écran. */
export function libelleDeLAffichage(affichage: Affichage): string {
  return AFFICHAGES.find(a => a.valeur === affichage)?.libelle ?? affichage
}
