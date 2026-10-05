// src/backend/logic/nettoyage-comparateur.ts

/*
 * Nettoyage des réglages du comparateur enregistrés dans une session (voir l'ADR 010).
 *
 * Avant la validation Zod, chaque réglage invalide (hors limites, mal formé) est écarté un par un et compté : un
 * réglage abîmé ne fait perdre ni les autres, ni la session. Après la validation, les réglages d'une activité ou
 * d'une année absentes de la session sont retirés sans être signalés : l'usage normal en laisse (une activité
 * supprimée, que l'annulation peut encore rétablir), ce n'est pas une corruption.
 */

import { ReglagesComparateurSchema } from "../../types.js"
import type { Comparateur, Entity, ReglagesComparateur } from "../../types.js"

type DonneesBrutes = Record<string, unknown>

/** Les données d'origine privées de leurs réglages invalides (`undefined` s'il n'en reste rien), et leur nombre. */
interface ReglagesFiltres {
  kept: unknown
  removed: number
}

const ANNEE = /^\d{4}$/
const champsDesReglages = ReglagesComparateurSchema.shape

function estObjet(valeur: unknown): valeur is DonneesBrutes {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)
}

/** Les rémunérations saisies par année : chaque année au nom ou au montant invalide est écartée. */
function nettoyerRemunerations(brutes: unknown): ReglagesFiltres {
  if (brutes === undefined) return { kept: undefined, removed: 0 }
  if (!estObjet(brutes)) return { kept: undefined, removed: 1 }
  const valides = Object.entries(brutes).filter(([annee, montant]) => ANNEE.test(annee) && typeof montant === "number" && Number.isFinite(montant) && montant >= 0)
  return { kept: Object.fromEntries(valides), removed: Object.keys(brutes).length - valides.length }
}

/** Les réglages d'une activité, champ par champ ; un champ inconnu est ignoré, comme partout ailleurs dans le fichier. */
function nettoyerReglages(bruts: unknown): ReglagesFiltres {
  if (!estObjet(bruts)) return { kept: undefined, removed: 1 }
  const kept: DonneesBrutes = {}
  let removed = 0
  for (const [champ, valeur] of Object.entries(bruts)) {
    if (champ === "remunerationParAnnee") {
      const remunerations = nettoyerRemunerations(valeur)
      removed += remunerations.removed
      if (remunerations.kept !== undefined) kept[champ] = remunerations.kept
    } else if (Object.prototype.hasOwnProperty.call(champsDesReglages, champ)) {
      if (champsDesReglages[champ as keyof typeof champsDesReglages].safeParse(valeur).success) kept[champ] = valeur
      else removed++
    }
  }
  return { kept, removed }
}

/** Les réglages de chaque activité ; une activité aux réglages inutilisables les perd, les autres les gardent. */
function nettoyerReglagesParActivite(bruts: unknown): ReglagesFiltres {
  if (bruts === undefined) return { kept: {}, removed: 0 }
  if (!estObjet(bruts)) return { kept: {}, removed: 1 }
  let removed = 0
  const kept: DonneesBrutes = {}
  for (const [activityId, reglages] of Object.entries(bruts)) {
    const nettoyes = nettoyerReglages(reglages)
    removed += nettoyes.removed
    if (nettoyes.kept !== undefined) kept[activityId] = nettoyes.kept
  }
  return { kept, removed }
}

/**
 * Écarte un à un les réglages invalides du comparateur, avant la validation de la session.
 * Une session sans comparateur (fichier d'avant les réglages enregistrés) reste sans comparateur.
 */
export function nettoyerComparateurBrut(brut: unknown): ReglagesFiltres {
  if (brut === undefined) return { kept: undefined, removed: 0 }
  if (!estObjet(brut)) return { kept: undefined, removed: 1 }
  const reglages = nettoyerReglagesParActivite(brut.reglagesParActivite)
  const activiteValide = brut.activiteComparee === undefined || typeof brut.activiteComparee === "string"
  const kept: DonneesBrutes = { reglagesParActivite: reglages.kept }
  if (activiteValide && brut.activiteComparee !== undefined) kept.activiteComparee = brut.activiteComparee
  return { kept, removed: reglages.removed + (activiteValide ? 0 : 1) }
}

/** Les réglages d'une activité, sans les rémunérations des années absentes de la session. */
function sansAnneesAbsentes(reglages: ReglagesComparateur, annees: Set<number>): ReglagesComparateur {
  if (!reglages.remunerationParAnnee) return reglages
  const remunerationParAnnee = Object.fromEntries(Object.entries(reglages.remunerationParAnnee).filter(([annee]) => annees.has(Number(annee))))
  return { ...reglages, remunerationParAnnee }
}

/**
 * Retire, sans le signaler, les réglages qui ne désignent plus rien : ceux d'une activité absente de la session, la
 * rémunération d'une année absente, et l'activité comparée si elle a disparu (le comparateur reprend la première).
 */
export function sansReglagesOrphelins(comparateur: Comparateur | undefined, entities: Entity[], annees: number[]): Comparateur | undefined {
  if (!comparateur) return undefined
  const activites = new Set(entities.filter(e => e.type !== "person").map(e => e.id))
  const anneesDeLaSession = new Set(annees)
  const reglagesParActivite = Object.fromEntries(Object.entries(comparateur.reglagesParActivite).flatMap(([id, reglages]) => (activites.has(id) ? [[id, sansAnneesAbsentes(reglages, anneesDeLaSession)]] : [])))
  const activiteComparee = comparateur.activiteComparee !== undefined && activites.has(comparateur.activiteComparee) ? comparateur.activiteComparee : undefined
  return activiteComparee === undefined ? { reglagesParActivite } : { activiteComparee, reglagesParActivite }
}
