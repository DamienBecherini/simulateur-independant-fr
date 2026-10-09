// src/backend/logic/cotisations-liberales.ts

import type { CaisseLiberale, CotisationTNS, DetailCaisseLiberale } from "../../types.js"
import { parTranches, progressive } from "./baremes.js"
import type { BaremeInvaliditeDecesLiberal, ProfessionReglementee, ReglesLiberauxReglementes, TrancheCotisation } from "./regles.js"

/*
 * Cotisations d'une profession libérale réglementée dont le simulateur connaît la caisse (voir l'ADR 015 et le dossier
 * documentation/recherche/caisses-des-liberaux.md). Sur la même assiette que les autres travailleurs non salariés :
 *   - l'Urssaf recouvre la maladie (barème des libéraux), les allocations familiales, la CSG-CRDS et la formation
 *     professionnelle (ces trois dernières sont celles du bloc TNS, calculées par cotisationsTNS.ts) ;
 *   - les indemnités journalières et la retraite de base suivent les règles communes de la CNAVPL ;
 *   - la retraite complémentaire et l'invalidité-décès suivent le barème de la caisse ;
 *   - un auxiliaire médical doit en plus la CURPS et, conventionné, l'ASV ; l'Assurance maladie prend alors en charge
 *     une partie de sa maladie et de son ASV, sur la seule part conventionnée de ses revenus.
 * La CARPIMKO appelle la complémentaire et l'ASV sur le revenu de l'année précédente : quand cette année est dans la
 * session, son assiette est donnée (`anneePrecedente`) ; sinon, celle de l'année simulée la remplace.
 */

/** Ce qu'il faut savoir d'une activité pour calculer les cotisations de sa caisse. */
export interface ParametresDeLaCaisse {
  caisse: CaisseLiberale
  profession: ProfessionReglementee
  regles: ReglesLiberauxReglementes
  /** Part des revenus conventionnés, nets de dépassements (0 à 1 ; 0 si la profession ne peut pas être conventionnée). */
  partConventionnee: number
  /** Année simulée. */
  annee: number
  /** CARPIMKO : assiette de l'année précédente, quand elle est dans la session. */
  anneePrecedente?: { annee: number; assiette: number }
}

/** Les lignes que la caisse change, ce qu'elle ajoute, et le supplément dû aux assiettes minimales. */
export interface CotisationsDeLaCaisse {
  lignes: Pick<Record<CotisationTNS, number>, "maladieMaternite" | "indemnitesJournalieres" | "retraiteDeBase" | "retraiteComplementaire" | "invaliditeDeces">
  detail: DetailCaisseLiberale
  supplementMinimum: number
  minimumRetraiteApplique: boolean
}

/** Invalidité-décès d'une caisse : forfait, plus le taux sur l'assiette ramenée entre son minimum et son plafond. */
export function invaliditeDecesLiberale(assiette: number, bareme: BaremeInvaliditeDecesLiberal, pass: number): number {
  const retenue = Math.min(Math.max(assiette, bareme.assietteMinimalePartDuPlafond * pass), bareme.plafondPartDuPlafond * pass)
  return bareme.forfait + bareme.taux * retenue
}

/** Retraite complémentaire de la CARPIMKO : forfait, plus le taux sur l'assiette bornée, au-delà du seuil. */
export function complementaireCarpimko(assiette: number, bareme: ReglesLiberauxReglementes["CARPIMKO"]["retraiteComplementaire"]): number {
  const retenue = Math.min(Math.max(assiette, bareme.assietteMinimale), bareme.plafond)
  return bareme.forfait + bareme.taux * Math.max(0, retenue - bareme.seuil)
}

/** CURPS : un taux de l'assiette, plafonné à une part du plafond de la sécurité sociale. */
export function curps(assiette: number, regles: ReglesLiberauxReglementes["commun"]["curps"], pass: number): number {
  return Math.min(assiette * regles.taux, regles.plafondPartDuPlafond * pass)
}

/** ASV d'un auxiliaire médical : rien sans revenus conventionnés ; sinon forfait et taux, pour le praticien et la CPAM. */
export function asv(revenusConventionnes: number, partConventionnee: number, regles: ReglesLiberauxReglementes["CARPIMKO"]["asv"], pass: number): { praticien: number; assuranceMaladie: number } {
  if (partConventionnee <= 0) return { praticien: 0, assuranceMaladie: 0 }
  const base = Math.min(Math.max(0, revenusConventionnes), regles.plafondPartDuPlafond * pass)
  return { praticien: regles.forfaitPraticien + regles.tauxPraticien * base, assuranceMaladie: regles.forfaitAssuranceMaladie + regles.tauxAssuranceMaladie * base }
}

/**
 * Maladie d'un auxiliaire médical : le taux du barème vaut pour toute l'assiette. Sur la part conventionnée,
 * l'Assurance maladie prend tout en charge sauf 0,10 point (sans dépasser la cotisation) ; sur le reste, le barème est
 * majoré de 3,25 points.
 */
export function maladieAuxiliaire(assiette: number, maladieAuBareme: number, partConventionnee: number, regles: ReglesLiberauxReglementes["CARPIMKO"]["priseEnChargeMaladie"]): { praticien: number; priseEnCharge: number } {
  const surConventionnes = maladieAuBareme * partConventionnee
  const resteConventionnes = Math.min(surConventionnes, regles.resteALaChargeDuPraticien * assiette * partConventionnee)
  const horsConvention = (maladieAuBareme + regles.majorationHorsConvention * assiette) * (1 - partConventionnee)
  return { praticien: resteConventionnes + horsConvention, priseEnCharge: surConventionnes - resteConventionnes }
}

/** Ce que le calcul propre à une caisse reçoit : l'assiette de l'année et ce que la caisse peut en faire. */
interface EntreesDeLaCaisse {
  assiette: number
  pass: number
  /** Maladie au barème des libéraux, avant toute prise en charge. */
  maladieAuBareme: number
  partConventionnee: number
  annee: number
  anneePrecedente?: { annee: number; assiette: number }
}

/** Ce que chaque caisse calcule à sa façon : maladie restant due, retraite complémentaire, ASV et prise en charge. */
type PartDeLaCaisse = Pick<CotisationsDeLaCaisse["lignes"], "maladieMaternite" | "retraiteComplementaire"> & Pick<DetailCaisseLiberale, "asv" | "priseEnCharge" | "baseDesCotisationsDeLAnneePrecedente">

/** Le calcul d'une caisse, à partir de son bloc des règles de l'année. */
type CalculDeLaCaisse<C extends CaisseLiberale> = (bareme: ReglesLiberauxReglementes[C], entrees: EntreesDeLaCaisse) => PartDeLaCaisse

/**
 * Le calcul propre à chaque caisse, une entrée par caisse de `CAISSES_LIBERALES` : le compilateur refuse une caisse
 * ajoutée à la liste sans son entrée (ni le bloc de ses règles, que l'entrée lit). Il n'y a pas de cas « par défaut » :
 * une nouvelle caisse ne peut pas être calculée comme une autre par oubli.
 */
export const CALCUL_PAR_CAISSE: { [C in CaisseLiberale]: CalculDeLaCaisse<C> } = {
  CIPAV: (cipav, { assiette, pass, maladieAuBareme }) => ({
    maladieMaternite: maladieAuBareme,
    retraiteComplementaire: parTranches(assiette, cipav.retraiteComplementaire.tranches, pass),
    asv: 0,
    priseEnCharge: { maladie: 0, asv: 0 }
  }),
  // Complémentaire et ASV sur l'assiette de l'année précédente quand elle est connue.
  CARPIMKO: (carpimko, { assiette, pass, maladieAuBareme, partConventionnee, annee, anneePrecedente }) => {
    const base = anneePrecedente ?? { annee, assiette }
    const maladie = maladieAuxiliaire(assiette, maladieAuBareme, partConventionnee, carpimko.priseEnChargeMaladie)
    const avantage = asv(base.assiette * partConventionnee, partConventionnee, carpimko.asv, pass)
    return {
      maladieMaternite: maladie.praticien,
      retraiteComplementaire: complementaireCarpimko(base.assiette, carpimko.retraiteComplementaire),
      asv: avantage.praticien,
      priseEnCharge: { maladie: maladie.priseEnCharge, asv: avantage.assuranceMaladie },
      baseDesCotisationsDeLAnneePrecedente: { annee: base.annee, assiette: base.assiette, anneePrecedenteConnue: anneePrecedente !== undefined }
    }
  }
}

/** Le calcul de la caisse `caisse`, avec son bloc des règles : le type relie l'un à l'autre, sans conversion. */
function partDeLaCaisse<C extends CaisseLiberale>(caisse: C, regles: ReglesLiberauxReglementes, entrees: EntreesDeLaCaisse): PartDeLaCaisse {
  const calcul: CalculDeLaCaisse<C> = CALCUL_PAR_CAISSE[caisse]
  return calcul(regles[caisse], entrees)
}

/** Les cotisations propres à la caisse d'une profession libérale réglementée, sur l'assiette de l'année. */
export function cotisationsDeLaCaisse(assiette: number, pass: number, p: ParametresDeLaCaisse): CotisationsDeLaCaisse {
  const { commun } = p.regles
  const minimales = commun.cotisationsMinimales
  const avecMinimum = (minimum: number, tranches: TrancheCotisation[]) => parTranches(Math.max(assiette, minimum), tranches, pass)
  const indemnitesJournalieres = avecMinimum(minimales.indemnitesJournalieres, commun.indemnitesJournalieres.tranches)
  const retraiteDeBase = avecMinimum(minimales.retraiteDeBase, commun.retraiteDeBase.tranches)
  const maladieAuBareme = progressive(assiette, commun.maladieMaternite, pass)
  const bareme = p.regles[p.caisse].invaliditeDeces
  const invaliditeDeces = invaliditeDecesLiberale(assiette, bareme, pass)
  const surAssietteReelle = parTranches(assiette, commun.indemnitesJournalieres.tranches, pass) + parTranches(assiette, commun.retraiteDeBase.tranches, pass) + invaliditeDecesLiberale(assiette, { ...bareme, assietteMinimalePartDuPlafond: 0 }, pass)
  const { maladieMaternite, retraiteComplementaire, ...propre } = partDeLaCaisse(p.caisse, p.regles, { assiette, pass, maladieAuBareme, partConventionnee: p.partConventionnee, annee: p.annee, anneePrecedente: p.anneePrecedente })
  return {
    lignes: { maladieMaternite, indemnitesJournalieres, retraiteDeBase, retraiteComplementaire, invaliditeDeces },
    detail: { caisse: p.caisse, profession: p.profession.id, libelleProfession: p.profession.libelle, partConventionnee: p.partConventionnee, curps: p.profession.curps ? curps(assiette, commun.curps, pass) : 0, ...propre },
    supplementMinimum: indemnitesJournalieres + retraiteDeBase + invaliditeDeces - surAssietteReelle,
    minimumRetraiteApplique: assiette < minimales.retraiteDeBase
  }
}
