// src/backend/securite-des-fenetres.test.ts
// Options de sécurité des fenêtres, navigation permise et adresses ouvertes hors de l'application.

import { describe, expect, it } from "vitest"
import { ADRESSE_NOUVEAU_TICKET, ADRESSE_E_MAIL_DES_RETOURS } from "@/lib/adresses-des-retours.js"
import { ADRESSE_DU_SERVEUR_DE_DEVELOPPEMENT, PREFERENCES_SURES, adresseAOuvrirHorsDeLApplication, navigationAutorisee } from "./securite-des-fenetres.js"

describe("options de sécurité des fenêtres", () => {
  it("sont écrites explicitement", () => {
    expect(PREFERENCES_SURES).toMatchObject({
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    })
  })
})

describe("adresses ouvertes hors de l'application", () => {
  it.each([
    "https://www.urssaf.fr/accueil/independant.html",
    "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000000000000#ancre",
    `${ADRESSE_NOUVEAU_TICKET}?template=retour.yml`,
    `mailto:${ADRESSE_E_MAIL_DES_RETOURS}?subject=Retour`
  ])("ouvre %s dans le navigateur ou la messagerie du système", adresse => {
    expect(adresseAOuvrirHorsDeLApplication(adresse)).toBe(true)
  })

  it.each([
    "http://www.urssaf.fr/",
    "https://utilisateur:secret@example.org/",
    "https://jeton@example.org/",
    "file:///C:/Windows/System32/calc.exe",
    "javascript:alert(1)",
    "mailto:quelquun@example.org",
    "ms-settings:",
    "smb://serveur/partage",
    "pas une adresse",
    ""
  ])("refuse %s", adresse => {
    expect(adresseAOuvrirHorsDeLApplication(adresse)).toBe(false)
  })
})

describe("navigation de la fenêtre", () => {
  const interfaceCompilee = "file:///C:/Programmes/Simulateur/resources/app.asar/dist-react/index.html"

  it("reste sur la page de l'interface : changement de vue (fragment) ou rechargement", () => {
    expect(navigationAutorisee(`${interfaceCompilee}#resultats`, interfaceCompilee, false)).toBe(true)
    expect(navigationAutorisee(interfaceCompilee, `${interfaceCompilee}#resultats`, false)).toBe(true)
  })

  it("ne quitte jamais l'interface", () => {
    for (const cible of ["https://example.org/", "file:///C:/Users/moi/Documents/autre.html", "file:///C:/Programmes/Simulateur/resources/app.asar/dist-react/index.html?x=1", `${ADRESSE_DU_SERVEUR_DE_DEVELOPPEMENT}/`, "pas une adresse"]) {
      expect(navigationAutorisee(cible, interfaceCompilee, false), cible).toBe(false)
    }
    expect(navigationAutorisee(interfaceCompilee, "", false)).toBe(false)
  })

  it("en développement, suit le serveur de développement et lui seul", () => {
    expect(navigationAutorisee(`${ADRESSE_DU_SERVEUR_DE_DEVELOPPEMENT}/`, `${ADRESSE_DU_SERVEUR_DE_DEVELOPPEMENT}/#resultats`, true)).toBe(true)
    expect(navigationAutorisee(`${ADRESSE_DU_SERVEUR_DE_DEVELOPPEMENT}/src/ui/main.tsx`, "", true)).toBe(true)
    expect(navigationAutorisee("http://localhost:3525/", `${ADRESSE_DU_SERVEUR_DE_DEVELOPPEMENT}/`, true)).toBe(false)
    expect(navigationAutorisee("https://example.org/", `${ADRESSE_DU_SERVEUR_DE_DEVELOPPEMENT}/`, true)).toBe(false)
  })
})
