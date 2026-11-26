// src/backend/logic/impot-du-foyer.ts
// Après les activités : résultat de chaque personne (revenus directs, revenus d'activité, déduction pour frais
// professionnels, forfaitaire ou aux frais réels), puis impôt de chaque foyer sur l'ensemble des revenus de ses membres
// (barème, dividendes au prélèvement forfaitaire ou au barème, versement libératoire, revenu fiscal de référence).

import type { EpargneRetraiteDeLaPersonne, EpargneRetraiteDuFoyer, FoyerFiscalResult, FraisProfessionnelsResult, Person, PersonResult } from "../../types.js"
import { calculerIR, trancheMarginale } from "./calculsIR.js"
import { avertissementsEpargneRetraite, epargneRetraiteDesMembres, type MembreDuFoyer } from "./epargne-retraite.js"
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

/** L'épargne retraite de chaque membre du foyer : ses versements de l'année, son plafond saisi, et ce qu'il reçoit de l'année précédente. */
function epargneRetraiteDuFoyer(ctx: Contexte, foyer: Foyer, revenusProfessionnels: Map<string, number>): EpargneRetraiteDeLaPersonne[] {
  const anneePrecedente = ctx.annee.epargneRetraite
  const enCouple = foyer.declarantIds.length >= 2
  const membres = [...foyer.declarantIds, ...foyer.enfantIds].map((personId): MembreDuFoyer => ({
    personId,
    enCouple: enCouple && foyer.declarantIds.includes(personId),
    verse: total(ctx, personId, "versement_per"),
    plafondSaisi: personneDe(ctx, personId)?.plafondEpargneRetraite,
    herites: anneePrecedente === undefined ? undefined : (anneePrecedente.parPersonne?.[personId] ?? null),
    revenusProfessionnels: revenusProfessionnels.get(personId) ?? 0
  }))
  return epargneRetraiteDesMembres(membres, anneeSimulee(ctx), ctx.regles)
}

/** Une déduction d'épargne retraite sur un revenu imposable : elle ne le rend jamais négatif (pas de déficit global). */
function deduire(impute: number, revenuAvantDeduction: number) {
  const deduction = Math.min(impute, Math.max(0, revenuAvantDeduction))
  return { revenuAvantDeduction, deduction, revenuImposable: revenuAvantDeduction - deduction }
}

/**
 * Impôt du foyer. Les dividendes sont imposés de la façon la plus favorable entre le prélèvement
 * forfaitaire et l'option pour le barème (abattement, CSG en partie déductible) ; les prélèvements
 * sociaux sont dus dans les deux cas. Les versements d'épargne retraite imputés sur les plafonds se déduisent du
 * revenu imposable au barème (ADR 021) : l'impôt est recalculé sans eux pour dire ce qu'ils économisent, et sans la
 * mise en commun des plafonds d'un couple pour dire ce qu'elle rapporte.
 */
export function calculerFoyer(ctx: Contexte, foyer: Foyer): FoyerFiscalResult {
  const { IR, dividendes: reglesDividendes } = ctx.regles
  const revenus = revenusDuFoyer(ctx, foyer)
  const quotient = { partsFiscales: foyer.totalParts, nombreDeclarants: foyer.nombreDeclarants }
  const baseAvecDividendes = revenus.baseBareme + revenus.dividendes * (1 - reglesDividendes.abattementBareme) - revenus.dividendesSoumisPS * reglesDividendes.csgDeductible

  /**
   * L'impôt au barème et sur les dividendes pour un montant de versements imputé sur les plafonds. Au prélèvement
   * forfaitaire, les dividendes ne sont pas dans le revenu global : la déduction ne porte que sur les autres revenus.
   */
  const imposer = (impute: number) => {
    const auForfait = deduire(impute, revenus.baseBareme)
    const auBareme = deduire(impute, baseAvecDividendes)
    const impotForfaitaire = calculerIR({ revenuNetGlobalImposable: auForfait.revenuImposable, ...quotient }, IR) + revenus.dividendes * reglesDividendes.tauxIrForfaitaire
    const impotAuBareme = calculerIR({ revenuNetGlobalImposable: auBareme.revenuImposable, ...quotient }, IR)
    const optionBareme = revenus.dividendes > 0 && impotAuBareme < impotForfaitaire
    return optionBareme ? { optionBareme, impot: impotAuBareme, ...auBareme } : { optionBareme, impot: impotForfaitaire, ...auForfait }
  }

  const personnes = epargneRetraiteDuFoyer(ctx, foyer, revenus.professionnels)
  const verse = somme(personnes, personne => personne.verse)
  const prisSurLeConjoint = somme(personnes, personne => personne.imputeSurLeConjoint)
  const impute = somme(personnes, personne => personne.imputeSurSesPlafonds) + prisSurLeConjoint
  const retenu = imposer(impute)
  const sansVersement = impute > 0 ? imposer(0) : retenu
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
    ...(prisSurLeConjoint > 0 ? { miseEnCommun: { montant: prisSurLeConjoint, impotEnPlusSansElle: Math.round(imposer(impute - prisSurLeConjoint).impot - retenu.impot) } } : {}),
    personnes
  }
  const avertissements = avertissementsEpargneRetraite({
    annee: anneeSimulee(ctx),
    personnes,
    nomDe: personId => personneDe(ctx, personId)?.name ?? personId,
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
