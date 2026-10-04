// src/lib/nom-du-pdf.ts
// Nom proposé pour le PDF d'une simulation : son nom en minuscules, sans accents ni espaces, suivi de l'année.

/** « Famille Martin, simulation » → « famille-martin-simulation » ; « simulation » si rien ne reste. */
function enSlug(texte: string): string {
  const slug = texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "simulation"
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
