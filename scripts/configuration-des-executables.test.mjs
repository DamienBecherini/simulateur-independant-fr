// scripts/configuration-des-executables.test.mjs
// Cohérence de la configuration d'electron-builder avec package.json et le guide d'installation : ce que
// l'on ne voit qu'en construisant les exécutables, ou une fois la version publiée.

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

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
