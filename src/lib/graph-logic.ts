// src/lib/graph-logic.ts
import type { Entity, Relationship } from "@/types"

type Activite = Exclude<Entity, { type: "person" }>

/**
 * Relations possibles entre une personne et une activité, selon le statut de celle-ci :
 * une SASU a un président, une EURL un gérant, et une entreprise individuelle
 * (micro-entreprise ou EI au réel) un titulaire.
 */
function getPersonToActivityRelationTypes(activite: Activite): Relationship["type"][] {
  if (activite.type === "micro-entreprise" || activite.legalStatus === "EI") return ["Titulaire"]
  return activite.legalStatus === "SASU" ? ["Président", "Associé"] : ["Gérant", "Associé"]
}

/**
 * Libellé d'une relation tel qu'il est affiché. La relation « Enfant » va du parent vers l'enfant :
 * elle se lit « Enfant à charge » depuis le parent et « Enfant de » depuis l'enfant.
 * @param type - Le type de relation enregistré.
 * @param isSource - Vrai si l'entité affichée est à l'origine de la relation.
 */
export function getRelationshipLabel(type: Relationship["type"], isSource = true): string {
  if (type !== "Enfant") return type
  return isSource ? "Enfant à charge" : "Enfant de"
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
  // Une entité ne peut pas être reliée à elle-même.
  if (sourceEntity.id === targetEntity.id) return []

  // Les relations qui existent déjà entre ces deux entités, quel que soit le sens.
  const existingTypes = new Set(allRelationships.filter(r => (r.fromId === sourceEntity.id && r.toId === targetEntity.id) || (r.fromId === targetEntity.id && r.toId === sourceEntity.id)).map(r => r.type))

  if (sourceEntity.type === "person" && targetEntity.type === "person") {
    // Deux personnes n'ont qu'un seul lien familial : on ne cumule pas mariage, PACS et filiation.
    return existingTypes.size > 0 ? [] : ["Marié(e)", "PACSé(e)", "Enfant"]
  }

  // Aucune relation entre deux activités.
  if (sourceEntity.type !== "person" && targetEntity.type !== "person") return []

  const activite = sourceEntity.type === "person" ? targetEntity : sourceEntity
  return getPersonToActivityRelationTypes(activite as Activite).filter(type => !existingTypes.has(type))
}
