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

/** Un trajet domicile-travail : distance d'un aller simple et nombre de jours travaillés dans l'année. */
export interface TrajetDomicileTravail {
  kmParTrajet: number
  joursTravailles: number
  /** Distance au-delà de 40 km justifiée par des circonstances particulières : elle est alors retenue entière. */
  distanceJustifiee: boolean
}

/**
 * Distance annuelle déductible d'un trajet domicile-travail (article 83, 3° du CGI) : un aller-retour par jour travaillé
 * (un seul, sauf contraintes particulières que le simulateur ne modélise pas), limité à 40 km par trajet sauf distance
 * plus longue justifiée. La limite vaut pour chaque trajet : celui vers un second employeur a la sienne.
 */
export function distanceDomicileTravail(trajet: TrajetDomicileTravail, regles: BaremeKilometrique["domicileTravail"]): number {
  const kmParTrajet = Math.max(0, trajet.kmParTrajet)
  const retenus = trajet.distanceJustifiee ? kmParTrajet : Math.min(kmParTrajet, regles.distanceMaxParTrajet)
  return 2 * retenus * Math.max(0, trajet.joursTravailles)
}

/**
 * Distance annuelle retenue par voiture. Le barème est dégressif et s'applique une fois par voiture, à toute la distance
 * parcourue avec elle dans l'année : deux trajets faits avec la même voiture s'additionnent avant d'en lire la tranche,
 * et son forfait ne compte qu'une fois. Choix du simulateur : une voiture est reconnue à sa puissance fiscale et à sa
 * motorisation, seules caractéristiques que lit le barème. Deux voitures distinctes de même puissance et de même
 * motorisation sont donc comptées comme une seule : le barème étant dégressif, cette prudence ne fait en pratique que
 * réduire la déduction, jamais la gonfler.
 */
export function distancesParVoiture(trajets: (TrajetDomicileTravail & Vehicule)[], regles: BaremeKilometrique["domicileTravail"]): { vehicule: Vehicule; distance: number }[] {
  const parVoiture = new Map<string, { vehicule: Vehicule; distance: number }>()
  for (const trajet of trajets) {
    const cle = `${trajet.puissanceFiscale}-${trajet.electrique ? "electrique" : "thermique"}`
    const voiture = parVoiture.get(cle) ?? { vehicule: { puissanceFiscale: trajet.puissanceFiscale, electrique: trajet.electrique }, distance: 0 }
    voiture.distance += distanceDomicileTravail(trajet, regles)
    parVoiture.set(cle, voiture)
  }
  return [...parVoiture.values()]
}

/** Une voiture des trajets domicile-travail : la distance retenue avec elle dans l'année et son montant au barème. */
export interface VoitureDesTrajets extends Vehicule {
  distance: number
  montant: number
}

/** Frais réels calculés d'une personne : trajets au barème, voiture par voiture, et autres frais. */
export interface FraisReelsCalcules {
  distanceRetenue: number
  fraisDeTrajet: number
  autresFrais: number
  voitures: VoitureDesTrajets[]
  total: number
}

/**
 * Frais réels d'une personne sur ses revenus imposés comme des salaires : ses trajets domicile-travail au barème
 * kilométrique de l'année, une fois par voiture, et ses autres frais réels saisis.
 */
export function fraisReelsDeLaPersonne(frais: FraisReels, bareme: BaremeKilometrique): FraisReelsCalcules {
  const voitures = distancesParVoiture(frais.trajets, bareme.domicileTravail).map(({ vehicule, distance }) => ({ ...vehicule, distance, montant: montantBaremeKilometrique(distance, vehicule, bareme) }))
  const distanceRetenue = voitures.reduce((somme, voiture) => somme + voiture.distance, 0)
  const fraisDeTrajet = voitures.reduce((somme, voiture) => somme + voiture.montant, 0)
  const autresFrais = Math.max(0, frais.autresFrais)
  return { distanceRetenue, fraisDeTrajet, autresFrais, voitures, total: fraisDeTrajet + autresFrais }
}
