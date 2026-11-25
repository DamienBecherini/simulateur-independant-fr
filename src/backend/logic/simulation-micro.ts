// src/backend/logic/simulation-micro.ts
// Calcul d'une micro-entreprise pour une année : cotisations et impôt sur le chiffre d'affaires, accès au versement
// libératoire (revenu fiscal de référence N-2 du foyer), dispositifs de l'année (ACRE, plafonds au prorata, retour au
// régime, annonce de la sortie). Ses revenus sont inscrits sur le compte de son titulaire (routage-des-flux.ts).

import type { ActivityResult, MicroEntreprise, VersementLiberatoireInfo } from "../../types.js"
import { calculerMicro, plafondRfrVersementLiberatoire, type ChiffreAffairesMicro, type EntrepriseDuTitulaire } from "./calculsAE.js"
import { euros } from "./format.js"
import type { ReglesFiscales } from "./regles.js"
import { avertissementsDeLaProfession, professionDe, reglesDeLaMicro } from "./professions.js"
import { acreDeLAnnee, ecrireMois, economieACRE, lireMois, microsReunies, noteACRE, noteAnnonce, noteProrata, noteRetour, prorataDeLEntreprise, prorataDesPlafonds, type ACREDuneAnnee } from "./dispositifs.js"
import { avecLaZone, beneficeExonereDeLActivite, detailDeLaZone, zoneDeLActivite } from "./exoneration-de-zone.js"
import { avertissementsAvantLaCreation } from "./annee-de-creation.js"
import { anneeSimulee, anomaliesDeLActivite, dirigeantsDe, revenusDe, total, type Contexte } from "./routage-des-flux.js"
import { deplacementsProfessionnels, detailDeplacements, detailProfession, detailSalaries, masseSalariale } from "./details-des-activites.js"

/**
 * Dispositifs de l'année d'une micro-entreprise : retour au régime micro, plafonds au prorata l'année de création, ACRE
 * des mois couverts, annonce de la sortie du régime l'année du second dépassement.
 */
function detailDispositifsMicro(ctx: Contexte, micro: MicroEntreprise, acre: ACREDuneAnnee | null, prorata: number, reglesMicro: ReglesFiscales): Pick<ActivityResult, "acre" | "dispositifs"> {
  const annee = anneeSimulee(ctx)
  const regime = ctx.annee.regimeMicro
  const creation = lireMois(micro.dateDeCreation)
  const annonce = regime?.annonces[micro.id]
  const economie = acre ? economieACRE(acre, reglesMicro) : 0
  const notes = [
    regime?.retours.includes(micro.id) ? noteRetour(annee) : null,
    creation && prorata < 1 ? noteProrata(creation, ctx.regles.microEntreprise.plafonds, prorata) : null,
    acre ? noteACRE(acre, annee, economie) : null,
    annonce ? noteAnnonce(annonce) : null
  ].filter((note): note is string => note !== null)
  const detailACRE = acre && acre.mois.length > 0 ? { acre: { reduction: acre.reduction, debut: ecrireMois(acre.debut), fin: ecrireMois(acre.fin), mois: acre.mois, economie: Math.round(economie) } } : {}
  return { ...detailACRE, ...(notes.length > 0 ? { dispositifs: notes } : {}) }
}

/**
 * Accès au versement libératoire : le revenu fiscal de référence N-2 du foyer du titulaire
 * ne doit pas dépasser un seuil proportionnel à son nombre de parts.
 */
function analyserVersementLiberatoire(ctx: Contexte, micro: MicroEntreprise, titulaire: string | undefined): VersementLiberatoireInfo {
  const foyer = titulaire ? ctx.foyers.find(f => f.declarantIds.includes(titulaire) || f.enfantIds.includes(titulaire)) : undefined
  const partsFiscales = foyer?.totalParts ?? 1
  const plafondRfr = plafondRfrVersementLiberatoire(partsFiscales, ctx.regles)
  const { rfrN2, origineRfr } = rfrDuTitulaire(ctx, micro, titulaire)
  const eligible = rfrN2 === null ? null : rfrN2 <= plafondRfr
  const anneeRfr = anneeSimulee(ctx) - 2
  return { plafondRfr, partsFiscales, rfrN2, anneeRfr, origineRfr, eligible, applique: micro.opteVFL && eligible !== false }
}

/**
 * Revenu fiscal de référence N-2 du foyer du titulaire : celui que la simulation a calculé quand l'année N-2 en fait
 * partie, sinon celui saisi dans la fiche de la micro-entreprise.
 */
function rfrDuTitulaire(ctx: Contexte, micro: MicroEntreprise, titulaire: string | undefined): Pick<VersementLiberatoireInfo, "rfrN2" | "origineRfr"> {
  const calcule = titulaire === undefined ? undefined : ctx.annee.rfrN2?.parPersonne[titulaire]
  if (calcule !== undefined) return { rfrN2: calcule, origineRfr: "calcule" }
  if (micro.rfrN2 !== undefined) return { rfrN2: micro.rfrN2, origineRfr: "saisi" }
  return { rfrN2: null, origineRfr: null }
}

function avertissementsVersementLiberatoire(micro: MicroEntreprise, vfl: VersementLiberatoireInfo): string[] {
  if (!micro.opteVFL) return []
  const parts = vfl.partsFiscales.toLocaleString("fr-FR")
  if (vfl.eligible === false) {
    const origine = vfl.origineRfr === "calcule" ? "calculé par la simulation" : "saisi dans la fiche"
    return [`Versement libératoire impossible : le revenu fiscal de référence ${vfl.anneeRfr} (${euros(vfl.rfrN2 ?? 0)}, ${origine}) dépasse le seuil de ${euros(vfl.plafondRfr)} pour ${parts} part(s). L'impôt est calculé au barème.`]
  }
  if (vfl.eligible === null) {
    return [`Versement libératoire : il n'est ouvert que si le revenu fiscal de référence ${vfl.anneeRfr} du foyer ne dépasse pas ${euros(vfl.plafondRfr)} pour ${parts} part(s). Ajoutez l'année ${vfl.anneeRfr} à la simulation pour qu'il soit calculé, ou renseignez-le dans la fiche de la micro-entreprise.`]
  }
  return []
}

/**
 * Quand le titulaire a d'autres micro-entreprises : leur chiffre d'affaires réuni, sur lequel se jugent les plafonds
 * du régime et la franchise de TVA (les soins exonérés de chacune mis à part), et la part des plafonds de l'année, celle
 * de la plus ancienne. Pour une micro-entreprise seule, le cas ordinaire : rien à réunir, et la part de ses propres
 * plafonds.
 */
function entrepriseDuTitulaire(ctx: Contexte, micro: MicroEntreprise): { reunie: { entreprise?: EntrepriseDuTitulaire }; prorata: number } {
  const micros = microsReunies(ctx.session, micro.id).filter((e): e is MicroEntreprise => e.type === "micro-entreprise")
  if (micros.length < 2) return { reunie: {}, prorata: prorataDesPlafonds(lireMois(micro.dateDeCreation), anneeSimulee(ctx)) }
  const reunir = (pourLaTVA: boolean): ChiffreAffairesMicro => {
    const somme = { caVente: 0, caServicesBic: 0, caServicesBnc: 0 }
    for (const m of micros) {
      const soinsExoneres = pourLaTVA && (professionDe(m, ctx.regles)?.soinsExoneresDeTVA ?? false)
      somme.caVente += total(ctx, m.id, "ca_micro_vente")
      somme.caServicesBic += total(ctx, m.id, "ca_micro_services_bic")
      somme.caServicesBnc += soinsExoneres ? 0 : total(ctx, m.id, "ca_micro_services_bnc")
    }
    return somme
  }
  return { reunie: { entreprise: { chiffreAffaires: reunir(false), chiffreAffairesSoumisALaTVA: reunir(true), activites: micros.map(m => m.name) } }, prorata: prorataDeLEntreprise(micros, anneeSimulee(ctx)) }
}

export function simulerMicroEntreprise(ctx: Contexte, micro: MicroEntreprise): ActivityResult {
  const titulaire = dirigeantsDe(ctx, micro)[0]
  const vfl = analyserVersementLiberatoire(ctx, micro, titulaire)
  // Un affilié de la CIPAV a son propre taux global sur ses BNC (cotisations, ACRE) ; les autres, celui de l'année.
  const profession = professionDe(micro, ctx.regles)
  const reglesMicro = reglesDeLaMicro(ctx.regles, profession)
  // Avec une date de création : ACRE limitée aux mois qu'elle couvre, plafonds au prorata l'année de création.
  const acre = acreDeLAnnee(micro, anneeSimulee(ctx), ctx.session.monthlyData, reglesMicro)
  const { reunie, prorata } = entrepriseDuTitulaire(ctx, micro)
  const resultat = calculerMicro(
    {
      caVente: total(ctx, micro.id, "ca_micro_vente"),
      caServicesBic: total(ctx, micro.id, "ca_micro_services_bic"),
      caServicesBnc: total(ctx, micro.id, "ca_micro_services_bnc"),
      beneficieACRE: micro.beneficieACRE,
      ...(acre ? { caSousACRE: acre.chiffreAffaires, reductionACRE: acre.reduction } : {}),
      prorataPlafonds: prorata,
      opteVFL: vfl.applique,
      soinsExoneresDeTVA: profession?.soinsExoneresDeTVA ?? false,
      ...reunie
    },
    reglesMicro
  )
  const warnings = [...resultat.warnings, ...avertissementsVersementLiberatoire(micro, vfl), ...avertissementsDeLaProfession(profession, "micro"), ...anomaliesDeLActivite(ctx, micro), ...avertissementsAvantLaCreation(ctx.session.monthlyData, micro, anneeSimulee(ctx))]
  // Au régime micro, les dépenses réelles ne réduisent ni les cotisations ni l'impôt : elles ne pèsent que sur la trésorerie.
  // Il en va de même du coût des salariés et des déplacements professionnels.
  const masse = masseSalariale(ctx, micro.id)
  const deplacements = deplacementsProfessionnels(ctx, micro)
  const depenses = total(ctx, micro.id, "expense") + masse.cout + deplacements
  const revenuVerse = resultat.chiffreAffaires - resultat.cotisationsSociales - depenses
  // Implantée en zone : une part du bénéfice après abattement est exonérée d'impôt sur le revenu. Au versement
  // libératoire, impôt sur le chiffre d'affaires, il n'y a pas de bénéfice à exonérer (BOI-BIC-DECLA-10-40-20, § 140).
  const zone = zoneDeLActivite(micro, anneeSimulee(ctx), ctx.regles)
  const beneficeExonere = vfl.applique ? 0 : beneficeExonereDeLActivite(zone, resultat.revenuImposable)

  if (titulaire) {
    const revenus = revenusDe(ctx, titulaire)
    revenus.beneficesImposables += resultat.revenuImposable - beneficeExonere
    revenus.beneficesExoneres += beneficeExonere
    revenus.versementLiberatoire += resultat.versementLiberatoire
    if (vfl.applique) revenus.revenusAuVersementLiberatoire += resultat.revenuApresAbattement
    revenus.beneficesEncaisses += revenuVerse
    revenus.prelevementsActivites += resultat.cotisationsSociales
  } else {
    warnings.push("Aucune relation « Titulaire » vers une personne : les revenus de cette micro-entreprise ne sont rattachés à aucun foyer.")
    ctx.nonRattache += revenuVerse
  }

  const activite: ActivityResult = {
    entityId: micro.id,
    name: micro.name,
    type: "micro-entreprise",
    statut: "Micro-entreprise",
    chiffreAffaires: resultat.chiffreAffaires,
    charges: depenses - masse.patronales,
    cotisationsSociales: resultat.cotisationsSociales + masse.patronales,
    impotSocietes: 0,
    revenuVerse,
    resultatConserve: 0,
    beneficiaireIds: titulaire ? [titulaire] : [],
    versementLiberatoire: { ...vfl, plafondRfr: Math.round(vfl.plafondRfr) },
    formationProfessionnelle: Math.round(resultat.formationProfessionnelle),
    ...detailSalaries(masse),
    ...detailDeplacements(micro, deplacements, false),
    ...detailDispositifsMicro(ctx, micro, acre, prorata, reglesMicro),
    ...detailProfession(profession, ctx.regles, true),
    warnings
  }
  // Recettes libérales : des prestations BNC, hors des professions de santé de la CARPIMKO.
  const recettesLiberales = total(ctx, micro.id, "ca_micro_services_bnc") > 0 && profession?.caisse !== "CARPIMKO"
  return avecLaZone(activite, detailDeLaZone(zone, anneeSimulee(ctx), ctx.regles, { beneficeExonere, versementLiberatoire: vfl.applique, recettesLiberales }))
}
