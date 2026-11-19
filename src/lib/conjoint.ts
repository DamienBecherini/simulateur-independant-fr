// src/lib/conjoint.ts
// Raccourci « Ajouter un conjoint » d'un foyer d'une seule personne : la personne, sa relation « Marié(e) » ou
// « PACSé(e) » et, s'il est donné, son salaire net de chaque mois de l'année, en une seule modification de la
// simulation (une étape d'annulation). Sans ce raccourci, il fallait trouver seul les trois gestes.

import { donneesDeLAnnee, remplacerGrille } from "@/backend/logic/annees"
import { createId } from "@/lib/id"
import type { Person, Relationship, SessionState } from "@/types"

/** Les relations qui unissent un couple : avec l'une d'elles, une personne a déjà un conjoint ou un concubin. */
const RELATIONS_DE_COUPLE: readonly Relationship["type"][] = ["Marié(e)", "PACSé(e)", "En couple"]

/** Couleur de la pastille du conjoint, la même que dans les situations types. */
const COULEUR_DU_CONJOINT = "#16a34a"

export type LienDuConjoint = "Marié(e)" | "PACSé(e)"

export interface ChoixDuConjoint {
  prenom: string
  lien: LienDuConjoint
  /** Salaire net imposable par mois, en euros ; 0 ou absent : aucun salaire ajouté. */
  salaireMensuel?: number
}

/**
 * Les personnes à qui le raccourci peut ajouter un conjoint : ni en couple (marié, pacsé ou en union libre, celle-ci
 * se changeant à la main), ni enfant rattaché à un foyer.
 */
export function personnesSansConjoint(session: Pick<SessionState, "entities" | "relationships">): Set<string> {
  const enCouple = new Set(session.relationships.filter(r => RELATIONS_DE_COUPLE.includes(r.type)).flatMap(r => [r.fromId, r.toId]))
  const enfants = new Set(session.relationships.filter(r => r.type === "Enfant").map(r => r.toId))
  return new Set(session.entities.filter(e => e.type === "person" && !enCouple.has(e.id) && !enfants.has(e.id)).map(e => e.id))
}

/** Le prénom saisi, sans espaces autour ; « Conjoint » s'il est vide. */
export function prenomDuConjoint(saisi: string): string {
  return saisi.trim() || "Conjoint"
}

/**
 * La simulation après l'ajout du conjoint de la personne : la nouvelle personne, la relation qui forme le foyer et,
 * avec un salaire, une ligne « Salaire » à ce montant chaque mois de l'année affichée (les autres années ne changent
 * pas). Renvoie aussi l'identifiant du conjoint.
 */
export function ajoutDUnConjoint(session: SessionState, annee: number, personneId: string, choix: ChoixDuConjoint): { session: SessionState; conjointId: string } {
  const prenom = prenomDuConjoint(choix.prenom)
  const conjoint: Person = {
    id: createId("person"),
    type: "person",
    name: prenom,
    fiscalParts: 1,
    avatar: { type: "initials", value: prenom.slice(0, 2).toUpperCase(), color: COULEUR_DU_CONJOINT },
    locked: false
  }
  const relation: Relationship = { id: createId("rel"), fromId: personneId, toId: conjoint.id, type: choix.lien }
  const avecLeConjoint: SessionState = { ...session, entities: [...session.entities, conjoint], relationships: [...session.relationships, relation] }
  const salaire = choix.salaireMensuel ?? 0
  if (salaire <= 0) return { session: avecLeConjoint, conjointId: conjoint.id }
  const grille = donneesDeLAnnee(session, annee).monthlyData.map(mois => ({ ...mois, flows: [...mois.flows, { id: createId("flow"), entityId: conjoint.id, type: "salary" as const, amount: salaire, label: "Salaire" }] }))
  return { session: remplacerGrille(avecLeConjoint, annee, grille), conjointId: conjoint.id }
}
