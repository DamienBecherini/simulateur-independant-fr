// src/backend/logic/sauvegardes-groupees.ts

/*
 * Export et import de toutes les sauvegardes nommées dans un seul fichier.
 *
 * Le fichier porte un marqueur `type`, pour ne pas le confondre avec l'export d'une simulation seule,
 * et un numéro `formatVersion`, comme tous les fichiers écrits par le simulateur. Chaque sauvegarde
 * est lue indépendamment des autres : convertie au format actuel, puis nettoyée ; une sauvegarde
 * irrécupérable est écartée sans faire perdre le reste du fichier.
 *
 * La fusion avec les sauvegardes existantes n'écrase jamais rien : un doublon exact est ignoré,
 * toute autre collision (même identifiant ou même nom) donne une copie renommée.
 */

import type { SaveSlot } from "../../types.js"
import { nettoyerLesSlots, type SauvegardeRefusee } from "./data-sanitizer.js"
import { FORMAT_VERSION_ACTUEL, migrerVersFormatActuel, versionDuFormat } from "./migrations.js"

/** Marqueur des fichiers de sauvegardes groupées. */
export const TYPE_FICHIER_SAUVEGARDES = "sauvegardes-simulateur"

export interface FichierSauvegardes {
  formatVersion: number
  type: typeof TYPE_FICHIER_SAUVEGARDES
  /** Date de l'export, au format ISO 8601. */
  exportedAt: string
  /** Version de l'application qui a écrit le fichier ; chaque sauvegarde garde la sienne (celle qui l'a enregistrée). */
  appVersion?: string
  /** Les sauvegardes, dans l'ordre d'affichage ; chacune porte aussi son numéro de format. */
  slots: (SaveSlot & { formatVersion: number })[]
  slotOrder: string[]
}

export interface RapportLecture {
  /** Sauvegardes lues et utilisables. */
  lues: number
  /** Sauvegardes irrécupérables, écartées. */
  ecartees: number
  /** Sauvegardes lisibles mais refusées : plus de dix années, ou des années qui ne se suivent pas. */
  refusees: SauvegardeRefusee[]
  /** Points à vérifier après la conversion de sauvegardes d'un format précédent (sans doublon). */
  notesMigration: string[]
}

export type ResultatLecture = { ok: true; slots: SaveSlot[]; rapport: RapportLecture } | { ok: false; erreur: string }

export interface Renommage {
  ancienNom: string
  nouveauNom: string
}

export interface RapportFusion {
  /** Sauvegardes ajoutées, renommées comprises. */
  ajoutees: number
  /** Sauvegardes déjà présentes à l'identique, ignorées. */
  doublons: number
  /** Sauvegardes ajoutées sous un autre nom, pour ne pas en écraser une existante. */
  renommees: Renommage[]
}

export interface ResultatFusion {
  slots: SaveSlot[]
  slotOrder: string[]
  rapport: RapportFusion
}

type DonneesBrutes = Record<string, unknown>

function estObjet(valeur: unknown): valeur is DonneesBrutes {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)
}

/** Les sauvegardes dans l'ordre d'affichage : celles de `ordre` d'abord, les autres ensuite, dans leur ordre d'origine. */
function trierSelonOrdre(slots: SaveSlot[], ordre: unknown): SaveSlot[] {
  const ids = Array.isArray(ordre) ? ordre.filter((id): id is string => typeof id === "string") : []
  const parId = new Map(slots.map(slot => [slot.id, slot]))
  const ordonnes = [...new Set(ids)].map(id => parId.get(id)).filter(slot => slot !== undefined)
  const places = new Set(ordonnes.map(slot => slot.id))
  return [...ordonnes, ...slots.filter(slot => !places.has(slot.id))]
}

/** Construit le fichier d'export de toutes les sauvegardes, dans leur ordre d'affichage, avec la version de l'application qui l'écrit. */
export function construireFichierSauvegardes(slots: SaveSlot[], slotOrder: string[], date: Date = new Date(), appVersion?: string): FichierSauvegardes {
  const ordonnes = trierSelonOrdre(slots, slotOrder)
  return {
    formatVersion: FORMAT_VERSION_ACTUEL,
    type: TYPE_FICHIER_SAUVEGARDES,
    exportedAt: date.toISOString(),
    ...(appVersion === undefined ? {} : { appVersion }),
    slots: ordonnes.map(slot => ({ ...slot, formatVersion: FORMAT_VERSION_ACTUEL })),
    slotOrder: ordonnes.map(slot => slot.id)
  }
}

const deuxChiffres = (n: number) => String(n).padStart(2, "0")

/** Nom proposé pour le fichier d'export, daté du jour (heure locale) : `sauvegardes-simulateur-2026-10-04.json`. */
export function nomFichierSauvegardes(date: Date = new Date()): string {
  return `${TYPE_FICHIER_SAUVEGARDES}-${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}.json`
}

/** Un export de simulation seule (bouton « Exporter » ou « Exporter cette sauvegarde... ») contient directement la simulation. */
function ressembleAUneSimulation(donnees: DonneesBrutes): boolean {
  // `monthlyData` : une simulation exportée avant les années multiples (format 2 ou plus ancien).
  return "entities" in donnees || "annees" in donnees || "monthlyData" in donnees || "relationships" in donnees
}

/** Message d'erreur si le contenu n'est pas un fichier de sauvegardes ; `null` s'il en est un. */
function erreurDeType(donnees: unknown): string | null {
  if (!estObjet(donnees)) return "Ce fichier n'est pas un export de sauvegardes du simulateur."
  if (donnees.type === TYPE_FICHIER_SAUVEGARDES) {
    return Array.isArray(donnees.slots) ? null : "Ce fichier de sauvegardes est incomplet : la liste des sauvegardes est absente."
  }
  if (ressembleAUneSimulation(donnees)) {
    return "Ce fichier contient une seule simulation, pas un ensemble de sauvegardes : importez-le avec « Importer une simulation... »."
  }
  return "Ce fichier n'est pas un export de sauvegardes du simulateur."
}

/**
 * Lit un fichier de sauvegardes groupées.
 * Une sauvegarde sans numéro de format propre prend celui du fichier ; chacune est ensuite convertie
 * au format actuel et nettoyée individuellement (voir `sanitizeSlots`).
 */
export function lireFichierSauvegardes(contenu: string): ResultatLecture {
  let donnees: unknown
  try {
    donnees = JSON.parse(contenu)
  } catch {
    return { ok: false, erreur: "Ce fichier n'est pas un fichier JSON valide : il est peut-être endommagé." }
  }

  const erreur = erreurDeType(donnees)
  if (erreur !== null) return { ok: false, erreur }

  const fichier = donnees as DonneesBrutes & { slots: unknown[] }
  const versionFichier = versionDuFormat(fichier)
  const brutes = fichier.slots.map(slot => (estObjet(slot) && !("formatVersion" in slot) ? { ...slot, formatVersion: versionFichier } : slot))

  const { slots, refusees } = nettoyerLesSlots(brutes)
  const idsRetenus = new Set(slots.map(slot => slot.id))
  const notesMigration = [...new Set(brutes.filter(slot => estObjet(slot) && idsRetenus.has(slot.id as string)).flatMap(slot => migrerVersFormatActuel(slot).notes))]

  return {
    ok: true,
    slots: trierSelonOrdre(slots, fichier.slotOrder),
    rapport: { lues: slots.length, ecartees: brutes.length - slots.length - refusees.length, refusees, notesMigration }
  }
}

/** Écriture stable d'une valeur, indépendante de l'ordre des clés, pour comparer deux contenus. */
function formeCanonique(valeur: unknown): string {
  if (Array.isArray(valeur)) return `[${valeur.map(formeCanonique).join(",")}]`
  if (estObjet(valeur)) {
    const cles = Object.keys(valeur)
      .filter(cle => valeur[cle] !== undefined)
      .sort((a, b) => a.localeCompare(b))
    return `{${cles.map(cle => `${JSON.stringify(cle)}:${formeCanonique(valeur[cle])}`).join(",")}}`
  }
  return JSON.stringify(valeur)
}

/**
 * Deux sauvegardes au contenu identique : même nom, même simulation et mêmes réglages du comparateur (la date de
 * modification n'entre pas en compte).
 */
function memeContenu(a: SaveSlot, b: SaveSlot): boolean {
  const contenu = ({ name, entities, relationships, annees, comparateur }: SaveSlot) => formeCanonique({ name, entities, relationships, annees, comparateur })
  return contenu(a) === contenu(b)
}

const SUFFIXE_IMPORTEE = /^(.*) \(importée(?: (\d+))?\)$/

/**
 * Premier nom libre parmi « Nom (importée) », « Nom (importée 2) », « Nom (importée 3) »… Un nom déjà suffixé n'en
 * reçoit pas un second : « Nom (importée) » devient « Nom (importée 2) », « Nom (importée 2) » devient « Nom (importée 3) ».
 */
function nomLibre(nom: string, nomsPris: Set<string>): string {
  const suffixe = SUFFIXE_IMPORTEE.exec(nom)
  const base = suffixe ? suffixe[1] : nom
  const libelle = (numero: number) => (numero === 1 ? `${base} (importée)` : `${base} (importée ${numero})`)
  let numero = suffixe ? Number(suffixe[2] ?? 1) + 1 : 1
  while (nomsPris.has(libelle(numero))) numero++
  return libelle(numero)
}

const nouvelIdentifiant = () => `slot-${crypto.randomUUID()}`

/**
 * Ajoute des sauvegardes importées aux sauvegardes existantes, sans jamais en écraser une :
 * - même identifiant et même contenu : doublon, ignoré ;
 * - même identifiant mais contenu différent : copie, avec un nouvel identifiant et un nom suffixé « (importée) »,
 *   pour la distinguer de la version existante ;
 * - même nom (identifiant différent) : copie renommée de la même façon, l'identifiant est conservé ;
 * - sinon : ajoutée telle quelle.
 * Les sauvegardes ajoutées se placent après les existantes, dans l'ordre du fichier.
 */
export function fusionnerSauvegardes(existantes: SaveSlot[], slotOrder: string[], importees: SaveSlot[], creerId: () => string = nouvelIdentifiant): ResultatFusion {
  const slots = [...existantes]
  const rapport: RapportFusion = { ajoutees: 0, doublons: 0, renommees: [] }
  const ajoutes: string[] = []

  for (const importee of importees) {
    const memeId = slots.find(slot => slot.id === importee.id)
    if (memeId && memeContenu(memeId, importee)) {
      rapport.doublons++
      continue
    }

    const noms = new Set(slots.map(slot => slot.name))
    const id = memeId ? creerId() : importee.id
    const name = memeId || noms.has(importee.name) ? nomLibre(importee.name, noms) : importee.name
    if (name !== importee.name) rapport.renommees.push({ ancienNom: importee.name, nouveauNom: name })

    slots.push({ ...importee, id, name })
    ajoutes.push(id)
    rapport.ajoutees++
  }

  return { slots, slotOrder: [...slotOrder, ...ajoutes], rapport }
}
