// src/backend/logic/frais-reels.test.ts

import { describe, expect, it } from "vitest"
import type { Entity, FraisReels, Person, Relationship, SimulationReport, Trajet } from "../../types.js"
import { runMetaSimulation } from "./simulation-engine.js"
import { reglesDeTest } from "./testing/regles-de-test.js"
import { micro, personne, relation, session, societe, type Flux } from "./testing/session-de-test.js"

/*
 * Frais réels sur les revenus imposés comme des salaires, avec les règles de test : déduction de 10 % entre 500 et
 * 14 000 €, barème kilométrique de 5 CV à 0,6 €/km jusqu'à 5 000 km, 0,4 €/km + 1 000 € jusqu'à 20 000 km ; de 3 CV à
 * 0,5 €/km puis 0,3 €/km + 1 000 € ; trajets retenus jusqu'à 40 km ; impôt à 10 % de 10 000 à 30 000 €, décote de
 * 800 € moins la moitié de l'impôt.
 */

const simuler = (entities: Entity[], relationships: Relationship[] = [], flux: Flux[] = []) => runMetaSimulation(session(entities, relationships, flux), reglesDeTest)

const sansTrajet: Trajet = { libelle: "", kmParTrajet: 0, joursTravailles: 0, puissanceFiscale: "5", electrique: false, distanceJustifiee: false }

const trajet = (champs: Partial<Trajet>): Trajet => ({ ...sansTrajet, ...champs })

/** Une personne avec un seul trajet (les champs du trajet) et ses autres frais. */
function avecFrais(id: string, { autresFrais = 0, ...champs }: Partial<Trajet> & { autresFrais?: number }): Person {
  return { ...personne(id), fraisReels: { trajets: [trajet(champs)], autresFrais } }
}

function avecTrajets(id: string, trajets: Partial<Trajet>[], autresFrais = 0): Person {
  const fraisReels: FraisReels = { trajets: trajets.map(trajet), autresFrais }
  return { ...personne(id), fraisReels }
}

/** 20 km par trajet, 200 jours, 5 CV : 8 000 km, soit 8 000 x 0,4 + 1 000 = 4 200 €. */
const trajets20km: Partial<Trajet> = { kmParTrajet: 20, joursTravailles: 200 }

function personDe(report: SimulationReport, id: string) {
  const resultat = report.persons.find(p => p.entityId === id)
  if (!resultat) throw new Error(`Personne ${id} absente du rapport`)
  return resultat
}

const foyerDe = (report: SimulationReport, id: string) => report.foyers.find(f => f.personIds.includes(id))!

describe("frais réels sur les salaires", () => {
  it("retient les frais réels quand ils dépassent la déduction de 10 %", () => {
    const report = simuler([avecFrais("alice", trajets20km)], [], [["alice", "salary", 30000]])

    expect(personDe(report, "alice").fraisProfessionnels).toEqual({ revenusSalariaux: 30000, deductionForfaitaire: 3000, fraisReels: 4200, fraisDeTrajet: 4200, distanceRetenue: 8000, nombreDeTrajets: 1, voitures: [{ puissanceFiscale: "5", electrique: false, distance: 8000, montant: 4200 }], autresFrais: 0, retenue: "reels", deduction: 4200 })
    // Imposable : 30 000 - 4 200 = 25 800 € ; impôt 1 580 €, décote 800 - 790 = 10 €, soit 1 570 €.
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 25800, impotSurLeRevenu: 1570 })
  })

  it("garde la déduction de 10 % quand elle est plus favorable", () => {
    // 5 km par trajet, 200 jours, 3 CV : 2 000 km x 0,5 = 1 000 €, moins que 3 000 €.
    const report = simuler([avecFrais("alice", { kmParTrajet: 5, joursTravailles: 200, puissanceFiscale: "3" })], [], [["alice", "salary", 30000]])

    expect(personDe(report, "alice").fraisProfessionnels).toMatchObject({ deductionForfaitaire: 3000, fraisReels: 1000, retenue: "forfait", deduction: 3000 })
    expect(foyerDe(report, "alice").revenuImposableGlobal).toBe(27000)
  })

  it("compare les frais réels au minimum de la déduction de 10 %", () => {
    // 10 % de 3 000 € = 300 €, porté au minimum de 500 €.
    const forfait = simuler([avecFrais("alice", { autresFrais: 400 })], [], [["alice", "salary", 3000]])
    expect(personDe(forfait, "alice").fraisProfessionnels).toMatchObject({ deductionForfaitaire: 500, retenue: "forfait", deduction: 500 })

    const reels = simuler([avecFrais("alice", { autresFrais: 600 })], [], [["alice", "salary", 3000]])
    expect(personDe(reels, "alice").fraisProfessionnels).toMatchObject({ deductionForfaitaire: 500, retenue: "reels", deduction: 600 })
  })

  it("compare les frais réels au maximum de la déduction de 10 %", () => {
    // 10 % de 200 000 € = 20 000 €, ramené au maximum de 14 000 €.
    const forfait = simuler([avecFrais("alice", { autresFrais: 13000 })], [], [["alice", "salary", 200000]])
    expect(personDe(forfait, "alice").fraisProfessionnels).toMatchObject({ deductionForfaitaire: 14000, retenue: "forfait", deduction: 14000 })

    const reels = simuler([avecFrais("alice", { autresFrais: 15000 })], [], [["alice", "salary", 200000]])
    expect(personDe(reels, "alice").fraisProfessionnels).toMatchObject({ retenue: "reels", deduction: 15000 })
    expect(foyerDe(reels, "alice").revenuImposableGlobal).toBe(185000)
  })

  it("ne déduit jamais plus que les revenus imposés comme des salaires", () => {
    const report = simuler([avecFrais("alice", { autresFrais: 5000 })], [], [
      ["alice", "salary", 2000],
      ["alice", "other_taxable_income", 15000]
    ])

    expect(personDe(report, "alice").fraisProfessionnels).toMatchObject({ fraisReels: 5000, retenue: "reels", deduction: 2000 })
    // Les 3 000 € de frais au-delà du salaire ne réduisent pas les autres revenus.
    expect(foyerDe(report, "alice").revenuImposableGlobal).toBe(15000)
  })

  it("limite chaque trajet à 40 km, sauf distance justifiée", () => {
    // 60 km par trajet, 100 jours, 3 CV : 40 x 2 x 100 = 8 000 km, soit 3 400 € ; justifiés, 12 000 km, soit 4 600 €.
    const limite = simuler([avecFrais("alice", { kmParTrajet: 60, joursTravailles: 100, puissanceFiscale: "3" })], [], [["alice", "salary", 30000]])
    expect(personDe(limite, "alice").fraisProfessionnels).toMatchObject({ distanceRetenue: 8000, fraisReels: 3400 })

    const justifiee = simuler([avecFrais("alice", { kmParTrajet: 60, joursTravailles: 100, puissanceFiscale: "3", distanceJustifiee: true })], [], [["alice", "salary", 30000]])
    expect(personDe(justifiee, "alice").fraisProfessionnels).toMatchObject({ distanceRetenue: 12000, fraisReels: 4600 })
  })

  it("majore de 20 % les trajets en voiture électrique, et ajoute les autres frais", () => {
    const report = simuler([avecFrais("alice", { ...trajets20km, electrique: true, autresFrais: 500 })], [], [["alice", "salary", 30000]])

    expect(personDe(report, "alice").fraisProfessionnels).toMatchObject({ fraisDeTrajet: 5040, fraisReels: 5540, deduction: 5540 })
  })

  it("s'applique à la rémunération du président de SASU et aux allocations chômage", () => {
    const report = simuler(
      [avecFrais("alice", trajets20km), societe("sasu")],
      [relation("alice", "sasu", "Président")],
      [
        ["sasu", "ca_services", 100000],
        ["sasu", "director_remuneration", 24300],
        ["alice", "are", 5000]
      ]
    )

    // Rémunération imposable 24 300 + 810 (CSG non déductible et CRDS) = 25 110 €, plus 5 000 € d'allocations.
    expect(personDe(report, "alice").fraisProfessionnels).toMatchObject({ revenusSalariaux: 30110, deductionForfaitaire: 3011, retenue: "reels", deduction: 4200 })
    expect(foyerDe(report, "alice").revenuImposableGlobal).toBe(25910)
  })

  it("ne touche ni les bénéfices d'une micro-entreprise, ni ceux d'une entreprise individuelle, ni les dividendes", () => {
    const sansSalaire = (avecFraisReels: boolean) =>
      simuler(
        [avecFraisReels ? avecFrais("alice", { ...trajets20km, autresFrais: 3000 }) : personne("alice"), micro("m"), societe("ei", "EI"), societe("sasu")],
        [relation("alice", "m", "Titulaire"), relation("alice", "ei", "Titulaire"), relation("alice", "sasu", "Président")],
        [
          ["m", "ca_micro_services_bnc", 30000],
          ["ei", "ca_services", 20000],
          ["sasu", "ca_services", 50000],
          ["sasu", "dividends_payment", 10000]
        ]
      )

    const avec = sansSalaire(true)
    expect(personDe(avec, "alice").fraisProfessionnels).toBeUndefined()
    expect(avec.foyers).toEqual(sansSalaire(false).foyers)
  })

  it("laisse chaque personne d'un foyer choisir pour elle-même", () => {
    const report = simuler(
      [avecFrais("alice", trajets20km), avecFrais("bob", { autresFrais: 100 })],
      [relation("alice", "bob", "Marié(e)")],
      [
        ["alice", "salary", 30000],
        ["bob", "salary", 30000]
      ]
    )

    expect(personDe(report, "alice").fraisProfessionnels?.retenue).toBe("reels")
    expect(personDe(report, "bob").fraisProfessionnels?.retenue).toBe("forfait")
    // 30 000 - 4 200 + 30 000 - 3 000.
    expect(foyerDe(report, "alice").revenuImposableGlobal).toBe(52800)
  })

  describe("plusieurs trajets, vers plusieurs lieux de travail", () => {
    // Trajet A : 20 km, 120 jours, soit 4 800 km. Trajet B : 10 km, 100 jours, soit 2 000 km.
    const a: Partial<Trajet> = { libelle: "Employeur A", kmParTrajet: 20, joursTravailles: 120 }
    const b: Partial<Trajet> = { libelle: "Employeur B", kmParTrajet: 10, joursTravailles: 100 }
    const salaires: Flux[] = [
      ["alice", "salary", 20000],
      ["alice", "salary", 10000]
    ]

    it("additionne les distances d'une même voiture avant d'appliquer le barème, une seule fois", () => {
      // 6 800 km en 5 CV : 6 800 x 0,4 + 1 000 = 3 720 €, et non 4 800 x 0,6 + 2 000 x 0,6 = 4 080 €.
      const report = simuler([avecTrajets("alice", [a, b])], [], salaires)

      expect(personDe(report, "alice").fraisProfessionnels).toEqual({ revenusSalariaux: 30000, deductionForfaitaire: 3000, fraisReels: 3720, fraisDeTrajet: 3720, distanceRetenue: 6800, nombreDeTrajets: 2, voitures: [{ puissanceFiscale: "5", electrique: false, distance: 6800, montant: 3720 }], autresFrais: 0, retenue: "reels", deduction: 3720 })
    })

    it("applique le barème à chaque voiture, reconnue à sa puissance et à sa motorisation", () => {
      // 4 800 km en 5 CV : 2 880 € ; 2 000 km en 3 CV : 1 000 €. Total 3 880 €.
      const deuxPuissances = simuler([avecTrajets("alice", [a, { ...b, puissanceFiscale: "3" }])], [], salaires)
      expect(personDe(deuxPuissances, "alice").fraisProfessionnels).toMatchObject({
        fraisDeTrajet: 3880,
        distanceRetenue: 6800,
        voitures: [
          { puissanceFiscale: "5", electrique: false, distance: 4800, montant: 2880 },
          { puissanceFiscale: "3", electrique: false, distance: 2000, montant: 1000 }
        ]
      })

      // 4 800 km en 5 CV : 2 880 € ; 2 000 km en 5 CV électrique : 1 200 x 1,2 = 1 440 €. Total 4 320 €.
      const electrique = simuler([avecTrajets("alice", [a, { ...b, electrique: true }])], [], salaires)
      expect(personDe(electrique, "alice").fraisProfessionnels).toMatchObject({ fraisDeTrajet: 4320, distanceRetenue: 6800 })
    })

    it("limite chaque trajet à 40 km séparément, selon sa propre justification", () => {
      // 60 km non justifiés, 100 jours : 40 x 2 x 100 = 8 000 km ; 50 km justifiés, 50 jours : 5 000 km.
      // 13 000 km en 5 CV : 13 000 x 0,4 + 1 000 = 6 200 €.
      const report = simuler([avecTrajets("alice", [{ kmParTrajet: 60, joursTravailles: 100 }, { kmParTrajet: 50, joursTravailles: 50, distanceJustifiee: true }])], [], salaires)

      expect(personDe(report, "alice").fraisProfessionnels).toMatchObject({ distanceRetenue: 13000, fraisDeTrajet: 6200 })
    })

    it("fait un seul choix entre la déduction de 10 % et les frais réels, pour le salaire et la rémunération de dirigeant ensemble", () => {
      const report = simuler(
        [avecTrajets("alice", [a, b], 500), societe("sasu")],
        [relation("alice", "sasu", "Président")],
        [
          ["alice", "salary", 20000],
          ["sasu", "ca_services", 100000],
          ["sasu", "director_remuneration", 24300]
        ]
      )

      // Revenus 20 000 + 25 110 = 45 110 € ; 10 % : 4 511 € ; frais réels 3 720 + 500 = 4 220 € : la déduction de 10 % l'emporte.
      expect(personDe(report, "alice").fraisProfessionnels).toMatchObject({ revenusSalariaux: 45110, deductionForfaitaire: 4511, fraisReels: 4220, retenue: "forfait", deduction: 4511 })
    })

    it("accepte une personne sans trajet, avec seulement d'autres frais", () => {
      const report = simuler([avecTrajets("alice", [], 3500)], [], salaires)

      expect(personDe(report, "alice").fraisProfessionnels).toMatchObject({ fraisDeTrajet: 0, distanceRetenue: 0, nombreDeTrajets: 0, voitures: [], autresFrais: 3500, fraisReels: 3500, retenue: "reels" })
    })
  })

  it("n'affiche rien pour une personne sans frais réels saisis", () => {
    const report = simuler([personne("alice")], [], [["alice", "salary", 30000]])

    expect(personDe(report, "alice").fraisProfessionnels).toBeUndefined()
    expect(foyerDe(report, "alice").revenuImposableGlobal).toBe(27000)
  })
})
