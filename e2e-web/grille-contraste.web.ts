// e2e-web/grille-contraste.web.ts
// Contraste des textes de la grille mensuelle, calculé dans le navigateur, en clair et en sombre. L'audit axe-core ne
// suffit pas ici : il ignore un texte fait seulement de ponctuation (le « — » d'un acteur sans flux) ou d'un seul
// caractère (numéro au-dessus d'une barre), et ne se prononce pas devant une teinte posée en image de fond (lignes
// zébrées) : ces textes ne sont ni signalés ni vérifiés.

import { test, expect, type Page } from "@playwright/test"
import { contrastesDesTextes } from "./support/contraste"
import { attendreLaFinDesAnimations } from "../e2e/support/animations"

/** Seuil WCAG AA d'un texte de taille normale : tous ceux de la grille le sont (text-sm, text-xs). */
const SEUIL = 4.5

const totaux = (page: Page) => page.getByRole("group", { name: /^Total annuel : / })

const personne = (id: string, name: string) => ({ id, type: "person", name, fiscalParts: 1, avatar: { type: "initials", value: name.slice(0, 2), color: "#3b82f6" }, locked: false })

/**
 * Une société qui verse une rémunération à Alice (barre hachurée sur sa ligne), puis deux personnes sans flux ni
 * versement : l'une sur une ligne ordinaire, l'autre sur une ligne zébrée, leur total affiche « — ».
 */
const SESSION = {
  formatVersion: 3,
  name: "Contraste de la grille",
  entities: [
    { id: "studio", type: "company", name: "Studio", legalStatus: "SASU", capitalSocial: 1000, avatar: { type: "icon", value: "Store", color: "#d97706" }, locked: false },
    personne("alice", "Alice"),
    personne("bruno", "Bruno"),
    personne("chloe", "Chloé")
  ],
  relationships: [{ id: "r1", fromId: "alice", toId: "studio", type: "Président" }],
  annees: [
    {
      annee: 2026,
      monthlyData: Array.from({ length: 12 }, (_, month) => ({
        month,
        flows: [
          { id: `ca${month}`, entityId: "studio", type: "ca_services", label: "", amount: 6000 },
          { id: `rem${month}`, entityId: "studio", type: "director_remuneration", label: "", amount: 2000 },
          { id: `dep${month}`, entityId: "alice", type: "expense", label: "Loyer", amount: 700 }
        ]
      }))
    }
  ]
}

async function verifier(page: Page, theme: string) {
  // Aucune case survolée : le survol change le fond d'une case de mois.
  await page.mouse.move(0, 0)
  // Au changement de thème, les fonds des cases passent en fondu : on attend leur couleur finale.
  await attendreLaFinDesAnimations(page)
  const textes = await contrastesDesTextes(page.locator("[role=group][aria-label^='Total annuel : '], [role=button][aria-label^='Flux ']"))
  expect(textes.length).toBeGreaterThan(10)
  const insuffisants =textes.filter(t => t.rapport < SEUIL)
  expect(insuffisants, `${theme} : ${JSON.stringify(insuffisants)}`).toEqual([])
}

test("les textes de la grille, « — » du total annuel compris, dépassent 4,5:1 en clair et en sombre, lignes zébrées comprises", async ({ page }) => {
  await page.addInitScript(session => window.localStorage.setItem("simulateur.session", JSON.stringify(session)), SESSION)
  await page.goto("./")
  await expect(totaux(page).first()).toBeVisible()
  // Des acteurs sans flux sur une ligne ordinaire et sur une ligne zébrée : leur total affiche « — ».
  const sansFlux = await totaux(page).evaluateAll(cases => cases.filter(c => c.textContent!.trim() === "—").map(c => c.classList.contains("case-de-bande")))
  expect(sansFlux).toContain(true)
  expect(sansFlux).toContain(false)

  await verifier(page, "thème clair")
  await page.getByRole("switch", { name: "Changer de thème" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await verifier(page, "thème sombre")
})
