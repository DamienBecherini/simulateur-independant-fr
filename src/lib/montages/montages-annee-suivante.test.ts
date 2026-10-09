// src/lib/montages/montages-annee-suivante.test.ts

import { expect, it, vi } from "vitest"
import { DERNIERE_ANNEE_DES_REGLES } from "@/backend/logic/regles"
import { ANNEE_AJOUTEE } from "@/backend/logic/testing/annee-suivante"

/*
 * Les montages types sont figés sur 2026 : leurs chiffres de référence ne doivent pas bouger quand les règles de 2027
 * arrivent. Même démarche que src/backend/logic/references/annee-suivante.test.ts : une année 2027 fictive devient la
 * dernière connue, puis les chiffres de référence des montages sont rejoués tels quels.
 */

vi.mock("@/backend/logic/regles", async importOriginal => (await import("@/backend/logic/testing/annee-suivante")).avecUneAnneeDePlus(await importOriginal()))

it("l'année fictive est bien la dernière connue pendant ce test", () => {
  expect(DERNIERE_ANNEE_DES_REGLES).toBe(ANNEE_AJOUTEE)
})

await import("./montages.reference.test")
