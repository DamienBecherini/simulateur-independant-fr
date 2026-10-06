// src/backend/mcp/donnees.ts
// Ce que le serveur MCP lit et écrit sur le disque, et rien d'autre : la session enregistrée par l'application (en
// lecture seule) et un fichier par proposition à appliquer, dans le dossier `propositions` (voir l'ADR 011).

import { randomBytes } from "node:crypto"
import { lstat, mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import type { SessionState } from "../../types.js"
import { lireLaSession } from "../logic/fichiers-de-donnees.js"
import { empreinte } from "../logic/outils/commun.js"
import type { Proposition } from "../logic/outils/propositions.js"
import { contenuDUnePropositionEnAttente, DOSSIER_DES_PROPOSITIONS, FICHIER_DE_LA_SESSION, lireUnePropositionEnAttente, NOM_DE_PROPOSITION, nomDUnePropositionEnAttente, TAILLE_MAX_D_UNE_PROPOSITION } from "./proposition-en-attente.js"

/** Erreur de lecture des données, dont le message en français dit à l'utilisateur quoi vérifier. */
export class ErreurDeDonnees extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ErreurDeDonnees"
  }
}

export interface SessionEnregistree {
  session: SessionState
  /** Date de la dernière écriture du fichier par l'application. */
  enregistreeLe: Date
}

const CONSEIL = "Vérifiez que le paramètre --donnees désigne le dossier indiqué par l'application (Paramètres, « Utiliser avec une IA (MCP) »)."

const message = (erreur: unknown) => (erreur instanceof Error ? erreur.message : String(erreur))

/** Ordre des noms de fichiers par points de code, le même sur tous les systèmes quelle que soit la langue. */
const parPointsDeCode = (a: string, b: string) => Number(a > b) - Number(a < b)

/** Le texte du fichier de la session et sa date d'écriture. */
async function lireLeFichier(dossier: string, fichier: string): Promise<{ contenu: string; enregistreeLe: Date }> {
  try {
    const [contenu, infos] = await Promise.all([readFile(fichier, "utf-8"), stat(fichier)])
    return { contenu, enregistreeLe: infos.mtime }
  } catch (erreur) {
    if ((erreur as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ErreurDeDonnees(`Aucune simulation enregistrée dans « ${dossier} ». Ouvrez une fois l'application Simulateur Indépendant FR, puis réessayez. ${CONSEIL}`)
    }
    throw new ErreurDeDonnees(`Simulation illisible (${fichier}) : ${message(erreur)}. ${CONSEIL}`)
  }
}

/** Lit la session que l'application a enregistrée en dernier, convertie et nettoyée comme au démarrage de l'application. */
export async function lireLaSessionEnregistree(dossier: string): Promise<SessionEnregistree> {
  const fichier = path.join(dossier, FICHIER_DE_LA_SESSION)
  const { contenu, enregistreeLe } = await lireLeFichier(dossier, fichier)
  try {
    return { session: lireLaSession(contenu).safeState, enregistreeLe }
  } catch (erreur) {
    throw new ErreurDeDonnees(`Le fichier de la simulation (${fichier}) est invalide : ${message(erreur)}. Ouvrez l'application : elle le signale et repart d'une simulation vierge.`)
  }
}

/**
 * Le fichier d'une proposition identique qui attend déjà dans la boîte (envoyée deux fois par le client d'IA, qui
 * réessaie par exemple après une réponse tardive) ; `null` s'il n'y en a pas. Seuls les fichiers que l'application
 * accepterait sont lus : nom simple, fichier ordinaire, taille bornée, format attendu.
 */
export async function propositionDejaEnAttente(dossier: string, proposition: Proposition): Promise<string | null> {
  const boite = path.join(dossier, DOSSIER_DES_PROPOSITIONS)
  const noms = await readdir(boite).catch(() => [] as string[])
  const cherchee = empreinte(proposition)
  for (const nom of noms.filter(n => NOM_DE_PROPOSITION.test(n)).sort(parPointsDeCode)) {
    const fichier = path.join(boite, nom)
    const infos = await lstat(fichier).catch(() => null)
    if (!infos?.isFile() || infos.size > TAILLE_MAX_D_UNE_PROPOSITION) continue
    const lue = lireUnePropositionEnAttente(await readFile(fichier, "utf-8").catch(() => ""))
    if (lue && empreinte(lue.proposition) === cherchee) return nom
  }
  return null
}

/**
 * Dépose une proposition dans la boîte de l'application. Écrite sous un nom provisoire puis renommée, pour que
 * l'application ne lise jamais un fichier à moitié écrit. Rend le nom du fichier.
 */
export async function deposerUneProposition(dossier: string, proposition: Proposition, maintenant: Date): Promise<string> {
  const boite = path.join(dossier, DOSSIER_DES_PROPOSITIONS)
  await mkdir(boite, { recursive: true })
  const nom = nomDUnePropositionEnAttente(maintenant, randomBytes(6).toString("hex"))
  const provisoire = path.join(boite, `${nom}.tmp`)
  await writeFile(provisoire, contenuDUnePropositionEnAttente(proposition, maintenant), { flag: "wx" })
  await rename(provisoire, path.join(boite, nom))
  return nom
}
