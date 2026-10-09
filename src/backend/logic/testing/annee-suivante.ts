// src/backend/logic/testing/annee-suivante.ts

import type * as Regles from "../regles.js"

/*
 * Simule l'arrivée des règles d'une année de plus (2027), pour vérifier que les cas de référence et les montages
 * types, figés sur 2026, n'en dépendent pas. S'utilise dans la fabrique d'un `vi.mock` du module des règles :
 *
 *   vi.mock("../regles.js", async importOriginal => (await import("../testing/annee-suivante.js")).avecUneAnneeDePlus(await importOriginal()))
 *
 * L'année ajoutée reprend les règles de 2026 avec des montants volontairement très différents (plafond de la sécurité
 * sociale, barème de l'impôt, taux des micro-entreprises, IS) : un calcul qui lirait « l'année en cours » au lieu des
 * règles de 2026 changerait de chiffres.
 */

export const ANNEE_AJOUTEE = 2027

export function avecUneAnneeDePlus(reelles: typeof Regles): typeof Regles {
  const ajoutee = structuredClone(reelles.reglesPubliees(2026))
  ajoutee.annee = ANNEE_AJOUTEE
  ajoutee.TNS.plafondSecuriteSociale *= 1.5
  ajoutee.regimeGeneral.plafondSecuriteSociale *= 1.5
  ajoutee.IR.bareme = ajoutee.IR.bareme.map(tranche => ({ ...tranche, taux: Math.min(tranche.taux + 0.05, 1) }))
  ajoutee.microEntreprise.cotisations = { venteBic: 0.2, servicesBic: 0.3, servicesBnc: 0.35 }
  ajoutee.IS.tauxReduit = 0.2
  return {
    ...reelles,
    reglesEnVigueur: ajoutee,
    DERNIERE_ANNEE_DES_REGLES: ANNEE_AJOUTEE,
    reglesDesAnneesConnues: () => [...reelles.reglesDesAnneesConnues(), ajoutee],
    reglesDeLAnnee: annee => (annee === ANNEE_AJOUTEE ? { regles: ajoutee, avertissement: null } : reelles.reglesDeLAnnee(annee))
  }
}
