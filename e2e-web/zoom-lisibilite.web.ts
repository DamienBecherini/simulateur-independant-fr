// e2e-web/zoom-lisibilite.web.ts
// L'interface agrandie reste lisible. Le zoom (boutons de la barre d'outils) réduit la place réellement disponible : une
// fenêtre de 1 280 px zoomée à 200 % n'offre que 640 px, alors que les points de rupture de la page suivent la largeur de
// la fenêtre. À chaque zoom : aucun texte ni aucune commande hors de l'écran, aucun texte coupé par son cadre, sorti de
// son cadre, trop petit ou écrit sur un autre (support/lisibilite.ts). La page est contrôlée dans les trois affichages ;
// toutes les fenêtres de la démo (dialogues, panneau des paramètres, menus, confirmations) le sont une à une, et chacune
// doit tenir dans l'écran. La barre d'outils, elle, suit sa propre largeur : zoomée, elle prend la forme qu'elle aurait
// dans une fenêtre de cette largeur.
// La session porte ce qui s'affiche de plus long : une activité exonérée en zone (ADR 017), sa note et son avertissement,
// et une micro-entreprise avec l'ACRE.
// Hors de portée ici, faute de serveur MCP dans la démo : la proposition de l'IA et sa notification, propres à
// l'application de bureau (e2e/ia-mcp.e2e.ts).

import { test, expect, type Locator, type Page } from "@playwright/test"
import { AFFICHAGES, ouvrirLaSessionAgrandie as ouvrir } from "./support/interface-agrandie"
import { defautsDeLaFenetre, defautsDeLisibilite } from "./support/lisibilite"

/** Fenêtres et zooms essayés ; `zoom` est le zoom demandé, que l'application borne selon la largeur (src/lib/zoom.ts). */
const CAS = [
  { largeur: 1280, hauteur: 800, zoom: 1.5, applique: "1.5" },
  { largeur: 1280, hauteur: 800, zoom: 2, applique: "2" },
  { largeur: 1024, hauteur: 700, zoom: 2, applique: "2" },
  { largeur: 800, hauteur: 700, zoom: 2, applique: "1.73" },
  { largeur: 375, hauteur: 700, zoom: 2, applique: "1.17" }
]

/** Ouvre la fiche « Modifier » de l'acteur de ce nom, quel que soit le rang de son bouton dans la page. */
async function ficheDe(page: Page, nom: string) {
  const boutons = page.getByRole("button", { name: "Modifier les autres réglages" })
  const nombre = await boutons.count()
  const fenetre = page.getByRole("dialog", { name: `Modifier : ${nom}` })
  for (let i = 0; i < nombre; i++) {
    if (!(await boutons.nth(i).isVisible())) continue
    await boutons.nth(i).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    if (await fenetre.isVisible()) return fenetre
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()
  }
  throw new Error(`Aucun bouton « Modifier les autres réglages » ne mène à la fiche de ${nom}`)
}

const barre = (page: Page) => page.getByRole("navigation", { name: "Barre d'outils" })
const fenetres = (page: Page) => page.getByRole("dialog")

/**
 * Ferme toutes les fenêtres ouvertes : Échap, tant qu'il en reste une. Une fenêtre peut demander plusieurs appuis (le
 * détail d'une situation type revient d'abord à la liste, une liste déroulante se referme avant sa fiche).
 */
async function toutFermer(page: Page) {
  await expect
    .poll(async () => {
      const ouvertes = await fenetres(page).count()
      if (ouvertes > 0) await page.keyboard.press("Escape")
      return ouvertes
    })
    .toBe(0)
}

for (const cas of CAS) {
  test.describe(`fenêtre de ${cas.largeur} px, zoom demandé de ${cas.zoom * 100} %`, () => {
    test.use({ viewport: { width: cas.largeur, height: cas.hauteur } })

    for (const affichage of AFFICHAGES) {
      test(`affichage « ${affichage} » : la page reste lisible`, async ({ page }) => {
        await ouvrir(page, cas.zoom, affichage)
        await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe(cas.applique)
        await expect(page.getByText(/ZFU-TE : bénéfice exonéré d'impôt/).first()).toBeAttached()
        expect(await defautsDeLisibilite(page), "page").toEqual([])
      })
    }

    test("toutes les fenêtres tiennent dans l'écran et restent lisibles", async ({ page }) => {
      // Une vingtaine de fenêtres à ouvrir, à laisser se poser et à relever.
      test.slow()
      await ouvrir(page, cas.zoom, "resume")
      await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe(cas.applique)
      const defauts: string[] = []
      const releves: string[] = []
      /** Relève les défauts de la fenêtre, sans s'arrêter au premier : l'échec les montre tous d'un coup. */
      const relever = async (nom: string, fenetre: Locator) => {
        defauts.push(...(await defautsDeLaFenetre(page, fenetre, cas, nom)))
        releves.push(nom)
      }
      const derniere = () => fenetres(page).last()
      /** Clique sur ce qui ouvre une fenêtre, sans autre fenêtre ouverte, et attend qu'elle soit là. */
      const ouvrirDepuis = async (declencheur: Locator) => {
        await expect(fenetres(page)).toHaveCount(0)
        await declencheur.click()
        await expect(fenetres(page)).toHaveCount(1)
      }
      const fenetre = (nom: string) => page.getByRole("dialog", { name: nom })
      const parametres = fenetre("Configuration")
      /** Le panneau des paramètres, rouvert de zéro : certaines des fenêtres qu'il ouvre le referment. */
      const ouvrirLesParametres = async () => {
        await toutFermer(page)
        await ouvrirDepuis(barre(page).getByRole("button", { name: "Paramètres" }))
      }

      // --- La barre d'outils : son menu sur un écran étroit, l'avis, l'export.
      const plusDActions = barre(page).getByRole("button", { name: "Plus d'actions" })
      if (await plusDActions.isVisible()) {
        await plusDActions.click()
        await relever("menu « Plus d'actions »", page.getByRole("menu", { name: "Plus d'actions" }))
        await page.getByRole("menuitem", { name: "Donner mon avis" }).click()
      } else await barre(page).getByRole("button", { name: "Donner mon avis" }).click()
      await relever("Donner mon avis", fenetre("Donner mon avis"))
      await toutFermer(page)

      await ouvrirDepuis(barre(page).getByRole("button", { name: "Exporter" }))
      await relever("Exporter", derniere())

      // --- Les paramètres et ce qu'ils ouvrent. La session n'est pas encore sauvegardée : charger une situation type
      // ou réinitialiser demande une confirmation.
      await ouvrirLesParametres()
      await relever("Paramètres", parametres)

      await parametres.getByRole("button", { name: "Partir d'une situation type..." }).click()
      await relever("Situations types", fenetre("Partir d'une situation type"))
      await page.getByRole("button", { name: "Détails de la situation « SASU sans salaire, tout en dividendes »" }).click()
      const detail = fenetre("SASU sans salaire, tout en dividendes")
      await relever("détail d'une situation type", detail)
      await detail.getByRole("button", { name: "Charger cette situation" }).click()
      await relever("confirmation du chargement d'une situation type", fenetre("Remplacer la simulation en cours ?"))

      await ouvrirLesParametres()
      await parametres.getByRole("button", { name: "Nouvelle Simulation / Réinitialiser" }).click()
      await relever("confirmation de la réinitialisation", fenetre("Remplacer la simulation en cours ?"))

      for (const nom of ["Utiliser avec une IA (MCP)", "Installer le simulateur", "Mentions légales et confidentialité"]) {
        await ouvrirLesParametres()
        await parametres.getByRole("button", { name: nom }).click()
        await relever(nom, fenetre(nom))
      }

      // « Sauvegarder » referme le panneau ; la liste des sauvegardes en compte alors une.
      await ouvrirLesParametres()
      await parametres.getByRole("button", { name: "Sauvegarder" }).click()
      await expect(parametres).toBeHidden()
      await ouvrirLesParametres()
      await parametres.getByRole("button", { name: "Charger une sauvegarde..." }).click()
      await expect(derniere().getByRole("button", { name: /^Charger la sauvegarde/ })).toBeVisible()
      await relever("liste des sauvegardes", derniere())
      await toutFermer(page)

      // --- Les fiches : la personne, frais réels dépliés ; l'activité en zone, section ouverte ; la micro-entreprise,
      // sa liste « Statut » et la confirmation du changement de statut.
      const ficheDAlice = await ficheDe(page, "Alice Martin")
      await ficheDAlice.getByRole("switch", { name: /^Comparer mes frais réels/ }).click()
      await ficheDAlice.getByRole("button", { name: "Ajouter un trajet" }).click()
      await relever("fiche de la personne, frais réels", ficheDAlice)
      await toutFermer(page)

      const ficheDeLAtelier = await ficheDe(page, "Atelier")
      await relever("fiche de l'activité en zone", ficheDeLAtelier)
      await expect(ficheDeLAtelier.getByRole("button", { name: "Enregistrer" })).toBeInViewport()
      await toutFermer(page)

      const ficheDeLaBoutique = await ficheDe(page, "Boutique")
      await relever("fiche de la micro-entreprise", ficheDeLaBoutique)
      await ficheDeLaBoutique.getByRole("combobox", { name: "Statut" }).click()
      await relever("liste « Statut »", page.getByRole("listbox"))
      await page.getByRole("option", { name: "Entreprise individuelle (au réel)" }).click()
      await relever("confirmation du changement de statut", fenetre("Passer « Boutique » en EI au réel ?"))
      await toutFermer(page)

      // --- La page : ajout d'une activité (ses deux temps), flux d'un mois, couleurs, conjoint, explication de l'ACRE.
      await ouvrirDepuis(page.getByRole("button", { name: "+ Ajouter une activité" }))
      await relever("Ajouter une activité, choix du statut", derniere())
      await derniere().getByRole("button", { name: /Micro-Entreprise/ }).click()
      await expect(derniere().getByRole("radio", { name: "Alice Martin" })).toBeVisible()
      await relever("Ajouter une activité, choix de la personne", derniere())
      await toutFermer(page)

      await ouvrirDepuis(page.getByRole("button", { name: "Flux de janvier : Atelier" }))
      await derniere().locator("summary", { hasText: "Aide à la saisie" }).click()
      await relever("flux d'un mois", derniere())
      await toutFermer(page)
      await ouvrirDepuis(page.getByRole("button", { name: "Flux de janvier : Boutique" }))
      await derniere().locator("summary", { hasText: "Nature du chiffre d'affaires" }).click()
      await relever("flux d'un mois d'une micro-entreprise", derniere())
      await toutFermer(page)

      await page.locator("summary", { hasText: "Légende des flux" }).click()
      await ouvrirDepuis(page.getByRole("button", { name: "Gérer les couleurs" }))
      await relever("couleurs des flux", derniere())
      await toutFermer(page)

      await ouvrirDepuis(page.getByRole("button", { name: "Ajouter un conjoint" }).first())
      await relever("Ajouter un conjoint", derniere())
      await toutFermer(page)

      await ouvrirDepuis(page.getByRole("button", { name: "Qu'est-ce que l'ACRE ?" }).first())
      await relever("explication de l'ACRE", derniere())
      await toutFermer(page)

      // --- Les années : l'ajout, puis la suppression de l'année ajoutée.
      await ouvrirDepuis(page.getByRole("button", { name: "Ajouter une année" }))
      await relever("Ajouter une année", derniere())
      await derniere().getByRole("button", { name: "Ajouter 2027" }).click()
      await expect(fenetres(page)).toHaveCount(0)
      await ouvrirDepuis(page.getByRole("button", { name: "Supprimer 2027" }))
      await relever("Supprimer une année", derniere())
      await toutFermer(page)

      expect(defauts, `fenêtres relevées : ${releves.join(", ")}`).toEqual([])
      // Garde-fou : le parcours a bien ouvert chaque fenêtre (une de plus avec le menu d'un écran étroit).
      expect(releves.length).toBeGreaterThanOrEqual(24)
    })
  })
}

test.describe("la barre d'outils suit sa largeur réelle, pas celle de la fenêtre", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test("à 100 %, 1 280 px : les noms des boutons, l'affichage et le thème dans la barre", async ({ page }) => {
    await ouvrir(page, 1, "resume")
    await expect(barre(page).getByRole("button", { name: "Donner mon avis" })).toHaveText("Donner mon avis")
    await expect(barre(page).getByRole("button", { name: "Exporter" })).toHaveText("Exporter")
    await expect(barre(page).getByRole("switch", { name: "Changer de thème" })).toBeVisible()
    await expect(barre(page).getByRole("button", { name: "Plus d'actions" })).toBeHidden()
  })

  test("à 200 %, la même fenêtre n'offre que 640 px : icônes seules, comme dans une fenêtre de 640 px", async ({ page }) => {
    await ouvrir(page, 2, "resume")
    await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe("2")
    // Les noms s'effacent (le nom accessible reste), et tout tient dans l'écran.
    await expect(barre(page).getByRole("button", { name: "Donner mon avis" }).getByText("Donner mon avis")).toBeHidden()
    await expect(barre(page).getByRole("button", { name: "Exporter" }).getByText("Exporter")).toBeHidden()
    await expect(barre(page).getByRole("button", { name: "Zoom arrière" })).toBeInViewport()
    await expect(barre(page).getByRole("switch", { name: "Changer de thème" })).toBeInViewport()
    expect(await defautsDeLisibilite(page, barre(page))).toEqual([])
    // On peut toujours revenir en arrière : « Zoom arrière » ramène à 190 %.
    await barre(page).getByRole("button", { name: "Zoom arrière" }).click()
    await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe("1.9")
  })

  test.describe("fenêtre de 1 024 px", () => {
    test.use({ viewport: { width: 1024, height: 700 } })

    test("à 200 %, 512 px : les actions secondaires passent dans « Plus d'actions », comme sur un téléphone", async ({ page }) => {
      await ouvrir(page, 2, "resume")
      await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe("2")
      await expect(barre(page).getByRole("button", { name: "Plus d'actions" })).toBeInViewport()
      await expect(barre(page).getByRole("switch", { name: "Changer de thème" })).toBeHidden()
      await expect(barre(page).getByRole("button", { name: "Situations types" })).toBeHidden()
      // Les boutons de zoom restent : c'est par eux qu'on revient à une taille plus petite.
      await expect(barre(page).getByRole("button", { name: "Zoom arrière" })).toBeInViewport()
      await expect(barre(page).getByRole("button", { name: "Exporter" })).toBeInViewport()
      expect(await defautsDeLisibilite(page, barre(page))).toEqual([])
    })
  })
})
