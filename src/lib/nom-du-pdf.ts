// src/lib/nom-du-pdf.ts
// Nom proposé pour le PDF d'une simulation : son nom en minuscules, sans accents ni espaces, suivi de l'année.

import { slugifier } from "./export-commun"

/**
 * « Famille Martin, simulation » → « famille-martin-simulation » ; « simulation » si rien ne reste. Le nom est
 * raccourci comme celui des autres exports : un nom de simulation très long donnerait sinon un nom de fichier
 * au-delà des 255 caractères permis.
 */
function enSlug(texte: string): string {
  return slugifier(texte) || "simulation"
}

/**
 * Nom du fichier PDF d'une simulation, avec l'année des règles fiscales appliquées
 * (« famille-martin-simulation-2026.pdf ») ; l'année n'est pas répétée si le nom la contient déjà.
 */
export function nomDuPdf(nomDeLaSimulation: string, annee: number): string {
  const slug = enSlug(nomDeLaSimulation)
  const contientLAnnee = slug.split("-").includes(String(annee))
  return `${contientLAnnee ? slug : `${slug}-${annee}`}.pdf`
}
