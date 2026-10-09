// src/lib/montages/montages-annee-suivante.test.ts

import { expect, it, vi } from "vitest"
import { ANNEE_COURANTE } from "@/backend/logic/regles"
import { ANNEE_AJOUTEE } from "@/backend/logic/testing/annee-suivante"

/*
 * Les montages types sont figés sur 2026 : leurs chiffres de référence ne doivent pas bouger quand les règles de 2027
 * arrivent. Même démarche que src/backend/logic/references/annee-suivante.test.ts : un fichier de règles 2027 fictif
 * fait de 2027 l'année en cours, puis les chiffres de référence des montages sont rejoués tels quels.
 */

vi.mock("@/backend/regles/index", async importOriginal => (await import("@/backend/logic/testing/annee-suivante")).avecUneAnneeDePlus(await importOriginal()))

it("l'année fictive est bien l'année en cours pendant ce test", () => {
  expect(ANNEE_COURANTE).toBe(ANNEE_AJOUTEE)
})

await import("./montages.reference.test")
