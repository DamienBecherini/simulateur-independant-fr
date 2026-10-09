// src/backend/logic/references/annee-suivante.test.ts

import { expect, it, vi } from "vitest"
import { ANNEE_COURANTE, reglesDeLAnnee, reglesEnVigueur } from "../regles.js"
import { ANNEE_AJOUTEE } from "../testing/annee-suivante.js"
import { casDeReference } from "../testing/cas-de-reference.js"

/*
 * Garde-fou de la procédure « nouvelle année de règles » : les cas de référence sont dérivés à la main avec les
 * règles de 2026, et doivent le rester quand les règles de 2027 arrivent (les montages types ont le même garde-fou,
 * dans src/lib/montages).
 *
 * Un fichier de règles 2027 fictif (testing/annee-suivante.ts) est ajouté ici à la liste des fichiers : 2027 devient
 * l'année en cours et la dernière année connue. Puis les cas de référence sont rejoués tels quels (ils sont importés
 * plus bas) : s'ils lisaient « l'année en cours » au lieu des règles de 2026, leurs chiffres changeraient et ils
 * échoueraient ; s'ils étaient ignorés (garde sur l'année), la sonde à la fin du fichier échouerait.
 *
 * Les cas de dispositifs.reference.test.ts ne sont pas rejoués : une partie simule 2027 et 2028 avec les dernières
 * règles connues, et changera légitimement avec les règles de 2027.
 */

vi.mock("../../regles/index.js", async importOriginal => (await import("../testing/annee-suivante.js")).avecUneAnneeDePlus(await importOriginal()))

it("l'année fictive est bien l'année en cours pendant ce test", () => {
  expect([reglesEnVigueur.annee, ANNEE_COURANTE, reglesDeLAnnee(ANNEE_AJOUTEE).regles?.annee]).toEqual([ANNEE_AJOUTEE, ANNEE_AJOUTEE, ANNEE_AJOUTEE])
})

await import("./comparateur.reference.test.js")
await import("./foyers.reference.test.js")
await import("./frais-reels.reference.test.js")
await import("./liberaux.reference.test.js")
await import("./micro.reference.test.js")
await import("./optimisation-remuneration.reference.test.js")
await import("./plusieurs-annees.reference.test.js")
await import("./president-sasu.reference.test.js")
await import("./protection-sociale.reference.test.js")
await import("./regles-2026.reference.test.js")
await import("./reserves.reference.test.js")
await import("./salarie.reference.test.js")
await import("./societes.reference.test.js")
await import("./strategies-de-distribution.reference.test.js")

let sondeExecutee = false
casDeReference("sonde", () => {
  it("s'exécute", () => {
    sondeExecutee = true
  })
})

it("les cas de référence ne sont pas ignorés quand l'année en cours change", () => {
  expect(sondeExecutee).toBe(true)
})
