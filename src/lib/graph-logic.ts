// src/lib/graph-logic.ts
import { rolesDisponibles } from "@/backend/logic/regles-de-structure"
import type { Entity, Relationship } from "@/types"

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

  // D'une personne vers une activité : ce que permettent les règles de sa forme (regles-de-structure.ts), la même table
  // que les propositions des IA et le calcul. Une SASU n'a qu'un président, une activité exercée en son nom qu'un
  // titulaire, et l'on ne dirige pas l'activité dont on est salarié.
  const [personne, activite] = sourceEntity.type === "person" ? [sourceEntity, targetEntity] : [targetEntity, sourceEntity]
  if (activite.type === "person") return []
  return rolesDisponibles(allRelationships, personne.id, activite)
}

/**
 * Ce que veut dire chaque relation d'une personne vers une activité, rappelé au moment de la créer : qui reçoit quoi,
 * et ce que le simulateur ne calcule pas (voir l'ADR 018).
 */
const AIDES_DES_RELATIONS: Partial<Record<Relationship["type"], string>> = {
  Président: "Président : dirige la SASU et reçoit la rémunération de dirigeant. Il ne reçoit des dividendes que s'il est aussi relié comme « Associé ».",
  Gérant: "Gérant : dirige l'EURL, dont il est l'associé, et reçoit rémunération et dividendes. Un gérant non associé, assimilé salarié, n'est pas calculé.",
  Associé: "Associé : reçoit sa part des dividendes. À plusieurs, ils sont partagés à parts égales, la répartition du capital n'étant pas modélisée.",
  // Conditions d'une relation « Salarié ».
  Salarié:
  "Salarié : un vrai contrat de travail, avec un lien de subordination réel et sans gestion de fait de l'activité. Le salaire reste saisi, net, sur la personne ; l'activité en supporte le coût employeur (brut, cotisations patronales, moins la réduction générale)."
}

/** Les aides des relations proposées, dans l'ordre où elles le sont : affichées sous le choix de la relation. */
export function aidesDesRelations(types: Relationship["type"][]): string[] {
  return types.map(type => AIDES_DES_RELATIONS[type]).filter((aide): aide is string => aide !== undefined)
}
