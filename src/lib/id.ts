// src/lib/id.ts

/**
 * Génère un identifiant unique, précédé d'un préfixe lisible qui indique la nature de l'objet (ex : `person-…`).
 * L'unicité repose sur un UUID v4 et non sur l'horloge : deux objets créés dans la même milliseconde
 * reçoivent des identifiants distincts.
 */
export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
