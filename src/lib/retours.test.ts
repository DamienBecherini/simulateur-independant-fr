// src/lib/retours.test.ts

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { ADRESSE_E_MAIL_DES_RETOURS, ADRESSE_NOUVEAU_TICKET, adresseExterneAutorisee } from "./adresses-des-retours"
import {
  adresseDeLEMail,
  adresseDuTicket,
  champsDuTicket,
  CHOIX_DU_FORMULAIRE,
  environnementDuRetour,
  LONGUEUR_MAXIMALE_E_MAIL,
  LONGUEUR_MAXIMALE_TICKET,
  NOTE_DE_TRONCATURE,
  retourEnvoyable,
  RETOUR_VIDE,
  sujetDeLEMail,
  systemeEtNavigateur,
  texteACopier,
  texteDuRetour,
  titreDuRetour,
  type Diagnostic,
  type Retour
} from "./retours"

const DIAGNOSTIC: Diagnostic = { version: "0.9.0", web: true, systeme: "Windows", navigateur: "Chrome 140", affichageEnCours: "resume", nombreDAnnees: 3, nombreDActeurs: 4 }
const retour = (changement: Partial<Retour> = {}): Retour => ({ ...RETOUR_VIDE, ...changement })
/** Paramètres d'une adresse de ticket, décodés. */
const parametres = (adresse: string) => Object.fromEntries(new URL(adresse).searchParams)

describe("au moins une information pour envoyer", () => {
  it("refuse un retour vide, ou qui n'a que le diagnostic ou des espaces", () => {
    expect(retourEnvoyable(RETOUR_VIDE)).toBe(false)
    expect(retourEnvoyable(retour({ diagnostic: true }))).toBe(false)
    expect(retourEnvoyable(retour({ message: "  \n\t " }))).toBe(false)
  })

  it("accepte une note, un affichage, un type ou un message, chacun seul", () => {
    expect(retourEnvoyable(retour({ note: 1 }))).toBe(true)
    expect(retourEnvoyable(retour({ affichage: "classique" }))).toBe(true)
    expect(retourEnvoyable(retour({ type: "bug" }))).toBe(true)
    expect(retourEnvoyable(retour({ message: "Bravo" }))).toBe(true)
  })
})

describe("contenu du retour", () => {
  it("transmet toujours la version et la cible, même sans diagnostic", () => {
    expect(champsDuTicket(retour({ note: 4 }), DIAGNOSTIC)).toEqual({ note: "★★★★☆ 4/5", version: "0.9.0", environnement: "démo web" })
    expect(environnementDuRetour(RETOUR_VIDE, { ...DIAGNOSTIC, web: false })).toBe("application de bureau")
    expect(environnementDuRetour(RETOUR_VIDE, { ...DIAGNOSTIC, installee: true })).toBe("version web installée")
    expect(environnementDuRetour({ ...RETOUR_VIDE, diagnostic: true }, { ...DIAGNOSTIC, installee: true })).toBe("version web installée · Windows · Chrome 140")
  })

  it("n'ajoute système, navigateur, affichage en cours et nombres qu'avec le diagnostic", () => {
    expect(champsDuTicket(retour({ affichage: "vues", type: "idee", message: "  Une idée  ", diagnostic: true }), DIAGNOSTIC)).toEqual({
      affichage: "Trois vues",
      type: "Idée",
      message: "Une idée",
      version: "0.9.0",
      environnement: "démo web · Windows · Chrome 140",
      diagnostic: "Affichage en cours : Résumé\nAnnées simulées : 3\nActeurs : 4"
    })
  })

  it("le diagnostic ne contient aucune donnée de la simulation : seulement les champs prévus, et des nombres", () => {
    const texte = texteDuRetour(retour({ note: 5, diagnostic: true }), DIAGNOSTIC)
    expect(texte).not.toMatch(/€|Alice|Martin|SASU|salaire|chiffre d'affaires/i)
    // Le type Diagnostic n'a pas de place pour un montant ou un nom : un champ en trop n'est pas repris.
    const avecDeTrop = { ...DIAGNOSTIC, montant: 12345, nom: "Alice Martin" } as Diagnostic
    expect(texteDuRetour(retour({ note: 5, diagnostic: true }), avecDeTrop)).toBe(texte)
  })

  it("écrit le texte de l'aperçu, de l'e-mail et de la copie", () => {
    expect(texteDuRetour(retour({ note: 3, type: "bug", message: "La grille\nne défile pas", diagnostic: true }), DIAGNOSTIC)).toBe(
      "Note : ★★★☆☆ 3/5\nType de retour : Bug\n\nMessage :\nLa grille\nne défile pas\n\nVersion : 0.9.0\nEnvironnement : démo web · Windows · Chrome 140\n\nDiagnostic :\nAffichage en cours : Résumé\nAnnées simulées : 3\nActeurs : 4"
    )
    expect(texteDuRetour(retour({ affichage: "classique" }), DIAGNOSTIC)).toBe("Affichage préféré : Classique\n\nVersion : 0.9.0\nEnvironnement : démo web")
    expect(texteACopier(retour({ note: 5 }), DIAGNOSTIC)).toBe(`Sujet : Retour sur le simulateur — v0.9.0\n\nNote : ★★★★★ 5/5\n\nVersion : 0.9.0\nEnvironnement : démo web`)
  })

  it("titre le ticket et l'e-mail avec le type, la note et la version", () => {
    expect(titreDuRetour(retour({ type: "idee", note: 4 }), DIAGNOSTIC)).toBe("[Retour] Idée · 4/5 · v0.9.0")
    expect(titreDuRetour(retour({ message: "x" }), DIAGNOSTIC)).toBe("[Retour] Avis · v0.9.0")
    expect(sujetDeLEMail(DIAGNOSTIC)).toBe("Retour sur le simulateur — v0.9.0")
  })
})

describe("ticket GitHub prérempli", () => {
  it("ouvre le formulaire « retour.yml » du dépôt, champs préremplis par leur identifiant", () => {
    const { adresse, tronque } = adresseDuTicket(retour({ note: 5, affichage: "resume", type: "avis", message: "Très clair & utile ?", diagnostic: true }), DIAGNOSTIC)
    expect(tronque).toBe(false)
    expect(adresse.startsWith(`${ADRESSE_NOUVEAU_TICKET}?`)).toBe(true)
    expect(adresse).not.toContain("+")
    expect(adresseExterneAutorisee(adresse)).toBe(true)
    expect(parametres(adresse)).toEqual({
      template: "retour.yml",
      title: "[Retour] Avis · 5/5 · v0.9.0",
      labels: "retour",
      note: "★★★★★ 5/5",
      affichage: "Résumé",
      type: "Avis",
      message: "Très clair & utile ?",
      version: "0.9.0",
      environnement: "démo web · Windows · Chrome 140",
      diagnostic: "Affichage en cours : Résumé\nAnnées simulées : 3\nActeurs : 4"
    })
  })

  it("ne transmet pas les réponses absentes, mais toujours la version", () => {
    expect(parametres(adresseDuTicket(retour({ message: "Bonjour" }), DIAGNOSTIC).adresse)).toEqual({ template: "retour.yml", title: "[Retour] Avis · v0.9.0", labels: "retour", message: "Bonjour", version: "0.9.0", environnement: "démo web" })
  })

  it("coupe un message trop long pour tenir dans l'adresse, avec une note, sans couper un caractère", () => {
    const message = "é😀".repeat(5_000)
    const { adresse, tronque } = adresseDuTicket(retour({ note: 2, message }), DIAGNOSTIC)
    expect(tronque).toBe(true)
    expect(adresse.length).toBeLessThanOrEqual(LONGUEUR_MAXIMALE_TICKET)
    expect(adresse.length).toBeGreaterThan(LONGUEUR_MAXIMALE_TICKET - 40)
    const envoye = parametres(adresse).message
    expect(envoye.endsWith(NOTE_DE_TRONCATURE)).toBe(true)
    expect(message.startsWith(envoye.slice(0, -NOTE_DE_TRONCATURE.length))).toBe(true)
    expect(parametres(adresse).note).toBe("★★☆☆☆ 2/5")
  })
})

describe("e-mail prérempli", () => {
  it("écrit à l'adresse des retours, sujet et corps codés pour un lien mailto", () => {
    const r = retour({ note: 4, message: "Ligne 1\nLigne 2 & co" })
    const { adresse, tronque } = adresseDeLEMail(r, DIAGNOSTIC)
    expect(tronque).toBe(false)
    expect(adresse.startsWith(`mailto:${ADRESSE_E_MAIL_DES_RETOURS}?subject=`)).toBe(true)
    expect(adresse).toContain("%0D%0A")
    expect(adresse).not.toMatch(/[ +]/)
    expect(adresseExterneAutorisee(adresse)).toBe(true)
    const url = new URL(adresse)
    expect(url.searchParams.get("subject")).toBe("Retour sur le simulateur — v0.9.0")
    expect(url.searchParams.get("body")).toBe(texteDuRetour(r, DIAGNOSTIC).replace(/\n/g, "\r\n"))
  })

  it("reste sous 1 800 caractères en coupant le message, avec une note", () => {
    const { adresse, tronque } = adresseDeLEMail(retour({ message: "Un long message. ".repeat(400), diagnostic: true }), DIAGNOSTIC)
    expect(tronque).toBe(true)
    expect(adresse.length).toBeLessThanOrEqual(LONGUEUR_MAXIMALE_E_MAIL)
    const corps = new URL(adresse).searchParams.get("body")!
    expect(corps).toContain(NOTE_DE_TRONCATURE.trim().replace(/\n/g, "\r\n"))
    // La version, l'environnement et le diagnostic restent, après le message coupé.
    expect(corps).toContain("Version : 0.9.0")
    expect(corps).toContain("Acteurs : 4")
  })

  it("garde un message court entier", () => {
    expect(adresseDeLEMail(retour({ type: "bug" }), DIAGNOSTIC).tronque).toBe(false)
  })
})

describe("cohérence avec le formulaire GitHub", () => {
  it("propose mot pour mot, dans les champs texte de .github/ISSUE_TEMPLATE/retour.yml, les valeurs que l'application y écrit", () => {
    const formulaire = readFileSync(".github/ISSUE_TEMPLATE/retour.yml", "utf-8").replace(/\r\n/g, "\n")
    for (const choix of [...Object.values(CHOIX_DU_FORMULAIRE.note), ...Object.values(CHOIX_DU_FORMULAIRE.affichage), ...Object.values(CHOIX_DU_FORMULAIRE.type)]) expect(formulaire).toContain(`« ${choix} »`)
    // GitHub ne préremplit pas les listes déroulantes depuis l'adresse : aucun champ ne doit en être une.
    expect(formulaire).not.toContain("type: dropdown")
    for (const id of ["note", "affichage", "type", "message", "version", "environnement", "diagnostic"]) expect(formulaire).toContain(`id: ${id}\n`)
  })
})

describe("système et navigateur", () => {
  it.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36", "Windows", "Chrome 140"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0", "Windows", "Edge 140"],
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) simulateur-independant-fr/0.9.0 Chrome/138.0.0.0 Electron/44.0.0 Safari/537.36", "Linux", "Electron 44"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0", "macOS", "Firefox 131"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "iOS", "Safari 18"],
    ["Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 OPR/85.0", "Android", "Opera 85"],
    ["Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36", "ChromeOS", "Chrome 140"],
    ["Navigateur maison", "système inconnu", "navigateur inconnu"]
  ])("%s", (userAgent, systeme, navigateur) => {
    expect(systemeEtNavigateur(userAgent)).toEqual({ systeme, navigateur })
  })

  it("ne prend pour Safari qu'une version suivie plus loin de « Safari »", () => {
    expect(systemeEtNavigateur("Opera/9.80 (Windows NT 6.1) Presto/2.12 Version/12.16").navigateur).toBe("navigateur inconnu")
    expect(systemeEtNavigateur("Safari/604.1 Version/18.0").navigateur).toBe("navigateur inconnu")
  })

  it("lit en temps linéaire une identification très longue", () => {
    // L'ancienne expression (Version\/(\d+).*Safari) reparcourait la fin du texte pour chaque « Version/ ».
    expect(systemeEtNavigateur("Version/1 ".repeat(20_000)).navigateur).toBe("navigateur inconnu")
    expect(systemeEtNavigateur(`${"Version/1 ".repeat(20_000)}Safari`).navigateur).toBe("Safari 1")
  })
})
