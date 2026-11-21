// src/backend/logic/testing/garanties-de-test.ts

import type { ProtectionSociale } from "../../../types.js"

/** Les garanties du régime général, pour les tests dont la protection sociale n'est pas le sujet. */
export const GARANTIES_DE_TEST: ProtectionSociale["garanties"] = {
  retraite: { niveau: "oui" },
  arretMaladie: { niveau: "oui" },
  invaliditeDeces: { niveau: "oui" },
  accidentDuTravail: { niveau: "oui" },
  chomage: { niveau: "non" }
}
