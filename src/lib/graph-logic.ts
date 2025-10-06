// src/lib/graph-logic.ts
/**
 * Détermine les types de relations théoriquement possibles entre deux types d'entités.
 * @param type1 - Le type de la première entité.
 * @param type2 - Le type de la deuxième entité.
 * @returns Un tableau de types de relations possibles.
 */
function getPotentialRelationTypes(type1: Entity["type"], type2: Entity["type"]): string[] {
  const types = new Set([type1, type2])

  if (types.has("person") && types.has("company")) {
    return ["Président", "Gérant", "Associé"]
  }
  if (types.has("person") && types.has("micro-entreprise")) {
    return ["Titulaire"]
  }
  // Si on a deux personnes et pas de société
  if (types.has("person") && !types.has("company") && !types.has("micro-entreprise") && types.size === 1) {
    return ["Marié(e)", "PACSé(e)", "Enfant"]
  }

  return []
}

/**
 * Renvoie la liste des relations qu'il est possible de créer entre une entité source et une entité cible,
 * en tenant compte des relations déjà existantes.
 * @param sourceEntity - L'entité depuis laquelle on crée la relation.
 * @param targetEntity - L'entité cible de la relation.
 * @param allRelationships - Le tableau complet de toutes les relations existantes.
 * @returns Un tableau de types de relations valides et non-existantes.
 */
export function getAvailableRelationships(sourceEntity: Entity, targetEntity: Entity, allRelationships: Relationship[]): string[] {
  // 1. Obtenir toutes les relations possibles en théorie
  const potentialTypes = getPotentialRelationTypes(sourceEntity.type, targetEntity.type)
  if (potentialTypes.length === 0) {
    return []
  }

  // 2. Trouver toutes les relations qui existent déjà entre ces deux entités, quel que soit le sens
  const existingRelationshipTypes = allRelationships.filter(r => (r.fromId === sourceEntity.id && r.toId === targetEntity.id) || (r.fromId === targetEntity.id && r.toId === sourceEntity.id)).map(r => r.type)

  // 3. Retourner uniquement les relations possibles qui n'existent pas déjà
  return potentialTypes.filter(type => !existingRelationshipTypes.includes(type))
}

// Ici, nous pourrons ajouter nos futures fonctions de validation plus complexes
// export function canHaveMultipleGerants(company: Company, allRelationships: Relationship[]): boolean { ... }
