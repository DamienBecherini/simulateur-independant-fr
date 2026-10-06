// src/backend/copie-du-serveur-mcp.test.ts
// La copie du serveur MCP hors du paquet du Microsoft Store, sur un dossier temporaire : écrite au premier démarrage,
// laissée telle quelle si elle est à jour, remplacée après une mise à jour de l'application.

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { copierLeServeurMcp } from "./copie-du-serveur-mcp.js"

let dossier: string
let source: string
let destination: string

beforeEach(async () => {
  dossier = await mkdtemp(path.join(tmpdir(), "simulateur-copie-mcp-"))
  source = path.join(dossier, "paquet", "serveur-mcp.mjs")
  destination = path.join(dossier, "donnees", "mcp", "serveur-mcp.mjs")
  await mkdir(path.dirname(source), { recursive: true })
  await writeFile(source, "// version 1")
})

afterEach(async () => {
  await rm(dossier, { recursive: true, force: true })
})

describe("copie du serveur MCP hors du paquet", () => {
  it("crée le dossier et copie le serveur au premier démarrage", async () => {
    expect(await copierLeServeurMcp(source, destination)).toBe(true)
    expect(await readFile(destination, "utf-8")).toBe("// version 1")
  })

  it("ne réécrit pas une copie à jour", async () => {
    await copierLeServeurMcp(source, destination)
    expect(await copierLeServeurMcp(source, destination)).toBe(false)
  })

  it("remplace la copie après une mise à jour, sans laisser de fichier temporaire", async () => {
    await copierLeServeurMcp(source, destination)
    await writeFile(source, "// version 2")
    expect(await copierLeServeurMcp(source, destination)).toBe(true)
    expect(await readFile(destination, "utf-8")).toBe("// version 2")
    expect(await readdir(path.dirname(destination))).toEqual(["serveur-mcp.mjs"])
  })

  it("échoue si le serveur livré manque", async () => {
    await expect(copierLeServeurMcp(path.join(dossier, "absent.mjs"), destination)).rejects.toThrow()
  })
})
