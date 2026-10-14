// src/backend/logic/simulation-portage.ts
// Activité en portage salarial (voir l'ADR 016) : du chiffre d'affaires facturé par la société de portage au salaire net
// du salarié porté, pas à pas. Frais de gestion mois par mois, frais professionnels remboursés, enveloppe, masse
// salariale qui l'épuise (dichotomie sur le coût employeur), partage entre salaire de base, indemnité d'apport
// d'affaires et réserve, bulletin du salarié porté, mutuelle ; le salaire rejoint ensuite le foyer de son titulaire.

import type { ActivityResult, ConditionsPortageRetenues, DetailCotisationsSalarie, DetailPortage, Portage } from "../../types.js"
import { calculerBulletinDuPorte, reductionGenerale, type BulletinDuPorte } from "./cotisationsSalarie.js"
import { euros } from "./format.js"
import { conditionsPortageRetenues } from "./options-du-comparateur.js"
import type { ReglesFiscales } from "./regles.js"
import { personnesLiees, revenusDe, total, type Contexte } from "./routage-des-flux.js"
import { LIBELLE_DU_PORTAGE } from "./statuts.js"

/** Nombre de divisions de l'intervalle par deux dans la recherche de la masse salariale. */
const ITERATIONS_DICHOTOMIE = 60

/**
 * Frais de gestion d'un mois : le taux appliqué au chiffre d'affaires du mois, ramené entre le plancher et le plafond
 * mensuels, plus les frais fixes, sans dépasser le chiffre d'affaires. Un mois sans chiffre d'affaires n'en a pas : c'est
 * une période sans mission, sans salaire (code du travail, art. L1254-21).
 */
export function fraisDeGestionDuMois(chiffreAffaires: number, conditions: ConditionsPortageRetenues): number {
  if (chiffreAffaires <= 0) return 0
  const proportionnels = Math.min(conditions.plafondMensuel ?? Infinity, Math.max(conditions.plancherMensuel ?? 0, conditions.tauxFraisDeGestion * chiffreAffaires))
  return Math.min(chiffreAffaires, proportionnels + conditions.fraisFixesMensuels)
}

/**
 * Le bulletin du salarié porté selon les règles de l'année et les conditions de sa société : FNAL, formation
 * professionnelle et paramètre de la réduction générale de son effectif, cotisations du cadre, contribution
 * conventionnelle à la formation, effort de construction, versement mobilité (dû à partir de 11 salariés).
 */
export function parametresDuBulletinDuPorte(regles: ReglesFiscales, conditions: ConditionsPortageRetenues): BulletinDuPorte {
  const { regimeGeneral } = regles
  const { cotisationsDuCadre, selonLEffectif } = regles.portageSalarial
  const effectif = selonLEffectif[conditions.effectif]
  const tauxVersementMobilite = effectif.versementMobiliteDu ? conditions.tauxVersementMobilite : 0
  return {
    regimeGeneral: {
      ...regimeGeneral,
      cotisations: { ...regimeGeneral.cotisations, fnal: effectif.fnal, formationProfessionnelle: effectif.formationProfessionnelle },
      reductionGenerale: { ...regimeGeneral.reductionGenerale, tDelta: effectif.tDeltaReductionGenerale }
    },
    cotisationsDuPortage: {
      apec: cotisationsDuCadre.apec,
      prevoyanceCadres: cotisationsDuCadre.prevoyanceCadres,
      formationConventionnelle: effectif.formationConventionnelle,
      effortConstruction: effectif.effortConstruction,
      versementMobilite: { salariale: [], patronale: tauxVersementMobilite > 0 ? [{ jusquA: null, taux: tauxVersementMobilite }] : [] }
    },
    reductionGeneraleReversee: conditions.reductionGeneraleReversee
  }
}

/**
 * Masse salariale brute M que l'enveloppe paie : la plus grande telle que coût employeur(M) ≤ enveloppe, par dichotomie,
 * comme `brutPourUnNet` trouve un brut à partir d'un net. Le coût employeur croît avec le brut, par sauts vers le haut
 * (contribution d'équilibre technique au-delà du plafond, sortie de la réduction générale, arrondi de son coefficient) :
 * une enveloppe qui tombe dans un saut n'est pas payée à l'euro près, et son reliquat reste sur le compte d'activité.
 * M ne dépasse jamais l'enveloppe, puisque le coût employeur est au moins le brut.
 */
export function masseSalarialePourUneEnveloppe(enveloppe: number, porte: BulletinDuPorte): number {
  if (enveloppe <= 0) return 0
  let bas = 0
  let haut = enveloppe
  for (let tour = 0; tour < ITERATIONS_DICHOTOMIE; tour++) {
    const milieu = (bas + haut) / 2
    if (calculerBulletinDuPorte(milieu, porte).coutEmployeur <= enveloppe) bas = milieu
    else haut = milieu
  }
  return bas
}

/** Chiffre d'affaires de prestations de services de chaque mois de l'année. */
function chiffreDAffairesParMois(ctx: Contexte, portageId: string): number[] {
  return ctx.session.monthlyData.map(mois => mois.flows.filter(f => f.entityId === portageId && f.type === "ca_services").reduce((cumul, f) => cumul + f.amount, 0))
}

/** Du chiffre d'affaires à l'enveloppe : frais de gestion mois par mois, frais professionnels remboursés. */
function enveloppeDeLAnnee(ctx: Contexte, portage: Portage, conditions: ConditionsPortageRetenues) {
  const parMois = chiffreDAffairesParMois(ctx, portage.id)
  const chiffreAffaires = parMois.reduce((cumul, montant) => cumul + montant, 0)
  const fraisDeGestion = parMois.reduce((cumul, montant) => cumul + fraisDeGestionDuMois(montant, conditions), 0)
  const fraisProfessionnels = total(ctx, portage.id, "deductible_expense")
  return { chiffreAffaires, fraisDeGestion, fraisProfessionnels, disponible: chiffreAffaires - fraisDeGestion - fraisProfessionnels, moisAvecChiffreDAffaires: parMois.filter(montant => montant > 0).length }
}

/**
 * Partage de la masse salariale et ce qui est versé dans l'année (convention de branche, art. 21) : salaire de base,
 * indemnité d'apport d'affaires et réserve en part du salaire de base. En CDD, l'indemnité de précarité est supposée
 * versée dans l'année ; en CDI, la réserve reste sur le compte d'activité, et ses cotisations sont prises au prorata
 * de la masse salariale, comme si elle était versée au même taux.
 */
function partageDeLaMasseSalariale(masse: number, bulletin: DetailCotisationsSalarie, regles: ReglesFiscales, conditions: ConditionsPortageRetenues, moisAvecSalaire: number) {
  const { indemniteApportDAffaires, reserveFinanciere } = regles.portageSalarial
  const salaireDeBase = masse / (1 + indemniteApportDAffaires.taux + reserveFinanciere.taux)
  const reserve = salaireDeBase * reserveFinanciere.taux
  const brutVerse = conditions.contrat === "CDI" ? masse - reserve : masse
  const partVersee = masse > 0 ? brutVerse / masse : 0
  const netAvantMutuelle = bulletin.net * partVersee
  const mutuelle = Math.min(netAvantMutuelle, conditions.mutuelleMensuelle * moisAvecSalaire)
  return {
    salaireDeBase,
    indemniteApportDAffaires: salaireDeBase * indemniteApportDAffaires.taux,
    reserve,
    brutVerse,
    mutuelle,
    netVerse: netAvantMutuelle - mutuelle,
    // La part salariale de la mutuelle collective obligatoire est déduite du salaire imposable (CGI, art. 83, 1° quater).
    netImposable: netAvantMutuelle - mutuelle + bulletin.partNonDeductible * partVersee,
    reserveConservee: bulletin.net * (1 - partVersee)
  }
}

/** Le calcul pas à pas d'une année, sans rien inscrire sur le compte des personnes. */
function detailDuPortage(ctx: Contexte, portage: Portage): DetailPortage {
  const { conditions, valeursTypiques } = conditionsPortageRetenues(portage.conditions)
  const annee = enveloppeDeLAnnee(ctx, portage, conditions)
  const enveloppe = Math.max(0, annee.disponible)
  const porte = parametresDuBulletinDuPorte(ctx.regles, conditions)
  const masseSalariale = masseSalarialePourUneEnveloppe(enveloppe, porte)
  const bulletin = calculerBulletinDuPorte(masseSalariale, porte)
  const moisAvecSalaire = masseSalariale > 0 ? annee.moisAvecChiffreDAffaires : 0
  const partage = partageDeLaMasseSalariale(masseSalariale, bulletin, ctx.regles, conditions, moisAvecSalaire)
  const reductionGardee = conditions.reductionGeneraleReversee ? 0 : Math.min(bulletin.totalPatronal, reductionGenerale(masseSalariale, porte.regimeGeneral.reductionGenerale))
  return {
    conditions,
    valeursTypiques,
    moisAvecChiffreDAffaires: annee.moisAvecChiffreDAffaires,
    chiffreAffaires: annee.chiffreAffaires,
    fraisDeGestion: annee.fraisDeGestion,
    fraisProfessionnels: annee.fraisProfessionnels,
    enveloppe,
    masseSalariale,
    bulletin,
    ...partage,
    // Négatif quand les frais dépassent le chiffre d'affaires : le compte d'activité est à découvert.
    reliquat: annee.disponible - bulletin.coutEmployeur,
    reductionGeneraleGardee: reductionGardee,
    salaireDeBaseMensuel: moisAvecSalaire > 0 ? partage.salaireDeBase / moisAvecSalaire : 0
  }
}

/** Avertissements du calcul : vente de marchandises, frais au-delà du chiffre d'affaires, minimum conventionnel… */
function avertissementsDuPortage(ctx: Contexte, portage: Portage, detail: DetailPortage): string[] {
  const warnings: string[] = []
  const { minimumConventionnel, selonLEffectif } = ctx.regles.portageSalarial
  if (total(ctx, portage.id, "ca_vente") !== 0) warnings.push("La vente de marchandises n'est pas permise en portage salarial, qui ne porte que sur des prestations de services (code du travail, art. L1254-1) : ce chiffre d'affaires de vente est écarté du calcul.")
  if (detail.chiffreAffaires - detail.fraisDeGestion - detail.fraisProfessionnels < 0) warnings.push("Les frais de gestion et les frais professionnels dépassent le chiffre d'affaires : aucun salaire n'est versé, et le compte d'activité est à découvert.")
  if (detail.salaireDeBaseMensuel > 0 && detail.salaireDeBaseMensuel < minimumConventionnel.mensuel) {
    warnings.push(`Salaire de base de ${euros(detail.salaireDeBaseMensuel)} par mois en moyenne, sous le minimum conventionnel d'un temps plein (${euros(minimumConventionnel.mensuel)} ; ${euros(minimumConventionnel.expert)} pour le niveau expert). La convention le compte au jour ou à l'heure travaillés, que le simulateur ne connaît pas : vérifiez-le avec votre société de portage.`)
  }
  if (detail.conditions.tauxVersementMobilite > 0 && !selonLEffectif[detail.conditions.effectif].versementMobiliteDu) warnings.push("Le versement mobilité n'est dû qu'à partir de 11 salariés : le taux saisi est ignoré pour une société de portage plus petite.")
  return warnings
}

/** Inscrit le salaire sur le compte du titulaire (le salarié porté), ou le signale sans titulaire. */
function verserAuTitulaire(ctx: Contexte, portage: Portage, detail: DetailPortage, cotisations: number, warnings: string[]): string[] {
  const titulaires = personnesLiees(ctx, portage.id, ["Titulaire"])
  const titulaire = titulaires[0]
  if (!titulaire) {
    warnings.push("Aucune relation « Titulaire » vers une personne : le salaire de cette activité en portage n'est rattaché à aucun foyer.")
    ctx.nonRattache += detail.netVerse
    return []
  }
  if (titulaires.length > 1) warnings.push("Plusieurs titulaires : le salaire est versé au premier, seul salarié porté de cette activité.")
  const autresPortages = ctx.session.entities.filter(e => e.type === "portage" && e.id !== portage.id && personnesLiees(ctx, e.id, ["Titulaire"])[0] === titulaire)
  if (autresPortages.length > 0) warnings.push("Cette personne a plusieurs activités en portage : chacune a son bulletin, et les plafonds de la sécurité sociale ne sont pas partagés entre elles.")
  const revenus = revenusDe(ctx, titulaire)
  revenus.salairesPortes += detail.netVerse
  revenus.salairesPortesImposables += detail.netImposable
  revenus.prelevementsActivites += cotisations
  revenus.resultatConserve += detail.reserveConservee + detail.reliquat
  return [titulaire]
}

/**
 * Une activité en portage salarial sur l'année. Ses charges sont les frais de gestion et les frais professionnels
 * remboursés ; ses cotisations sociales, celles du bulletin (salariales et patronales, après la réduction générale si
 * elle est reversée) et la mutuelle ; ce qu'elle verse, le net ; ce qu'elle garde, la réserve d'un CDI et le reliquat.
 */
export function simulerPortage(ctx: Contexte, portage: Portage): ActivityResult {
  const detail = detailDuPortage(ctx, portage)
  const warnings = avertissementsDuPortage(ctx, portage, detail)
  const { bulletin } = detail
  const cotisations = bulletin.totalSalarial + bulletin.totalPatronal - bulletin.reductionGenerale + detail.mutuelle
  const beneficiaireIds = verserAuTitulaire(ctx, portage, detail, cotisations, warnings)
  return {
    entityId: portage.id,
    name: portage.name,
    type: "portage",
    statut: LIBELLE_DU_PORTAGE,
    chiffreAffaires: detail.chiffreAffaires,
    charges: detail.fraisDeGestion + detail.fraisProfessionnels,
    cotisationsSociales: cotisations,
    impotSocietes: 0,
    revenuVerse: detail.netVerse,
    resultatConserve: detail.reserveConservee + detail.reliquat,
    beneficiaireIds,
    portage: detail,
    warnings
  }
}
