// src/backend/logic/frais-kilometriques.ts

import type { FraisReels, PuissanceFiscale } from "../../types.js"
import type { BaremeKilometrique } from "./regles.js"

/** La voiture utilisée : sa puissance fiscale, et si elle est 100 % électrique. */
export interface Vehicule {
  puissanceFiscale: PuissanceFiscale
  electrique: boolean
}

/**
 * Montant du barème kilométrique pour la distance parcourue dans l'année avec une voiture (BOI-BAREME-000001) :
 * la tranche est celle de la distance totale de l'année (jusqu'à 5 000 km, de 5 001 à 20 000 km, au-delà), et son
 * montant `d x taux + forfait` s'applique à toute la distance. Majoré de 20 % pour un véhicule électrique.
 */
export function montantBaremeKilometrique(distanceAnnuelle: number, vehicule: Vehicule, bareme: BaremeKilometrique): number {
  if (!(distanceAnnuelle > 0)) return 0
  const tranches = bareme.voitures[vehicule.puissanceFiscale]
  const tranche = tranches.find(t => t.jusquA === null || distanceAnnuelle <= t.jusquA) ?? tranches[tranches.length - 1]
  const montant = distanceAnnuelle * tranche.taux + tranche.forfait
  return vehicule.electrique ? montant * (1 + bareme.majorationElectrique) : montant
}

/** Trajets domicile-travail d'une personne : distance d'un aller simple et nombre de jours travaillés dans l'année. */
export interface TrajetsDomicileTravail {
  kmParTrajet: number
  joursTravailles: number
  /** Distance au-delà de 40 km justifiée par des circonstances particulières : elle est alors retenue entière. */
  distanceJustifiee: boolean
}

/**
 * Distance annuelle déductible des trajets domicile-travail (article 83, 3° du CGI) : un aller-retour par jour travaillé
 * (un seul, sauf contraintes particulières que le simulateur ne modélise pas), chaque trajet limité à 40 km sauf
 * distance plus longue justifiée.
 */
export function distanceDomicileTravail(trajets: TrajetsDomicileTravail, regles: BaremeKilometrique["domicileTravail"]): number {
  const kmParTrajet = Math.max(0, trajets.kmParTrajet)
  const retenus = trajets.distanceJustifiee ? kmParTrajet : Math.min(kmParTrajet, regles.distanceMaxParTrajet)
  return 2 * retenus * Math.max(0, trajets.joursTravailles)
}

/**
 * Frais réels d'une personne sur ses revenus imposés comme des salaires : ses trajets domicile-travail au barème
 * kilométrique de l'année, et ses autres frais réels saisis.
 */
export function fraisReelsDeLaPersonne(frais: FraisReels, bareme: BaremeKilometrique): { distanceRetenue: number; fraisDeTrajet: number; total: number } {
  const distanceRetenue = distanceDomicileTravail(frais, bareme.domicileTravail)
  const fraisDeTrajet = montantBaremeKilometrique(distanceRetenue, frais, bareme)
  return { distanceRetenue, fraisDeTrajet, total: fraisDeTrajet + Math.max(0, frais.autresFrais) }
}
