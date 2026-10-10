// src/lib/detail-des-cotisations.ts
// Le détail des cotisations sociales d'une activité, ligne à ligne, pour rapprocher le total d'un appel de l'Urssaf :
// toutes les lignes que le moteur calcule, arrondies à l'euro de façon que leur somme soit exactement le total affiché.

import { euros, pourcent } from "@/backend/logic/format"
import type { ActivityResult, CotisationSalarie, CotisationTNS, DetailCotisationsSalarie, DetailCotisationsTNS } from "@/types"
import { lignesDeLaCaisse } from "./professions"

/** Une ligne du détail : « dont … », son montant et ce qui le précise (taux, assiette, prise en charge…). */
export interface LigneDuDetail {
  libelle: string
  montant: number
  precision: string | null
}

// --- Travailleur non salarié (entreprise individuelle au réel, gérant d'EURL) ---

/** Les lignes du bloc des travailleurs non salariés, dans l'ordre d'un appel de cotisations. */
const LIBELLES_TNS: Record<CotisationTNS, string> = {
  maladieMaternite: "dont maladie-maternité",
  indemnitesJournalieres: "dont indemnités journalières",
  retraiteDeBase: "dont retraite de base",
  retraiteComplementaire: "dont retraite complémentaire",
  invaliditeDeces: "dont invalidité-décès",
  allocationsFamiliales: "dont allocations familiales",
  csgDeductible: "dont CSG déductible",
  csgNonDeductibleEtCrds: "dont CSG non déductible et CRDS",
  formationProfessionnelle: "dont formation professionnelle"
}

/** La formation professionnelle est un forfait sur le plafond de la sécurité sociale, pas un taux de l'assiette. */
const PRECISION_DE_LA_FORMATION = "forfait annuel, dû même sans revenu"

/** Le taux effectif d'une ligne sur l'assiette : il se compare au taux d'un appel de l'Urssaf. */
function tauxSurLAssiette(montant: number, assiette: number): string | null {
  return assiette > 0 && montant > 0 ? `${pourcent(montant / assiette)} de l'assiette` : null
}

/** La ligne est calculée sur l'assiette de l'année : pas la complémentaire de la CARPIMKO, sur le revenu précédent. */
function surLAssietteDeLAnnee(tns: DetailCotisationsTNS, cle: CotisationTNS): boolean {
  return !(cle === "retraiteComplementaire" && tns.caisse?.baseDesCotisationsDeLAnneePrecedente)
}

/**
 * Les cotisations d'un travailleur non salarié : chaque ligne du bloc commun, avec le libellé et la précision de la
 * caisse quand une profession libérale réglementée la change, puis ce que la caisse ajoute (ASV, CURPS).
 */
function lignesDuTravailleurNonSalarie(tns: DetailCotisationsTNS): LigneDuDetail[] {
  const deLaCaisse = lignesDeLaCaisse(tns, euros)
  const communes = (Object.keys(LIBELLES_TNS) as CotisationTNS[]).map(cle => {
    const ligne = deLaCaisse.find(l => l.cle === cle) ?? { libelle: LIBELLES_TNS[cle], montant: tns.cotisations[cle], precision: null }
    const taux = cle === "formationProfessionnelle" ? PRECISION_DE_LA_FORMATION : surLAssietteDeLAnnee(tns, cle) ? tauxSurLAssiette(ligne.montant, tns.assiette) : null
    return { libelle: ligne.libelle, montant: ligne.montant, precision: [taux, ligne.precision].filter(Boolean).join(" ; ") || null }
  })
  const enPlus = deLaCaisse.filter(l => l.cle === undefined).map(({ libelle, montant, precision }) => ({ libelle, montant, precision }))
  return [...communes, ...enPlus]
}

// --- Président de SASU (assimilé salarié) ---

type GroupeDuRegimeGeneral = "maladie" | "retraiteDeBase" | "retraiteComplementaire" | "allocationsFamiliales" | "csgCrds" | "autres"

/** Les lignes du bulletin regroupées comme sur un bulletin de paie clarifié : une entrée par cotisation. */
const GROUPE_DU_REGIME_GENERAL: Record<CotisationSalarie, GroupeDuRegimeGeneral> = {
  maladie: "maladie",
  vieillessePlafonnee: "retraiteDeBase",
  vieillesseDeplafonnee: "retraiteDeBase",
  retraiteComplementaire: "retraiteComplementaire",
  contributionEquilibreGeneral: "retraiteComplementaire",
  contributionEquilibreTechnique: "retraiteComplementaire",
  allocationsFamiliales: "allocationsFamiliales",
  csgDeductible: "csgCrds",
  csgNonDeductibleEtCrds: "csgCrds",
  accidentsDuTravail: "autres",
  contributionSolidariteAutonomie: "autres",
  fnal: "autres",
  assuranceChomage: "autres",
  ags: "autres",
  dialogueSocial: "autres",
  formationProfessionnelle: "autres",
  taxeApprentissage: "autres"
}

const LIBELLES_DU_REGIME_GENERAL: Record<GroupeDuRegimeGeneral, { libelle: string; contenu?: string }> = {
  maladie: { libelle: "dont maladie" },
  retraiteDeBase: { libelle: "dont retraite de base" },
  retraiteComplementaire: { libelle: "dont retraite complémentaire (Agirc-Arrco)" },
  allocationsFamiliales: { libelle: "dont allocations familiales" },
  csgCrds: { libelle: "dont CSG et CRDS" },
  autres: { libelle: "dont autres contributions", contenu: "accidents du travail, autonomie, logement, formation, apprentissage, dialogue social" }
}

/** Le bulletin d'un président de SASU, par groupe : la part salariale et la part patronale de chacun. */
function lignesDuPresident(bulletin: DetailCotisationsSalarie): LigneDuDetail[] {
  const groupes = (Object.keys(LIBELLES_DU_REGIME_GENERAL) as GroupeDuRegimeGeneral[]).map(groupe => {
    const cles = (Object.keys(GROUPE_DU_REGIME_GENERAL) as CotisationSalarie[]).filter(cle => GROUPE_DU_REGIME_GENERAL[cle] === groupe)
    const salariale = cles.reduce((somme, cle) => somme + bulletin.cotisations[cle].salariale, 0)
    const patronale = cles.reduce((somme, cle) => somme + bulletin.cotisations[cle].patronale, 0)
    const { libelle, contenu } = LIBELLES_DU_REGIME_GENERAL[groupe]
    const parts = `${euros(salariale)} salariales, ${euros(patronale)} patronales`
    return { libelle, montant: salariale + patronale, precision: contenu ? `${contenu} ; ${parts}` : parts }
  })
  // Le président n'y a pas droit ; la ligne garde le détail exact si un bulletin en portait une.
  const reduction = bulletin.reductionGenerale > 0 ? [{ libelle: "dont réduction générale", montant: -bulletin.reductionGenerale, precision: null }] : []
  return [...groupes, ...reduction]
}

// --- Micro-entreprise ---

/** Une micro-entreprise : les cotisations au pourcentage du chiffre d'affaires, puis la formation professionnelle. */
function lignesDeLaMicro(activite: ActivityResult, patronalesDesSalaries: number): LigneDuDetail[] {
  const formation = activite.formationProfessionnelle ?? 0
  const taux = activite.profession?.tauxMicro === undefined ? "pourcentage du chiffre d'affaires de chaque nature d'activité" : `${pourcent(activite.profession.tauxMicro)} du chiffre d'affaires (${activite.profession.caisse})`
  const acre = activite.acre ? `après ${euros(activite.acre.economie)} de réduction ACRE` : null
  return [
    { libelle: "dont cotisations sociales", montant: activite.cotisationsSociales - formation - patronalesDesSalaries, precision: [taux, acre].filter(Boolean).join(" ; ") },
    { libelle: "dont formation professionnelle", montant: formation, precision: "contribution sur le chiffre d'affaires, non réduite par l'ACRE" }
  ]
}

// --- Salariés de l'activité ---

/** Cotisations patronales des salariés de l'activité, réduction générale déduite : le coût employeur moins le brut. */
function patronalesDesSalaries(activite: ActivityResult): number {
  return (activite.salaries ?? []).reduce((somme, s) => somme + s.coutEmployeur - s.brut, 0)
}

function ligneDesSalaries(activite: ActivityResult): LigneDuDetail[] {
  const salaries = activite.salaries ?? []
  if (salaries.length === 0) return []
  const reduction = salaries.reduce((somme, s) => somme + s.reductionGenerale, 0)
  return [{ libelle: salaries.length > 1 ? "dont cotisations patronales des salariés" : "dont cotisations patronales du salarié", montant: patronalesDesSalaries(activite), precision: reduction >= 0.5 ? `après ${euros(reduction)} de réduction générale` : null }]
}

// --- Assemblage ---

/** Les lignes propres au statut de l'activité ; une micro-entreprise sortie du régime a celles du réel. */
function lignesDuStatut(activite: ActivityResult): LigneDuDetail[] {
  if (activite.cotisationsTNS) return lignesDuTravailleurNonSalarie(activite.cotisationsTNS)
  if (activite.cotisationsPresident) return lignesDuPresident(activite.cotisationsPresident)
  if (activite.type === "micro-entreprise") return lignesDeLaMicro(activite, patronalesDesSalaries(activite))
  return []
}

/** Toutes les lignes, montants non arrondis : leur somme est le total des cotisations sociales de l'activité. */
export function lignesAvantArrondi(activite: ActivityResult): LigneDuDetail[] {
  return [...lignesDuStatut(activite), ...ligneDesSalaries(activite)]
}

/**
 * Arrondit chaque montant à l'euro de façon que la somme soit exactement `total` arrondi (méthode du plus fort reste) :
 * chaque ligne est d'abord arrondie à l'euro inférieur, puis l'écart est donné, un euro à la fois, aux lignes dont la
 * partie décimale est la plus grande (retiré à celles dont elle est la plus petite si l'écart est négatif).
 */
export function arrondiesAuTotal<T extends { montant: number }>(lignes: T[], total: number): T[] {
  if (lignes.length === 0) return []
  const arrondis = lignes.map(l => Math.floor(l.montant))
  const reste = (i: number) => lignes[i].montant - arrondis[i]
  const ordre = lignes.map((_, i) => i).sort((a, b) => reste(b) - reste(a))
  const ecart = Math.round(total) - arrondis.reduce((somme, m) => somme + m, 0)
  for (let k = 0; k < Math.abs(ecart); k++) {
    if (ecart > 0) arrondis[ordre[k % ordre.length]] += 1
    else arrondis[ordre[ordre.length - 1 - (k % ordre.length)]] -= 1
  }
  return lignes.map((l, i) => ({ ...l, montant: arrondis[i] }))
}

/**
 * Le détail des cotisations sociales de l'activité, montants à l'euro dont la somme est exactement le total affiché
 * (`cotisationsSociales`) ; sans les lignes nulles. Vide quand le détail n'apprendrait rien (une seule ligne), et
 * quand les lignes ne rejoignent pas le total à l'arrondi près : mieux vaut aucun détail qu'un détail faux.
 */
export function detailDesCotisations(activite: ActivityResult): LigneDuDetail[] {
  const brutes = lignesAvantArrondi(activite)
  if (Math.abs(brutes.reduce((somme, l) => somme + l.montant, 0) - activite.cotisationsSociales) > 1) return []
  const lignes = arrondiesAuTotal(brutes, activite.cotisationsSociales).filter(l => l.montant !== 0)
  return lignes.length > 1 ? lignes : []
}

/**
 * Ce qui précise le total des cotisations d'un travailleur non salarié : l'assiette, et l'écart possible avec l'appel
 * de l'Urssaf, qui demande d'abord des acomptes provisionnels puis régularise ; `null` pour les autres statuts.
 */
export function precisionDesCotisations(activite: ActivityResult): string | null {
  const tns = activite.cotisationsTNS
  if (!tns) return null
  return `assiette de ${euros(tns.assiette)} (${euros(tns.revenuAvantCotisations)} de revenu avant cotisations, après l'abattement forfaitaire) ; montant définitif de l'année, que l'Urssaf appelle d'abord en acomptes provisionnels puis régularise`
}
