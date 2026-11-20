// e2e-web/implantation-en-zone.web.ts
// Exonération d'impôt sur les bénéfices en zone (ADR 017) : une SASU créée en janvier 2024, 80 000 € de bénéfice. La
// section « Aides liées au lieu d'implantation » de sa fiche est repliée ; cochée, elle annonce le régime ZFU-TE, son
// calendrier et les hypothèses du calcul, et la carte de l'activité montre le bénéfice exonéré (50 000 €, le plafond)
// et l'impôt sur les sociétés qui reste (4 500 € au lieu de 15 750 €). Rien de tout cela n'apparaît case décochée.
// La situation type « SASU en zone franche urbaine (ZFU-TE) » s'ouvre par son adresse, case déjà cochée.

import { test, expect, type Locator, type Page } from "@playwright/test"
import { ligneDeLAnnee } from "./support/annees"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"

const SESSION = {
  formatVersion: 3,
  name: "Atelier en zone franche",
  entities: [
    { id: "person-alice", type: "person", name: "Alice Martin", fiscalParts: 1, avatar: { type: "initials", value: "AM", color: "#3b82f6" }, locked: false },
    { id: "company-atelier", type: "company", name: "Atelier", legalStatus: "SASU", capitalSocial: 1000, dateDeCreation: "2024-01", avatar: { type: "icon", value: "Store", color: "#d97706" }, locked: false }
  ],
  relationships: [{ id: "r-president", fromId: "person-alice", toId: "company-atelier", type: "Président" }],
  annees: [{ annee: 2026, monthlyData: Array.from({ length: 12 }, (_, month) => ({ month, flows: month === 0 ? [{ id: "ca", entityId: "company-atelier", type: "ca_services", label: "Prestations", amount: 80000 }] : [] })) }]
}

const TITRE = "Aides liées au lieu d'implantation"
const CASE = "Activité implantée en zone franche urbaine (ZFU-TE) ou en quartier prioritaire (QPV)"
const NOTE = /ZFU-TE : bénéfice exonéré d'impôt à 100\s% en 2026, soit 50\s000\s€ : plafond de 50\s000\s€ atteint\. Exonération totale jusqu'à fin décembre 2028/

async function ouvrir(page: Page, session: unknown = SESSION) {
  await page.addInitScript(s => {
    // Une seule fois : un rechargement doit retrouver ce que la page a enregistré, pas la session de départ.
    if (!window.localStorage.getItem("simulateur.session")) window.localStorage.setItem("simulateur.session", JSON.stringify(s))
  }, session)
  await page.goto("./")
  await expect(page.getByText(ligneDeLAnnee(2026))).toBeVisible()
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

const carteAtelier = (page: Page) => page.getByRole("article").filter({ has: page.getByText("Atelier", { exact: true }) }).first()
const section = (fenetre: Locator) => fenetre.locator("details").filter({ hasText: TITRE })

test("cocher la case exonère le bénéfice, l'annonce sur la carte, et décocher retire tout", async ({ page }) => {
  await ouvrir(page)

  // Case décochée : aucune trace du dispositif dans les résultats.
  await expect(carteAtelier(page).getByRole("list", { name: "Dispositifs de l'année" })).toHaveCount(0)
  await expect(page.getByText("ZFU-TE")).toHaveCount(0)
  await carteAtelier(page).getByRole("button", { name: "Afficher le détail" }).click()
  await expect(carteAtelier(page)).toContainText(/Impôt sur les sociétés\s*− 15\s750\s€/)
  await expect(carteAtelier(page)).not.toContainText("Bénéfice exonéré d'impôt")

  // Dans la fiche, la section est repliée ; une fois dépliée, la case est décochée et rien d'autre n'est montré.
  const fenetre = await reglagesDe(page, "Atelier")
  await expect(section(fenetre)).not.toHaveAttribute("open")
  await section(fenetre).locator("summary").click()
  const laCase = fenetre.getByRole("switch", { name: CASE })
  await expect(laCase).not.toBeChecked()
  await expect(fenetre.getByRole("status")).toHaveCount(0)

  // Cochée : le régime de la date de création, son calendrier, son plafond et les hypothèses du calcul.
  await laCase.click()
  await expect(fenetre.getByRole("status")).toHaveText(/^Créée en janvier 2024 : régime ZFU-TE\. Bénéfice exonéré d'impôt en totalité jusqu'à fin décembre 2028, puis à 60\s%, 40\s% et 20\s% par périodes de douze mois, jusqu'à fin décembre 2031\. Bénéfice exonéré plafonné à 50\s000\s€ par an\.$/)
  await expect(fenetre.getByRole("spinbutton", { name: "Part du chiffre d'affaires réalisée dans la zone (%)" })).toHaveValue("100")
  const hypotheses = fenetre.getByRole("list", { name: "Ce que ce calcul suppose" }).getByRole("listitem")
  // Une seule pour une SASU : l'hypothèse sur les cotisations de l'entreprise individuelle ne la concerne pas.
  await expect(hypotheses).toHaveCount(1)
  await expect(hypotheses.first()).toContainText("Une année à cheval sur deux taux d'exonération est répartie également entre ses mois")
  await expect(fenetre.getByRole("link", { name: "Vérifier une adresse sur la carte officielle" })).toHaveAttribute("href", "https://sig.ville.gouv.fr/")
  await auditer(page, "fiche de l'activité, aides liées au lieu d'implantation", "[role='dialog']")
  await fenetre.getByRole("button", { name: "Enregistrer" }).click()
  await expect(fenetre).toBeHidden()

  // La carte annonce l'exonération, avertit des conditions non vérifiées, et le calcul la montre.
  await expect(carteAtelier(page).getByRole("list", { name: "Dispositifs de l'année" })).toContainText(NOTE)
  // L'avertissement tient en une phrase ; « Voir les conditions » déplie la liste et le lien vers le texte officiel.
  const conditions = carteAtelier(page).getByText(/Exonération ZFU-TE appliquée sans vérifier ses conditions : moins de 50 salariés.*Hypothèses du calcul dans la fiche de l'activité\./)
  await expect(carteAtelier(page).getByText("Exonération ZFU-TE appliquée sans vérifier ses conditions.", { exact: true })).toBeVisible()
  await expect(conditions).toBeHidden()
  await carteAtelier(page).getByRole("button", { name: "Voir les conditions" }).click()
  await expect(conditions).toBeVisible()
  await expect(carteAtelier(page).getByRole("link", { name: "Texte officiel" })).toHaveAttribute("href", /^https:\/\/bofip\.impots\.gouv\.fr\//)
  await auditer(page, "résultats d'une activité exonérée en zone, conditions dépliées")
  await carteAtelier(page).getByRole("button", { name: "Masquer les conditions" }).click()
  await expect(conditions).toBeHidden()
  await expect(carteAtelier(page)).toContainText(/Bénéfice exonéré d'impôt\s*50\s000\s€\s*ZFU-TE, exonéré à 100\s%, plafond atteint/)
  await expect(carteAtelier(page)).toContainText(/Impôt sur les sociétés\s*− 4\s500\s€/)
  await auditer(page, "résultats d'une activité exonérée en zone")

  // Le choix est enregistré avec la simulation : un rechargement le retrouve, et la section s'ouvre d'elle-même.
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem("simulateur.session") ?? "{}").entities?.[1]?.implantationEnZone)).toEqual({})
  await page.reload()
  await expect(carteAtelier(page).getByRole("list", { name: "Dispositifs de l'année" })).toContainText(NOTE)
  const rouverte = await reglagesDe(page, "Atelier")
  await expect(section(rouverte)).toHaveAttribute("open", "")
  await expect(rouverte.getByRole("switch", { name: CASE })).toBeChecked()

  // 60 % du chiffre d'affaires dans la zone : 48 000 € exonérés, sous le plafond.
  const part = rouverte.getByRole("spinbutton", { name: "Part du chiffre d'affaires réalisée dans la zone (%)" })
  await part.fill("60")
  await rouverte.getByRole("button", { name: "Enregistrer" }).click()
  await expect(carteAtelier(page).getByRole("list", { name: "Dispositifs de l'année" })).toContainText(/à 100\s% en 2026 \(60\s% du chiffre d'affaires réalisé dans la zone\), soit 48\s000\s€\./)

  // Décochée : tout disparaît, l'impôt sur les sociétés revient à son montant d'avant.
  const derniere = await reglagesDe(page, "Atelier")
  await derniere.getByRole("switch", { name: CASE }).click()
  await expect(derniere.getByRole("status")).toHaveCount(0)
  await expect(section(derniere)).toHaveAttribute("open", "")
  await derniere.getByRole("button", { name: "Enregistrer" }).click()
  await expect(carteAtelier(page).getByRole("list", { name: "Dispositifs de l'année" })).toHaveCount(0)
  await expect(page.getByText("ZFU-TE")).toHaveCount(0)
  // Le détail de la carte, ouvert plus haut, l'est resté.
  await expect(carteAtelier(page)).toContainText(/Impôt sur les sociétés\s*− 15\s750\s€/)
  await expect(carteAtelier(page)).not.toContainText("Bénéfice exonéré d'impôt")
})

test("au clavier : déplier la section, cocher la case, régler la part", async ({ page }) => {
  await ouvrir(page)
  const fenetre = await reglagesDe(page, "Atelier")
  const titre = section(fenetre).locator("summary")
  await titre.focus()
  await page.keyboard.press("Enter")
  await expect(section(fenetre)).toHaveAttribute("open", "")
  await page.keyboard.press("Tab")
  await expect(fenetre.getByRole("switch", { name: CASE })).toBeFocused()
  await page.keyboard.press("Space")
  await expect(fenetre.getByRole("switch", { name: CASE })).toBeChecked()
  // Après la case : le lien vers la carte officielle, puis la part du chiffre d'affaires, que les flèches règlent.
  await page.keyboard.press("Tab")
  await expect(fenetre.getByRole("link", { name: "Vérifier une adresse sur la carte officielle" })).toBeFocused()
  await page.keyboard.press("Tab")
  const part = fenetre.getByRole("spinbutton", { name: "Part du chiffre d'affaires réalisée dans la zone (%)" })
  await expect(part).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await expect(part).toHaveValue("95")
})

test("la situation type « SASU en zone franche urbaine (ZFU-TE) » s'ouvre par son adresse, case cochée : 50 000 € exonérés, 4 200 € d'impôt sur les sociétés", async ({ page }) => {
  await page.goto("./#situation=sasu-en-zone-franche-urbaine")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SASU en zone franche urbaine (ZFU-TE)")
  const carte = page.getByRole("article").filter({ has: page.getByText("SASU de Karim", { exact: true }) }).first()
  await expect(carte.getByRole("list", { name: "Dispositifs de l'année" })).toContainText(NOTE)
  await carte.getByRole("button", { name: "Afficher le détail" }).click()
  await expect(carte).toContainText(/Bénéfice exonéré d'impôt\s*50\s000\s€/)
  await expect(carte).toContainText(/Impôt sur les sociétés\s*− 4\s200\s€/)

  // La fiche de la société s'ouvre sur la section dépliée, case cochée, avec le régime et les hypothèses.
  const fenetre = await reglagesDe(page, "SASU de Karim")
  await expect(section(fenetre)).toHaveAttribute("open", "")
  await expect(fenetre.getByRole("switch", { name: CASE })).toBeChecked()
  await expect(fenetre.getByRole("status")).toContainText("Créée en janvier 2024 : régime ZFU-TE.")
  await page.keyboard.press("Escape")
  await expect(fenetre).toBeHidden()

  // La fenêtre des situations types la présente, avec ses conditions et ses sources officielles.
  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: "Partir d'une situation type..." }).click()
  await page.getByRole("button", { name: "Détails de la situation « SASU en zone franche urbaine (ZFU-TE) »" }).click()
  const detail = page.getByRole("dialog", { name: "SASU en zone franche urbaine (ZFU-TE)" })
  await expect(detail).toContainText(/en totalité pendant 60 mois, puis à 60\s%, 40\s%, 20\s% par périodes de douze mois, dans la limite de 50\s000\s€ par an/)
  await expect(detail.getByRole("link", { name: /Carte officielle des quartiers prioritaires et des zones franches urbaines/ })).toHaveAttribute("href", "https://sig.ville.gouv.fr/")
  await auditer(page, "détail de la situation type en zone franche urbaine", "[role='dialog']")
})

for (const cas of [
  { nom: "interface zoomée à 150 % dans une fenêtre basse", viewport: { width: 1280, height: 600 }, zoom: 1.5 },
  { nom: "téléphone", viewport: { width: 375, height: 700 }, zoom: 1 }
]) {
  test.describe(cas.nom, () => {
    test.use({ viewport: cas.viewport })

    test("la fiche, section dépliée et case cochée, tient dans l'écran et se parcourt en défilant", async ({ page }) => {
      await page.addInitScript(zoom => window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: "resume", zoom })), cas.zoom)
      const enZone = { ...SESSION, entities: [SESSION.entities[0], { ...SESSION.entities[1], implantationEnZone: {} }] }
      await ouvrir(page, enZone)
      const fenetre = await reglagesDe(page, "Atelier")
      await expect(section(fenetre)).toHaveAttribute("open", "")
      // Après l'animation d'ouverture.
      await expect.poll(async () => (await fenetre.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0)
      const cadre = (await fenetre.boundingBox())!
      expect(cadre.y + cadre.height).toBeLessThanOrEqual(cas.viewport.height)
      expect(cadre.x).toBeGreaterThanOrEqual(0)
      expect(cadre.x + cadre.width).toBeLessThanOrEqual(cas.viewport.width)
      // Les hypothèses, tout en bas de la section, s'atteignent en défilant, sans défilement horizontal (la liste
      // native que Radix cache derrière ses listes déroulantes, 1 px de côté, ne compte pas : Firefox en mesure le contenu).
      const hypotheses = fenetre.getByRole("list", { name: "Ce que ce calcul suppose" })
      await hypotheses.scrollIntoViewIfNeeded()
      await expect(hypotheses).toBeInViewport()
      expect(await fenetre.evaluate(el => [el, ...Array.from(el.querySelectorAll("*"))].filter(e => !e.matches(".sr-only, select[aria-hidden='true']") && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "visible").map(e => e.className))).toEqual([])
      await auditer(page, `fiche de l'activité en zone, ${cas.nom}`, "[role='dialog']")
    })
  })
}

for (const zoom of [1, 1.5]) {
  test(`le lien « Alertes » de la barre de résumé mène à la première alerte, sur la carte de l'activité, zoom de ${zoom * 100} %`, async ({ page }) => {
    await page.addInitScript(z => window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: "resume", zoom: z })), zoom)
    await page.goto("./#situation=sasu-en-zone-franche-urbaine")
    const barre = page.getByRole("region", { name: "Résumé de l'année" })
    const lien = barre.getByRole("link", { name: /^Alertes/ })
    await expect(lien).toHaveText(/Alertes\s*1/)
    await expect(lien).toHaveAttribute("href", "#premiere-alerte")
    await lien.click()
    // L'alerte de la carte « SASU de Karim », pas le titre des résultats, loin au-dessus : entière sous la barre collée.
    const alerte = page.locator("#premiere-alerte")
    await expect(alerte).toContainText("Exonération ZFU-TE appliquée sans vérifier ses conditions")
    await expect(alerte).toBeInViewport({ ratio: 1 })
    const [hautDeLAlerte, basDeLaBarre] = await Promise.all([alerte.evaluate(e => e.getBoundingClientRect().top), barre.evaluate(e => e.getBoundingClientRect().bottom)])
    expect(hautDeLAlerte).toBeGreaterThanOrEqual(basDeLaBarre)
  })
}
