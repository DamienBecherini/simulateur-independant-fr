// src/backend/logic/libelles-des-cotisations.ts
// Les noms des lignes de cotisations d'un travailleur non salarié, dans un seul fichier : l'écran et les exports en
// tirent leurs lignes « dont … » (src/lib/detail-des-cotisations.ts), les outils pour les IA leurs composantes
// (outils/resultats.ts). Le moteur ne pouvant pas importer src/lib, la table vit ici, comme LIBELLES_DES_STATUTS.

import type { CotisationTNS } from "../../types.js"

/** Le nom de chaque cotisation d'un travailleur non salarié, dans l'ordre d'un appel de cotisations. */
export const LIBELLES_DES_COTISATIONS_TNS: Record<CotisationTNS, string> = {
  maladieMaternite: "Maladie-maternité",
  indemnitesJournalieres: "Indemnités journalières",
  retraiteDeBase: "Retraite de base",
  retraiteComplementaire: "Retraite complémentaire",
  invaliditeDeces: "Invalidité-décès",
  allocationsFamiliales: "Allocations familiales",
  csgDeductible: "CSG déductible",
  csgNonDeductibleEtCrds: "CSG non déductible et CRDS",
  formationProfessionnelle: "Formation professionnelle"
}
