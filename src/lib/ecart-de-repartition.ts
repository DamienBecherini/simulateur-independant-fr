// src/lib/ecart-de-repartition.ts
// D'où vient l'écart de la colonne du statut actuel, quand une société y est simulée avec un autre partage du bénéfice
// que celui de la grille (au meilleur net, tout en rémunération, répartition sur mesure). La colonne et la situation
// saisie ont le même statut : seuls changent la rémunération et les dividendes, et ce que le foyer en paie. On les met
// côte à côte, poste par poste, pour que « +1 200 € » se lise « 12 000 € de rémunération au lieu de 0 € ».

import { euros } from "@/backend/logic/format"
import type { ComparaisonResult, ScenarioStatut } from "@/types"

/** Un poste du net du foyer : ce qu'il vaut dans la situation saisie et dans la colonne, et ce que l'écart ajoute au net. */
interface PosteDeLEcart {
  libelle: string
  saisie: number
  colonne: number
  /** Effet sur le net du foyer, en euros : positif s'il l'augmente (une rémunération en plus, un impôt en moins). */
  effet: number
}

export interface EcartDeRepartition {
  /** « avec 400 € de rémunération nette au lieu de 0 € » : ce qui distingue la colonne de la situation saisie. */
  resume: string
  postes: PosteDeLEcart[]
  /** Ce que les postes n'expliquent pas (cotisations d'un gérant sur ses dividendes, arrondis) ; absent sous 2 €. */
  autres?: number
  /** Bénéfice que la situation saisie laisse dans la société et que la colonne ne laisse pas, ou l'inverse. */
  conserve?: { saisie: number; colonne: number }
}

const SEUIL_DES_AUTRES_ECARTS = 2

/**
 * Le détail de l'écart d'une colonne avec la situation saisie ; `null` quand la colonne n'est pas celle du statut actuel
 * d'une société, qu'elle est la situation saisie elle-même, ou que rien n'y change.
 */
export function ecartDeRepartition(result: ComparaisonResult, scenario: ScenarioStatut): EcartDeRepartition | null {
  const saisie = result.situationSaisie?.repartition
  const partage = scenario.partage
  if (!saisie || !partage || !scenario.actuel || scenario.telleQueSaisie || !result.situationSaisie) return null
  const arrondi = (montant: number) => Math.round(montant)
  const revenu = (libelle: string, avant: number, apres: number): PosteDeLEcart => ({ libelle, saisie: arrondi(avant), colonne: arrondi(apres), effet: arrondi(apres) - arrondi(avant) })
  const prelevement = (libelle: string, avant: number, apres: number): PosteDeLEcart => ({ libelle, saisie: arrondi(avant), colonne: arrondi(apres), effet: arrondi(avant) - arrondi(apres) })
  const remuneration = revenu("Rémunération nette", saisie.remunerationNette, partage.remunerationNette)
  const dividendes = revenu("Dividendes", saisie.dividendes, partage.dividendesNets)
  const postes = [remuneration, dividendes, prelevement("Impôt sur le revenu", saisie.impotSurLeRevenu, scenario.impotSurLeRevenu), prelevement("Prélèvements sociaux", saisie.prelevementsSociaux, scenario.prelevementsSociaux)]

  const change = [remuneration, dividendes].find(poste => poste.effet !== 0)
  if (!change) return null
  const autres = arrondi(scenario.netApresImpots - result.situationSaisie.netApresImpots) - postes.reduce((somme, poste) => somme + poste.effet, 0)
  const conserve = { saisie: arrondi(saisie.resultatConserve), colonne: arrondi(partage.resultatConserve) }
  return {
    resume: `avec ${euros(change.colonne)} de ${change === remuneration ? "rémunération nette" : "dividendes"} au lieu de ${euros(change.saisie)}`,
    postes,
    ...(Math.abs(autres) >= SEUIL_DES_AUTRES_ECARTS ? { autres } : {}),
    ...(conserve.saisie !== conserve.colonne ? { conserve } : {})
  }
}
