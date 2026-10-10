// src/backend/logic/impot-du-foyer.ts
// Après les activités : résultat de chaque personne (revenus directs, revenus d'activité, déduction pour frais
// professionnels, forfaitaire ou aux frais réels), puis impôt de chaque foyer sur l'ensemble des revenus de ses membres
// (barème, dividendes au prélèvement forfaitaire ou au barème, versement libératoire, revenu fiscal de référence).

import type { FoyerFiscalResult, FraisProfessionnelsResult, Person, PersonResult } from "../../types.js"
import { calculerIR } from "./calculsIR.js"
import type { Foyer } from "./foyers.js"
import { fraisReelsDeLaPersonne } from "./frais-kilometriques.js"
import type { ReglesFiscales } from "./regles.js"
import { encaisse, revenusDe, total, type Contexte } from "./routage-des-flux.js"

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
      benefices: Math.round(revenus.beneficesEncaisses)
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
 * (président de SASU, gérant d'EURL) imposables. Salarié d'une activité de la simulation : sa CSG non déductible et sa
 * CRDS s'ajoutent au net imposable. Ni les bénéfices (micro, EI) ni les dividendes n'en font partie.
 */
function revenusSalariaux(ctx: Contexte, personId: string): number {
  const salarie = ctx.salaries.get(personId)?.bulletin
  return total(ctx, personId, "salary", "are") + revenusDe(ctx, personId).remunerationsImposables + (salarie?.partNonDeductible ?? 0)
}

/**
 * Déduction pour frais professionnels d'une personne (article 83, 3° du CGI) : la déduction forfaitaire de 10 % (avec son
 * minimum et son maximum), ou ses frais réels s'ils sont plus élevés. Le choix vaut pour l'ensemble de ses revenus
 * imposés comme des salaires. Simplification : la déduction ne dépasse jamais ces revenus (pas de déficit).
 */
function fraisProfessionnels(ctx: Contexte, personId: string): FraisProfessionnelsResult {
  const salaires = revenusSalariaux(ctx, personId)
  const deductionForfaitaire = abattementSalaires(salaires, ctx.regles.IR.abattementSalaires)
  const personne = ctx.session.entities.find((e): e is Person => e.id === personId && e.type === "person")
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

/** Additionne les revenus de tous les membres d'un foyer, par traitement fiscal. */
function revenusDuFoyer(ctx: Contexte, foyer: Foyer) {
  const cumul = { baseBareme: 0, dividendes: 0, dividendesSoumisPS: 0, versementLiberatoire: 0, revenusAuVersementLiberatoire: 0, encaisse: 0, depenses: 0, prelevementsActivites: 0, resultatConserve: 0 }
  for (const personId of [...foyer.declarantIds, ...foyer.enfantIds]) {
    const revenus = revenusDe(ctx, personId)
    const salarie = ctx.salaries.get(personId)?.bulletin
    const frais = fraisProfessionnels(ctx, personId)
    const autresRevenus = total(ctx, personId, "other_taxable_income")

    cumul.baseBareme += frais.revenusSalariaux - frais.deduction + autresRevenus + revenus.beneficesImposables
    cumul.dividendes += revenus.dividendes
    cumul.dividendesSoumisPS += revenus.dividendesSoumisPS
    cumul.versementLiberatoire += revenus.versementLiberatoire
    cumul.revenusAuVersementLiberatoire += revenus.revenusAuVersementLiberatoire
    cumul.encaisse += total(ctx, personId, "salary", "are", "other_taxable_income") + encaisse(revenus)
    cumul.depenses += total(ctx, personId, "expense")
    // Les cotisations patronales de son salaire comptent parmi les prélèvements de son foyer.
    cumul.prelevementsActivites += revenus.prelevementsActivites + (ctx.cotisationsSalariales.get(personId) ?? 0) + (salarie ? salarie.coutEmployeur - salarie.brut : 0)
    cumul.resultatConserve += revenus.resultatConserve
  }
  return cumul
}

/**
 * Impôt du foyer. Les dividendes sont imposés de la façon la plus favorable entre le prélèvement
 * forfaitaire et l'option pour le barème (abattement, CSG en partie déductible) ; les prélèvements
 * sociaux sont dus dans les deux cas.
 */
export function calculerFoyer(ctx: Contexte, foyer: Foyer): FoyerFiscalResult {
  const { IR, dividendes: reglesDividendes } = ctx.regles
  const revenus = revenusDuFoyer(ctx, foyer)
  const quotient = { partsFiscales: foyer.totalParts, nombreDeclarants: foyer.nombreDeclarants }

  const impotForfaitaire = calculerIR({ revenuNetGlobalImposable: revenus.baseBareme, ...quotient }, IR) + revenus.dividendes * reglesDividendes.tauxIrForfaitaire
  const baseAvecDividendes = revenus.baseBareme + revenus.dividendes * (1 - reglesDividendes.abattementBareme) - revenus.dividendesSoumisPS * reglesDividendes.csgDeductible
  const impotAuBareme = calculerIR({ revenuNetGlobalImposable: baseAvecDividendes, ...quotient }, IR)
  const optionBareme = revenus.dividendes > 0 && impotAuBareme < impotForfaitaire

  const impotSurLeRevenu = (optionBareme ? impotAuBareme : impotForfaitaire) + revenus.versementLiberatoire
  const prelevementsSociaux = revenus.dividendesSoumisPS * reglesDividendes.prelevementsSociaux
  const optionDividendes = optionBareme ? "bareme" : "pfu"
  const revenuImposableGlobal = Math.max(0, optionBareme ? baseAvecDividendes : revenus.baseBareme)
  // Revenu fiscal de référence : on rajoute ce que le barème ne voit pas. Au prélèvement forfaitaire, les dividendes
  // bruts ; au barème, l'abattement de 40 % (le reste y est déjà, net de la CSG déductible).
  const dividendesHorsBareme = optionBareme ? revenus.dividendes * reglesDividendes.abattementBareme : revenus.dividendes
  const revenuFiscalDeReference = revenuImposableGlobal + dividendesHorsBareme + revenus.revenusAuVersementLiberatoire

  return {
    personIds: [...foyer.declarantIds, ...foyer.enfantIds],
    totalParts: foyer.totalParts,
    revenusEncaisses: Math.round(revenus.encaisse),
    revenuImposableGlobal: Math.round(revenuImposableGlobal),
    revenuFiscalDeReference: Math.round(revenuFiscalDeReference),
    impotSurLeRevenu: Math.round(impotSurLeRevenu),
    ...(revenus.versementLiberatoire > 0 ? { versementLiberatoire: Math.round(revenus.versementLiberatoire) } : {}),
    prelevementsSociaux: Math.round(prelevementsSociaux),
    optionDividendes: revenus.dividendes > 0 ? optionDividendes : null,
    netApresImpots: Math.round(revenus.encaisse - impotSurLeRevenu - prelevementsSociaux),
    // Tout ce que le foyer produit se retrouve soit encaissé, soit prélevé en amont, soit conservé en société.
    revenusAvantPrelevements: Math.round(revenus.encaisse + revenus.prelevementsActivites + revenus.resultatConserve),
    totalPrelevements: Math.round(revenus.prelevementsActivites + impotSurLeRevenu + prelevementsSociaux),
    resultatConserve: Math.round(revenus.resultatConserve),
    depenses: Math.round(revenus.depenses),
    warnings: foyer.warnings
  }
}
