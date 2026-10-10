// src/backend/util.test.ts
// Vérification de l'émetteur des appels IPC : seule la page de l'interface peut appeler le process principal.

import path from "node:path"
import { pathToFileURL } from "node:url"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { WebFrameMain } from "electron"

const electron = vi.hoisted(() => ({ handle: vi.fn() }))
const developpement = vi.hoisted(() => ({ actif: false }))
const PAGE_DE_L_INTERFACE = path.resolve("/Programmes/Simulateur/dist-react/index.html")

vi.mock("electron", () => ({ ipcMain: { handle: electron.handle } }))
vi.mock("./pathResolver.js", () => ({ getUIPath: () => PAGE_DE_L_INTERFACE }))
vi.mock("./isDev.js", () => ({ isDev: () => developpement.actif }))

const { ipcMainHandle, validateEventFrame } = await import("./util.js")

const cadre = (url: string) => ({ url }) as WebFrameMain
const interfaceCompilee = pathToFileURL(PAGE_DE_L_INTERFACE).toString()

beforeEach(() => {
  developpement.actif = false
  electron.handle.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("validateEventFrame", () => {
  it("accepte la page de l'interface, quelle que soit la vue affichée (fragment)", () => {
    expect(() => validateEventFrame(cadre(interfaceCompilee))).not.toThrow()
    expect(() => validateEventFrame(cadre(`${interfaceCompilee}#resultats`))).not.toThrow()
  })

  it("refuse un appel sans cadre émetteur", () => {
    expect(() => validateEventFrame(null)).toThrow("Malicious event")
  })

  it("refuse toute autre page", () => {
    for (const url of ["https://example.org/", pathToFileURL(path.resolve("/Programmes/Simulateur/autre.html")).toString(), `${interfaceCompilee}?x=1`, "http://localhost:3524/"]) {
      expect(() => validateEventFrame(cadre(url)), url).toThrow("Malicious event")
    }
  })

  it("en développement, accepte le serveur de développement et lui seul", () => {
    developpement.actif = true
    expect(() => validateEventFrame(cadre("http://localhost:3524/"))).not.toThrow()
    expect(() => validateEventFrame(cadre("http://localhost:3525/"))).toThrow("Malicious event")
    expect(() => validateEventFrame(cadre("https://localhost:3524/"))).toThrow("Malicious event")
  })
})

describe("ipcMainHandle", () => {
  const gestionnaire = vi.fn(async (adresse: string) => adresse === "ok")

  function canalDeclare() {
    ipcMainHandle("ouvrirAdresseExterne", gestionnaire)
    expect(electron.handle).toHaveBeenCalledWith("ouvrirAdresseExterne", expect.any(Function))
    return electron.handle.mock.calls[0][1] as (event: { senderFrame: WebFrameMain | null }, ...args: unknown[]) => Promise<boolean>
  }

  it("transmet l'appel de l'interface au gestionnaire", async () => {
    const canal = canalDeclare()
    expect(await canal({ senderFrame: cadre(interfaceCompilee) }, "ok")).toBe(true)
    expect(gestionnaire).toHaveBeenCalledWith("ok")
  })

  it("refuse, sans appeler le gestionnaire, un appel sans cadre émetteur ou d'une autre page", () => {
    gestionnaire.mockClear()
    const canal = canalDeclare()
    expect(() => canal({ senderFrame: null }, "ok")).toThrow("Malicious event")
    expect(() => canal({ senderFrame: cadre("https://example.org/") }, "ok")).toThrow("Malicious event")
    expect(gestionnaire).not.toHaveBeenCalled()
  })
})
