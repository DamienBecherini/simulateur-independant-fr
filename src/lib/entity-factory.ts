// src/lib/entity-factory.ts

import { CAPITAL_SOCIAL_PAR_DEFAUT, type Person, type Company, type MicroEntreprise, type Relationship, type SessionState } from "@/types"
import type { StatutDUneActivite } from "@/backend/logic/changement-de-statut"
import { relationDuDirigeant } from "@/backend/logic/conversion-de-statut"
import { createId } from "@/lib/id"

// Couleurs par défaut des pastilles, prises dans la palette des réglages d'un acteur (ChampsDeLActeur) :
// distinctes deux à deux et lisibles avec des initiales ou une icône en blanc.
const defaultColors = {
  person: "#3b82f6",
  sasu: "#b91c1c",
  eurl: "#16a34a",
  ei: "#7e22ce",
  micro: "#d97706"
}

/**
 * Crée une nouvelle entité Personne avec des valeurs par défaut.
 */
export function createPerson(): Person {
  return {
    id: createId("person"),
    type: "person",
    name: "Nouvelle Personne",
    fiscalParts: 1,
    avatar: { type: "initials", value: "NP", color: defaultColors.person },
    locked: false
  }
}

// Valeurs par défaut propres à chaque statut. Une entreprise individuelle n'a pas de capital social.
const companyDefaults: Record<Company["legalStatus"], { name: string; icon: string; color: string; capitalSocial: number }> = {
  SASU: { name: "Ma SASU", icon: "Briefcase", color: defaultColors.sasu, capitalSocial: CAPITAL_SOCIAL_PAR_DEFAUT },
  EURL: { name: "Mon EURL", icon: "Building", color: defaultColors.eurl, capitalSocial: CAPITAL_SOCIAL_PAR_DEFAUT },
  EI: { name: "Mon entreprise individuelle", icon: "User", color: defaultColors.ei, capitalSocial: 0 }
}

/**
 * Crée une nouvelle entité Company (SASU, EURL ou entreprise individuelle au réel) avec des valeurs par défaut.
 * @param legalStatus - Le statut juridique de l'activité.
 */
export function createCompany(legalStatus: Company["legalStatus"]): Company {
  const defaults = companyDefaults[legalStatus]
  return {
    id: createId("company"),
    type: "company",
    name: defaults.name,
    legalStatus: legalStatus,
    capitalSocial: defaults.capitalSocial,
    avatar: { type: "icon", value: defaults.icon, color: defaults.color },
    locked: false
  }
}

/**
 * Crée une nouvelle entité Micro-Entreprise avec des valeurs par défaut.
 */
export function createMicroEntreprise(): MicroEntreprise {
  return {
    id: createId("micro"),
    type: "micro-entreprise",
    name: "Ma Micro-Entreprise",
    beneficieACRE: false,
    opteVFL: false,
    avatar: { type: "icon", value: "Store", color: defaultColors.micro },
    locked: false
  }
}

/** Qui exerce une nouvelle activité : une personne de la simulation, une personne créée avec elle, ou personne pour l'instant. */
export type Exercant = { personneId: string } | "nouvelle personne" | null

/** L'identifiant de la personne qui exerce, et la personne à créer s'il y a lieu. */
function personneQuiExerce(exercant: Exercant): { personneId: string | null; nouvelle: Person | null } {
  if (exercant === null) return { personneId: null, nouvelle: null }
  if (exercant !== "nouvelle personne") return { personneId: exercant.personneId, nouvelle: null }
  const nouvelle = createPerson()
  return { personneId: nouvelle.id, nouvelle }
}

/**
 * Les acteurs et relations après l'ajout d'une activité de ce statut et, s'il y a lieu, de la personne qui l'exerce,
 * reliée par la relation de son dirigeant (`relationDuDirigeant` : titulaire d'une micro-entreprise ou d'une EI,
 * président de SASU, gérant d'EURL) : sans relation, le revenu de l'activité ne rejoindrait aucun foyer. L'appelant en
 * fait une seule modification, annulable en une étape.
 */
export function ajoutDUneActivite(session: Pick<SessionState, "entities" | "relationships">, statut: StatutDUneActivite, exercant: Exercant): Pick<SessionState, "entities" | "relationships"> {
  const activite: Company | MicroEntreprise = statut === "micro" ? createMicroEntreprise() : createCompany(statut)
  const { personneId, nouvelle } = personneQuiExerce(exercant)
  const relation: Relationship[] = personneId ? [{ id: createId("rel"), fromId: personneId, toId: activite.id, type: relationDuDirigeant(statut) }] : []
  return {
    entities: [...session.entities, ...(nouvelle ? [nouvelle] : []), activite],
    relationships: [...session.relationships, ...relation]
  }
}
