// src/backend/boite-aux-propositions.test.ts
// La boîte aux propositions du process principal, sur un dossier temporaire : une proposition valide est transmise,
// tout le reste (trop gros, invalide, lien, sous-dossier, fichier hors de la boîte) est écarté sans être transmis.

import { mkdtemp, mkdir, readdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { empreinteDeLaSession } from "./logic/outils/commun.js"
import { sessionExemple } from "../web/session-exemple.js"
import { ouvrirLaBoiteAuxPropositions, type BoiteAuxPropositions } from "./boite-aux-propositions.js"
import { contenuDUnePropositionEnAttente, DOSSIER_DES_PROPOSITIONS, TAILLE_MAX_D_UNE_PROPOSITION, type PropositionRecue } from "./mcp/proposition-en-attente.js"

let dossier: string
let boite: BoiteAuxPropositions | null
let recues: PropositionRecue[][]
const journal = { warn: vi.fn(), error: vi.fn() }

const proposition = {
  empreinteSession: empreinteDeLaSession(sessionExemple()),
  operations: [{ type: "ajouter_flux" as const, annee: 2026, acteurId: "company-conseil", typeFlux: "deductible_expense" as const, libelle: "Loyer", montant: 800, mois: [1] }]
}
const valide = () => contenuDUnePropositionEnAttente(proposition, new Date("2026-10-06T08:30:00.000Z"))
const dansLaBoite = (nom: string) => path.join(dossier, DOSSIER_DES_PROPOSITIONS, nom)

async function ouvrir() {
  boite = await ouvrirLaBoiteAuxPropositions(dossier, { surChangement: liste => recues.push(liste), journal, delai: 10 })
  return boite
}

/** Attend que la boîte ait transmis une nouvelle liste (événement du système de fichiers, puis relecture). */
async function attendreUneListe(nombre: number) {
  await vi.waitFor(() => expect(recues.length).toBeGreaterThanOrEqual(nombre), { timeout: 3000, interval: 20 })
  return recues[nombre - 1]
}

beforeEach(async () => {
  dossier = await mkdtemp(path.join(tmpdir(), "simulateur-boite-"))
  recues = []
  boite = null
  journal.warn.mockClear()
  journal.error.mockClear()
})

afterEach(async () => {
  boite?.arreter()
  await rm(dossier, { recursive: true, force: true })
})

describe("boîte aux propositions", () => {
  it("transmet une proposition déjà présente à l'ouverture, puis la retire une fois traitée", async () => {
    await mkdir(path.join(dossier, DOSSIER_DES_PROPOSITIONS))
    await writeFile(dansLaBoite("a.json"), valide())
    const ouverte = await ouvrir()
    expect(recues).toEqual([[{ id: "a.json", creeeLe: "2026-10-06T08:30:00.000Z", proposition }]])
    expect(ouverte.enAttente().map(p => p.id)).toEqual(["a.json"])

    expect(await ouverte.retirer("a.json")).toBe(true)
    expect(recues.at(-1)).toEqual([])
    expect(await readdir(path.join(dossier, DOSSIER_DES_PROPOSITIONS))).toEqual([])
    expect(await ouverte.retirer("a.json")).toBe(false)
  })

  it("transmet une proposition déposée pendant que l'application tourne", async () => {
    await ouvrir()
    expect(recues).toEqual([])
    await writeFile(dansLaBoite("2026-b.json"), valide())
    expect((await attendreUneListe(1)).map(p => p.id)).toEqual(["2026-b.json"])
  })

  it("rend les propositions dans l'ordre de leur nom, c'est-à-dire de leur dépôt", async () => {
    await mkdir(path.join(dossier, DOSSIER_DES_PROPOSITIONS))
    await writeFile(dansLaBoite("2026-10-06T09-00-00-000Z-b.json"), valide())
    await writeFile(dansLaBoite("2026-10-06T08-00-00-000Z-a.json"), valide())
    expect((await ouvrir()).enAttente().map(p => p.id)).toEqual(["2026-10-06T08-00-00-000Z-a.json", "2026-10-06T09-00-00-000Z-b.json"])
  })

  it("écarte et supprime un fichier trop gros ou invalide, sans le transmettre", async () => {
    await mkdir(path.join(dossier, DOSSIER_DES_PROPOSITIONS))
    await writeFile(dansLaBoite("gros.json"), " ".repeat(TAILLE_MAX_D_UNE_PROPOSITION + 1))
    await writeFile(dansLaBoite("casse.json"), "{ pas du JSON")
    await writeFile(dansLaBoite("autre.json"), JSON.stringify({ format: "autre chose" }))
    // Une proposition au-delà des limites de la couche d'outils (deux suppressions) est refusée par son schéma.
    const deuxSuppressions = { ...JSON.parse(valide()), proposition: { ...proposition, operations: [{ type: "supprimer_relation", relationId: "a" }, { type: "supprimer_relation", relationId: "b" }] } }
    await writeFile(dansLaBoite("limites.json"), JSON.stringify(deuxSuppressions))
    await writeFile(dansLaBoite("cle-en-trop.json"), JSON.stringify({ ...JSON.parse(valide()), executer: "rm -rf" }))
    const ouverte = await ouvrir()
    expect(ouverte.enAttente()).toEqual([])
    expect(recues).toEqual([])
    expect(journal.warn).toHaveBeenCalledTimes(5)
    expect(journal.warn).toHaveBeenCalledWith(expect.stringMatching(/« gros\.json » écartée : fichier trop gros/))
    expect(await readdir(path.join(dossier, DOSSIER_DES_PROPOSITIONS))).toEqual([])
  })

  it("ne signale qu'une fois un fichier écarté quand deux examens sont demandés en même temps", async () => {
    await mkdir(path.join(dossier, DOSSIER_DES_PROPOSITIONS))
    const ouverte = await ouvrir()
    for (const nom of ["un.json", "deux.json", "trois.json"]) await writeFile(dansLaBoite(nom), "{ pas du JSON")
    await writeFile(dansLaBoite("bonne.json"), valide())
    // Comme un événement du dossier qui arrive pendant un examen : le second attend le premier au lieu de le doubler.
    await Promise.all([ouverte.examiner(), ouverte.examiner(), ouverte.examiner()])
    expect(journal.warn).toHaveBeenCalledTimes(3)
    expect(ouverte.enAttente().map(p => p.id)).toEqual(["bonne.json"])
    expect(await readdir(path.join(dossier, DOSSIER_DES_PROPOSITIONS))).toEqual(["bonne.json"])
  })

  it("ignore les noms qui ne sont pas des propositions, les sous-dossiers et les fichiers hors de la boîte", async () => {
    await mkdir(path.join(dossier, DOSSIER_DES_PROPOSITIONS, "sous-dossier.json"), { recursive: true })
    await writeFile(path.join(dossier, DOSSIER_DES_PROPOSITIONS, "sous-dossier.json", "c.json"), valide())
    await writeFile(dansLaBoite("en-cours.json.tmp"), valide())
    await writeFile(dansLaBoite(".cache.json"), valide())
    await writeFile(dansLaBoite("é.json"), valide())
    await writeFile(path.join(dossier, "voisin.json"), valide())
    const ouverte = await ouvrir()
    expect(ouverte.enAttente()).toEqual([])
    expect(await ouverte.retirer("../voisin.json")).toBe(false)
    expect(await ouverte.retirer("sous-dossier.json/c.json")).toBe(false)
    expect((await readdir(dossier)).sort()).toEqual([DOSSIER_DES_PROPOSITIONS, "voisin.json"])
    expect((await readdir(path.join(dossier, DOSSIER_DES_PROPOSITIONS))).sort()).toEqual([".cache.json", "en-cours.json.tmp", "sous-dossier.json", "é.json"])
  })

  it("ne suit pas un lien vers un fichier hors de la boîte", async ({ skip }) => {
    await mkdir(path.join(dossier, DOSSIER_DES_PROPOSITIONS))
    const dehors = path.join(dossier, "dehors.json")
    await writeFile(dehors, valide())
    try {
      await symlink(dehors, dansLaBoite("lien.json"), "file")
    } catch {
      // Windows sans le mode développeur : créer un lien symbolique demande des droits d'administrateur.
      return skip()
    }
    const ouverte = await ouvrir()
    expect(ouverte.enAttente()).toEqual([])
    expect(journal.warn).toHaveBeenCalledWith(expect.stringMatching(/« lien\.json » écartée : ce n'est pas un fichier ordinaire/))
    expect(await readdir(dossier)).toContain("dehors.json")
  })

  it("oublie une proposition dont le fichier a disparu", async () => {
    await mkdir(path.join(dossier, DOSSIER_DES_PROPOSITIONS))
    await writeFile(dansLaBoite("a.json"), valide())
    const ouverte = await ouvrir()
    await rm(dansLaBoite("a.json"))
    await ouverte.examiner()
    expect(ouverte.enAttente()).toEqual([])
    expect(recues.at(-1)).toEqual([])
  })
})
