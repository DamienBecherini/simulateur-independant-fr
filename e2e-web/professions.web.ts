// e2e-web/professions.web.ts
// Professions libérales réglementées (ADR 015) : choisir une profession dans la fenêtre de réglages d'une activité,
// voir sa caisse sur la carte, et les colonnes micro-entreprise du comparateur disparaître pour un kinésithérapeute.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"

const SESSION = {
  formatVersion: 3,
  name: "Cabinet de Camille",
  entities: [
    { id: "person-camille", type: "person", name: "Camille", fiscalParts: 1, avatar: { type: "initials", value: "CA", color: "#3b82f6" }, locked: false },
    { id: "ei-cabinet", type: "company", name: "Cabinet", legalStatus: "EI", capitalSocial: 0, avatar: { type: "icon", value: "User", color: "#7e22ce" }, locked: false }
  ],
  relationships: [{ id: "r-titulaire", fromId: "person-camille", toId: "ei-cabinet", type: "Titulaire" }],
  annees: [{ annee: 2026, monthlyData: Array.from({ length: 12 }, (_, month) => ({ month, flows: [{ id: `ca-${month}`, entityId: "ei-cabinet", type: "ca_services", label: "Honoraires", amount: 5000 }] })) }],
  comparateur: { activiteComparee: "ei-cabinet", reglagesParActivite: {} }
}

async function ouvrir(page: Page) {
  await page.addInitScript(session => window.localStorage.setItem("simulateur.session", JSON.stringify(session)), SESSION)
  await page.goto("./")
  await expect(page.getByText(/année 2026 avec les règles fiscales 2026/)).toBeVisible()
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

const carteDuCabinet = (page: Page) => page.getByRole("article").filter({ has: page.getByText("Cabinet", { exact: true }) }).first()
const tableau = (page: Page) => page.getByRole("table", { name: "Comparaison des statuts" })

test("choisir « Masseur-kinésithérapeute » : la caisse sur la carte, plus de micro-entreprise dans le comparateur", async ({ page }) => {
  await ouvrir(page)
  // Non réglementée : la micro-entreprise est comparée.
  await expect(tableau(page).getByRole("columnheader", { name: /^Micro-entreprise/ })).toBeVisible()

  const fenetre = await reglagesDe(page, "Cabinet")
  const liste = fenetre.getByRole("combobox", { name: "Profession" })
  await expect(liste).toHaveText("Non réglementée")
  await liste.click()
  await page.getByRole("option", { name: "Masseur-kinésithérapeute" }).click()
  await expect(liste).toHaveAccessibleDescription(/Caisse : CARPIMKO\. Micro-entreprise interdite/)
  await expect(fenetre.getByLabel("Part conventionnée (%)")).toBeVisible()
  await auditer(page, "fenêtre de réglages d'une profession libérale réglementée", "[role=dialog]")
  await fenetre.getByRole("button", { name: "Enregistrer" }).click()
  await expect(page.getByRole("dialog")).toBeHidden()

  // La carte dit la profession et sa caisse ; le comparateur retire les colonnes micro, avec la raison.
  await expect(carteDuCabinet(page)).toContainText("EI au réel · Masseur-kinésithérapeute (CARPIMKO)")
  await expect(tableau(page).getByRole("columnheader", { name: /^EI au réel/ })).toBeVisible()
  await expect(tableau(page).getByRole("columnheader", { name: /^Micro-entreprise/ })).toHaveCount(0)
  await expect(page.getByText(/Micro-entreprise non proposée : elle est interdite aux praticiens et auxiliaires médicaux/).first()).toBeVisible()
  await auditer(page, "comparateur d'un kinésithérapeute")
})

test("une profession de la CIPAV garde la micro-entreprise, au taux de 23,2 %", async ({ page }) => {
  await ouvrir(page)
  const fenetre = await reglagesDe(page, "Cabinet")
  await fenetre.getByRole("combobox", { name: "Profession" }).click()
  await page.getByRole("option", { name: "Ostéopathe" }).click()
  await expect(fenetre.getByRole("combobox", { name: "Profession" })).toHaveAccessibleDescription(/Micro-entreprise possible, au taux de 23,2 %/)
  await expect(fenetre.getByLabel("Part conventionnée (%)")).toHaveCount(0)
  await fenetre.getByRole("button", { name: "Enregistrer" }).click()

  await expect(carteDuCabinet(page)).toContainText("EI au réel · Ostéopathe (CIPAV)")
  await expect(tableau(page).getByRole("columnheader", { name: /^Micro-entreprise/ })).toBeVisible()
})
