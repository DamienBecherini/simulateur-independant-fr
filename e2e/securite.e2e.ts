// e2e/securite.e2e.ts
// Sécurité de la fenêtre (voir l'ADR 003) : pas de Node.js dans la page, aucune navigation hors de l'interface, aucune
// nouvelle fenêtre (une page web en https s'ouvre dans le navigateur du système), et des paramètres IPC vérifiés par
// le process principal. L'ouverture dans le navigateur est remplacée (neutraliser-dialogues.cjs) : rien ne s'ouvre.

import { test, expect, adressesOuvertes, lireFichier } from "./support/fixtures"

test("la page n'a pas accès à Node.js", async ({ lancer }) => {
  const { page } = await lancer()
  expect(await page.evaluate(() => [typeof (globalThis as { require?: unknown }).require, typeof (globalThis as { process?: unknown }).process])).toEqual(["undefined", "undefined"])
})

test("la fenêtre ne quitte jamais l'interface ; une page en https s'ouvre dans le navigateur du système", async ({ lancer }) => {
  const { electronApp, page } = await lancer()
  const adresseDeLInterface = page.url()

  // Changer de vue (fragment) reste permis.
  await page.evaluate(() => {
    window.location.hash = "#contenu"
  })
  await expect.poll(() => page.url()).toBe(`${adresseDeLInterface}#contenu`)

  await page.evaluate(() => {
    window.location.href = "https://example.org/navigation"
  })
  await page.evaluate(() => {
    window.location.href = "file:///C:/Windows/System32/drivers/etc/hosts"
  })
  await expect.poll(() => adressesOuvertes(electronApp)).toEqual(["https://example.org/navigation"])

  // La navigation annulée laisse Playwright en attente d'une fin de navigation qui ne vient pas : la fenêtre est
  // examinée depuis le process principal. Elle affiche toujours l'interface, qui répond.
  const fenetre = () =>
    electronApp.evaluate(async ({ BrowserWindow }) => {
      const contenu = BrowserWindow.getAllWindows().find(f => f.webContents.getURL().includes("/dist-react/"))?.webContents
      return { adresse: contenu?.getURL(), simulationAffichee: (await contenu?.executeJavaScript("/avec les règles fiscales \\d{4}/.test(document.body.textContent)")) as boolean }
    })
  await expect.poll(fenetre).toEqual({ adresse: `${adresseDeLInterface}#contenu`, simulationAffichee: true })
})

test("aucune nouvelle fenêtre : seule une page en https s'ouvre, dans le navigateur du système", async ({ lancer }) => {
  const { electronApp, page } = await lancer()
  const fenetres = electronApp.windows().length

  const ouvertes = await page.evaluate(() =>
    ["https://example.org/fenetre", "http://example.org/", "file:///C:/Windows/System32/calc.exe", "https://jeton@example.org/", "javascript:alert(1)"].map(adresse => window.open(adresse) !== null)
  )
  expect(ouvertes).toEqual([false, false, false, false, false])
  await expect.poll(() => adressesOuvertes(electronApp)).toEqual(["https://example.org/fenetre"])
  expect(electronApp.windows().length).toBe(fenetres)
})

test("le process principal refuse les paramètres invalides des canaux IPC", async ({ lancer, dossierDonnees }) => {
  const { page } = await lancer()
  const refus = (appel: () => Promise<unknown>) => page.evaluate(appel).then(
    () => "accepté",
    (erreur: Error) => (erreur.message.includes("paramètres invalides") ? "refusé" : erreur.message)
  )

  expect(await refus(() => window.api.saveTextFile({ defaultName: "a", content: "a", format: "exe" as "csv" }))).toBe("refusé")
  expect(await refus(() => window.api.openTextFile({ title: "a", format: "__proto__" as "csv" }))).toBe("refusé")
  expect(await refus(() => window.api.printToPdf(42 as unknown as string))).toBe("refusé")
  expect(await refus(() => window.api.exportState("simulation" as never))).toBe("refusé")
  expect(await refus(() => window.api.saveSlots("sauvegardes" as never))).toBe("refusé")
  expect(await refus(() => window.api.getCurrentSession().then(session => window.api.compareStatuts(session, { activityId: "a" } as never, 2026)))).toBe("refusé")
  expect(await refus(() => window.api.getCurrentSession().then(session => window.api.compareStatuts(session, { activityId: "a", remunerationNette: 0, repartition: { mode: "dividendes", partDistribuee: 1 }, partBncPrestations: 1 }, "2026" as never)))).toBe("refusé")

  // Une session qui n'en est pas une n'est pas écrite : le fichier de la session reste celui de l'application.
  const avant = await lireFichier<{ name: string }>(dossierDonnees, "sessionState.json")
  await page.evaluate(() => window.api.saveCurrentSession({ name: "détournée" } as never))
  await page.evaluate(() => window.api.saveCurrentSessionSync("détournée" as never))
  expect(await lireFichier(dossierDonnees, "sessionState.json")).toEqual(avant)
})
