// src/lib/graph-logic.ts
import type { Entity, Relationship } from "@/types"

/**
 * Détermine les types de relations théoriquement possibles entre deux types d'entités.
 * @param type1 - Le type de la première entité.
 * @param type2 - Le type de la deuxième entité.
 * @returns Un tableau de types de relations possibles.
 */
function getPotentialRelationTypes(type1: Entity["type"], type2: Entity["type"]): Relationship["type"][] {
  const types = new Set([type1, type2])

  if (types.has("person") && types.has("company")) {
    // On déclare directement le tableau avec le bon type. TypeScript valide chaque chaîne.
    return ["Président", "Gérant", "Associé"]
  }
  if (types.has("person") && types.has("micro-entreprise")) {
    return ["Titulaire"]
  }
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
export function getAvailableRelationships(sourceEntity: Entity, targetEntity: Entity, allRelationships: Relationship[]): Relationship["type"][] {
  // 1. `potentialTypes` est maintenant directement du bon type : Relationship['type'][]
  const potentialTypes = getPotentialRelationTypes(sourceEntity.type, targetEntity.type)
  if (potentialTypes.length === 0) {
    return []
  }

  // 2. Trouver toutes les relations qui existent déjà entre ces deux entités, quel que soit le sens
  const existingRelationshipTypes = new Set(allRelationships.filter(r => (r.fromId === sourceEntity.id && r.toId === targetEntity.id) || (r.fromId === targetEntity.id && r.toId === sourceEntity.id)).map(r => r.type))

  // 3. Le filtrage est maintenant sûr car les deux côtés de la comparaison sont du même type.
  return potentialTypes.filter(type => !existingRelationshipTypes.has(type))
}
