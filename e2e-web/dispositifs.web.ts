// e2e-web/dispositifs.web.ts
// Dispositifs limités dans le temps sur trois années : une micro-entreprise créée en septembre 2026, à l'ACRE, au-delà
// des plafonds en 2026 (au prorata de ses quatre mois) et en 2027, passe au régime réel au 1er janvier 2028. L'ACRE
// court de septembre 2026 à juin 2027. Résultats, synthèse des années, comparateur, fenêtre de réglages, accessibilité.

import { test, expect, type Page } from "@playwright/test"
import { ligneDeLAnnee } from "./support/annees"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"

/** 7 500 € de prestations BIC chaque mois d'activité : 30 000 € en 2026 (plafond au prorata : 27 943 €), 90 000 € ensuite. */
function grille(mois: number[]) {
  return Array.from({ length: 12 }, (_, month) => ({ month, flows: mois.includes(month) ? [{ id: `ca-${month}`, entityId: "micro-atelier", type: "ca_micro_services_bic", label: "Prestations", amount: 7500 }] : [] }))
}

const TOUS_LES_MOIS = Array.from({ length: 12 }, (_, m) => m)

const SESSION = {
  formatVersion: 3,
  name: "Atelier créé en septembre 2026",
  entities: [
    { id: "person-alice", type: "person", name: "Alice Martin", fiscalParts: 1, avatar: { type: "initials", value: "AM", color: "#3b82f6" }, locked: false },
    { id: "micro-atelier", type: "micro-entreprise", name: "Atelier", beneficieACRE: true, opteVFL: false, dateDeCreation: "2026-09", avatar: { type: "icon", value: "Store", color: "#d97706" }, locked: false }
  ],
  relationships: [{ id: "r-titulaire", fromId: "person-alice", toId: "micro-atelier", type: "Titulaire" }],
  annees: [
    { annee: 2026, monthlyData: grille([8, 9, 10, 11]) },
    { annee: 2027, monthlyData: grille(TOUS_LES_MOIS) },
    { annee: 2028, monthlyData: grille(TOUS_LES_MOIS) }
  ]
}

async function ouvrir(page: Page) {
  await page.addInitScript(session => window.localStorage.setItem("simulateur.session", JSON.stringify(session)), SESSION)
  await page.goto("./")
  await expect(page.getByText(ligneDeLAnnee(2028))).toBeVisible()
}

/** Ouvre la fenêtre de réglages de l'acteur dont la carte porte ce nom. */
async function reglagesDe(page: Page, nom: string) {
  const boutons = page.getByRole("button", { name: "Modifier les autres réglages" })
  const nombre = await boutons.count()
  for (let i = 0; i < nombre; i++) {
    await boutons.nth(i).click()
    const fenetre = page.getByRole("dialog", { name: `Modifier : ${nom}` })
    if (await fenetre.isVisible()) return fenetre
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()
  }
  throw new Error(`Aucune fenêtre de réglages pour ${nom}`)
}

const annee = (page: Page, valeur: string) => page.getByRole("group", { name: "Année affichée" }).getByRole("button", { name: valeur, exact: true })
const carteAtelier = (page: Page) => page.getByRole("article").filter({ has: page.getByText("Atelier", { exact: true }) }).first()
const sortie = "Sortie du régime micro au 1er janvier 2028 : chiffre d'affaires au-delà des plafonds en 2026 et 2027."

test("2028 sous le régime réel, annoncé dans les résultats, la synthèse et le comparateur ; l'ACRE sur deux années", async ({ page }) => {
  await ouvrir(page)

  // 2028 : l'activité est simulée en entreprise individuelle au réel, et la carte le dit.
  await expect(carteAtelier(page)).toContainText("EI au réel · sortie du régime micro au 1er janvier 2028")
  await expect(carteAtelier(page).getByRole("list", { name: "Dispositifs de l'année" })).toContainText(sortie)

  // La synthèse des années reprend chaque dispositif, année par année.
  const dispositifs = page.getByRole("list", { name: "Dispositifs dans le temps" })
  await expect(dispositifs).toContainText(/2026 · Atelier : Année de création \(septembre 2026\) : plafonds du régime micro réduits au prorata de 122 jours/)
  await expect(dispositifs).toContainText(/2026 · Atelier : ACRE : cotisations réduites de 25\s% sur le chiffre d'affaires de septembre à décembre 2026/)
  await expect(dispositifs).toContainText(/2027 · Atelier : ACRE : cotisations réduites de 25\s% sur le chiffre d'affaires de janvier à juin 2027/)
  await expect(dispositifs).toContainText("2027 · Atelier : Deuxième année de suite au-delà des plafonds (2026 et 2027) : sortie du régime micro au 1er janvier 2028")
  await expect(dispositifs).toContainText(`2028 · Atelier : ${sortie}`)

  // Le comparateur de 2028 : les colonnes micro ne sont plus accessibles, l'EI au réel est le statut actuel.
  const tableau = page.getByRole("table", { name: "Comparaison des statuts" })
  for (const colonne of [/^Micro-entreprise/, /^Micro \+ versement libératoire/]) await expect(tableau.getByRole("columnheader", { name: colonne })).toContainText("plus accessible · sortie au 1er janvier 2028")
  await expect(tableau.getByRole("columnheader", { name: /^EI au réel/ })).toContainText("actuel")
  await auditer(page, "année de sortie du régime micro")

  // 2026 : toujours au régime micro, avec l'ACRE des quatre premiers mois.
  await annee(page, "2026").click()
  await expect(page.getByText(ligneDeLAnnee(2026))).toBeVisible()
  await expect(carteAtelier(page)).toContainText("Micro-entreprise")
  await expect(carteAtelier(page).getByRole("list", { name: "Dispositifs de l'année" })).toContainText(/ACRE : cotisations réduites de 25\s% sur le chiffre d'affaires de septembre à décembre 2026, soit 1\s590\s€ de moins ; l'aide court de septembre 2026 à fin juin 2027/)
  await auditer(page, "année de création, ACRE")
})

test("la date de création se lit et se règle dans la fenêtre de réglages de l'activité", async ({ page }) => {
  await ouvrir(page)
  const fenetre = await reglagesDe(page, "Atelier")
  const groupe = fenetre.getByRole("group", { name: "Date de création" })
  await expect(groupe.getByRole("combobox", { name: "Mois de création" })).toHaveText("septembre")
  await expect(groupe.getByRole("combobox", { name: "Année de création" })).toHaveText("2026")
  await auditer(page, "fenêtre de réglages d'une micro-entreprise", "[role=dialog]")

  // Sans date de création, 2026 n'est plus jugé au prorata (30 000 € < 83 600 €) : pas de sortie en 2028, seulement
  // l'annonce d'une sortie en 2029, 2027 et 2028 étant au-delà des plafonds.
  await groupe.getByRole("combobox", { name: "Mois de création" }).click()
  await page.getByRole("option", { name: "Non renseignée" }).click()
  await fenetre.getByRole("button", { name: "Enregistrer" }).click()
  await expect(page.getByRole("dialog")).toBeHidden()
  await expect(carteAtelier(page)).toContainText("Micro-entreprise")
  const dispositifs = page.getByRole("list", { name: "Dispositifs dans le temps" })
  await expect(dispositifs).toHaveText("2028 · Atelier : Deuxième année de suite au-delà des plafonds (2027 et 2028) : sortie du régime micro au 1er janvier 2029, l'activité passera au régime réel.")
})
