// src/lib/graph-logic.ts
import { RELATIONS_PAR_STATUT } from "@/backend/logic/statuts"
import type { Entity, Relationship } from "@/types"

type Activite = Exclude<Entity, { type: "person" }>

/** Relations qui font diriger une activité ou en être titulaire. */
const RELATIONS_DE_DIRECTION: Relationship["type"][] = ["Président", "Gérant", "Titulaire"]

/**
 * Relations possibles entre une personne et une activité : celles de son statut au réel (`RELATIONS_PAR_STATUT`), ou le
 * seul titulaire d'une micro-entreprise. La relation « Salarié » n'y est pas proposée, le coût d'un salarié n'y
 * réduisant ni cotisations ni impôt.
 */
function getPersonToActivityRelationTypes(activite: Activite): Relationship["type"][] {
  if (activite.type === "micro-entreprise") return ["Titulaire"]
  return RELATIONS_PAR_STATUT[activite.legalStatus]
}

/**
 * Libellé d'une relation tel qu'il est affiché. La relation « Enfant » va du parent vers l'enfant :
 * elle se lit « Enfant à charge » depuis le parent et « Enfant de » depuis l'enfant.
 * @param type - Le type de relation enregistré.
 * @param isSource - Vrai si l'entité affichée est à l'origine de la relation.
 */
export function getRelationshipLabel(type: Relationship["type"], isSource = true): string {
  if (type === "En couple") return "En couple (union libre)"
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
    return existingTypes.size > 0 ? [] : ["Marié(e)", "PACSé(e)", "En couple", "Enfant"]
  }

  // Aucune relation entre deux activités.
  if (sourceEntity.type !== "person" && targetEntity.type !== "person") return []

  const activite = sourceEntity.type === "person" ? targetEntity : sourceEntity
  // On ne dirige pas, et on n'est pas titulaire, d'une activité dont on est salarié, et inversement.
  const dirige = RELATIONS_DE_DIRECTION.some(type => existingTypes.has(type))
  return getPersonToActivityRelationTypes(activite as Activite).filter(type => {
    if (existingTypes.has(type)) return false
    if (type === "Salarié") return !dirige
    return !(RELATIONS_DE_DIRECTION.includes(type) && existingTypes.has("Salarié"))
  })
}

/** Conditions d'une relation « Salarié », rappelées au moment de la créer. */
export const AIDE_RELATION_SALARIE =
  "Salarié : un vrai contrat de travail, avec un lien de subordination réel et sans gestion de fait de l'activité. Le salaire reste saisi, net, sur la personne ; l'activité en supporte le coût employeur (brut, cotisations patronales, moins la réduction générale)."
