// src/lib/entity-factory.ts

import type { Person, Company, MicroEntreprise } from "@/types"

// On peut même centraliser les couleurs par défaut ici
const defaultColors = {
  person: "#3b82f6",
  sasu: "#ef4444",
  eurl: "#22c55e",
  micro: "#f97316"
}

/**
 * Crée une nouvelle entité Personne avec des valeurs par défaut.
 */
export function createPerson(): Person {
  return {
    id: `person-${Date.now()}`,
    type: "person",
    name: "Nouvelle Personne",
    fiscalParts: 1,
    avatar: { type: "initials", value: "NP", color: defaultColors.person },
    locked: false
  }
}

/**
 * Crée une nouvelle entité Company (SASU ou EURL) avec des valeurs par défaut.
 * @param legalStatus - Le statut juridique de la société.
 */
export function createCompany(legalStatus: "SASU" | "EURL"): Company {
  const isSASU = legalStatus === "SASU"
  return {
    id: `company-${Date.now()}`,
    type: "company",
    name: isSASU ? "Ma SASU" : "Mon EURL",
    legalStatus: legalStatus,
    avatar: {
      type: "icon",
      value: isSASU ? "Briefcase" : "Building",
      color: isSASU ? defaultColors.sasu : defaultColors.eurl
    },
    locked: false
  }
}

/**
 * Crée une nouvelle entité Micro-Entreprise avec des valeurs par défaut.
 */
export function createMicroEntreprise(): MicroEntreprise {
  return {
    id: `micro-${Date.now()}`,
    type: "micro-entreprise",
    name: "Ma Micro-Entreprise",
    beneficieACRE: false,
    opteVFL: false,
    avatar: { type: "icon", value: "Store", color: defaultColors.micro },
    locked: false
  }
}
