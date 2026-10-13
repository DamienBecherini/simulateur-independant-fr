// e2e-web/edition-des-activites.web.ts
// Édition des activités (parcours utilisateur, P-16 et P-17) : une activité ajoutée est reliée d'emblée à la personne
// qui l'exerce ; une micro-entreprise devient une entreprise individuelle au réel depuis sa fiche, flux et relation
// compris. Chacune de ces actions s'annule en une seule étape.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { choisirAvantLeChargement } from "./support/affichage"

const ALICE = { id: "person-alice", type: "person", name: "Alice Martin", fiscalParts: 1, avatar: { type: "initials", value: "AM", color: "#3b82f6" }, locked: false }
const ATELIER = { id: "micro-atelier", type: "micro-entreprise", name: "Atelier", beneficieACRE: true, opteVFL: false, avatar: { type: "icon", value: "Store", color: "#d97706" }, locked: false }

function session(entities: object[], relationships: object[] = [], fluxMensuels: object[] = []) {
  return {
    formatVersion: 3,
    name: "Édition des activités",
    entities,
    relationships,
    annees: [{ annee: 2026, monthlyData: Array.from({ length: 12 }, (_, month) => ({ month, flows: fluxMensuels.map((f, i) => ({ id: `f-${month}-${i}`, ...f })) })) }],
    comparateur: { reglagesParActivite: {} }
  }
}

async function ouvrir(page: Page, contenu: object) {
  await choisirAvantLeChargement(page, "classique")
  await page.addInitScript(s => window.localStorage.setItem("simulateur.session", JSON.stringify(s)), contenu)
  await page.goto("./")
  await expect(page.getByText(/année 2026 avec les règles fiscales 2026/)).toBeVisible()
}

/** Le sous-titre de la carte de l'activité, qui dit son statut. */
const sousTitre = (page: Page, statut: string) => page.getByText(`Activité - ${statut}`, { exact: true })
/** La fiche de l'activité, seconde de la liste après la personne. */
const ouvrirLaFiche = (page: Page) => page.getByRole("button", { name: "Modifier les autres réglages" }).nth(1).click()
const annuler = (page: Page) => page.getByRole("navigation", { name: "Barre d'outils" }).getByRole("button", { name: "Annuler", exact: true })

test("ajouter une micro-entreprise reliée d'emblée à la seule personne, puis l'annuler en une étape", async ({ page }) => {
  await ouvrir(page, session([ALICE]))

  await page.getByRole("button", { name: "+ Ajouter une activité" }).click()
  const fenetre = page.getByRole("dialog", { name: "Ajouter une activité" })
  await fenetre.getByRole("button", { name: /Micro-Entreprise/ }).click()

  // Second temps : la seule personne est proposée d'office, avec le focus, et la relation est annoncée.
  const alice = fenetre.getByRole("radio", { name: "Alice Martin" })
  await expect(alice).toBeChecked()
  await expect(alice).toBeFocused()
  await expect(fenetre.getByRole("group", { name: "Qui exerce cette activité ?" })).toHaveAccessibleDescription(/reliée à l'activité comme « Titulaire »/)
  await auditer(page, "ajout d'une activité : qui l'exerce", "[role=dialog]")
  // Au clavier : Entrée valide le choix proposé.
  await page.keyboard.press("Enter")
  await expect(fenetre).toBeHidden()

  // L'activité est reliée : la relation « Titulaire » paraît sur les deux cartes.
  await expect(page.getByRole("textbox", { name: "Nom" })).toHaveCount(2)
  await expect(page.getByText("Titulaire", { exact: true })).toHaveCount(2)

  // Une seule étape d'historique : « Annuler » retire l'activité et sa relation ensemble.
  await annuler(page).click()
  await expect(page.getByRole("textbox", { name: "Nom" })).toHaveCount(1)
  await expect(page.getByText("Titulaire", { exact: true })).toHaveCount(0)
})

test("convertir une micro-entreprise en EI au réel depuis sa fiche, puis l'annuler en une étape", async ({ page }) => {
  await ouvrir(page, session([ALICE, ATELIER], [{ id: "r-titulaire", fromId: "person-alice", toId: "micro-atelier", type: "Titulaire" }], [{ entityId: "micro-atelier", type: "ca_micro_services_bnc", label: "Prestations libérales (BNC)", amount: 3000 }]))
  await expect(sousTitre(page, "Micro-entreprise")).toBeVisible()

  await ouvrirLaFiche(page)
  const fiche = page.getByRole("dialog", { name: "Modifier : Atelier" })
  await fiche.getByRole("combobox", { name: "Statut" }).click()
  await page.getByRole("option", { name: "Entreprise individuelle (au réel)" }).click()

  // Ce qui change est dit avant de valider.
  const confirmation = page.getByRole("dialog", { name: "Passer « Atelier » en EI au réel ?" })
  const consequences = confirmation.getByRole("list", { name: "Ce que la conversion change" })
  await expect(consequences).toContainText(/« Prestations libérales \(BNC\) » \(36\s000\s€\) devient « CA - Prestation de services »/)
  await expect(consequences).toContainText("L'ACRE est retirée")
  await auditer(page, "confirmation d'un changement de statut", "[role=dialog]")
  await confirmation.getByRole("button", { name: "Convertir" }).click()
  await expect(confirmation).toBeHidden()

  // La fiche reste ouverte sur l'activité convertie, le focus sur la liste « Statut ».
  const statut = fiche.getByRole("combobox", { name: "Statut" })
  await expect(statut).toHaveText("Entreprise individuelle (au réel)")
  await expect(statut).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(fiche).toBeHidden()
  await expect(sousTitre(page, "EI au réel")).toBeVisible()
  await expect(page.getByText("Titulaire", { exact: true })).toHaveCount(2)

  // Une seule étape d'historique : la micro-entreprise revient avec ses flux.
  await annuler(page).click()
  await expect(sousTitre(page, "Micro-entreprise")).toBeVisible()
  await expect(page.getByRole("button", { name: "Flux de janvier : Atelier" })).toBeVisible()
  await expect(annuler(page)).toBeDisabled()
})

test("un masseur-kinésithérapeute ne peut pas passer en micro-entreprise : la raison est donnée, rien ne change", async ({ page }) => {
  const cabinet = { id: "ei-cabinet", type: "company", name: "Cabinet", legalStatus: "EI", capitalSocial: 0, profession: "masseur-kinesitherapeute", avatar: { type: "icon", value: "User", color: "#7e22ce" }, locked: false }
  await ouvrir(page, session([ALICE, cabinet], [{ id: "r", fromId: "person-alice", toId: "ei-cabinet", type: "Titulaire" }]))

  await ouvrirLaFiche(page)
  await page.getByRole("dialog", { name: "Modifier : Cabinet" }).getByRole("combobox", { name: "Statut" }).click()
  await page.getByRole("option", { name: "Micro-entreprise" }).click()

  const refus = page.getByRole("dialog", { name: "« Cabinet » ne peut pas devenir une micro-entreprise" })
  await expect(refus).toContainText("interdite aux praticiens et auxiliaires médicaux")
  await refus.getByRole("button", { name: "Retour à la fiche" }).click()
  const statut = page.getByRole("dialog", { name: "Modifier : Cabinet" }).getByRole("combobox", { name: "Statut" })
  await expect(statut).toHaveText("Entreprise individuelle (au réel)")
  await expect(statut).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(sousTitre(page, "EI au réel")).toBeVisible()
  await expect(annuler(page)).toBeDisabled()
})
