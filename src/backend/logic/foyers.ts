// src/backend/logic/foyers.ts

import type { Person, Relationship, DonneesDeLAnnee } from "../../types.js"
import type { ReglesFiscales } from "./regles.js"

// Seuls le mariage et le PACS créent une imposition commune ; l'union libre (« En couple ») laisse deux foyers.
const RELATIONS_DE_COUPLE: Relationship["type"][] = ["Marié(e)", "PACSé(e)"]

/** Un foyer fiscal : un ou deux déclarants, et les enfants qui leur sont rattachés. */
export interface Foyer {
  declarantIds: string[]
  enfantIds: string[]
  totalParts: number
  nombreDeclarants: 1 | 2
  warnings: string[]
}

/** Structure union-find : regroupe les personnes reliées, de proche en proche, par une relation de couple. */
class UnionFind {
  private readonly parent = new Map<string, string>()

  constructor(ids: string[]) {
    for (const id of ids) this.parent.set(id, id)
  }

  find(id: string): string {
    const parent = this.parent.get(id) ?? id
    if (parent === id) return id
    const racine = this.find(parent)
    this.parent.set(id, racine)
    return racine
  }

  union(a: string, b: string) {
    this.parent.set(this.find(a), this.find(b))
  }
}

/** Relations dont les deux extrémités sont des personnes de la session, parmi les types demandés. */
function relationsEntrePersonnes(session: DonneesDeLAnnee, personIds: Set<string>, types: Relationship["type"][]): Relationship[] {
  return session.relationships.filter(rel => types.includes(rel.type) && personIds.has(rel.fromId) && personIds.has(rel.toId))
}

/**
 * Associe chaque enfant rattaché à ses parents. La relation « Enfant » va du parent vers l'enfant.
 * Un enfant en couple déclare ses revenus de son côté ; un enfant dont le parent est lui-même
 * rattaché à un autre foyer n'est pas rattaché (les foyers à trois générations ne sont pas modélisés).
 */
function trouverEnfantsRattaches(liensDeFiliation: Relationship[], enCouple: Set<string>): Map<string, string[]> {
  const candidats = new Set(liensDeFiliation.map(rel => rel.toId).filter(id => !enCouple.has(id)))
  const parentsParEnfant = new Map<string, string[]>()
  for (const rel of liensDeFiliation) {
    if (!candidats.has(rel.toId) || candidats.has(rel.fromId)) continue
    parentsParEnfant.set(rel.toId, [...(parentsParEnfant.get(rel.toId) ?? []), rel.fromId])
  }
  return parentsParEnfant
}

/** Parts apportées par les enfants : une demi-part pour chacun des deux premiers, une part entière ensuite. */
function partsDesEnfants(nombreEnfants: number, regles: ReglesFiscales["IR"]["partsParEnfant"]): number {
  return Math.min(nombreEnfants, 2) * regles.deuxPremiers + Math.max(0, nombreEnfants - 2) * regles.suivants
}

/**
 * Regroupe les personnes de la session en foyers fiscaux : les couples mariés ou pacsés déclarent
 * ensemble, et leurs enfants leur sont rattachés. Les parts saisies sur un enfant rattaché sont
 * ignorées : c'est son rang qui détermine ce qu'il apporte au foyer.
 */
export function buildFoyers(session: DonneesDeLAnnee, regles: ReglesFiscales["IR"]["partsParEnfant"]): Foyer[] {
  const personnes = session.entities.filter((e): e is Person => e.type === "person")
  const personIds = new Set(personnes.map(p => p.id))

  const couples = new UnionFind([...personIds])
  const enCouple = new Set<string>()
  for (const rel of relationsEntrePersonnes(session, personIds, RELATIONS_DE_COUPLE)) {
    couples.union(rel.fromId, rel.toId)
    enCouple.add(rel.fromId).add(rel.toId)
  }

  const parentsParEnfant = trouverEnfantsRattaches(relationsEntrePersonnes(session, personIds, ["Enfant"]), enCouple)

  // Un foyer par groupe de déclarants, dans l'ordre des entités de la session.
  const foyers = new Map<string, Foyer>()
  for (const personne of personnes) {
    if (parentsParEnfant.has(personne.id)) continue
    const racine = couples.find(personne.id)
    const foyer = foyers.get(racine) ?? { declarantIds: [], enfantIds: [], totalParts: 0, nombreDeclarants: 1, warnings: [] }
    foyer.declarantIds.push(personne.id)
    foyer.totalParts += personne.fiscalParts
    foyers.set(racine, foyer)
  }

  for (const [enfantId, parentIds] of parentsParEnfant) {
    const racines = [...new Set(parentIds.map(id => couples.find(id)))]
    const foyer = foyers.get(racines[0])!
    foyer.enfantIds.push(enfantId)
    if (racines.length > 1) {
      foyer.warnings.push("Un enfant est relié à des parents de foyers différents : il est rattaché au premier (la résidence alternée n'est pas modélisée).")
    }
  }

  for (const foyer of foyers.values()) {
    const avecPartsMajorees = personnes.filter(p => foyer.declarantIds.includes(p.id) && p.fiscalParts > 1).map(p => p.name)
    if (foyer.enfantIds.length > 0 && avecPartsMajorees.length > 0) {
      foyer.warnings.push(`${avecPartsMajorees.join(", ")} : plus d'une part propre et des enfants reliés. Les parts des enfants s'ajoutent automatiquement : vérifiez qu'ils ne sont pas comptés deux fois.`)
    }
    foyer.totalParts += partsDesEnfants(foyer.enfantIds.length, regles)
    foyer.nombreDeclarants = foyer.declarantIds.length >= 2 ? 2 : 1
    if (foyer.declarantIds.length > 2) {
      foyer.warnings.push("Plus de deux personnes sont reliées par des relations de couple : elles sont traitées comme un seul foyer à deux déclarants.")
    }
  }

  return [...foyers.values()]
}
