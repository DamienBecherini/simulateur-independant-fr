// src/backend/logic/references/plusieurs-annees.reference.test.ts

import { describe, expect, it } from "vitest"
import { grilleVide, type MicroEntreprise, type SessionState } from "../../../types.js"
import { comparerStatutsDeLAnnee, simulerLesAnnees } from "../simulation-pluriannuelle.js"
import { micro, personne, relation } from "../testing/session-de-test.js"

/*
 * Cas de référence sur plusieurs années, avec les règles réelles (src/backend/regles/2024.json, 2025.json et
 * regles/2026.json) : le versement libératoire de 2026 dépend du revenu fiscal de référence (RFR) de 2024,
 * que la simulation calcule puisque 2024 en fait partie.
 *
 * Alice, célibataire (1 part), titulaire d'une micro-entreprise de prestations BNC qui demande le versement
 * libératoire chaque année. Elle n'a pas d'autre revenu.
 *
 * Règles utilisées :
 * - 2024 : abattement BNC de 34 % (2024.json, microEntreprise.abattement.servicesBnc) ;
 * - 2026 : seuil de RFR 2024 de 29 315 € par part pour le versement libératoire (regles/2026.json,
 *   microEntreprise.versementLiberatoire.plafondRfrParPart : limite de la 2e tranche du barème des revenus de 2024).
 *
 * RFR 2024 (article 1417 IV du CGI) : au versement libératoire, le chiffre d'affaires après abattement sort du barème
 * mais entre dans le RFR ; sans autre revenu, RFR = CA x (1 - 34 %).
 * - CA 2024 de 44 000 € : RFR = 44 000 x 0,66 = 29 040 € ≤ 29 315 € : versement libératoire ouvert en 2026.
 * - CA 2024 de 45 000 € : RFR = 45 000 x 0,66 = 29 700 € > 29 315 € : versement libératoire fermé en 2026.
 *
 * Pour 2024 (RFR 2022) et 2025 (RFR 2023), années absentes de la session, le RFR saisi sur la fiche (10 000 €)
 * est retenu : le versement libératoire s'applique ces deux années-là.
 */

const alice = personne("alice")
const atelier: MicroEntreprise = { ...micro("m1", { opteVFL: true }), rfrN2: 10000 }

/** Une grille dont janvier porte le chiffre d'affaires BNC de l'année. */
function grilleBnc(chiffreAffaires: number) {
  const grille = grilleVide()
  grille[0].flows.push({ id: `ca-${chiffreAffaires}`, label: "Prestations", amount: chiffreAffaires, entityId: "m1", type: "ca_micro_services_bnc" })
  return grille
}

function troisAnnees(chiffreAffaires2024: number): SessionState {
  return {
    name: "Alice, trois années",
    entities: [alice, atelier],
    relationships: [relation("alice", "m1", "Titulaire")],
    annees: [
      { annee: 2024, monthlyData: grilleBnc(chiffreAffaires2024) },
      { annee: 2025, monthlyData: grilleBnc(30000) },
      { annee: 2026, monthlyData: grilleBnc(30000) }
    ]
  }
}

const vflDe = (session: SessionState, annee: number) => simulerLesAnnees(session).annees.find(a => a.annee === annee)!.report!.activities[0].versementLiberatoire!

describe("versement libératoire 2026 d'après le RFR 2024 calculé (règles réelles)", () => {
  it("calcule le RFR 2024 : chiffre d'affaires après l'abattement BNC de 34 %", () => {
    const [en2024] = simulerLesAnnees(troisAnnees(44000)).annees

    expect(en2024.report!.foyers[0].revenuImposableGlobal).toBe(0)
    expect(en2024.report!.foyers[0].revenuFiscalDeReference).toBe(29040)
  })

  it("ouvre le versement libératoire en 2026 avec un RFR 2024 de 29 040 €", () => {
    expect(vflDe(troisAnnees(44000), 2026)).toEqual({ plafondRfr: 29315, partsFiscales: 1, rfrN2: 29040, anneeRfr: 2024, origineRfr: "calcule", eligible: true, applique: true })
  })

  it("le ferme en 2026 avec un RFR 2024 de 29 700 €, alors que le RFR saisi (10 000 €) l'aurait ouvert", () => {
    expect(vflDe(troisAnnees(45000), 2026)).toEqual({ plafondRfr: 29315, partsFiscales: 1, rfrN2: 29700, anneeRfr: 2024, origineRfr: "calcule", eligible: false, applique: false })
  })

  it("garde le RFR saisi pour 2024 et 2025, dont les années N-2 ne sont pas simulées", () => {
    const session = troisAnnees(45000)

    expect(vflDe(session, 2024)).toMatchObject({ rfrN2: 10000, anneeRfr: 2022, origineRfr: "saisi", applique: true })
    expect(vflDe(session, 2025)).toMatchObject({ rfrN2: 10000, anneeRfr: 2023, origineRfr: "saisi", applique: true })
  })

  it("le comparateur de 2026 retient lui aussi le RFR 2024 calculé : la colonne au versement libératoire est refusée", () => {
    const options = { activityId: "m1", remunerationNette: 0, repartition: { mode: "dividendes" as const, partDistribuee: 1 }, partBncPrestations: 1 }
    const colonne = comparerStatutsDeLAnnee(troisAnnees(45000), options, 2026).scenarios.find(s => s.statut === "micro-vfl")!

    expect(colonne.warnings).toContainEqual(expect.stringMatching(/^Versement libératoire impossible : le revenu fiscal de référence 2024 \(29\s700 €, calculé par la simulation\)/))
  })
})
