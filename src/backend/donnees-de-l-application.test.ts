// src/backend/donnees-de-l-application.test.ts
// Les fichiers de données de l'application de bureau, sur un dossier temporaire : un fichier illisible est copié avant
// d'être remplacé, l'utilisateur est prévenu, et un échec d'écriture est signalé à l'interface.

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { grilleVide, SessionStateSchema, type NotificationPayload, type Person, type SaveSlot, type SessionState } from "../types.js"
import { FORMAT_VERSION_ACTUEL } from "./logic/migrations.js"
import { donneesDeLApplication, MESSAGES, type Avertissement } from "./donnees-de-l-application.js"

const MAINTENANT = new Date(2026, 9, 9, 14, 30, 5)
const ALICE: Person = { id: "person-alice", type: "person", name: "Alice", fiscalParts: 1, avatar: { type: "initials", value: "A", color: "#3b82f6" }, locked: false }

let dossier: string
let avertissements: Avertissement[]
let notifications: NotificationPayload[]

beforeEach(async () => {
  dossier = await mkdtemp(path.join(tmpdir(), "simulateur-donnees-"))
  avertissements = []
  notifications = []
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(dossier, { recursive: true, force: true })
})

function donnees(dans = dossier) {
  return donneesDeLApplication({ dossier: dans, versionDeLApplication: "1.2.3", avertir: a => avertissements.push(a), notifier: n => notifications.push(n), maintenant: () => MAINTENANT })
}

const fichier = (nom: string) => path.join(dossier, nom)
const lire = (nom: string) => readFile(fichier(nom), "utf-8")
const json = async <T>(nom: string) => JSON.parse(await lire(nom)) as T

function session(nom = "Ma simulation"): SessionState {
  return { name: nom, entities: [ALICE], relationships: [], annees: [{ annee: 2026, monthlyData: grilleVide() }] }
}

function sauvegarde(id: string, nom: string): SaveSlot & { formatVersion: number } {
  return { ...session(nom), id, lastModified: 1, formatVersion: FORMAT_VERSION_ACTUEL }
}

describe("fichier des sauvegardes illisible", () => {
  it("est mis de côté, intact, sous un nom horodaté ; l'utilisateur est prévenu ; il n'est jamais écrasé", async () => {
    const tronque = JSON.stringify([sauvegarde("slot-1", "Scénario A")]).slice(0, 60)
    await writeFile(fichier("simulationSlots.json"), tronque)
    const api = donnees()

    expect(await api.lireLesSauvegardes()).toEqual([])

    const copie = "simulationSlots.illisible-20261009-143005.json"
    expect(await lire(copie)).toBe(tronque)
    expect(avertissements).toEqual([expect.objectContaining({ type: "warning", title: "Sauvegardes illisibles" })])
    expect(avertissements[0].message).toContain(copie)
    expect(avertissements[0].message).toContain(dossier)

    // La sauvegarde suivante écrit un nouveau fichier ; la copie reste telle quelle.
    expect(await api.ecrireLesSauvegardes([sauvegarde("slot-2", "Scénario B")])).toBe(true)
    expect((await json<SaveSlot[]>("simulationSlots.json")).map(s => s.name)).toEqual(["Scénario B"])
    expect(await lire(copie)).toBe(tronque)
  })

  it("met de côté un JSON qui n'est pas une liste de sauvegardes", async () => {
    await writeFile(fichier("simulationSlots.json"), '{"slots": []}')
    expect(await donnees().lireLesSauvegardes()).toEqual([])
    expect(await readdir(dossier)).toEqual(["simulationSlots.illisible-20261009-143005.json"])
  })

  it("inaccessible : n'est pas modifié, et toute écriture échoue avec un message", async () => {
    await mkdir(fichier("simulationSlots.json"))
    const api = donnees()

    expect(await api.lireLesSauvegardes()).toEqual([])
    expect(avertissements[0].message).toContain("(erreur EISDIR)")
    expect(await api.ecrireLesSauvegardes([sauvegarde("slot-1", "A")])).toBe(false)
    expect(notifications).toEqual([{ message: MESSAGES.echecDesSauvegardes, type: "error" }])
  })

  it("une sauvegarde illisible est écartée : le fichier est copié, puis réécrit avec les autres", async () => {
    const contenu = JSON.stringify([sauvegarde("slot-1", "Gardée"), { name: "Sans identifiant" }])
    await writeFile(fichier("simulationSlots.json"), contenu)

    expect((await donnees().lireLesSauvegardes()).map(s => s.name)).toEqual(["Gardée"])

    expect(await lire("simulationSlots.refuse-20261009-143005.json")).toBe(contenu)
    expect((await json<SaveSlot[]>("simulationSlots.json")).map(s => s.name)).toEqual(["Gardée"])
    expect(avertissements).toEqual([expect.objectContaining({ title: "Sauvegardes illisibles", message: expect.stringContaining("1 sauvegarde illisible a été écartée") })])
  })

  it("une sauvegarde refusée à cause de ses années est nommée, et le fichier copié", async () => {
    const refusee = { ...sauvegarde("slot-2", "Trou"), annees: [2024, 2026].map(annee => ({ annee, monthlyData: grilleVide() })) }
    await writeFile(fichier("simulationSlots.json"), JSON.stringify([sauvegarde("slot-1", "Gardée"), refusee]))

    await donnees().lireLesSauvegardes()

    expect(avertissements[0]).toMatchObject({ title: "Sauvegardes refusées", message: expect.stringContaining("« Trou »") })
    expect(avertissements[0].message).toContain("simulationSlots.refuse-20261009-143005.json")
  })

  it("des sauvegardes d'un format précédent sont converties après copie de l'original", async () => {
    const ancienne = { ...session("Format 2"), id: "slot-1", lastModified: 1, formatVersion: 2, annees: undefined, monthlyData: grilleVide() }
    const contenu = JSON.stringify([ancienne])
    await writeFile(fichier("simulationSlots.json"), contenu)

    expect((await donnees().lireLesSauvegardes()).map(s => s.annees.map(a => a.annee))).toEqual([[2026]])

    expect(await lire("simulationSlots.format-2.json")).toBe(contenu)
    expect((await json<{ formatVersion: number }[]>("simulationSlots.json"))[0].formatVersion).toBe(FORMAT_VERSION_ACTUEL)
    expect(avertissements).toEqual([expect.objectContaining({ title: "Sauvegardes converties" })])
  })
})

describe("écriture des sauvegardes", () => {
  it("annonce la réussite, sauf en silence", async () => {
    const api = donnees()
    expect(await api.ecrireLesSauvegardes([sauvegarde("slot-1", "A"), { name: 42 } as unknown as SaveSlot])).toBe(true)
    expect(await api.ecrireLesSauvegardes([], { silencieux: true })).toBe(true)
    expect(notifications).toEqual([{ message: "Sauvegarde réussie !", type: "success" }])
  })

  it("signale l'échec au lieu de « Sauvegarde réussie ! », et le fichier précédent est intact", async () => {
    expect(await donnees(path.join(dossier, "absent")).ecrireLesSauvegardes([sauvegarde("slot-1", "A")])).toBe(false)
    expect(notifications).toEqual([{ message: "Échec de la sauvegarde : le fichier des sauvegardes n'a pas pu être écrit. Vos sauvegardes précédentes sont intactes.", type: "error" }])
  })
})

describe("session en cours", () => {
  it("absente : session vierge, sans message", async () => {
    expect(await donnees().lireLaSession()).toEqual(SessionStateSchema.parse({}))
    expect(avertissements).toEqual([])
  })

  it("lue telle quelle, sans message ni réécriture", async () => {
    await writeFile(fichier("sessionState.json"), JSON.stringify({ ...session(), formatVersion: FORMAT_VERSION_ACTUEL }))
    expect((await donnees().lireLaSession()).name).toBe("Ma simulation")
    expect(avertissements).toEqual([])
    expect(await readdir(dossier)).toEqual(["sessionState.json"])
  })

  it.each([
    ["tronquée", '{"name": "Ma sim'],
    ["qui n'est pas un objet", "[1, 2]"],
    // Lisible, mais refusée en bloc par le schéma : rien n'en serait gardé, elle ne doit pas devenir une session vierge en silence.
    ["dont le nom n'est pas un texte", JSON.stringify({ ...session(), name: 42, formatVersion: FORMAT_VERSION_ACTUEL })],
    ["dont la grille d'une année est inutilisable", JSON.stringify({ ...session(), annees: [{ annee: 2026, monthlyData: grilleVide().slice(0, 11) }], formatVersion: FORMAT_VERSION_ACTUEL })]
  ])("illisible (%s) : mise de côté, message qui la nomme, session vierge", async (_cas, contenu) => {
    await writeFile(fichier("sessionState.json"), contenu)

    expect(await donnees().lireLaSession()).toEqual(SessionStateSchema.parse({}))

    expect(await readdir(dossier)).toEqual(["sessionState.illisible-20261009-143005.json"])
    expect(await lire("sessionState.illisible-20261009-143005.json")).toBe(contenu)
    expect(avertissements).toEqual([expect.objectContaining({ type: "warning", title: "Chargement échoué" })])
    expect(avertissements[0].message).toContain("sessionState.illisible-20261009-143005.json")
    expect(avertissements[0].message).toContain("nouvelle simulation vierge")
  })

  it("refusée à cause de ses années : mise de côté avec le motif", async () => {
    await writeFile(fichier("sessionState.json"), JSON.stringify({ ...session(), formatVersion: FORMAT_VERSION_ACTUEL, annees: [2024, 2026].map(annee => ({ annee, monthlyData: grilleVide() })) }))

    expect((await donnees().lireLaSession()).entities).toEqual([])

    expect(await readdir(dossier)).toEqual(["sessionState.refuse-20261009-143005.json"])
    expect(avertissements[0]).toMatchObject({ title: "Chargement refusé", message: expect.stringContaining("sessionState.refuse-20261009-143005.json") })
  })

  it("nettoyée : le fichier d'origine est copié, puis réécrit sans ce qui a été retiré", async () => {
    const contenu = JSON.stringify({ ...session(), formatVersion: FORMAT_VERSION_ACTUEL, entities: [ALICE, { id: "x", type: "inconnu" }] })
    await writeFile(fichier("sessionState.json"), contenu)

    expect((await donnees().lireLaSession()).entities).toEqual([ALICE])

    expect(await lire("sessionState.refuse-20261009-143005.json")).toBe(contenu)
    expect((await json<SessionState>("sessionState.json")).entities).toEqual([ALICE])
    expect(avertissements[0]).toMatchObject({ type: "info", title: "Chargement de la session", message: expect.stringContaining("Entités invalides supprimées : 1") })
    expect(avertissements[0].message).toContain("sessionState.refuse-20261009-143005.json")
  })

  it("d'un format précédent : convertie après copie de l'original", async () => {
    const contenu = JSON.stringify({ name: "Format 2", formatVersion: 2, entities: [ALICE], relationships: [], monthlyData: grilleVide() })
    await writeFile(fichier("sessionState.json"), contenu)

    expect((await donnees().lireLaSession()).annees.map(a => a.annee)).toEqual([2026])

    expect(await lire("sessionState.format-2.json")).toBe(contenu)
    expect(await json<{ formatVersion: number; appVersion: string }>("sessionState.json")).toMatchObject({ formatVersion: FORMAT_VERSION_ACTUEL, appVersion: "1.2.3" })
    expect(avertissements[0].message).toContain("convertie au nouveau format")
  })

  it("inaccessible : jamais remplacée, et la sauvegarde automatique signale son échec une seule fois", async () => {
    await mkdir(fichier("sessionState.json"))
    const api = donnees()

    expect(await api.lireLaSession()).toEqual(SessionStateSchema.parse({}))
    expect(avertissements[0].message).toContain("sauvegarde automatique est suspendue")
    expect(await api.ecrireLaSession(session())).toBe(false)
    expect(await api.ecrireLaSession(session())).toBe(false)
    expect(api.ecrireLaSessionSync(session())).toBe(false)
    expect(notifications).toEqual([{ message: MESSAGES.echecDeLaSession, type: "error" }])
  })

  it("un échec de la sauvegarde automatique est signalé à nouveau après une réussite", async () => {
    const ailleurs = path.join(dossier, "donnees")
    const api = donnees(ailleurs)

    expect(await api.ecrireLaSession(session())).toBe(false)
    await mkdir(ailleurs)
    expect(await api.ecrireLaSession(session())).toBe(true)
    expect(api.ecrireLaSessionSync(session("Fermeture"))).toBe(true)
    expect((JSON.parse(await readFile(path.join(ailleurs, "sessionState.json"), "utf-8")) as SessionState).name).toBe("Fermeture")
    await rm(ailleurs, { recursive: true })
    expect(await api.ecrireLaSession(session())).toBe(false)

    expect(notifications).toEqual([
      { message: MESSAGES.echecDeLaSession, type: "error" },
      { message: MESSAGES.echecDeLaSession, type: "error" }
    ])
  })
})

describe("préférences", () => {
  it("illisibles : mises de côté sans message, valeurs par défaut", async () => {
    await writeFile(fichier("userPreferences.json"), "{ pas du json")
    expect(await donnees().lireLesPreferences()).toEqual({ slotOrder: [] })
    expect(await lire("userPreferences.illisible-20261009-143005.json")).toBe("{ pas du json")
    expect(avertissements).toEqual([])
  })

  it("lues, absentes ou inaccessibles", async () => {
    expect(await donnees().lireLesPreferences()).toEqual({ slotOrder: [] })
    await writeFile(fichier("userPreferences.json"), JSON.stringify({ slotOrder: ["a"], zoom: 1.2 }))
    expect(await donnees().lireLesPreferences()).toEqual({ slotOrder: ["a"], zoom: 1.2 })
  })

  it("enregistrées validées ; un échec est signalé une fois", async () => {
    const api = donnees()
    await api.ecrireLesPreferences({ slotOrder: ["a"], zoom: "grand" } as never)
    expect(await json<object>("userPreferences.json")).toEqual({ slotOrder: ["a"] })

    const ailleurs = donnees(path.join(dossier, "absent"))
    await ailleurs.ecrireLesPreferences({ slotOrder: [] })
    await ailleurs.ecrireLesPreferences({ slotOrder: [] })
    expect(notifications).toEqual([{ message: MESSAGES.echecDesPreferences, type: "error" }])
  })
})
