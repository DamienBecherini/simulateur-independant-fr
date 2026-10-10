// src/lib/export-commun.ts
// Briques partagées par les exports CSV et Markdown : noms de fichiers, nature des acteurs, flux regroupés par acteur.

import type { Entity, FinancialFlow, FoyerFiscalResult, FraisProfessionnelsResult, PuissanceFiscale, SimulationAnnuelle, SimulationPluriannuelle, SimulationReport, VersementLiberatoireInfo } from "@/types"
import { flowTypeLabels, libelleDuType, isOutgoingFlowType, type FlowType } from "./flow-constants"
import { libelleDuMois, lireMois } from "@/backend/logic/dispositifs"
import { pourcent } from "@/backend/logic/format"
import { LIBELLES_DES_STATUTS } from "@/backend/logic/statuts"
import { lectureDesReserves, type LectureDesReserves } from "./reserves"

/** Mois de création d'une activité en toutes lettres (« septembre 2026 ») ; `null` pour une personne ou sans date. */
export function dateDeCreationLisible(entity: Entity): string | null {
  const mois = entity.type === "person" ? null : lireMois(entity.dateDeCreation)
  return mois ? libelleDuMois(mois) : null
}

export const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

/** Texte réduit à des lettres minuscules sans accent, des chiffres et des tirets, pour un nom de fichier. */
export function slugifier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "")
}

/**
 * Nom de fichier d'un export : le nom de la simulation, ce que contient le fichier et, si on la donne, l'année des
 * règles fiscales (omise quand le nom de la simulation la contient déjà). Ex. « famille-martin-grille-2026.csv ».
 */
export function nomDeFichier(nomSimulation: string, contenu: string, extension: string, annee?: number): string {
  const base = slugifier(nomSimulation) || "simulation"
  const avecAnnee = annee !== undefined && !base.split("-").includes(String(annee))
  return `${base}-${contenu}${avecAnnee ? `-${annee}` : ""}.${extension}`
}

/** Nature d'un acteur, telle que l'affiche l'application : « Personne », « SASU », « EI au réel »… */
export function natureActeur(entity: Entity): string {
  if (entity.type === "person") return "Personne"
  if (entity.type === "micro-entreprise") return "Micro-entreprise"
  return LIBELLES_DES_STATUTS[entity.legalStatus]
}

/** Les flux d'un même type pour un acteur : montants des douze mois et total de l'année. */
export interface LigneDeFlux {
  type: FlowType
  libelle: string
  /** Sortie d'argent du point de vue de l'acteur (dépense, rémunération ou dividendes versés). */
  sortie: boolean
  mois: number[]
  total: number
}

export interface FluxDUnActeur {
  entity: Entity
  lignes: LigneDeFlux[]
}

const ORDRE_DES_TYPES = Object.keys(flowTypeLabels) as FlowType[]

function lignesDeLActeur(entityId: string, typeActeur: Entity["type"], fluxParMois: FinancialFlow[][]): LigneDeFlux[] {
  return ORDRE_DES_TYPES.flatMap(type => {
    const mois = fluxParMois.map(flows => flows.filter(f => f.entityId === entityId && f.type === type).reduce((somme, f) => somme + f.amount, 0))
    const present = fluxParMois.some(flows => flows.some(f => f.entityId === entityId && f.type === type))
    if (!present) return []
    return [{ type, libelle: libelleDuType(type, typeActeur), sortie: isOutgoingFlowType(type), mois, total: mois.reduce((a, b) => a + b, 0) }]
  })
}

/** Flux de la grille, regroupés par acteur (dans l'ordre des acteurs) puis par type ; les acteurs sans flux sont omis. */
export function fluxParActeur(session: SimulationAnnuelle): FluxDUnActeur[] {
  const fluxParMois = Array.from({ length: 12 }, (_, i) => session.monthlyData.find(m => m.month === i)?.flows ?? [])
  return session.entities.map(entity => ({ entity, lignes: lignesDeLActeur(entity.id, entity.type, fluxParMois) })).filter(acteur => acteur.lignes.length > 0)
}

/** Nom d'un acteur d'après son identifiant, ou l'identifiant lui-même s'il n'existe plus. */
export function nomDeLActeur(session: SimulationAnnuelle, id: string): string {
  return session.entities.find(e => e.id === id)?.name ?? id
}

/** Nom d'un foyer fiscal : ses membres, déclarants puis enfants. */
export function nomDuFoyer(session: SimulationAnnuelle, foyer: FoyerFiscalResult): string {
  return foyer.personIds.map(id => nomDeLActeur(session, id)).join(", ")
}

// --- Frais au barème kilométrique ---

const LIBELLES_PUISSANCE: Record<PuissanceFiscale, string> = { "3": "3 CV et moins", "4": "4 CV", "5": "5 CV", "6": "6 CV", "7": "7 CV et plus" }

/** Puissance fiscale en clair : « 3 CV et moins », « 5 CV »… */
export const libellePuissance = (puissanceFiscale: PuissanceFiscale) => LIBELLES_PUISSANCE[puissanceFiscale]

/** Voiture du barème kilométrique en clair : « 5 CV », « 7 CV et plus, électrique ». */
export function libelleVoiture({ puissanceFiscale, electrique }: { puissanceFiscale: PuissanceFiscale; electrique: boolean }): string {
  return `${libellePuissance(puissanceFiscale)}${electrique ? ", électrique" : ""}`
}

/** Les frais réels d'une personne dans les résultats, avec son nom. */
export interface FraisDUnePersonne {
  name: string
  frais: FraisProfessionnelsResult
}

/** Personnes qui ont saisi des frais réels et perçoivent des revenus imposés comme des salaires, avec leur déduction. */
export function fraisProfessionnelsDesPersonnes(report: SimulationReport): FraisDUnePersonne[] {
  return report.persons.flatMap(p => (p.fraisProfessionnels ? [{ name: p.name, frais: p.fraisProfessionnels }] : []))
}

/** « Déduction de 10 % », au taux de l'année du résultat. */
export const libelleDeduction = (frais: Pick<FraisProfessionnelsResult, "tauxDeductionForfaitaire">) => `Déduction de ${pourcent(frais.tauxDeductionForfaitaire)}`

export const libelleRetenue = (frais: FraisProfessionnelsResult) => (frais.retenue === "reels" ? "Frais réels" : libelleDeduction(frais))

// --- Versement libératoire ---

/** D'où vient le revenu fiscal de référence N-2 comparé au seuil du versement libératoire. */
export function origineDuRfr(info: VersementLiberatoireInfo): string {
  if (info.origineRfr === "calcule") return "calculé par la simulation"
  return info.origineRfr === "saisi" ? "saisi dans la fiche" : "inconnu"
}

/** Ce que donne la comparaison au seuil : accès ou non au versement libératoire, et s'il est appliqué. */
export function issueDuVersementLiberatoire(info: VersementLiberatoireInfo): string {
  if (info.eligible === null) return "revenu fiscal de référence inconnu"
  if (!info.eligible) return "seuil dépassé, versement libératoire inaccessible"
  return info.applique ? "sous le seuil, versement libératoire appliqué" : "sous le seuil, versement libératoire non appliqué"
}

// --- Toutes les années ---

/** Revenu fiscal de référence de chaque foyer, année par année : une ligne par année et par foyer calculés. */
export function rfrDesAnnees(session: SimulationAnnuelle, simulation: SimulationPluriannuelle): { annee: number; foyer: string; rfr: number }[] {
  return simulation.annees.flatMap(({ annee, report }) => (report?.foyers ?? []).map(f => ({ annee, foyer: nomDuFoyer(session, f), rfr: f.revenuFiscalDeReference })))
}

/** Réserves des sociétés à l'IS de l'année, quand il y a quelque chose à en dire (voir l'ADR 014). */
export function reservesDeLAnnee(report: SimulationReport): { activite: string; lecture: LectureDesReserves }[] {
  return report.activities.flatMap(a => {
    const lecture = lectureDesReserves(a)
    return lecture?.aSignaler ? [{ activite: a.name, lecture }] : []
  })
}

/** Réserves des sociétés à l'IS au 31 décembre, année par année et société par société. */
export function reservesDesAnnees(simulation: SimulationPluriannuelle): { annee: number; activite: string; lecture: LectureDesReserves }[] {
  return simulation.annees.flatMap(({ annee, report }) => (report ? reservesDeLAnnee(report).map(r => ({ annee, ...r })) : []))
}

/** Dispositifs limités dans le temps, année par année et activité par activité. */
export function dispositifsDesAnnees(simulation: SimulationPluriannuelle): { annee: number; activite: string; note: string }[] {
  return simulation.annees.flatMap(({ annee, report }) => (report?.activities ?? []).flatMap(a => (a.dispositifs ?? []).map(note => ({ annee, activite: a.name, note }))))
}
