// scripts/simuler.test.mjs
// La commande `npm run simuler` telle qu'on la lance : le script compile le module de src/lib, lit un vrai fichier et
// affiche sur la sortie standard (ou d'erreur), avec le code de sortie. Le détail du texte est vérifié par
// src/lib/simuler-en-ligne-de-commande.test.ts.

import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it } from "vitest"
import { contenuDuFichier } from "../src/backend/logic/fichiers-de-donnees.ts"
import { MONTAGES_TYPES, sessionDUnMontage } from "../src/lib/montages/montages.ts"

const script = fileURLToPath(new URL("simuler.mjs", import.meta.url))
const dossier = mkdtempSync(path.join(tmpdir(), "simuler-"))
const montage = MONTAGES_TYPES.find(m => m.id === "micro-et-sasu-du-conjoint")
writeFileSync(path.join(dossier, "session.json"), contenuDuFichier(sessionDUnMontage(montage)))

afterAll(() => rmSync(dossier, { recursive: true, force: true }))

/** Lance le script comme `npm run simuler`, qui le démarre à la racine du dépôt et donne le dossier de l'appel dans INIT_CWD. */
const simuler = (...args) =>
  spawnSync(process.execPath, [script, ...args], { cwd: fileURLToPath(new URL("..", import.meta.url)), env: { ...process.env, INIT_CWD: dossier }, encoding: "utf-8" })

describe("npm run simuler", () => {
  it("simule un montage type et l'affiche, un chemin relatif se lisant depuis le dossier de l'appel", () => {
    const { status, stdout, stderr } = simuler("session.json")
    expect(stderr).toBe("")
    expect(status).toBe(0)
    expect(stdout).toContain(`Simulation « ${montage.titre} » : session.json`)
    expect(stdout).toContain("== 2026 (règles de 2026) ==")
    expect(stdout).toContain("  SASU de Marc (SASU)")
    expect(stdout).toContain("  Claire, Marc (2 parts)")
  }, 30_000)

  it("fichier absent : message sur la sortie d'erreur et code 1", () => {
    const { status, stdout, stderr } = simuler("absent.json")
    expect(status).toBe(1)
    expect(stdout).toBe("")
    expect(stderr).toBe("Fichier introuvable : absent.json\n")
  }, 30_000)
})
