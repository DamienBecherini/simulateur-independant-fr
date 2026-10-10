// src/backend/logic/simulation-au-reel.ts
// Calcul d'une activité au réel, par statut juridique (SIMULATION_PAR_STATUT) : sociétés à l'IS (SASU, EURL, avec
// CALCUL_DES_SOCIETES), qui versent rémunération et dividendes et gardent des réserves, et entreprise individuelle,
// dont le bénéfice revient à son titulaire. Les versements sont inscrits sur le compte des personnes (routage-des-flux.ts).

import type { ActivityResult, Company, EtatDeLaSociete, MicroEntreprise, PartageDuBenefice, StatutJuridique, StatutSociete } from "../../types.js"
import { calculerEI } from "./calculsEI.js"
import { calculerEURL, type EntreesEURL } from "./calculsEURL.js"
import { calculerSASU } from "./calculsSASU.js"
import { etatSansReserves, type ResultatSociete } from "./calculsSociete.js"
import type { ReglesFiscales } from "./regles.js"
import type { ParametresDeLaCaisse } from "./cotisations-liberales.js"
import { avertissementsDeLaProfession, parametresDeLaCaisse, professionDe } from "./professions.js"
import { lireMois, noteSortie } from "./dispositifs.js"
import { anneeSimulee, attribuerResultatSociete, personnesLiees, RELATIONS_D_ASSOCIE, RELATIONS_D_EXPLOITANT, revenusDe, total, verserDividendes, verserRemuneration, type Contexte } from "./routage-des-flux.js"
import { deplacementsProfessionnels, detailDeplacements, detailProfession, detailSalaries, masseSalariale } from "./details-des-activites.js"

/**
 * Calcul de la société à l'IS de chaque statut de société : le président de SASU est assimilé salarié et reste au
 * régime général ; le gérant d'EURL est travailleur non salarié et cotise à la caisse de sa profession, y compris sur
 * ses dividendes au-delà de 10 % du capital. Un nouveau statut à l'IS doit y dire quel calcul est le sien.
 */
const CALCUL_DES_SOCIETES: Record<StatutSociete, (entrees: EntreesEURL, ctx: Contexte, societe: Company) => ResultatSociete> = {
  SASU: (entrees, ctx) => calculerSASU(entrees, ctx.regles),
  EURL: (entrees, ctx, societe) => calculerEURL(entrees, ctx.regles, caisseDeLActivite(ctx, societe))
}

function simulerSocieteIS(ctx: Contexte, societe: Company, statut: StatutSociete): ActivityResult {
  const masse = masseSalariale(ctx, societe.id)
  const deplacements = deplacementsProfessionnels(ctx, societe)
  const entrees = {
    chiffreAffaires: total(ctx, societe.id, "ca_services", "ca_vente"),
    chargesDeductibles: total(ctx, societe.id, "deductible_expense") + masse.cout + deplacements,
    remunerationNette: total(ctx, societe.id, "director_remuneration"),
    dividendesDemandes: total(ctx, societe.id, "dividends_payment"),
    capitalSocial: societe.capitalSocial,
    etat: ctx.annee.etatsDesSocietes?.[societe.id] ?? etatAuDebutDeLaSimulation(societe, anneeSimulee(ctx), ctx.regles)
  }
  const resultat = CALCUL_DES_SOCIETES[statut](entrees, ctx, societe)
  const profession = professionDe(societe, ctx.regles)
  const warnings = [...resultat.warnings, ...avertissementsDeLaProfession(profession, statut)]

  verserRemuneration(ctx, societe, { nette: resultat.remunerationNette, imposable: resultat.remunerationImposable, cotisations: resultat.cotisationsSociales - resultat.cotisationsSurDividendes }, warnings)
  attribuerResultatSociete(ctx, societe, resultat)
  verserDividendes(ctx, societe, { verses: resultat.dividendesVerses, soumisPS: resultat.dividendesSoumisPS, cotisations: resultat.cotisationsSurDividendes }, warnings)

  return {
    entityId: societe.id,
    name: societe.name,
    type: "company",
    statut: societe.legalStatus,
    chiffreAffaires: resultat.chiffreAffaires,
    // Les salaires bruts sont des charges, les cotisations patronales des cotisations sociales.
    charges: resultat.chargesDeductibles - masse.patronales,
    cotisationsSociales: resultat.cotisationsSociales + masse.patronales,
    impotSocietes: resultat.impotSocietes,
    revenuVerse: resultat.remunerationNette + resultat.dividendesVerses - resultat.cotisationsSurDividendes,
    resultatConserve: resultat.resultatConserve,
    beneficiaireIds: personnesLiees(ctx, societe.id, RELATIONS_D_ASSOCIE),
    ...(resultat.cotisationsTNS ? { cotisationsTNS: resultat.cotisationsTNS } : {}),
    ...(resultat.cotisationsPresident && resultat.remunerationNette > 0 ? { cotisationsPresident: resultat.cotisationsPresident } : {}),
    ...detailSalaries(masse),
    ...detailDeplacements(societe, deplacements, true),
    partage: partageDuBenefice(resultat),
    reserves: resultat.reserves,
    ...detailProfession(profession, ctx.regles, false),
    warnings
  }
}

/**
 * Paramètres de la caisse de l'activité pour l'année, avec, pour la CARPIMKO, son assiette de l'année précédente quand
 * celle-ci est dans la session (ADR 015) ; `undefined` sans profession réglementée dont le simulateur connaît la caisse.
 */
function caisseDeLActivite(ctx: Contexte, activite: Company | MicroEntreprise): ParametresDeLaCaisse | undefined {
  return parametresDeLaCaisse(activite, ctx.regles, anneeSimulee(ctx), ctx.annee.assiettesAnneePrecedente?.parActivite[activite.id])
}

/**
 * Ce qu'une société à l'IS a au 1er janvier de la première année simulée (voir l'ADR 014) : les réserves saisies dans sa
 * fiche, aucun déficit reportable, et une réserve légale déjà constituée, sauf si la société est créée cette année-là
 * ou plus tard (date de création connue) : sa réserve légale part alors de zéro.
 */
export function etatAuDebutDeLaSimulation(societe: Company, premiereAnnee: number, regles: ReglesFiscales): EtatDeLaSociete {
  const creation = lireMois(societe.dateDeCreation)
  const nouvelle = creation !== null && creation.annee >= premiereAnnee
  return { ...etatSansReserves(nouvelle ? 0 : societe.capitalSocial, regles.reserveLegale), reserves: societe.reservesInitiales ?? 0 }
}

/** Le bénéfice avant rémunération du dirigeant, poste par poste : la somme des postes le redonne exactement. */
function partageDuBenefice(resultat: ResultatSociete): PartageDuBenefice {
  const cotisationsRemuneration = resultat.cotisationsSociales - resultat.cotisationsSurDividendes
  return {
    beneficeAvantRemuneration: resultat.chiffreAffaires - resultat.chargesDeductibles,
    remunerationNette: resultat.remunerationNette,
    cotisationsRemuneration,
    impotSocietes: resultat.impotSocietes,
    dividendesNets: resultat.dividendesVerses - resultat.cotisationsSurDividendes,
    cotisationsSurDividendes: resultat.cotisationsSurDividendes,
    resultatConserve: resultat.resultatConserve
  }
}

function simulerEntrepriseIndividuelle(ctx: Contexte, entreprise: Company): ActivityResult {
  const masse = masseSalariale(ctx, entreprise.id)
  const deplacements = deplacementsProfessionnels(ctx, entreprise)
  const resultat = calculerEI({ chiffreAffaires: total(ctx, entreprise.id, "ca_services", "ca_vente"), chargesDeductibles: total(ctx, entreprise.id, "deductible_expense") + masse.cout + deplacements }, ctx.regles, caisseDeLActivite(ctx, entreprise))
  const profession = professionDe(entreprise, ctx.regles)
  const warnings = [...resultat.warnings, ...avertissementsDeLaProfession(profession, "EI")]

  if (total(ctx, entreprise.id, "director_remuneration", "dividends_payment") > 0) {
    warnings.push("Une entreprise individuelle ne verse ni rémunération de dirigeant ni dividendes : ces flux sont ignorés, tout le bénéfice revient à l'entrepreneur.")
  }

  const exploitant = personnesLiees(ctx, entreprise.id, RELATIONS_D_EXPLOITANT)[0]
  if (exploitant) {
    const revenus = revenusDe(ctx, exploitant)
    // Un déficit d'entreprise individuelle au réel s'impute sur les autres revenus du foyer (article 156 du CGI).
    revenus.beneficesImposables += resultat.revenuImposable
    revenus.beneficesEncaisses += resultat.revenuNet
    revenus.prelevementsActivites += resultat.cotisationsSociales
  } else {
    warnings.push("Aucune relation « Titulaire » vers une personne : le bénéfice de cette entreprise n'est rattaché à aucun foyer.")
    ctx.nonRattache += resultat.revenuNet
  }

  return {
    entityId: entreprise.id,
    name: entreprise.name,
    type: "company",
    statut: "EI au réel",
    chiffreAffaires: resultat.chiffreAffaires,
    charges: resultat.chargesDeductibles - masse.patronales,
    cotisationsSociales: resultat.cotisationsSociales + masse.patronales,
    impotSocietes: 0,
    revenuVerse: resultat.revenuNet,
    resultatConserve: 0,
    beneficiaireIds: exploitant ? [exploitant] : [],
    cotisationsTNS: resultat.cotisationsTNS,
    ...detailSalaries(masse),
    ...detailDeplacements(entreprise, deplacements, true),
    ...detailSortieDuRegimeMicro(ctx, entreprise.id),
    ...detailProfession(profession, ctx.regles, false),
    warnings
  }
}

/** Micro-entreprise sortie du régime micro, simulée en entreprise individuelle au réel : la sortie et sa note. */
function detailSortieDuRegimeMicro(ctx: Contexte, entityId: string): Pick<ActivityResult, "sortieDuRegimeMicro" | "dispositifs"> {
  const sortie = ctx.annee.regimeMicro?.sorties[entityId]
  return sortie ? { sortieDuRegimeMicro: sortie, dispositifs: [noteSortie(sortie, anneeSimulee(ctx))] } : {}
}

/**
 * Simulation d'une activité au réel selon son statut : les sociétés à l'IS versent rémunération et dividendes et gardent
 * des réserves (`simulerSocieteIS`, puis le calcul de `CALCUL_DES_SOCIETES`) ; le bénéfice de l'entreprise individuelle
 * est le revenu de son titulaire. Un nouveau statut doit y dire comment il se calcule, au lieu d'être calculé comme un
 * autre.
 */
export const SIMULATION_PAR_STATUT: Record<StatutJuridique, (ctx: Contexte, activite: Company) => ActivityResult> = {
  SASU: (ctx, societe) => simulerSocieteIS(ctx, societe, "SASU"),
  EURL: (ctx, societe) => simulerSocieteIS(ctx, societe, "EURL"),
  EI: simulerEntrepriseIndividuelle
}
