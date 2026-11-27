// src/backend/logic/impot-du-foyer.ts
// Après les activités : résultat de chaque personne (revenus directs, revenus d'activité, déduction pour frais
// professionnels, forfaitaire ou aux frais réels), puis impôt de chaque foyer sur l'ensemble des revenus de ses membres
// (barème, dividendes au prélèvement forfaitaire ou au barème, versement libératoire, revenu fiscal de référence).

import type { DeductionDuRevenuProfessionnel, EpargneRetraiteDeLaPersonne, EpargneRetraiteDuFoyer, FoyerFiscalResult, FraisProfessionnelsResult, Person, PersonResult } from "../../types.js"
import { calculerIR, trancheMarginale } from "./calculsIR.js"
import { avertissementsEpargneRetraite, deductionDuRevenuProfessionnel, epargneRetraiteDesMembres, excedentsSurLesPlafonds, plafondSaisiDeLAnnee, type MembreDuFoyer, type RevenuDeductible, type RevenuProfessionnelDeLActivite, type VersantDuFoyer } from "./epargne-retraite.js"
import type { Foyer } from "./foyers.js"
import { fraisReelsDeLaPersonne } from "./frais-kilometriques.js"
import type { ReglesFiscales } from "./regles.js"
import { anneeSimulee, encaisse, revenusDe, somme, total, type Contexte } from "./routage-des-flux.js"

/** La personne de la session qui porte cet identifiant. */
function personneDe(ctx: Contexte, personId: string): Person | undefined {
  return ctx.session.entities.find((e): e is Person => e.id === personId && e.type === "person")
}

export function resultatPersonne(ctx: Contexte, personne: Person): PersonResult {
  const revenus = revenusDe(ctx, personne.id)
  return {
    entityId: personne.id,
    name: personne.name,
    revenusDirects: Math.round(total(ctx, personne.id, "salary", "are", "other_taxable_income")),
    revenusActivites: Math.round(encaisse(revenus)),
    detail: {
      salaires: Math.round(total(ctx, personne.id, "salary")),
      allocationsChomage: Math.round(total(ctx, personne.id, "are")),
      autresRevenus: Math.round(total(ctx, personne.id, "other_taxable_income")),
      remunerationsDirigeant: Math.round(revenus.remunerations),
      dividendes: Math.round(revenus.dividendesEncaisses),
      benefices: Math.round(revenus.beneficesEncaisses),
      ...(revenus.salairesPortes > 0 ? { salairesPortage: Math.round(revenus.salairesPortes) } : {})
    },
    cotisationsSalariales: Math.round(ctx.cotisationsSalariales.get(personne.id) ?? 0),
    depenses: Math.round(total(ctx, personne.id, "expense")),
    ...detailFraisProfessionnels(ctx, personne)
  }
}

/** La déduction retenue, pour une personne qui a saisi des frais réels et perçoit des revenus imposés comme des salaires. */
function detailFraisProfessionnels(ctx: Contexte, personne: Person): Pick<PersonResult, "fraisProfessionnels"> {
  if (!personne.fraisReels) return {}
  const frais = fraisProfessionnels(ctx, personne.id)
  if (frais.revenusSalariaux <= 0) return {}
  return {
    fraisProfessionnels: {
      ...frais,
      revenusSalariaux: Math.round(frais.revenusSalariaux),
      deductionForfaitaire: Math.round(frais.deductionForfaitaire),
      fraisReels: Math.round(frais.fraisReels),
      fraisDeTrajet: Math.round(frais.fraisDeTrajet),
      distanceRetenue: Math.round(frais.distanceRetenue),
      voitures: frais.voitures.map(voiture => ({ ...voiture, distance: Math.round(voiture.distance), montant: Math.round(voiture.montant) })),
      autresFrais: Math.round(frais.autresFrais),
      deduction: Math.round(frais.deduction)
    }
  }
}

/** Déduction forfaitaire pour frais professionnels sur les revenus imposés comme des salaires, par personne. */
function abattementSalaires(salaires: number, regles: ReglesFiscales["IR"]["abattementSalaires"]): number {
  const abattement = Math.min(Math.max(salaires * regles.taux, regles.minimum), regles.maximum)
  return Math.min(salaires, abattement)
}

/**
 * Revenus imposés comme des salaires d'une personne : salaires et allocations chômage saisis, rémunérations de dirigeant
 * (président de SASU, gérant d'EURL) et salaires d'une activité en portage salarial, imposables. Salarié d'une activité
 * de la simulation : sa CSG non déductible et sa CRDS s'ajoutent au net imposable. Ni les bénéfices (micro, EI) ni les
 * dividendes n'en font partie.
 */
function revenusSalariaux(ctx: Contexte, personId: string): number {
  const salarie = ctx.salaries.get(personId)?.bulletin
  const revenus = revenusDe(ctx, personId)
  return total(ctx, personId, "salary", "are") + revenus.remunerationsImposables + revenus.salairesPortesImposables + (salarie?.partNonDeductible ?? 0)
}

/**
 * Déduction pour frais professionnels d'une personne (article 83, 3° du CGI) : la déduction forfaitaire de 10 % (avec son
 * minimum et son maximum), ou ses frais réels s'ils sont plus élevés. Le choix vaut pour l'ensemble de ses revenus
 * imposés comme des salaires. Simplification : la déduction ne dépasse jamais ces revenus (pas de déficit).
 */
function fraisProfessionnels(ctx: Contexte, personId: string): FraisProfessionnelsResult {
  const salaires = revenusSalariaux(ctx, personId)
  const deductionForfaitaire = abattementSalaires(salaires, ctx.regles.IR.abattementSalaires)
  const personne = personneDe(ctx, personId)
  const reels = personne?.fraisReels ? fraisReelsDeLaPersonne(personne.fraisReels, ctx.regles.baremeKilometrique) : { distanceRetenue: 0, fraisDeTrajet: 0, autresFrais: 0, voitures: [], total: 0 }
  const retenue = salaires > 0 && reels.total > deductionForfaitaire ? "reels" : "forfait"
  return {
    revenusSalariaux: salaires,
    tauxDeductionForfaitaire: ctx.regles.IR.abattementSalaires.taux,
    deductionForfaitaire,
    fraisReels: reels.total,
    fraisDeTrajet: reels.fraisDeTrajet,
    distanceRetenue: reels.distanceRetenue,
    nombreDeTrajets: personne?.fraisReels?.trajets.length ?? 0,
    voitures: reels.voitures,
    autresFrais: reels.autresFrais,
    retenue,
    deduction: retenue === "reels" ? Math.min(salaires, reels.total) : deductionForfaitaire
  }
}

/**
 * Additionne les revenus de tous les membres d'un foyer, par traitement fiscal, et garde pour chacun ses revenus
 * d'activité professionnelle, dont dépend son plafond d'épargne retraite de l'année suivante (article 163 quatervicies,
 * II du CGI ; ADR 021, hypothèse 5) : revenus imposés comme des salaires après la déduction pour frais, bénéfices
 * imposables (déficits compris), bénéfices exonérés en zone et chiffre d'affaires après abattement d'une
 * micro-entreprise au versement libératoire. Ni les « autres revenus », de nature inconnue, ni les dividendes.
 */
function revenusDuFoyer(ctx: Contexte, foyer: Foyer) {
  const cumul = { baseBareme: 0, dividendes: 0, dividendesSoumisPS: 0, versementLiberatoire: 0, revenusAuVersementLiberatoire: 0, beneficesExoneres: 0, encaisse: 0, depenses: 0, prelevementsActivites: 0, resultatConserve: 0 }
  const professionnels = new Map<string, number>()
  for (const personId of [...foyer.declarantIds, ...foyer.enfantIds]) {
    const revenus = revenusDe(ctx, personId)
    const salarie = ctx.salaries.get(personId)?.bulletin
    const frais = fraisProfessionnels(ctx, personId)
    const autresRevenus = total(ctx, personId, "other_taxable_income")

    professionnels.set(personId, frais.revenusSalariaux - frais.deduction + revenus.beneficesImposables + revenus.beneficesExoneres + revenus.revenusAuVersementLiberatoire)
    cumul.baseBareme += frais.revenusSalariaux - frais.deduction + autresRevenus + revenus.beneficesImposables
    cumul.dividendes += revenus.dividendes
    cumul.dividendesSoumisPS += revenus.dividendesSoumisPS
    cumul.versementLiberatoire += revenus.versementLiberatoire
    cumul.revenusAuVersementLiberatoire += revenus.revenusAuVersementLiberatoire
    cumul.beneficesExoneres += revenus.beneficesExoneres
    cumul.encaisse += total(ctx, personId, "salary", "are", "other_taxable_income") + encaisse(revenus)
    cumul.depenses += total(ctx, personId, "expense")
    // Les cotisations patronales de son salaire comptent parmi les prélèvements de son foyer.
    cumul.prelevementsActivites += revenus.prelevementsActivites + (ctx.cotisationsSalariales.get(personId) ?? 0) + (salarie ? salarie.coutEmployeur - salarie.brut : 0)
    cumul.resultatConserve += revenus.resultatConserve
  }
  return { ...cumul, professionnels }
}

/** Chaque membre du foyer : ses versements d'épargne retraite de l'année, son plafond saisi, et ce qu'il reçoit de l'année précédente. */
function versantsDuFoyer(ctx: Contexte, foyer: Foyer): VersantDuFoyer[] {
  const anneePrecedente = ctx.annee.epargneRetraite
  const enCouple = foyer.declarantIds.length >= 2
  return [...foyer.declarantIds, ...foyer.enfantIds].map(personId => ({
    personId,
    enCouple: enCouple && foyer.declarantIds.includes(personId),
    verse: total(ctx, personId, "versement_per"),
    // Sans contexte d'épargne retraite, l'année est la première de la session (ou la seule simulée).
    ...plafondSaisiDeLAnnee(personneDe(ctx, personId), anneeSimulee(ctx), anneePrecedente === undefined),
    herites: anneePrecedente === undefined ? undefined : (anneePrecedente.parPersonne?.[personId] ?? null)
  }))
}

/**
 * Le revenu d'une activité sur lequel se calcule la limite de ce qui s'en déduit (article 154 bis) : le bénéfice ; pour
 * un gérant, sa rémunération moins sa part de la déduction pour frais professionnels, qui porte sur tous ses revenus
 * imposés comme des salaires (hypothèse 2 de l'ADR 021).
 */
function revenuDeLaLimite(ctx: Contexte, { personId, cadre }: Pick<RevenuProfessionnelDeLActivite, "personId" | "cadre">, revenu: number): number {
  if (cadre === "benefice") return revenu
  const frais = fraisProfessionnels(ctx, personId)
  return frais.revenusSalariaux > 0 ? revenu - (frais.deduction * revenu) / frais.revenusSalariaux : revenu
}

/**
 * Ce que chaque personne déduit de son bénéfice ou de sa rémunération (article 154 bis du CGI, ADR 021) : ce qui dépasse
 * ses plafonds du revenu global, mise en commun d'un couple comprise, dans la limite de l'année. D'après un calcul des
 * activités sans cette déduction (`ctx`) : ses revenus en donnent la limite. Par identifiant de l'activité qui la porte.
 */
export function deductionsDuRevenuProfessionnel(ctx: Contexte): Map<string, DeductionDuRevenuProfessionnel> {
  const regles = ctx.regles.IR.epargneRetraite.deductionDuRevenuProfessionnel
  const deductions = new Map<string, DeductionDuRevenuProfessionnel>()
  for (const foyer of ctx.foyers) {
    for (const [personId, excedent] of excedentsSurLesPlafonds(versantsDuFoyer(ctx, foyer), anneeSimulee(ctx), ctx.regles)) {
      const deduction = deductionDuRevenuProfessionnel(excedent, candidatsDe(ctx, personId), regles)
      if (deduction) deductions.set(deduction.activiteId, deduction)
    }
  }
  return deductions
}

/** Les bénéfices et rémunérations dont une personne peut déduire, avec le revenu de leur limite, d'après le calcul des activités de `ctx`. */
function candidatsDe(ctx: Contexte, personId: string): RevenuDeductible[] {
  return ctx.revenusProfessionnelsDeductibles.filter(revenu => revenu.personId === personId).map(revenu => ({ ...revenu, revenuDeLaLimite: revenuDeLaLimite(ctx, revenu, revenu.revenuAvantDeduction) }))
}

/**
 * L'épargne retraite de chaque membre du foyer : l'imputation de ses versements, ce qui se déduit de son bénéfice ou de
 * sa rémunération avec le revenu qui en reste, et ses revenus d'activité professionnelle, pour le plafond suivant.
 */
function epargneRetraiteDuFoyer(ctx: Contexte, foyer: Foyer, revenusProfessionnels: Map<string, number>): EpargneRetraiteDeLaPersonne[] {
  const deductions = [...ctx.deductionsDuRevenuProfessionnel.values()]
  const membres = versantsDuFoyer(ctx, foyer).map((versant): MembreDuFoyer => {
    const deduction = deductions.find(d => d.personId === versant.personId)
    // Ce qui reste du revenu après la déduction, sur la même base que la limite : la part de 15 % s'y calcule.
    const duRevenuProfessionnel = deduction ? { deduction, revenuApresDeduction: revenuDeLaLimite(ctx, deduction, deduction.revenuAvantDeduction - deduction.montant) } : undefined
    return { ...versant, revenusProfessionnels: revenusProfessionnels.get(versant.personId) ?? 0, ...(duRevenuProfessionnel ? { duRevenuProfessionnel } : {}) }
  })
  return epargneRetraiteDesMembres(membres, anneeSimulee(ctx), ctx.regles)
}

/**
 * La mise en commun des plafonds d'un couple : ce qui est pris sur le plafond du conjoint, et l'impôt en plus sans la
 * case 6QR. Quand celui qui prend sur le plafond de son conjoint pourrait encore déduire de son bénéfice ou de sa
 * rémunération (sa limite n'est pas atteinte), ces versements ne seraient pas tous perdus sans la case : cet impôt en
 * plus, calculé comme s'ils l'étaient, n'est qu'un maximum. La limite se lit sur le calcul des activités sans déduction.
 */
function miseEnCommun(avantDeduction: Contexte, personnes: EpargneRetraiteDeLaPersonne[], montant: number, impotEnPlusSansElle: number): NonNullable<EpargneRetraiteDuFoyer["miseEnCommun"]> {
  const regles = avantDeduction.regles.IR.epargneRetraite.deductionDuRevenuProfessionnel
  const marge = (personne: EpargneRetraiteDeLaPersonne) => {
    // Le plus que permettrait sa limite (ou sa rémunération), face à ce qu'il en déduit déjà.
    const maximum = deductionDuRevenuProfessionnel(Number.MAX_SAFE_INTEGER, candidatsDe(avantDeduction, personne.personId), regles)
    return maximum && maximum.montant > (personne.deduitDuRevenuProfessionnel?.montant ?? 0) ? maximum.cadre : undefined
  }
  const cadre = personnes.filter(personne => personne.imputeSurLeConjoint > 0).map(marge).find(c => c !== undefined)
  return { montant, impotEnPlusSansElle, ...(cadre ? { deductibleDuRevenuProfessionnel: cadre } : {}) }
}

/**
 * L'impôt du foyer sans aucun versement d'épargne retraite : sans la déduction du revenu global et, quand une part se
 * déduit du bénéfice ou de la rémunération, sur les revenus d'avant cette déduction.
 */
function sansAucunVersement(ctx: Contexte, foyer: Foyer, calcul: { revenus: RevenusDuFoyer; impute: number; duRevenuProfessionnel: number; retenu: ReturnType<typeof imposer>; avantDeduction: Contexte }) {
  if (calcul.duRevenuProfessionnel > 0) return imposer(calcul.avantDeduction, foyer, revenusDuFoyer(calcul.avantDeduction, foyer), 0)
  return calcul.impute > 0 ? imposer(ctx, foyer, calcul.revenus, 0) : calcul.retenu
}

/** Une déduction d'épargne retraite sur un revenu imposable : elle ne le rend jamais négatif (pas de déficit global). */
function deduire(impute: number, revenuAvantDeduction: number) {
  const deduction = Math.min(impute, Math.max(0, revenuAvantDeduction))
  return { revenuAvantDeduction, deduction, revenuImposable: revenuAvantDeduction - deduction }
}

/** Les revenus du foyer, tels que `revenusDuFoyer` les additionne. */
type RevenusDuFoyer = ReturnType<typeof revenusDuFoyer>

/**
 * L'impôt au barème et sur les dividendes d'un foyer, pour un montant de versements d'épargne retraite imputé sur les
 * plafonds du revenu global. Les dividendes sont imposés de la façon la plus favorable entre le prélèvement forfaitaire
 * et l'option pour le barème (abattement, CSG en partie déductible). Au prélèvement forfaitaire, ils ne sont pas dans le
 * revenu global : la déduction ne porte que sur les autres revenus.
 */
function imposer(ctx: Contexte, foyer: Foyer, revenus: RevenusDuFoyer, impute: number) {
  const { IR, dividendes: reglesDividendes } = ctx.regles
  const quotient = { partsFiscales: foyer.totalParts, nombreDeclarants: foyer.nombreDeclarants }
  const baseAvecDividendes = revenus.baseBareme + revenus.dividendes * (1 - reglesDividendes.abattementBareme) - revenus.dividendesSoumisPS * reglesDividendes.csgDeductible
  const auForfait = deduire(impute, revenus.baseBareme)
  const auBareme = deduire(impute, baseAvecDividendes)
  const impotForfaitaire = calculerIR({ revenuNetGlobalImposable: auForfait.revenuImposable, ...quotient }, IR) + revenus.dividendes * reglesDividendes.tauxIrForfaitaire
  const impotAuBareme = calculerIR({ revenuNetGlobalImposable: auBareme.revenuImposable, ...quotient }, IR)
  const optionBareme = revenus.dividendes > 0 && impotAuBareme < impotForfaitaire
  return optionBareme ? { optionBareme, impot: impotAuBareme, ...auBareme } : { optionBareme, impot: impotForfaitaire, ...auForfait }
}

/**
 * Impôt du foyer ; les prélèvements sociaux sur les dividendes sont dus quelle que soit leur imposition. Les versements
 * d'épargne retraite imputés sur les plafonds se déduisent du revenu imposable au barème, et ce qui les dépasse, du
 * bénéfice ou de la rémunération, déjà dans les revenus de `ctx` (ADR 021). Pour dire ce qu'ils économisent, l'impôt est
 * recalculé sans aucun versement, sur les revenus d'avant cette seconde déduction (`avantDeduction`, le premier calcul
 * des activités) ; et sans la mise en commun des plafonds d'un couple, pour dire ce qu'elle rapporte.
 */
export function calculerFoyer(ctx: Contexte, foyer: Foyer, avantDeduction: Contexte = ctx): FoyerFiscalResult {
  const { IR, dividendes: reglesDividendes } = ctx.regles
  const revenus = revenusDuFoyer(ctx, foyer)
  const quotient = { partsFiscales: foyer.totalParts, nombreDeclarants: foyer.nombreDeclarants }

  const personnes = epargneRetraiteDuFoyer(ctx, foyer, revenus.professionnels)
  const verse = somme(personnes, personne => personne.verse)
  const prisSurLeConjoint = somme(personnes, personne => personne.imputeSurLeConjoint)
  const impute = somme(personnes, personne => personne.imputeSurSesPlafonds) + prisSurLeConjoint
  const duRevenuProfessionnel = somme(personnes, personne => personne.deduitDuRevenuProfessionnel?.montant ?? 0)
  const retenu = imposer(ctx, foyer, revenus, impute)
  const sansVersement = sansAucunVersement(ctx, foyer, { revenus, impute, duRevenuProfessionnel, retenu, avantDeduction })
  const impotEconomise = Math.round(sansVersement.impot - retenu.impot)

  const impotSurLeRevenu = retenu.impot + revenus.versementLiberatoire
  const prelevementsSociaux = revenus.dividendesSoumisPS * reglesDividendes.prelevementsSociaux
  const optionDividendes = retenu.optionBareme ? "bareme" : "pfu"
  const revenuImposableGlobal = Math.max(0, retenu.revenuImposable)
  // Revenu fiscal de référence : on rajoute ce que le barème ne voit pas. Au prélèvement forfaitaire, les dividendes
  // bruts ; au barème, l'abattement de 40 % (le reste y est déjà, net de la CSG déductible).
  const dividendesHorsBareme = retenu.optionBareme ? revenus.dividendes * reglesDividendes.abattementBareme : revenus.dividendes
  // Les bénéfices exonérés d'impôt en zone (ZFU-TE, QPV) y reviennent aussi (article 1417, IV, 1°, b du CGI), comme
  // les versements d'épargne retraite déduits du revenu global (1°, a du même IV) : ils ne le font donc pas baisser.
  const revenuFiscalDeReference = revenuImposableGlobal + retenu.deduction + dividendesHorsBareme + revenus.revenusAuVersementLiberatoire + revenus.beneficesExoneres

  const epargneRetraite: EpargneRetraiteDuFoyer = {
    trancheMarginale: trancheMarginale({ revenuNetGlobalImposable: sansVersement.revenuAvantDeduction, ...quotient }, IR),
    partDesRevenus: IR.epargneRetraite.partDesRevenus,
    ...(prisSurLeConjoint > 0 ? { miseEnCommun: miseEnCommun(avantDeduction, personnes, prisSurLeConjoint, Math.round(imposer(ctx, foyer, revenus, impute - prisSurLeConjoint).impot - retenu.impot)) } : {}),
    personnes
  }
  const avertissements = avertissementsEpargneRetraite({
    annee: anneeSimulee(ctx),
    personnes,
    nomDe: personId => personneDe(ctx, personId)?.name ?? personId,
    nomDeLActivite: activiteId => ctx.session.entities.find(e => e.id === activiteId)?.name ?? activiteId,
    deduction: retenu.deduction,
    revenuAvantDeduction: Math.max(0, retenu.revenuAvantDeduction),
    impotEconomise,
    auVersementLiberatoire: revenus.revenusAuVersementLiberatoire > 0
  })

  return {
    personIds: [...foyer.declarantIds, ...foyer.enfantIds],
    totalParts: foyer.totalParts,
    revenusEncaisses: Math.round(revenus.encaisse),
    revenuImposableGlobal: Math.round(revenuImposableGlobal),
    ...(verse > 0 ? { deductionEpargneRetraite: Math.round(retenu.deduction) } : {}),
    revenuFiscalDeReference: Math.round(revenuFiscalDeReference),
    ...(revenus.beneficesExoneres > 0 ? { beneficesExoneres: Math.round(revenus.beneficesExoneres) } : {}),
    impotSurLeRevenu: Math.round(impotSurLeRevenu),
    ...(revenus.versementLiberatoire > 0 ? { versementLiberatoire: Math.round(revenus.versementLiberatoire) } : {}),
    ...(verse > 0 ? { impotEconomiseEpargneRetraite: impotEconomise } : {}),
    prelevementsSociaux: Math.round(prelevementsSociaux),
    optionDividendes: revenus.dividendes > 0 ? optionDividendes : null,
    // Les versements d'épargne retraite ne sont pas retranchés : l'argent reste au foyer, bloqué jusqu'à la retraite.
    netApresImpots: Math.round(revenus.encaisse - impotSurLeRevenu - prelevementsSociaux),
    ...(verse > 0 ? { versementsEpargneRetraite: verse } : {}),
    // Tout ce que le foyer produit se retrouve soit encaissé, soit prélevé en amont, soit conservé en société.
    revenusAvantPrelevements: Math.round(revenus.encaisse + revenus.prelevementsActivites + revenus.resultatConserve),
    totalPrelevements: Math.round(revenus.prelevementsActivites + impotSurLeRevenu + prelevementsSociaux),
    resultatConserve: Math.round(revenus.resultatConserve),
    depenses: Math.round(revenus.depenses),
    epargneRetraite,
    warnings: [...foyer.warnings, ...avertissements]
  }
}
