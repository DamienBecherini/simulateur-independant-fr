// src/backend/logic/testing/annee-suivante.ts

import type * as FichiersDeRegles from "../../regles/index.js"

/*
 * Simule l'arrivée du fichier de règles d'une année de plus (2027), pour vérifier que les cas de référence et les
 * montages types, figés sur 2026, n'en dépendent pas. S'utilise dans la fabrique d'un `vi.mock` de la liste des
 * fichiers de règles :
 *
 *   vi.mock("../../regles/index.js", async importOriginal => (await import("../testing/annee-suivante.js")).avecUneAnneeDePlus(await importOriginal()))
 *
 * L'année ajoutée devient l'année en cours, comme le ferait un vrai fichier `2027.json`. Elle reprend les règles de
 * 2026 avec des montants volontairement très différents (plafond de la sécurité sociale, barème de l'impôt, taux des
 * micro-entreprises, IS) : un calcul qui lirait « l'année en cours » au lieu des règles de 2026 changerait de chiffres.
 */

export const ANNEE_AJOUTEE = 2027

export function avecUneAnneeDePlus(reelles: typeof FichiersDeRegles): typeof FichiersDeRegles {
  const de2026 = reelles.FICHIERS_DE_REGLES.find(regles => regles.annee === 2026)
  if (!de2026) throw new Error("Les règles de 2026 sont introuvables.")
  const ajoutee = structuredClone(de2026)
  ajoutee.annee = ANNEE_AJOUTEE
  ajoutee.TNS.plafondSecuriteSociale *= 1.5
  ajoutee.regimeGeneral.plafondSecuriteSociale *= 1.5
  ajoutee.IR.bareme = ajoutee.IR.bareme.map(tranche => ({ ...tranche, taux: Math.min(tranche.taux + 0.05, 1) }))
  ajoutee.microEntreprise.cotisations = { venteBic: 0.2, servicesBic: 0.3, servicesBnc: 0.35 }
  ajoutee.IS.tauxReduit = 0.2
  return { FICHIERS_DE_REGLES: [...reelles.FICHIERS_DE_REGLES, ajoutee], ANNEE_COURANTE: ANNEE_AJOUTEE }
}
