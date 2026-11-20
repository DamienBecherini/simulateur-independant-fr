// src/lib/montages/filtres.ts
// Retrouver une situation type dans la bibliothèque : une recherche par texte, et deux filtres à cocher, le statut de
// l'activité et le foyer. Les deux filtres se déduisent du contenu de la situation (ses acteurs et leurs relations),
// pas d'une étiquette saisie à la main : une situation ajoutée demain est classée d'elle-même, sans risque d'oubli.
//
// Les filtres d'un même axe s'ajoutent (« Micro » et « SASU » : les situations qui ont l'une ou l'autre) ; les deux axes
// et la recherche se combinent (« SASU », « En couple » et « retraite » : les situations qui répondent aux trois).

import type { ContenuDuMontage } from "./construction"
import type { MontageType } from "./montages"

export type StatutDeMontage = "micro" | "SASU" | "EURL" | "EI"
export type FoyerDeMontage = "seul" | "couple"

/** Les filtres proposés, dans l'ordre de leur affichage. */
export const FILTRES_DE_STATUT: { valeur: StatutDeMontage; libelle: string }[] = [
  { valeur: "micro", libelle: "Micro" },
  { valeur: "SASU", libelle: "SASU" },
  { valeur: "EURL", libelle: "EURL" },
  { valeur: "EI", libelle: "Entreprise individuelle" }
]
export const FILTRES_DE_FOYER: { valeur: FoyerDeMontage; libelle: string }[] = [
  { valeur: "seul", libelle: "Seul" },
  { valeur: "couple", libelle: "En couple" }
]

export interface CriteresDesMontages {
  recherche: string
  statuts: StatutDeMontage[]
  foyers: FoyerDeMontage[]
}

export const AUCUN_CRITERE: CriteresDesMontages = { recherche: "", statuts: [], foyers: [] }

/** Vrai dès qu'un critère restreint la liste. */
export function criteresActifs(criteres: CriteresDesMontages): boolean {
  return criteres.recherche.trim() !== "" || criteres.statuts.length > 0 || criteres.foyers.length > 0
}

/** Les statuts des activités d'une situation, sans doublon. */
export function statutsDuContenu(contenu: Pick<ContenuDuMontage, "entities">): StatutDeMontage[] {
  const statuts = new Set<StatutDeMontage>()
  for (const acteur of contenu.entities) {
    if (acteur.type === "micro-entreprise") statuts.add("micro")
    if (acteur.type === "company") statuts.add(acteur.legalStatus)
  }
  return [...statuts]
}

const RELATIONS_DE_COUPLE = new Set(["Marié(e)", "PACSé(e)", "En couple"])

/** En couple dès que deux personnes sont mariées, pacsées ou en union libre ; seul sinon. */
export function foyerDuContenu(contenu: Pick<ContenuDuMontage, "relationships">): FoyerDeMontage {
  return contenu.relationships.some(relation => RELATIONS_DE_COUPLE.has(relation.type)) ? "couple" : "seul"
}

/** Texte en minuscules et sans accent, pour une recherche qui ne dépend ni de la casse ni des accents (« kine » trouve « Kinésithérapeute »). */
export function sansAccent(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/gi, "oe")
    .toLowerCase()
}

interface Fiche {
  statuts: StatutDeMontage[]
  foyer: FoyerDeMontage
  /** Titre, résumé, mots-clés et questions, sans accent. */
  texte: string
}

// Le contenu d'une situation se construit à la demande ; sa fiche de recherche est gardée, une situation ne changeant pas.
const fiches = new Map<string, Fiche>()

function ficheDuMontage(montage: MontageType): Fiche {
  let fiche = fiches.get(montage.id)
  if (!fiche) {
    const contenu = montage.contenu()
    fiche = { statuts: statutsDuContenu(contenu), foyer: foyerDuContenu(contenu), texte: sansAccent([montage.titre, montage.resume, ...montage.etiquettes, ...montage.questions].join(" ")) }
    fiches.set(montage.id, fiche)
  }
  return fiche
}

/** Les situations qui répondent aux critères, dans l'ordre de la bibliothèque. Chaque mot de la recherche doit s'y trouver. */
export function filtrerLesMontages(montages: MontageType[], criteres: CriteresDesMontages): MontageType[] {
  const mots = sansAccent(criteres.recherche).split(/\s+/).filter(Boolean)
  return montages.filter(montage => {
    const fiche = ficheDuMontage(montage)
    if (criteres.statuts.length > 0 && !criteres.statuts.some(statut => fiche.statuts.includes(statut))) return false
    if (criteres.foyers.length > 0 && !criteres.foyers.includes(fiche.foyer)) return false
    return mots.every(mot => fiche.texte.includes(mot))
  })
}
