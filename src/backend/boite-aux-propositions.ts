// src/backend/boite-aux-propositions.ts
// La boîte aux propositions, côté process principal (voir l'ADR 011) : le serveur MCP local dépose une proposition par
// fichier dans le dossier `propositions` du dossier de données ; on surveille ce dossier, et seulement lui. Un fichier
// n'est transmis à l'interface que s'il porte un nom simple, est un vrai fichier (pas un lien), ne dépasse pas la
// taille maximale et suit le format, proposition validée en entier par le schéma de la couche d'outils. Les autres sont
// supprimés sans être lus plus loin. L'interface relit la proposition, la montre, et nous la fait retirer une fois
// appliquée ou refusée. Sans Electron, pour être testé seul.

import { watch, type FSWatcher } from "node:fs"
import { lstat, mkdir, readdir, readFile, unlink } from "node:fs/promises"
import path from "node:path"
import { DOSSIER_DES_PROPOSITIONS, lireUnePropositionEnAttente, NOM_DE_PROPOSITION, TAILLE_MAX_D_UNE_PROPOSITION, type PropositionRecue } from "./mcp/proposition-en-attente.js"

export interface BoiteAuxPropositions {
  /** Les propositions valides en attente, de la plus ancienne à la plus récente. */
  enAttente(): PropositionRecue[]
  /** Retire une proposition traitée (appliquée ou refusée) ; `false` si l'identifiant n'en désigne aucune. */
  retirer(id: string): Promise<boolean>
  /** Relit le dossier ; appelé à chaque changement, et une fois à l'ouverture. */
  examiner(): Promise<void>
  arreter(): void
}

export interface OptionsDeLaBoite {
  /** Appelé avec toutes les propositions en attente, chaque fois que la liste change. */
  surChangement: (propositions: PropositionRecue[]) => void
  journal?: Pick<Console, "warn" | "error">
  /** Délai de regroupement des événements du système de fichiers, en millisecondes. */
  delai?: number
}

/** Le chemin d'une proposition de la boîte, ou `null` si l'identifiant n'est pas un nom de fichier simple. */
function cheminDans(boite: string, id: string): string | null {
  if (!NOM_DE_PROPOSITION.test(id)) return null
  const chemin = path.join(boite, id)
  return path.dirname(chemin) === boite ? chemin : null
}

/** Lit un fichier de la boîte ; rend la proposition, ou le motif de son refus. */
async function lireLaProposition(chemin: string, id: string): Promise<PropositionRecue | string> {
  const infos = await lstat(chemin)
  if (!infos.isFile()) return "ce n'est pas un fichier ordinaire"
  if (infos.size > TAILLE_MAX_D_UNE_PROPOSITION) return `fichier trop gros (${infos.size} octets, au plus ${TAILLE_MAX_D_UNE_PROPOSITION})`
  const lue = lireUnePropositionEnAttente(await readFile(chemin, "utf-8"))
  if (!lue) return "format invalide"
  return { id, creeeLe: lue.creeeLe, proposition: lue.proposition }
}

/** Ouvre la boîte aux propositions du dossier de données, et la surveille. */
export async function ouvrirLaBoiteAuxPropositions(dossierDeDonnees: string, { surChangement, journal = console, delai = 100 }: OptionsDeLaBoite): Promise<BoiteAuxPropositions> {
  const boite = path.resolve(dossierDeDonnees, DOSSIER_DES_PROPOSITIONS)
  await mkdir(boite, { recursive: true })
  const propositions = new Map<string, PropositionRecue>()
  const ecartees = new Set<string>()
  let signature = ""

  const publier = () => {
    const liste = [...propositions.values()].sort((a, b) => a.id.localeCompare(b.id))
    const nouvelle = liste.map(p => p.id).join("|")
    if (nouvelle === signature) return
    signature = nouvelle
    surChangement(liste)
  }

  const ecarter = async (id: string, motif: string) => {
    ecartees.add(id)
    journal.warn(`Proposition « ${id} » écartée : ${motif}.`)
    const chemin = cheminDans(boite, id)
    if (chemin) await unlink(chemin).catch(() => undefined)
  }

  const examinerUnFichier = async (id: string) => {
    const chemin = cheminDans(boite, id)
    if (!chemin) return
    try {
      const lue = await lireLaProposition(chemin, id)
      if (typeof lue === "string") await ecarter(id, lue)
      else propositions.set(id, lue)
    } catch (erreur) {
      // Fichier disparu entre la lecture du dossier et la sienne : il sera revu au prochain événement s'il revient.
      if ((erreur as NodeJS.ErrnoException).code !== "ENOENT") journal.error(`Proposition « ${id} » illisible :`, erreur)
    }
  }

  const examinerUneFois = async () => {
    const noms = new Set(await readdir(boite).catch(() => [] as string[]))
    // Retirer l'élément courant pendant le parcours d'une Map ou d'un Set est sûr : pas de copie nécessaire.
    for (const id of propositions.keys()) if (!noms.has(id)) propositions.delete(id)
    for (const id of ecartees) if (!noms.has(id)) ecartees.delete(id)
    for (const id of noms) if (!propositions.has(id) && !ecartees.has(id) && NOM_DE_PROPOSITION.test(id)) await examinerUnFichier(id)
    publier()
  }

  // Deux examens ne se chevauchent jamais : sinon chacun lirait les mêmes fichiers avant que l'autre ne les ait
  // écartés, et un même fichier serait signalé plusieurs fois (les suppressions de l'examen en cours réveillent la
  // surveillance). Une demande reçue pendant un examen en déclenche un seul de plus, à sa suite ; chaque appelant
  // attend la fin de ce dernier, qui voit l'état du dossier au moment de sa demande.
  let examenEnCours: Promise<void> | null = null
  let aReprendre = false
  const examiner = (): Promise<void> => {
    if (examenEnCours) {
      aReprendre = true
      return examenEnCours
    }
    examenEnCours = (async () => {
      try {
        do {
          aReprendre = false
          await examinerUneFois()
        } while (aReprendre)
      } finally {
        examenEnCours = null
      }
    })()
    return examenEnCours
  }

  // Les événements arrivent souvent par rafales (création, écriture, renommage) : on relit le dossier une fois.
  let minuterie: NodeJS.Timeout | null = null
  let surveillance: FSWatcher | null = null
  try {
    surveillance = watch(boite, () => {
      if (minuterie) clearTimeout(minuterie)
      minuterie = setTimeout(() => void examiner().catch(erreur => journal.error("Boîte aux propositions illisible :", erreur)), delai)
    })
    surveillance.on("error", erreur => journal.error("Surveillance de la boîte aux propositions interrompue :", erreur))
  } catch (erreur) {
    journal.error("Surveillance de la boîte aux propositions impossible :", erreur)
  }
  await examiner()

  return {
    enAttente: () => [...propositions.values()].sort((a, b) => a.id.localeCompare(b.id)),
    retirer: async id => {
      const chemin = cheminDans(boite, id)
      if (!chemin || !propositions.has(id)) return false
      propositions.delete(id)
      await unlink(chemin).catch(erreur => journal.error(`Proposition « ${id} » impossible à supprimer :`, erreur))
      publier()
      return true
    },
    examiner,
    arreter: () => {
      if (minuterie) clearTimeout(minuterie)
      surveillance?.close()
    }
  }
}
