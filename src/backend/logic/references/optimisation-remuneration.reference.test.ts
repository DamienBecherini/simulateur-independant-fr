// src/backend/logic/references/optimisation-remuneration.reference.test.ts

import { expect, it } from "vitest"
import { optimiserRemuneration } from "../optimisation-remuneration.js"
import { casDeReference } from "../testing/cas-de-reference.js"
import { personne, relation, session, societe } from "../testing/session-de-test.js"

/*
 * Cas de référence 2026 : arbitrage rémunération / dividendes avec les règles réelles.
 * Seuil de 4 trimestres d'un président de SASU (voir protection-sociale.reference.test.ts) : 7 212 € bruts, soit, le net
 * étant 79,15975 % du brut sous le plafond, 7 212 x 0,7915975 = 5 708,94 € nets. 5 700 € nets = 7 200,63 € bruts en valident 3,
 * et la première centaine qui en valide 4 est 5 800 € (7 326,96 € bruts). Avec l'ancien ratio net / brut de 78 %, c'était 5 700 €.
 */

const options = { activityId: "s1", remunerationNette: 0, distribuerToutLeBenefice: true, partBncPrestations: 1 }

casDeReference("Arbitrage rémunération / dividendes", () => {
  it("président de SASU : 4 trimestres de retraite à partir de 5 800 € nets de rémunération", () => {
    const s = session([personne("alice"), societe("s1", "SASU")], [relation("alice", "s1", "Président")], [["s1", "ca_services", 80000]])
    const { points } = optimiserRemuneration(s, options, "SASU")

    expect(points.find(p => p.remunerationNette === 5700)?.trimestres).toBe(3)
    expect(points.find(p => p.trimestres >= 4)?.remunerationNette).toBe(5800)
  })

  it("président de SASU : sans rémunération, aucun trimestre de retraite", () => {
    const s = session([personne("alice"), societe("s1", "SASU")], [relation("alice", "s1", "Président")], [["s1", "ca_services", 80000]])
    expect(optimiserRemuneration(s, options, "SASU").points[0]).toMatchObject({ remunerationNette: 0, trimestres: 0 })
  })
})
