// src/lib/montages/construction.ts
// Petites fabriques pour décrire un montage type en quelques lignes : acteurs, relations et grille d'une année.

import type { Comparateur, Company, FinancialFlow, MicroEntreprise, Person, Relationship, SessionState } from "@/types"

/** Année des montages types : celle dont les règles ont servi à figer leurs chiffres de référence. */
export const ANNEE_DES_MONTAGES = 2026

/** Couleurs des pastilles, prises dans la palette des réglages d'un acteur (voir entity-factory.ts). */
const COULEURS = { personne: "#3b82f6", conjoint: "#16a34a", SASU: "#b91c1c", EURL: "#16a34a", EI: "#7e22ce", micro: "#d97706" } as const
const ICONES = { SASU: "Briefcase", EURL: "Building", EI: "User" } as const

/** Une personne, ses initiales tirées de son prénom ; `conjoint` change la couleur de sa pastille. */
export function personne(id: string, prenom: string, conjoint = false): Person {
  return { id, type: "person", name: prenom, fiscalParts: 1, avatar: { type: "initials", value: prenom.slice(0, 2).toUpperCase(), color: conjoint ? COULEURS.conjoint : COULEURS.personne }, locked: false }
}

export function microEntreprise(id: string, name: string, options: Pick<MicroEntreprise, "opteVFL"> & Partial<Pick<MicroEntreprise, "rfrN2">>): MicroEntreprise {
  return { id, type: "micro-entreprise", name, beneficieACRE: false, ...options, avatar: { type: "icon", value: "Store", color: COULEURS.micro }, locked: false }
}

export function societe(id: string, name: string, legalStatus: Company["legalStatus"], capitalSocial: number): Company {
  return { id, type: "company", name, legalStatus, capitalSocial, avatar: { type: "icon", value: ICONES[legalStatus], color: COULEURS[legalStatus] }, locked: false }
}

export function relation(fromId: string, toId: string, type: Relationship["type"]): Relationship {
  return { id: `rel-${fromId}-${toId}`, fromId, toId, type }
}

/** Un flux de la grille, sans son identifiant : il est saisi chaque mois, ou un seul mois (`mois`, de 0 à 11). */
export interface FluxDuMontage {
  entityId: string
  type: FinancialFlow["type"]
  amount: number
  label: string
  /** Salaire brut mensuel, pour un salaire seulement. */
  grossAmount?: number
  /** Mois du flux ponctuel ; absent, le flux revient chaque mois. */
  mois?: number
}

function fluxDuMois(flux: FluxDuMontage, mois: number): FinancialFlow {
  const { entityId, type, amount, label, grossAmount } = flux
  return { id: `${entityId}-${type}-${mois}`, label, amount, entityId, type, ...(grossAmount === undefined ? {} : { grossAmount }) }
}

/** Ce qui décrit la session d'un montage : ses acteurs, leurs relations, les flux de l'année et, si besoin, le comparateur. */
export interface ContenuDuMontage {
  entities: SessionState["entities"]
  relationships: Relationship[]
  flux: FluxDuMontage[]
  comparateur?: Comparateur
}

/** La session d'un montage : une seule année, nommée d'après le montage. */
export function sessionDuMontage(name: string, { entities, relationships, flux, comparateur }: ContenuDuMontage): SessionState {
  const monthlyData = Array.from({ length: 12 }, (_, month) => ({
    month,
    flows: flux.filter(f => f.mois === undefined || f.mois === month).map(f => fluxDuMois(f, month))
  }))
  return { name, entities, relationships, annees: [{ annee: ANNEE_DES_MONTAGES, monthlyData }], ...(comparateur ? { comparateur } : {}) }
}

/** Le comparateur ouvert sur une activité, au meilleur net : avec ou sans l'exigence de 4 trimestres de retraite. */
export function comparateurAuMeilleurNet(activityId: string, avecRetraite: boolean): Comparateur {
  return { activiteComparee: activityId, reglagesParActivite: { [activityId]: { repartition: { mode: "meilleurNet", partDistribuee: 1, avecRetraite } } } }
}
