// e2e/support/fixtures.ts
//
// Fixtures Playwright : chaque test reçoit un dossier de données vierge, dans le dossier temporaire du
// système, et lance l'application compilée dessus (`--user-data-dir`), sans jamais toucher aux données
// réelles de l'utilisateur. Tout est fermé et supprimé à la fin du test.

import { test as base, expect, _electron as electron, type ElectronApplication, type Page } from "@playwright/test"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { FORMAT_VERSION_ACTUEL } from "../../src/backend/logic/migrations"
import type { SaveSlot, SessionState } from "../../src/types"

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const NEUTRALISER_DIALOGUES = path.join(RACINE, "e2e/support/neutraliser-dialogues.cjs")

/** Boîte de dialogue native interceptée pendant le test (voir `neutraliser-dialogues.cjs`). */
export interface DialogueIntercepte {
  type: "message" | "erreur"
  title: string
  message: string
}

/** Une application lancée : process Electron, fenêtre principale et erreurs relevées dans sa console. */
export interface Application {
  electronApp: ElectronApplication
  page: Page
  erreursConsole: string[]
  dialogues: () => Promise<DialogueIntercepte[]>
}

interface Fixtures {
  /** Dossier de données de l'application pour ce test. */
  dossierDonnees: string
  /** Lance l'application sur le dossier de données du test ; plusieurs lancements successifs sont possibles. */
  lancer: () => Promise<Application>
}

/** La fenêtre principale charge l'interface compilée ; la fenêtre d'accueil (splash) charge `splash.html`. */
const estFenetrePrincipale = (page: Page) => page.url().endsWith("/dist-react/index.html")

async function attendreFenetrePrincipale(electronApp: ElectronApplication): Promise<Page> {
  await expect.poll(() => electronApp.windows().some(estFenetrePrincipale), { message: "Fenêtre principale introuvable", timeout: 20_000 }).toBe(true)
  return electronApp.windows().find(estFenetrePrincipale)!
}

async function lancerApplication(dossierDonnees: string): Promise<Application> {
  if (!existsSync(path.join(RACINE, "dist-react/index.html")) || !existsSync(path.join(RACINE, "dist-electron/backend/main.js"))) {
    throw new Error("Application non compilée : lancez les tests de bout en bout avec « npm run test:e2e ».")
  }

  const electronApp = await electron.launch({
    cwd: RACINE,
    // Le bac à sable de Chromium n'est pas disponible sur les runners Linux de l'intégration continue.
    args: ["-r", NEUTRALISER_DIALOGUES, ".", `--user-data-dir=${dossierDonnees}`, ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
    // Fenêtres masquées par défaut ; E2E_VISIBLE=1 (npm run test:e2e:visible) les affiche pour suivre un test.
    env: { ...process.env, NODE_ENV: "production", SIMULATEUR_FENETRES_MASQUEES: process.env.E2E_VISIBLE === "1" ? "0" : "1" }
  })

  const page = await attendreFenetrePrincipale(electronApp)
  const erreursConsole: string[] = []
  page.on("console", message => {
    if (message.type() === "error") erreursConsole.push(message.text())
  })
  page.on("pageerror", erreur => erreursConsole.push(erreur.message))

  // L'interface est prête quand la session est chargée et que la première simulation est affichée.
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()

  const dialogues = () => electronApp.evaluate(() => (globalThis as unknown as { __dialoguesE2E: DialogueIntercepte[] }).__dialoguesE2E)
  return { electronApp, page, erreursConsole, dialogues }
}

/** Ajoute à des données le numéro du format actuel, comme le fait l'application à l'écriture. */
function auFormatActuel<T extends object>(donnees: T): T & { formatVersion: number } {
  return { ...donnees, formatVersion: FORMAT_VERSION_ACTUEL }
}

/** Dépose une session en cours, au format actuel, avant le lancement de l'application. */
export async function deposerSession(dossierDonnees: string, session: SessionState) {
  await fs.writeFile(path.join(dossierDonnees, "sessionState.json"), JSON.stringify(auFormatActuel(session), null, 2))
}

/** Dépose des sauvegardes, au format actuel, avant le lancement de l'application. */
export async function deposerSauvegardes(dossierDonnees: string, slots: SaveSlot[]) {
  await fs.writeFile(path.join(dossierDonnees, "simulationSlots.json"), JSON.stringify(slots.map(auFormatActuel), null, 2))
}

/** Fenêtres de fichier remplacées par neutraliser-dialogues.cjs : chemins choisis par le test et demandes reçues. */
interface FichiersE2E {
  enregistrer: string | null
  ouvrir: string | null
  demandes: { title: string; defaultPath: string }[]
}

/** Chemins que renverront les fenêtres d'enregistrement et d'ouverture de fichier ; `null` simule une annulation. */
export async function choisirFichiers(electronApp: ElectronApplication, chemins: { enregistrer?: string | null; ouvrir?: string | null }) {
  await electronApp.evaluate((_electron, choix) => {
    Object.assign((globalThis as unknown as { __fichiersE2E: FichiersE2E }).__fichiersE2E, choix)
  }, chemins)
}

/** Titre et nom de fichier proposés par chaque fenêtre d'enregistrement ouverte depuis le lancement. */
export async function demandesDEnregistrement(electronApp: ElectronApplication): Promise<FichiersE2E["demandes"]> {
  return electronApp.evaluate(() => (globalThis as unknown as { __fichiersE2E: FichiersE2E }).__fichiersE2E.demandes)
}

/** Lit un fichier JSON du dossier de données ; `null` s'il n'existe pas encore. */
export async function lireFichier<T = unknown>(dossierDonnees: string, nom: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(dossierDonnees, nom), "utf-8")) as T
  } catch {
    return null
  }
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  dossierDonnees: async ({}, fournir) => {
    const dossier = await fs.mkdtemp(path.join(os.tmpdir(), "simulateur-e2e-"))
    await fournir(dossier)
    // Electron peut garder quelques fichiers ouverts un court instant après sa fermeture (Windows).
    await fs.rm(dossier, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  },

  lancer: async ({ dossierDonnees }, fournir, testInfo) => {
    const lancees: Application[] = []
    await fournir(async () => {
      const application = await lancerApplication(dossierDonnees)
      lancees.push(application)
      return application
    })

    for (const { electronApp, page } of lancees) {
      // En cas d'échec, une capture de la fenêtre encore ouverte est jointe au rapport.
      if (testInfo.status !== testInfo.expectedStatus && !page.isClosed()) {
        await testInfo.attach("fenetre-principale", { body: await page.screenshot(), contentType: "image/png" }).catch(() => {})
      }
      await electronApp.close().catch(() => {})
    }
  }
})

export { expect }
