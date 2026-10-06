// scripts/configuration-des-executables.test.mjs
// Cohérence de la configuration d'electron-builder avec package.json et le guide d'installation : ce que
// l'on ne voit qu'en construisant les exécutables, ou une fois la version publiée.

import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { ALIAS_D_EXECUTION } from "../src/lib/configuration-mcp.ts"

const lireJson = (chemin) => JSON.parse(readFileSync(new URL(`../${chemin}`, import.meta.url), "utf-8"))
const paquet = lireJson("package.json")
const configuration = lireJson("electron-builder.json")
const installation = readFileSync(new URL("../documentation/installation.md", import.meta.url), "utf-8")

/** Nom d'un exécutable selon le modèle `artifactName`, comme le calcule electron-builder. */
const nomDeFichier = (os, arch, ext) =>
  configuration.artifactName.replace("${version}", "<version>").replace("${os}", os).replace("${arch}", arch).replace("${ext}", ext)

describe("exécutables Linux", () => {
  it("relient la fenêtre ouverte à l'entrée du menu des applications", () => {
    // Electron donne à la fenêtre l'identifiant `desktopName` (sans « .desktop ») ; avec syncDesktopName,
    // electron-builder nomme le fichier .desktop et son StartupWMClass d'après lui. Sans desktopName, StartupWMClass
    // valait le nom du produit, accentué, qui ne correspond pas à la fenêtre.
    expect(paquet.desktopName).toBe(`${paquet.name}.desktop`)
    expect(configuration.linux.syncDesktopName).toBe(true)
  })
})

describe("guide d'installation", () => {
  // electron-builder écrit l'architecture à la manière de chaque format : x86_64 pour l'AppImage, amd64 pour le deb.
  it.each([
    ["win", "x64", "exe"],
    ["win", "x64", "zip"],
    ["mac", "arm64", "dmg"],
    ["mac", "x64", "dmg"],
    ["linux", "x86_64", "AppImage"],
    ["linux", "amd64", "deb"]
  ])("cite le fichier %s-%s.%s sous le nom que lui donne electron-builder", (os, arch, ext) => {
    expect(installation).toContain(nomDeFichier(os, arch, ext))
  })
})

describe("paquet du Microsoft Store", () => {
  const extensions = readFileSync(new URL(`../${configuration.appx.customExtensionsPath}`, import.meta.url), "utf-8")
  const images = readdirSync(new URL("../build/appx/", import.meta.url))

  it("n'est construit que par npm run dist:store, pas avec l'installateur et l'archive Windows", () => {
    expect(configuration.win.target).not.toContain("appx")
    expect(paquet.scripts["dist:store"]).toContain("scripts/construire-paquet-store.mjs")
  })

  it("déclare l'alias d'exécution que l'application donne aux clients d'IA, sur l'exécutable du paquet", () => {
    // electron-builder range l'application dans le dossier « app » du paquet, sous le nom du produit.
    expect(extensions).toContain(`Executable="app\\${configuration.productName}.exe"`)
    expect(extensions).toContain(`Alias="${ALIAS_D_EXECUTION}"`)
    // Les alias d'exécution d'une application de bureau datent de Windows 10 version 1709 (16299).
    expect(Number(configuration.appx.minVersion.split(".")[2])).toBeGreaterThanOrEqual(16299)
  })

  it.each(["StoreLogo", "Square44x44Logo", "Square150x150Logo", "Wide310x150Logo"])("a l'image %s à chaque échelle", (nom) => {
    for (const echelle of [100, 125, 150, 200, 400]) expect(images).toContain(`${nom}.scale-${echelle}.png`)
  })

  it("est en français", () => {
    expect(configuration.appx.languages).toEqual(["fr-FR"])
  })
})
