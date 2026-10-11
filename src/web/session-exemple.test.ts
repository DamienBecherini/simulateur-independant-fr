// src/web/session-exemple.test.ts
// La simulation d'exemple de la démo web, telle qu'elle s'ouvre : ses charges courantes, son net et le comparateur.

import { describe, expect, it } from "vitest"
import { vueDeLAnnee } from "@/backend/logic/annees"
import { AUCUNE_CHARGE } from "@/backend/logic/options-du-comparateur"
import { comparerStatutsDeLAnnee, simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { reglagesDeLActiviteComparee } from "@/lib/comparateur-options"
import { ANNEE_DE_L_EXEMPLE, sessionExemple } from "./session-exemple"

function comparaisonALOuverture() {
  const session = sessionExemple()
  const reglages = reglagesDeLActiviteComparee(vueDeLAnnee(session, ANNEE_DE_L_EXEMPLE), session.comparateur)
  if (!reglages) throw new Error("aucune activité à comparer")
  return { activite: reglages.activite.id, comparaison: comparerStatutsDeLAnnee(session, reglages.options, ANNEE_DE_L_EXEMPLE) }
}

describe("simulation d'exemple de la démo web", () => {
  it("s'ouvre sur l'atelier de Camille, avec ses charges : pas d'alerte « aucune charge » dans le comparateur", () => {
    const { activite, comparaison } = comparaisonALOuverture()
    expect(activite).toBe("micro-atelier")
    expect(comparaison.warnings).not.toContain(AUCUNE_CHARGE)
    // Les charges de l'atelier, non déductibles en micro, ne changent pas le meilleur statut (micro-vfl sans elles aussi).
    expect(comparaison.meilleur).toBe("micro-vfl")
  })

  it("charges de l'atelier : 900 € par an (banque 120 €, assurance 480 €, CFE 300 €), retirés du net du foyer", () => {
    const charges = sessionExemple().annees[0].monthlyData.flatMap(mois => mois.flows).filter(f => f.entityId === "micro-atelier" && f.type === "expense")
    expect(charges.reduce((somme, f) => somme + f.amount, 0)).toBe(900)
    expect(new Set(charges.map(f => f.id)).size).toBe(charges.length)
    // 69 500 € sans les charges : 900 € de moins.
    expect(simulerLesAnnees(sessionExemple()).annees[0].report?.totalNetApresImpots).toBe(68600)
  })
})
