// src/lib/reglages-des-acteurs.ts
// Le type d'un acteur en quelques mots, pour la pastille de sa ligne (affichage « Résumé »).

import { LIBELLES_DES_STATUTS } from "@/backend/logic/statuts"
import type { Entity } from "@/types"

/** Type de l'acteur en une pastille : « Personne · 1 part », « Micro-entreprise », « SASU ». */
export function typeCourt(entity: Entity): string {
  if (entity.type === "person") return `Personne · ${entity.fiscalParts.toLocaleString("fr-FR")} ${entity.fiscalParts > 1 ? "parts" : "part"}`
  if (entity.type === "micro-entreprise") return "Micro-entreprise"
  return LIBELLES_DES_STATUTS[entity.legalStatus]
}
