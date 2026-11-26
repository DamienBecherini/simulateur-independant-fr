// src/lib/epargne-retraite.ts
// Ce que la carte d'un foyer et le rapport Markdown disent de son épargne retraite (PER, ADR 021) : les lignes du bloc
// « Épargne retraite (PER) », la mention sous le net et la précision du revenu fiscal de référence. Les montants
// viennent du moteur ; ce module ne fait que les nommer.

import type { EpargneRetraiteDeLaPersonne, FoyerFiscalResult, PlafondReporte, SimulationReport } from "@/types"
import { baseDuPlafondCalculeEnClair, consigneDeLaMiseEnCommun, origineDuPlafondEnClair, plafondMinimalDeLAnnee } from "@/backend/logic/epargne-retraite"
import { deNom, euros, pourcent } from "@/backend/logic/format"
import { premiereAnneeSimulable } from "@/backend/logic/regles"
import { reglesDeLAnneeAffichee } from "./regles-affichees"

/** Une ligne du bloc « Épargne retraite (PER) » d'un foyer. */
interface LigneEpargneRetraite {
  /** Ce que la ligne dit, pour la retrouver : l'écran met en valeur l'impôt économisé et replie le reste en affichage « Résumé ». */
  nature: "verse" | "deduit" | "nonDeduit" | "economie" | "reste" | "plafondCalcule"
  libelle: string
  /** Montant ou montants mis en forme : « 4 710 € », « 9 000 € et 4 806 € ». */
  valeur: string
  precision?: string
}

/** Le bloc « Épargne retraite (PER) » d'un foyer qui a versé : ses lignes, et la consigne d'un couple dont les plafonds sont mis en commun. */
export interface BlocEpargneRetraite {
  lignes: LigneEpargneRetraite[]
  /** Ce qu'un couple doit faire pour que la mise en commun soit retenue (case 6QR) ; `null` sans mise en commun. */
  consigne: string | null
}

type NomDe = (personId: string) => string

const total = (personnes: EpargneRetraiteDeLaPersonne[], montant: (personne: EpargneRetraiteDeLaPersonne) => number) => personnes.reduce((cumul, personne) => cumul + montant(personne), 0)
const impute = (personne: EpargneRetraiteDeLaPersonne) => personne.imputeSurSesPlafonds + personne.imputeSurLeConjoint
const sommeDesPlafonds = (plafonds: PlafondReporte[]) => plafonds.reduce((cumul, plafond) => cumul + plafond.montant, 0)

/** « Paul et Sophie », « Paul, Sophie et Léa ». */
function enumeration(elements: string[]): string {
  return elements.length <= 1 ? elements.join("") : `${elements.slice(0, -1).join(", ")} et ${elements[elements.length - 1]}`
}

/** Le plafond d'une personne qui a versé : son montant et son origine, ou ses plafonds reportés avec lui. */
function plafondEnClair(personne: EpargneRetraiteDeLaPersonne, annee: number, nom: string): string {
  const reportes = sommeDesPlafonds(personne.plafondsReportes)
  const deLAnnee = `${euros(personne.plafond)}, ${origineDuPlafondEnClair(personne, annee, nom)}`
  if (reportes === 0) return `plafond pour les versements de ${annee} : ${deLAnnee}`
  return `plafonds utilisables en ${annee} : ${euros(personne.plafond + reportes)}, dont ${euros(reportes)} reportés des années précédentes (plafond de l'année : ${deLAnnee})`
}

/** Ce que la ligne « Déduit du revenu » précise : le revenu qui a manqué, le plafond de chacun, ou ce qui est pris sur celui du conjoint. */
function precisionDeLaDeduction(foyer: FoyerFiscalResult, annee: number, nomDe: NomDe): string {
  const { personnes, miseEnCommun } = foyer.epargneRetraite
  const deduction = foyer.deductionEpargneRetraite ?? 0
  if (deduction < total(personnes, impute)) return deduction === 0 ? "aucun revenu imposable au barème" : `le foyer n'a que ${euros(foyer.revenuImposableGlobal + deduction)} de revenu imposable au barème`
  const versants = personnes.filter(personne => personne.verse > 0)
  if (miseEnCommun) {
    const surLesSiens = versants.filter(personne => personne.imputeSurSesPlafonds > 0).map(personne => `${euros(personne.imputeSurSesPlafonds)} sur le plafond ${deNom(nomDe(personne.personId))}`)
    const surLeConjoint = personnes.filter(personne => personne.preteAuConjoint > 0).map(personne => `${euros(personne.preteAuConjoint)} sur celui ${deNom(nomDe(personne.personId))}`)
    return [...surLesSiens, ...surLeConjoint].join(", ")
  }
  return versants.map(personne => (versants.length > 1 ? `${nomDe(personne.personId)} : ${plafondEnClair(personne, annee, nomDe(personne.personId))}` : plafondEnClair(personne, annee, nomDe(personne.personId)))).join(" ; ")
}

/** Ce qui reste des plafonds d'une personne après les versements du foyer ; rien quand tout est utilisé. */
function ligneDuReste(personne: EpargneRetraiteDeLaPersonne, plusieurs: boolean, nomDe: NomDe): LigneEpargneRetraite[] {
  const libelle = plusieurs ? `Reste à ${nomDe(personne.personId)}` : "Reste du plafond"
  // Le reste du plafond saisi ne se reporte pas : on n'en connaît que le total (hypothèse 1 de l'ADR 021).
  if (personne.originePlafond === "saisi") {
    if (!personne.resteNonReporte) return []
    return [{ nature: "reste", libelle, valeur: euros(personne.resteNonReporte.montant), precision: "du plafond saisi ; non reporté sur les années suivantes, faute de connaître l'année d'origine de chaque part" }]
  }
  const restants = personne.plafondsRestants
  if (restants.length === 0) return []
  const precision = restants.length === 1 ? `${plusieurs ? "de son" : "du"} plafond de ${restants[0].annee}, utilisables jusqu'en ${restants[0].utilisableJusquEn}` : restants.map(plafond => `${euros(plafond.montant)} du plafond de ${plafond.annee}, jusqu'en ${plafond.utilisableJusquEn}`).join(" ; ")
  return [{ nature: "reste", libelle, valeur: euros(sommeDesPlafonds(restants)), precision }]
}

/** Le plafond que l'année prépare à la suivante, pour ceux que les versements du foyer concernent. */
function ligneDesPlafondsCalcules(concernes: EpargneRetraiteDeLaPersonne[], annee: number, partDesRevenus: number, nomDe: NomDe): LigneEpargneRetraite {
  if (concernes.length === 1) {
    return { nature: "plafondCalcule", libelle: `Plafond calculé sur ${annee}`, valeur: euros(concernes[0].plafondCalcule), precision: `pour les versements de ${annee + 1} : ${baseDuPlafondCalculeEnClair(concernes[0], annee, partDesRevenus)}` }
  }
  return { nature: "plafondCalcule", libelle: `Plafonds calculés sur ${annee}`, valeur: enumeration(concernes.map(personne => euros(personne.plafondCalcule))), precision: `${enumeration(concernes.map(personne => nomDe(personne.personId)))}, pour les versements de ${annee + 1}` }
}

/**
 * Le bloc « Épargne retraite (PER) » d'un foyer, ou `null` s'il n'a rien versé dans l'année : ce que chacun a versé,
 * ce qui est déduit et sur quel plafond, ce qui ne l'est pas, l'impôt économisé, ce qui reste des plafonds et le
 * plafond que l'année prépare à la suivante. Les noms ne sont écrits que dans un foyer de plusieurs personnes.
 */
export function blocEpargneRetraite(foyer: FoyerFiscalResult, annee: number, nomDe: NomDe): BlocEpargneRetraite | null {
  if (!foyer.versementsEpargneRetraite) return null
  const { personnes, trancheMarginale, partDesRevenus } = foyer.epargneRetraite
  const plusieurs = personnes.length > 1
  const deduction = foyer.deductionEpargneRetraite ?? 0
  const nonDeduit = total(personnes, personne => personne.nonDeduit)
  // Ceux que les versements concernent : qui a versé, et qui a prêté de son plafond.
  const concernes = personnes.filter(personne => personne.verse > 0 || personne.preteAuConjoint > 0)
  return {
    lignes: [
      ...personnes.filter(personne => personne.verse > 0).map((personne): LigneEpargneRetraite => ({ nature: "verse", libelle: plusieurs ? `Versé en ${annee} par ${nomDe(personne.personId)}` : `Versé en ${annee}`, valeur: euros(personne.verse) })),
      { nature: "deduit", libelle: "Déduit du revenu", valeur: deduction > 0 ? `− ${euros(deduction)}` : euros(0), precision: precisionDeLaDeduction(foyer, annee, nomDe) },
      ...(nonDeduit > 0 ? [{ nature: "nonDeduit", libelle: "Non déduit", valeur: euros(nonDeduit), precision: "au-delà du plafond, sans report" } satisfies LigneEpargneRetraite] : []),
      { nature: "economie", libelle: "Impôt économisé", valeur: euros(foyer.impotEconomiseEpargneRetraite ?? 0), ...(deduction > 0 ? { precision: `impôt recalculé sans le versement ; tranche marginale : ${pourcent(trancheMarginale)} (indicatif)` } : {}) },
      ...concernes.flatMap(personne => ligneDuReste(personne, plusieurs, nomDe)),
      ligneDesPlafondsCalcules(concernes, annee, partDesRevenus, nomDe)
    ],
    consigne: consigneDeLaMiseEnCommun(foyer.epargneRetraite, nomDe)
  }
}

/** Ce que les exports disent en tête de leur partie sur l'épargne retraite. */
export const INTRODUCTION_DE_L_EPARGNE_RETRAITE = "Versements sur un plan d'épargne retraite déduits du revenu imposable, dans la limite du plafond de chaque personne. La somme versée reste dans le net après impôts : elle est au foyer, bloquée jusqu'à la retraite, et sa sortie sera imposée."

/** Les foyers qui ont versé sur un plan d'épargne retraite dans l'année, chacun avec son bloc. */
export function epargneRetraiteDesFoyers(report: SimulationReport, nomDe: NomDe): { foyer: FoyerFiscalResult; bloc: BlocEpargneRetraite }[] {
  return report.foyers.flatMap(foyer => {
    const bloc = blocEpargneRetraite(foyer, report.annee, nomDe)
    return bloc ? [{ foyer, bloc }] : []
  })
}

/**
 * Le libellé (« Plafond épargne retraite 2026 ») et l'aide du champ de la fiche d'une personne. Le plafond saisi vaut
 * pour la première année simulée de la session (une année d'avant les premières règles ne l'est pas) ; l'aide cite le
 * minimum que le simulateur retient cette année-là sans saisie, d'après ses règles.
 */
export function texteDuPlafondSaisi(annees: number[]): { libelle: string; aide: string } {
  const premiere = premiereAnneeSimulable(annees)
  if (premiere === undefined) return { libelle: "Plafond épargne retraite", aide: "Le plafond de déduction des versements sur un PER, sur votre avis d'impôt, rubrique « Plafond épargne retraite »." }
  const minimum = plafondMinimalDeLAnnee(premiere, reglesDeLAnneeAffichee(premiere))
  const ensuite = annees.some(annee => annee > premiere) ? " Les années suivantes, il est calculé sur les revenus de l'année précédente." : ""
  return {
    libelle: `Plafond épargne retraite ${premiere}`,
    aide: `La ligne « Plafond pour les cotisations versées en ${premiere} » de l'avis d'impôt reçu en ${premiere}. Vide : le minimum légal est retenu (${euros(minimum)}).${ensuite} Les versements se saisissent dans la grille, avec le type « Versement PER ». Marié ou pacsé : chacun saisit le sien.`
  }
}

/** Sous le net après impôts : la part qui est de l'épargne retraite, bloquée ; `null` sans versement. */
export function mentionDeLEpargneDansLeNet(versements: number | undefined): string | null {
  return versements ? `dont ${euros(versements)} d'épargne retraite (PER), bloqués jusqu'à la retraite` : null
}

/**
 * Ce qui reste au foyer après ses dépenses saisies. L'épargne retraite, comprise dans le net après impôts, n'est pas
 * disponible : elle en est retirée aussi, et la ligne le dit. `null` quand aucune dépense n'est saisie.
 */
export function resteApresDepenses(foyer: Pick<FoyerFiscalResult, "netApresImpots" | "depenses" | "versementsEpargneRetraite">): { libelle: string; montant: number; precision: string } | null {
  if (foyer.depenses <= 0) return null
  const epargne = foyer.versementsEpargneRetraite ?? 0
  if (epargne === 0) return { libelle: "Reste après dépenses saisies", montant: foyer.netApresImpots - foyer.depenses, precision: `${euros(foyer.depenses)} de dépenses` }
  return { libelle: "Reste après dépenses et épargne retraite", montant: foyer.netApresImpots - foyer.depenses - epargne, precision: `${euros(foyer.depenses)} de dépenses, ${euros(epargne)} d'épargne retraite` }
}

/** Ce que la ligne du revenu fiscal de référence précise : ce qu'il contient en plus du revenu imposable, et à quoi il sert. */
export function precisionDuRevenuFiscalDeReference(foyer: Pick<FoyerFiscalResult, "beneficesExoneres" | "deductionEpargneRetraite">): string {
  return [foyer.beneficesExoneres ? `dont ${euros(foyer.beneficesExoneres)} de bénéfice exonéré en zone` : null, foyer.deductionEpargneRetraite ? "versement PER déduit, puis rajouté" : null, "pour le versement libératoire dans deux ans"].filter(Boolean).join(" ; ")
}
