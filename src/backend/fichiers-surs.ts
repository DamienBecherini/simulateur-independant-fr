// src/backend/fichiers-surs.ts
// Écriture et lecture prudentes des fichiers de données de l'application de bureau (voir l'ADR 005, « Robustesse de
// l'écriture ») : écriture atomique, copie horodatée d'un fichier qu'on ne peut pas garder tel quel, et protection d'un
// fichier qu'on n'a pu ni lire ni copier. Sans Electron, pour être testé seul sur un dossier temporaire.

import { constants, renameSync, rmSync, writeFileSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { horodatage } from "@/lib/horodatage.js"

/** Erreurs d'un renommage refusé un court instant sous Windows (antivirus, indexation, fichier ouvert ailleurs). */
const ERREURS_PASSAGERES = new Set(["EPERM", "EACCES", "EBUSY"])
const ESSAIS_DE_RENOMMAGE = 5
const PAUSE_ENTRE_ESSAIS_MS = 40

/** Code d'une erreur du système de fichiers (`ENOENT`, `EACCES`…), ou `undefined`. */
export function codeDErreur(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | null)?.code
}

/** Écriture refusée : le fichier n'a pu être ni lu ni copié, le remplacer ferait perdre son contenu. */
export class FichierProtegeError extends Error {
  constructor(chemin: string) {
    super(`${path.basename(chemin)} n'a pu être ni lu ni copié : il n'est pas remplacé.`)
    this.name = "FichierProtegeError"
  }
}

const fichiersProteges = new Set<string>()

/** Interdit, jusqu'à la fermeture de l'application, toute écriture sur un fichier qu'on n'a pu ni lire ni copier. */
export function proteger(chemin: string) {
  fichiersProteges.add(path.resolve(chemin))
}

function verifierQuIlPeutEtreRemplace(chemin: string) {
  if (fichiersProteges.has(path.resolve(chemin))) throw new FichierProtegeError(chemin)
}

// Chaque écriture a son fichier temporaire et son numéro : deux écritures du même fichier ne se mélangent jamais, et
// une écriture plus ancienne qui finit après une plus récente ne la remplace pas.
let derniereEcriture = 0
const numeroDeLaDerniereEcriture = new Map<string, number>()

function preparerUneEcriture(chemin: string): { numero: number; provisoire: string } {
  verifierQuIlPeutEtreRemplace(chemin)
  derniereEcriture += 1
  numeroDeLaDerniereEcriture.set(path.resolve(chemin), derniereEcriture)
  return { numero: derniereEcriture, provisoire: `${chemin}.${process.pid}-${derniereEcriture}.tmp` }
}

const estLaDerniereEcriture = (chemin: string, numero: number) => numeroDeLaDerniereEcriture.get(path.resolve(chemin)) === numero

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Renomme en remplaçant la cible ; sous Windows, un refus passager est retenté quelques fois. */
async function renommer(source: string, cible: string) {
  for (let essai = 1; ; essai += 1) {
    try {
      await fs.rename(source, cible)
      return
    } catch (error) {
      if (essai >= ESSAIS_DE_RENOMMAGE || !ERREURS_PASSAGERES.has(codeDErreur(error) ?? "")) throw error
      await pause(PAUSE_ENTRE_ESSAIS_MS * essai)
    }
  }
}

function renommerSync(source: string, cible: string) {
  for (let essai = 1; ; essai += 1) {
    try {
      renameSync(source, cible)
      return
    } catch (error) {
      if (essai >= ESSAIS_DE_RENOMMAGE || !ERREURS_PASSAGERES.has(codeDErreur(error) ?? "")) throw error
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, PAUSE_ENTRE_ESSAIS_MS * essai)
    }
  }
}

/**
 * Écrit un fichier sans jamais le laisser à moitié écrit : le contenu va dans un fichier temporaire du même dossier,
 * vidé sur le disque, puis renommé. Un arrêt brutal laisse l'ancien fichier ou le nouveau, jamais un fichier tronqué.
 * Si l'écriture échoue, l'ancien fichier est intact et l'erreur est levée.
 * @throws {FichierProtegeError} Si le fichier n'a pu être ni lu ni copié au démarrage.
 */
export async function ecrireAtomiquement(chemin: string, contenu: string): Promise<void> {
  const { numero, provisoire } = preparerUneEcriture(chemin)
  try {
    await fs.writeFile(provisoire, contenu, { flush: true })
    if (estLaDerniereEcriture(chemin, numero)) await renommer(provisoire, chemin)
  } finally {
    await fs.rm(provisoire, { force: true })
  }
}

/** Comme `ecrireAtomiquement`, de façon synchrone : pour l'enregistrement à la fermeture de la fenêtre. */
export function ecrireAtomiquementSync(chemin: string, contenu: string): void {
  const { provisoire } = preparerUneEcriture(chemin)
  try {
    writeFileSync(provisoire, contenu, { flush: true })
    renommerSync(provisoire, chemin)
  } finally {
    rmSync(provisoire, { force: true })
  }
}

/** Suffixe d'une copie : fichier entièrement illisible, ou lu mais dont une partie a été refusée ou écartée. */
export type RaisonDeLaCopie = "illisible" | "refuse"

/**
 * Copie un fichier, octet pour octet, à côté de lui sous un nom horodaté (`simulationSlots.illisible-20261009-143005.json`),
 * sans jamais écraser une copie existante (`-2`, `-3`… si le nom est pris). Si `deplacer` est vrai, l'original est
 * ensuite supprimé : il ne sera plus relu au prochain démarrage.
 * @returns Le chemin de la copie, ou `null` si elle n'a pas pu être faite : le fichier est alors protégé (`proteger`).
 */
export async function copierACote(chemin: string, raison: RaisonDeLaCopie, { maintenant = new Date(), deplacer = false } = {}): Promise<string | null> {
  const base = chemin.replace(/\.json$/, "")
  for (let rang = 1; rang <= 99; rang += 1) {
    const copie = `${base}.${raison}-${horodatage(maintenant)}${rang > 1 ? `-${rang}` : ""}.json`
    try {
      await fs.copyFile(chemin, copie, constants.COPYFILE_EXCL)
      if (deplacer) await fs.rm(chemin, { force: true }).catch(() => undefined)
      return copie
    } catch (error) {
      if (codeDErreur(error) !== "EEXIST") break
    }
  }
  proteger(chemin)
  return null
}

/**
 * Copie un fichier à côté de lui sous un nom fixe (`sessionState.format-1.json`), sans remplacer une copie existante.
 * @returns `true` si la copie a été faite.
 */
export async function copierSansRemplacer(chemin: string, suffixe: string): Promise<boolean> {
  try {
    await fs.copyFile(chemin, chemin.replace(/\.json$/, `.${suffixe}.json`), constants.COPYFILE_EXCL)
    return true
  } catch {
    // Une copie existe déjà : on la conserve.
    return false
  }
}

/** Ce que donne la lecture d'un fichier de données. */
export type LectureDuFichier = { etat: "absent" } | { etat: "lu"; contenu: string } | { etat: "inaccessible"; code: string }

/**
 * Lit un fichier de données. Absent : c'est un premier lancement. Inaccessible (droits, fichier verrouillé…) : il est
 * protégé, pour ne pas être remplacé par un fichier vide alors qu'on ignore ce qu'il contient.
 */
export async function lireLeFichier(chemin: string): Promise<LectureDuFichier> {
  try {
    return { etat: "lu", contenu: await fs.readFile(chemin, "utf-8") }
  } catch (error) {
    const code = codeDErreur(error) ?? "inconnue"
    if (code === "ENOENT") return { etat: "absent" }
    proteger(chemin)
    return { etat: "inaccessible", code }
  }
}

/** Le JSON d'un fichier, ou `undefined` s'il n'en est pas. */
export function jsonOuRien(contenu: string): unknown {
  try {
    return JSON.parse(contenu) as unknown
  } catch {
    return undefined
  }
}
