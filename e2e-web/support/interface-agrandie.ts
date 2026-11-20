// e2e-web/support/interface-agrandie.ts
// La session des contrôles de lisibilité de l'interface agrandie (zoom-lisibilite.web.ts, zoom-balayage.web.ts) : elle
// porte ce qui s'affiche de plus long, une activité exonérée en zone (ADR 017) avec sa note et son avertissement, et une
// micro-entreprise avec l'ACRE.

import { expect, type Page } from "@playwright/test"

const SESSION = {
  formatVersion: 3,
  name: "Atelier en zone franche",
  entities: [
    { id: "person-alice", type: "person", name: "Alice Martin", fiscalParts: 1, avatar: { type: "initials", value: "AM", color: "#3b82f6" }, locked: false },
    { id: "company-atelier", type: "company", name: "Atelier", legalStatus: "SASU", capitalSocial: 1000, dateDeCreation: "2024-01", implantationEnZone: {}, avatar: { type: "icon", value: "Store", color: "#d97706" }, locked: false },
    { id: "micro-boutique", type: "micro-entreprise", name: "Boutique", beneficieACRE: true, opteVFL: false, dateDeCreation: "2026-01", avatar: { type: "icon", value: "Store", color: "#f97316" }, locked: false }
  ],
  relationships: [
    { id: "r-president", fromId: "person-alice", toId: "company-atelier", type: "Président" },
    { id: "r-titulaire", fromId: "person-alice", toId: "micro-boutique", type: "Titulaire" }
  ],
  annees: [
    {
      annee: 2026,
      monthlyData: Array.from({ length: 12 }, (_, month) => ({
        month,
        flows: [...(month === 0 ? [{ id: "ca", entityId: "company-atelier", type: "ca_services", label: "Prestations", amount: 80000 }] : []), { id: `boutique-${month}`, entityId: "micro-boutique", type: "ca_micro_services_bic", label: "Ateliers du samedi", amount: 1500 }]
      }))
    }
  ]
}

export const AFFICHAGES = ["resume", "classique", "vues"] as const

/** Ouvre la démo sur cette session, au zoom demandé (que l'application borne selon la largeur) et dans cet affichage. */
export async function ouvrirLaSessionAgrandie(page: Page, zoom: number, affichage: string) {
  await page.addInitScript(
    ([session, z, a]) => {
      window.localStorage.setItem("simulateur.session", JSON.stringify(session))
      window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: a, zoom: z }))
    },
    [SESSION, zoom, affichage] as const
  )
  await page.goto("./")
  await expect(page.getByRole("navigation", { name: "Barre d'outils" })).toBeVisible()
}
