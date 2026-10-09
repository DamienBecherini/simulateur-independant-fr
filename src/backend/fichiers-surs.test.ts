// src/backend/fichiers-surs.test.ts
// Écriture atomique, copie horodatée et protection d'un fichier illisible, sur un dossier temporaire.

import fs, { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { horodatage } from "@/lib/horodatage.js"
import { copierACote, copierSansRemplacer, ecrireAtomiquement, ecrireAtomiquementSync, FichierProtegeError, jsonOuRien, lireLeFichier } from "./fichiers-surs.js"

let dossier: string
let fichier: string
const MAINTENANT = new Date(2026, 9, 9, 14, 30, 5)

beforeEach(async () => {
  dossier = await mkdtemp(path.join(tmpdir(), "simulateur-fichiers-surs-"))
  fichier = path.join(dossier, "simulationSlots.json")
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(dossier, { recursive: true, force: true })
})

const erreur = (code: string) => Object.assign(new Error(code), { code })

describe("écriture atomique", () => {
  it("écrit le fichier sans laisser de fichier temporaire", async () => {
    await writeFile(fichier, "ancien")
    await ecrireAtomiquement(fichier, "nouveau")
    expect(await readFile(fichier, "utf-8")).toBe("nouveau")
    expect(await readdir(dossier)).toEqual(["simulationSlots.json"])
  })

  it("laisse l'ancien fichier intact et lève l'erreur si le renommage échoue", async () => {
    await writeFile(fichier, "ancien")
    vi.spyOn(fs, "rename").mockRejectedValue(erreur("EIO"))
    await expect(ecrireAtomiquement(fichier, "nouveau")).rejects.toThrow("EIO")
    expect(await readFile(fichier, "utf-8")).toBe("ancien")
    expect(await readdir(dossier)).toEqual(["simulationSlots.json"])
  })

  it("lève l'erreur si le dossier n'existe pas", async () => {
    await expect(ecrireAtomiquement(path.join(dossier, "absent", "x.json"), "{}")).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("réessaie un renommage refusé un court instant (Windows : antivirus, fichier ouvert ailleurs)", async () => {
    const renommer = fs.rename
    const espion = vi.spyOn(fs, "rename").mockRejectedValueOnce(erreur("EPERM")).mockRejectedValueOnce(erreur("EBUSY")).mockImplementation(renommer)
    await ecrireAtomiquement(fichier, "nouveau")
    expect(espion).toHaveBeenCalledTimes(3)
    expect(await readFile(fichier, "utf-8")).toBe("nouveau")
  })

  it("abandonne après plusieurs refus passagers", async () => {
    await writeFile(fichier, "ancien")
    vi.spyOn(fs, "rename").mockRejectedValue(erreur("EPERM"))
    await expect(ecrireAtomiquement(fichier, "nouveau")).rejects.toThrow("EPERM")
    expect(await readFile(fichier, "utf-8")).toBe("ancien")
  })

  it("une écriture plus ancienne qui finit après une plus récente ne la remplace pas", async () => {
    const ancienne = ecrireAtomiquement(fichier, "ancienne")
    ecrireAtomiquementSync(fichier, "récente")
    await ancienne
    expect(await readFile(fichier, "utf-8")).toBe("récente")
    expect(await readdir(dossier)).toEqual(["simulationSlots.json"])
  })

  it("écrit aussi de façon synchrone, et lève l'erreur en cas d'échec", async () => {
    ecrireAtomiquementSync(fichier, "fermeture")
    expect(await readFile(fichier, "utf-8")).toBe("fermeture")
    expect(() => ecrireAtomiquementSync(path.join(dossier, "absent", "x.json"), "{}")).toThrow()
  })
})

describe("copie à côté d'un fichier", () => {
  it("copie le fichier octet pour octet sous un nom horodaté, sans écraser une copie existante", async () => {
    const abime = Buffer.from([0x5b, 0x7b, 0xff, 0xfe, 0x22])
    await writeFile(fichier, abime)

    const premiere = await copierACote(fichier, "illisible", { maintenant: MAINTENANT })
    const seconde = await copierACote(fichier, "illisible", { maintenant: MAINTENANT })

    expect(premiere).toBe(path.join(dossier, "simulationSlots.illisible-20261009-143005.json"))
    expect(seconde).toBe(path.join(dossier, "simulationSlots.illisible-20261009-143005-2.json"))
    expect(await readFile(premiere!)).toEqual(abime)
    expect(await readFile(fichier)).toEqual(abime)
  })

  it("supprime l'original quand il est déplacé", async () => {
    await writeFile(fichier, "{ abîmé")
    const copie = await copierACote(fichier, "refuse", { maintenant: MAINTENANT, deplacer: true })
    expect(path.basename(copie!)).toBe("simulationSlots.refuse-20261009-143005.json")
    expect(await readdir(dossier)).toEqual(["simulationSlots.refuse-20261009-143005.json"])
  })

  it("protège un fichier qu'elle n'a pas pu copier : il n'est plus jamais écrit", async () => {
    await writeFile(fichier, "{ abîmé")
    vi.spyOn(fs, "copyFile").mockRejectedValue(erreur("ENOSPC"))

    expect(await copierACote(fichier, "illisible", { maintenant: MAINTENANT })).toBeNull()
    await expect(ecrireAtomiquement(fichier, "[]")).rejects.toBeInstanceOf(FichierProtegeError)
    expect(() => ecrireAtomiquementSync(fichier, "[]")).toThrow(FichierProtegeError)
    expect(await readFile(fichier, "utf-8")).toBe("{ abîmé")
  })

  it("garde sous un nom fixe la copie d'avant une conversion, sans la remplacer", async () => {
    await writeFile(fichier, "format 1")
    expect(await copierSansRemplacer(fichier, "format-1")).toBe(true)
    await writeFile(fichier, "autre")
    expect(await copierSansRemplacer(fichier, "format-1")).toBe(false)
    expect(await readFile(path.join(dossier, "simulationSlots.format-1.json"), "utf-8")).toBe("format 1")
  })
})

describe("lecture d'un fichier de données", () => {
  it("distingue un fichier absent, lu ou inaccessible ; un fichier inaccessible est protégé", async () => {
    expect(await lireLeFichier(fichier)).toEqual({ etat: "absent" })
    await writeFile(fichier, "[]")
    expect(await lireLeFichier(fichier)).toEqual({ etat: "lu", contenu: "[]" })

    const repertoire = path.join(dossier, "userPreferences.json")
    await mkdir(repertoire)
    expect(await lireLeFichier(repertoire)).toEqual({ etat: "inaccessible", code: "EISDIR" })
    await expect(ecrireAtomiquement(repertoire, "{}")).rejects.toBeInstanceOf(FichierProtegeError)
  })

  it("rend le JSON d'un texte, ou rien s'il n'en est pas", () => {
    expect(jsonOuRien("[1]")).toEqual([1])
    expect(jsonOuRien("[1")).toBeUndefined()
  })

  it("horodate à la seconde, en heure locale", () => {
    expect(horodatage(MAINTENANT)).toBe("20261009-143005")
    expect(horodatage(new Date(2027, 0, 2, 3, 4, 5))).toBe("20270102-030405")
  })
})
