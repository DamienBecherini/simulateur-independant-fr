// src/backend/logic/outils/commun.ts
// Ce que partagent les outils : erreurs lisibles par un modèle, arrondis, vocabulaire des acteurs et des flux, règles
// des relations, et empreinte d'une session (pour refuser une proposition construite sur une session qui a changé).

import type { Entity, FinancialFlow, Relationship, SessionState } from "../../../types.js"

/** Erreur prévue, dont le message en français dit au modèle ce qui ne va pas et comment s'y prendre autrement. */
export class ErreurOutil extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ErreurOutil"
  }
}

/** Montant arrondi à l'euro (jamais « -0 »). */
export const arrondir = (montant: number): number => Math.round(montant) + 0

/** « 2025, 2026 et 2027 », ou « Président ou Gérant ». */
export function enumerer(parties: (string | number)[], conjonction: "et" | "ou" = "et"): string {
  const textes = parties.map(String)
  return textes.length <= 1 ? (textes[0] ?? "") : `${textes.slice(0, -1).join(", ")} ${conjonction} ${textes[textes.length - 1]}`
}

// ===================================================================================
// == ACTEURS
// ===================================================================================

/** Ce qu'est un acteur, en un mot : une personne, ou une activité et son statut. */
export const GENRES_D_ACTEUR = ["personne", "SASU", "EURL", "EI", "micro-entreprise"] as const
export type GenreDActeur = (typeof GENRES_D_ACTEUR)[number]

export function genreDe(acteur: Entity): GenreDActeur {
  if (acteur.type === "person") return "personne"
  if (acteur.type === "micro-entreprise") return "micro-entreprise"
  return acteur.legalStatus
}

export function trouverActeur(session: Pick<SessionState, "entities">, id: string): Entity {
  const acteur = session.entities.find(e => e.id === id)
  if (acteur) return acteur
  const connus = session.entities.map(e => `${e.id} (${e.name})`)
  throw new ErreurOutil(`Aucun acteur « ${id} » dans la simulation. Acteurs connus : ${connus.length > 0 ? connus.join(", ") : "aucun"}. Appelez decrire_simulation pour les identifiants.`)
}

export function nomDe(session: Pick<SessionState, "entities">, id: string): string {
  return session.entities.find(e => e.id === id)?.name ?? id
}

/** L'année demandée si la session la contient ; sans année demandée, la plus récente. */
export function anneeDeLaSession(session: Pick<SessionState, "annees">, annee?: number): number {
  const annees = session.annees.map(a => a.annee)
  if (annee === undefined) return Math.max(...annees)
  if (annees.includes(annee)) return annee
  throw new ErreurOutil(`L'année ${annee} n'est pas dans la simulation. Années disponibles : ${enumerer(annees)}.`)
}

// ===================================================================================
// == FLUX
// ===================================================================================

/** Types de flux qu'un outil peut écrire (le type « income », réservé aux tests, en est exclu). */
export const TYPES_DE_FLUX = ["ca_services", "ca_vente", "deductible_expense", "director_remuneration", "dividends_payment", "ca_micro_services_bic", "ca_micro_services_bnc", "ca_micro_vente", "salary", "are", "other_taxable_income", "expense"] as const satisfies readonly FinancialFlow["type"][]
export type TypeDeFlux = (typeof TYPES_DE_FLUX)[number]

/**
 * Chaque type de flux expliqué pour un modèle : ce qu'il représente, hors taxe ou non. Montants mensuels, en euros.
 * Qui le porte est dit à part, d'après `TYPES_PERMIS` (`typesExpliquesParGenre`). Ces textes entrent dans la
 * description de proposer_flux, envoyée au modèle à chaque échange : ils restent courts.
 */
export const SENS_DES_TYPES: Record<FinancialFlow["type"], string> = {
  ca_services: "chiffre d'affaires HT de prestations de services",
  ca_vente: "chiffre d'affaires HT de ventes de marchandises",
  deductible_expense: "charge déductible HT : loyer, matériel, sous-traitance…",
  director_remuneration: "rémunération nette du dirigeant, exige une relation Président ou Gérant",
  dividends_payment: "dividendes bruts, exigent une relation Président, Gérant ou Associé",
  ca_micro_services_bic: "chiffre d'affaires de prestations commerciales ou artisanales, BIC",
  ca_micro_services_bnc: "chiffre d'affaires de prestations libérales, BNC",
  ca_micro_vente: "chiffre d'affaires de ventes de marchandises, restauration, hébergement",
  salary: "salaire net avant impôt, brut facultatif",
  are: "allocation chômage",
  other_taxable_income: "autre revenu net imposable, ajouté tel quel au barème, sans l'abattement de 10 %",
  expense: "dépense non déductible, TVA comprise : personnelle, ou charge d'une micro-entreprise comme un loyer ; réduit le net encaissé, pas les cotisations ni l'impôt",
  income: "type réservé aux tests"
}

/** Types de flux que porte chaque genre d'acteur. */
export const TYPES_PERMIS: Record<GenreDActeur, readonly TypeDeFlux[]> = {
  personne: ["salary", "are", "other_taxable_income", "expense"],
  SASU: ["ca_services", "ca_vente", "deductible_expense", "director_remuneration", "dividends_payment"],
  EURL: ["ca_services", "ca_vente", "deductible_expense", "director_remuneration", "dividends_payment"],
  EI: ["ca_services", "ca_vente", "deductible_expense"],
  "micro-entreprise": ["ca_micro_services_bic", "ca_micro_services_bnc", "ca_micro_vente", "expense"]
}

/**
 * Les types de flux permis à chaque genre d'acteur, ceux qui ont les mêmes réunis, chaque type expliqué la première
 * fois qu'il paraît : « personne : salary (salaire net…), … ; SASU, EURL : ca_services (…), … ; EI : ca_services, … ».
 */
export function typesExpliquesParGenre(): string {
  const groupes = new Map<string, GenreDActeur[]>()
  for (const genre of GENRES_D_ACTEUR) {
    const cle = TYPES_PERMIS[genre].join()
    groupes.set(cle, [...(groupes.get(cle) ?? []), genre])
  }
  const expliques = new Set<TypeDeFlux>()
  const type = (t: TypeDeFlux) => (expliques.has(t) ? t : (expliques.add(t), `${t} (${SENS_DES_TYPES[t]})`))
  return [...groupes.values()].map(genres => `${genres.join(", ")} : ${TYPES_PERMIS[genres[0]].map(type).join(", ")}`).join(". ")
}

/** Flux qu'une activité ne verse qu'à une personne reliée par l'une de ces relations. */
export const RELATIONS_REQUISES: Partial<Record<TypeDeFlux, Relationship["type"][]>> = {
  director_remuneration: ["Président", "Gérant"],
  dividends_payment: ["Président", "Gérant", "Associé"]
}

export function verifierTypePermis(acteur: Entity, typeFlux: TypeDeFlux): void {
  const permis = TYPES_PERMIS[genreDe(acteur)]
  if (!permis.includes(typeFlux)) {
    throw new ErreurOutil(`Le type de flux « ${typeFlux} » ne convient pas à « ${acteur.name} » (${genreDe(acteur)}). Types possibles : ${permis.join(", ")}.`)
  }
}

// ===================================================================================
// == RELATIONS
// ===================================================================================

export const TYPES_DE_RELATION_FAMILIALE: Relationship["type"][] = ["Marié(e)", "PACSé(e)", "En couple", "Enfant"]
const DIRECTION: Relationship["type"][] = ["Président", "Gérant", "Titulaire"]

/** Relations possibles d'une personne vers une activité, selon le statut de l'activité. */
const RELATIONS_VERS_UNE_ACTIVITE: Record<Exclude<GenreDActeur, "personne">, Relationship["type"][]> = {
  SASU: ["Président", "Associé", "Salarié"],
  EURL: ["Gérant", "Associé", "Salarié"],
  EI: ["Titulaire", "Salarié"],
  "micro-entreprise": ["Titulaire"]
}

/** Ce que dit une relation, en français : « Camille est titulaire de Atelier ». */
export function phraseDeLaRelation(session: Pick<SessionState, "entities">, relation: Relationship): string {
  const de = nomDe(session, relation.fromId)
  const vers = nomDe(session, relation.toId)
  if (relation.type === "Enfant") return `${vers} est l'enfant à charge de ${de}`
  if (TYPES_DE_RELATION_FAMILIALE.includes(relation.type)) return `${de} et ${vers} : ${relation.type}`
  return `${de} — ${relation.type} — ${vers}`
}

/**
 * Vérifie qu'une relation peut être créée, avec les règles de la fenêtre des relations : un seul lien familial entre
 * deux personnes ; d'une personne vers une activité, les relations de son statut ; jamais entre deux activités ;
 * on ne dirige pas une activité dont on est salarié, et inversement.
 */
export function verifierNouvelleRelation(session: Pick<SessionState, "entities" | "relationships">, deId: string, versId: string, type: Relationship["type"]): void {
  const de = trouverActeur(session, deId)
  const vers = trouverActeur(session, versId)
  if (deId === versId) throw new ErreurOutil("Une relation relie deux acteurs différents.")
  const existantes = session.relationships.filter(r => (r.fromId === deId && r.toId === versId) || (r.fromId === versId && r.toId === deId)).map(r => r.type)
  if (existantes.includes(type)) throw new ErreurOutil(`La relation « ${type} » existe déjà entre « ${de.name} » et « ${vers.name} ».`)

  if (de.type === "person" && vers.type === "person") {
    if (!TYPES_DE_RELATION_FAMILIALE.includes(type)) throw new ErreurOutil(`Entre deux personnes, seules ces relations existent : ${TYPES_DE_RELATION_FAMILIALE.join(", ")}.`)
    if (existantes.length > 0) throw new ErreurOutil(`« ${de.name} » et « ${vers.name} » ont déjà un lien familial (${existantes.join(", ")}) : un seul est possible.`)
    return
  }
  if (de.type !== "person") throw new ErreurOutil("Une relation part d'une personne : « deId » est la personne (le parent pour « Enfant »), « versId » la personne ou l'activité.")

  const possibles = RELATIONS_VERS_UNE_ACTIVITE[genreDe(vers) as Exclude<GenreDActeur, "personne">]
  if (!possibles.includes(type)) throw new ErreurOutil(`Relations possibles d'une personne vers « ${vers.name} » (${genreDe(vers)}) : ${possibles.join(", ")}.`)
  if (type === "Salarié" && existantes.some(t => DIRECTION.includes(t))) throw new ErreurOutil(`« ${de.name} » dirige déjà « ${vers.name} » : pas de relation « Salarié » en plus.`)
  if (DIRECTION.includes(type) && existantes.includes("Salarié")) throw new ErreurOutil(`« ${de.name} » est déjà salarié(e) de « ${vers.name} » : pas de relation de direction en plus.`)
}

// ===================================================================================
// == EMPREINTE
// ===================================================================================

/** JSON aux clés triées : deux sessions égales ont le même texte, quel que soit l'ordre de construction des objets. */
function jsonCanonique(valeur: unknown): string {
  if (Array.isArray(valeur)) return `[${valeur.map(jsonCanonique).join(",")}]`
  if (valeur !== null && typeof valeur === "object") {
    const entrees = Object.entries(valeur as Record<string, unknown>).filter(([, v]) => v !== undefined)
    return `{${entrees
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([cle, v]) => `${JSON.stringify(cle)}:${jsonCanonique(v)}`)
      .join(",")}}`
  }
  return JSON.stringify(valeur) ?? "null"
}

/** Hachage FNV-1a sur 32 bits, en hexadécimal. Sert à repérer un changement, pas à protéger un secret. */
function fnv1a(texte: string, graine: number): string {
  let hash = graine
  for (let i = 0; i < texte.length; i++) {
    hash ^= texte.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

/** Empreinte d'une valeur : deux hachages de son JSON canonique, 16 caractères hexadécimaux. */
export function empreinte(valeur: unknown): string {
  const texte = jsonCanonique(valeur)
  return fnv1a(texte, 0x811c9dc5) + fnv1a(texte, 0x050c5d1f)
}

/**
 * Empreinte du contenu d'une session : nom, acteurs, relations, années et réglages du comparateur. Une proposition la
 * porte ; si la session a changé depuis (autre modification, annulation), la proposition est refusée.
 */
export function empreinteDeLaSession(session: SessionState): string {
  const { name, entities, relationships, annees, comparateur } = session
  return empreinte({ name, entities, relationships, annees, comparateur })
}
