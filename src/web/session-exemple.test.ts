// src/web/session-exemple.test.ts
// La simulation d'exemple de la démo web, telle qu'elle s'ouvre : ses charges courantes, son net et le comparateur.

import { describe, expect, it } from "vitest"
import { vueDeLAnnee } from "@/backend/logic/annees"
import { AUCUNE_CHARGE } from "@/backend/logic/options-du-comparateur"
import { comparerStatutsDeLAnnee, simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { reglagesDeLActiviteComparee } from "@/lib/comparateur-options"
import { activitesSansCharge } from "@/lib/testing/activites-sans-charge"
import type { FinancialFlow } from "@/types"
import { ANNEE_DE_L_EXEMPLE, sessionExemple } from "./session-exemple"

function comparaisonDe(activiteComparee?: string) {
  const session = sessionExemple()
  const comparateur = activiteComparee ? { reglagesParActivite: {}, ...session.comparateur, activiteComparee } : session.comparateur
  const reglages = reglagesDeLActiviteComparee(vueDeLAnnee(session, ANNEE_DE_L_EXEMPLE), comparateur)
  if (!reglages) throw new Error("aucune activité à comparer")
  return { activite: reglages.activite.id, comparaison: comparerStatutsDeLAnnee(session, reglages.options, ANNEE_DE_L_EXEMPLE) }
}

/** Les charges d'une activité de l'exemple, d'un type donné : leur total de l'année par libellé. */
function chargesParLibelle(entityId: string, type: FinancialFlow["type"]): Record<string, number> {
  const charges = sessionExemple().annees[0].monthlyData.flatMap(mois => mois.flows).filter(f => f.entityId === entityId && f.type === type)
  expect(new Set(charges.map(f => f.id)).size).toBe(charges.length)
  return charges.reduce<Record<string, number>>((totaux, f) => ({ ...totaux, [f.label]: (totaux[f.label] ?? 0) + f.amount }), {})
}

describe("simulation d'exemple de la démo web", () => {
  it("s'ouvre sur l'atelier de Camille, avec ses charges : pas d'alerte « aucune charge » dans le comparateur", () => {
    const { activite, comparaison } = comparaisonDe()
    expect(activite).toBe("micro-atelier")
    expect(comparaison.warnings).not.toContain(AUCUNE_CHARGE)
    // Les charges de l'atelier, non déductibles en micro, ne changent pas le meilleur statut (micro-vfl sans elles aussi).
    expect(comparaison.meilleur).toBe("micro-vfl")
  })

  it("chaque activité a ses charges : pas d'alerte « aucune charge » quelle que soit l'activité choisie", () => {
    expect(activitesSansCharge(sessionExemple(), ANNEE_DE_L_EXEMPLE)).toEqual([])
    // La SASU de conseil, choisie dans le comparateur : même meilleur statut que sans ses charges.
    expect(comparaisonDe("company-conseil").comparaison.meilleur).toBe("micro-vfl")
  })

  it("charges de l'atelier : 2 790 € par an, dont 1 890 € de matières et fournitures (35 % des 5 400 € de ventes)", () => {
    expect(chargesParLibelle("micro-atelier", "expense")).toEqual({ "Matières et fournitures": 1890, Banque: 120, "Assurance RC Pro": 480, CFE: 300 })
  })

  it("charges déductibles de la SASU : 3 130 € par an, proches des 2 900 € de frais supposés d'une SASU", () => {
    expect(chargesParLibelle("company-conseil", "deductible_expense")).toEqual({ "Expert-comptable": 2040, Banque: 240, "Assurance RC Pro": 400, CFE: 450 })
  })

  it("net du foyer de 66 710 € ; les charges de la SASU réduisent son impôt sur les sociétés et ce qu'elle conserve", () => {
    const report = simulerLesAnnees(sessionExemple()).annees[0].report!
    // 68 600 € avec les seules charges courantes de l'atelier : 1 890 € d'achats en moins. Les dividendes saisis
    // (12 000 €) ne changent pas : les 3 130 € de charges de la SASU réduisent son impôt sur les sociétés (3 901 -> 3 432 €)
    // et le bénéfice qu'elle conserve (10 107 -> 7 446 €), pas le net du foyer.
    expect(report.totalNetApresImpots).toBe(66710)
    expect(report.activities.find(a => a.entityId === "company-conseil")).toMatchObject({ impotSocietes: 3432, resultatConserve: 7446 })
    expect([...report.avertissements, ...report.activities.flatMap(a => a.warnings), ...report.foyers.flatMap(f => f.warnings)]).toEqual([])
  })
})
