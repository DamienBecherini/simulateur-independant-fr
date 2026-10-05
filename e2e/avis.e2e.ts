// e2e/avis.e2e.ts
// « Donner mon avis » dans l'application de bureau : le process principal n'ouvre dans le navigateur ou la messagerie
// du système que le formulaire de ticket du dépôt et l'e-mail des retours, et refuse toute autre adresse, même
// demandée directement par la page. L'ouverture est remplacée (neutraliser-dialogues.cjs) : rien ne s'ouvre.

import { test, expect, adressesOuvertes } from "./support/fixtures"

const ADRESSE_NOUVEAU_TICKET = "https://github.com/DamienBecherini/simulateur-independant-fr/issues/new"
const ADRESSE_E_MAIL = "simulateur-independant@damien.becherini.fr"

test("le process principal n'ouvre que le formulaire de ticket du dépôt et l'e-mail des retours", async ({ lancer }) => {
  const { electronApp, page } = await lancer()
  const ouvrir = (adresse: unknown) => page.evaluate(a => window.api.ouvrirAdresseExterne(a as string), adresse)

  const refusees = [
    "https://example.org/",
    "https://github.com/DamienBecherini/simulateur-independant-fr/settings",
    "https://github.com/autre/depot/issues/new",
    ADRESSE_NOUVEAU_TICKET.replace("https:", "http:"),
    "https://jeton@github.com/DamienBecherini/simulateur-independant-fr/issues/new",
    "file:///C:/Windows/System32/calc.exe",
    "javascript:alert(1)",
    "mailto:quelquun@example.org",
    `mailto:${ADRESSE_E_MAIL}?cc=quelquun@example.org`,
    `mailto:${ADRESSE_E_MAIL},quelquun@example.org`,
    42
  ]
  for (const adresse of refusees) expect(await ouvrir(adresse), String(adresse)).toBe(false)
  expect(await adressesOuvertes(electronApp)).toEqual([])

  const ticket = `${ADRESSE_NOUVEAU_TICKET}?template=retour.yml&note=%E2%98%85%E2%98%85%E2%98%85%E2%98%85%E2%98%85%205%2F5`
  const eMail = `mailto:${ADRESSE_E_MAIL}?subject=Retour&body=Bonjour`
  expect(await ouvrir(ticket)).toBe(true)
  expect(await ouvrir(eMail)).toBe(true)
  expect(await adressesOuvertes(electronApp)).toEqual([ticket, eMail])
})

test("la fenêtre « Donner mon avis » ouvre le ticket prérempli dans le navigateur du système", async ({ lancer }) => {
  const { electronApp, page, erreursConsole } = await lancer()
  await page.getByRole("button", { name: "Donner mon avis" }).click()
  const fenetre = page.getByRole("dialog", { name: "Donner mon avis" })
  await fenetre.getByRole("group", { name: "Affichage préféré" }).getByText("Classique").click()
  await expect(fenetre.getByLabel("Texte envoyé")).toContainText("Environnement : application de bureau")

  await fenetre.getByRole("button", { name: "Envoyer sur GitHub (compte requis, message public)" }).click()
  await expect(fenetre.getByRole("status")).toContainText("Le formulaire GitHub s'ouvre")
  const [ticket] = await adressesOuvertes(electronApp)
  expect(ticket.startsWith(`${ADRESSE_NOUVEAU_TICKET}?template=retour.yml&`)).toBe(true)
  expect(new URL(ticket).searchParams.get("affichage")).toBe("Classique")
  expect(new URL(ticket).searchParams.get("environnement")).toBe("application de bureau")

  await fenetre.getByRole("button", { name: "Envoyer par e-mail" }).click()
  await expect.poll(async () => (await adressesOuvertes(electronApp)).length).toBe(2)
  expect((await adressesOuvertes(electronApp))[1].startsWith(`mailto:${ADRESSE_E_MAIL}?subject=`)).toBe(true)
  expect(erreursConsole).toEqual([])
})
