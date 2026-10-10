// src/lib/entity-factory.ts

import { CAPITAL_SOCIAL_PAR_DEFAUT, type Person, type Company, type MicroEntreprise } from "@/types"
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
