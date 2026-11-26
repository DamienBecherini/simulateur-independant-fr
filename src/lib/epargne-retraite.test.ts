// src/lib/epargne-retraite.test.ts
// Les textes de l'épargne retraite sur la carte d'un foyer, comparés aux maquettes validées (ADR 021), sur les cas de
// l'étude calculés par le moteur avec les règles de 2026.

import { describe, expect, it } from "vitest"
import type { Entity, MicroEntreprise, Person, Relationship, SimulationReport } from "@/types"
import { enTexteBrut } from "@/backend/logic/format"
import { reglesPubliees } from "@/backend/logic/regles"
import { runMetaSimulation, type ContexteDeLAnnee } from "@/backend/logic/simulation-engine"
import { micro, personne, relation, session, type Flux } from "@/backend/logic/testing/session-de-test"
import { blocEpargneRetraite, mentionDeLEpargneDansLeNet, precisionDuRevenuFiscalDeReference, texteDuPlafondSaisi } from "./epargne-retraite"
import { csvResultats } from "./export-csv"
import { rapportMarkdown } from "./export-markdown"

const nommee = (id: string, name: string, plafondEpargneRetraite?: number): Person => ({ ...personne(id), name, ...(plafondEpargneRetraite === undefined ? {} : { plafondEpargneRetraite }) })
const simuler = (entities: Entity[], relationships: Relationship[], flux: Flux[], contexte: ContexteDeLAnnee = {}) => runMetaSimulation(session(entities, relationships, flux), reglesPubliees(2026), { annee: 2026, ...contexte })

/** Le bloc du premier foyer, en texte brut : `[libellé, valeur, précision]` par ligne. */
function bloc(report: SimulationReport, noms: Record<string, string>) {
  const resultat = blocEpargneRetraite(report.foyers[0], report.annee, id => noms[id] ?? id)!
  return { lignes: resultat.lignes.map(ligne => [ligne.libelle, enTexteBrut(ligne.valeur), ligne.precision ? enTexteBrut(ligne.precision) : null]), consigne: resultat.consigne ? enTexteBrut(resultat.consigne) : null }
}

describe("bloc « Épargne retraite (PER) » d'un foyer", () => {
  it("n'existe pas pour un foyer qui n'a rien versé", () => {
    const report = simuler([nommee("s", "Sophie")], [], [["s", "salary", 50000]])

    expect(blocEpargneRetraite(report.foyers[0], 2026, id => id)).toBeNull()
  })

  it("dit ce qui est versé, déduit et non déduit, l'impôt économisé et le plafond calculé (maquette 2)", () => {
    const report = simuler([nommee("s", "Sophie", 4710)], [], [["s", "salary", 50000], ["s", "versement_per", 5000]])

    expect(bloc(report, { s: "Sophie" })).toEqual({
      lignes: [
        ["Versé en 2026", "5 000 €", null],
        ["Déduit du revenu", "− 4 710 €", "plafond pour les versements de 2026 : 4 710 €, saisi dans la fiche de Sophie"],
        ["Non déduit", "290 €", "au-delà du plafond, sans report"],
        ["Impôt économisé", "1 413 €", "impôt recalculé sans le versement ; tranche marginale : 30 % (indicatif)"],
        ["Plafond calculé sur 2026", "4 806 €", "pour les versements de 2027 : le minimum légal (10 % des revenus d'activité professionnelle de 2026 ne donnent que 4 500 €)"]
      ],
      consigne: null
    })
  })

  it("dit ce qui reste du plafond, et quand il expire", () => {
    const report = simuler([nommee("s", "Sophie")], [], [["s", "salary", 50000], ["s", "versement_per", 3000]])
    const { lignes } = bloc(report, { s: "Sophie" })

    expect(lignes[1]).toEqual(["Déduit du revenu", "− 3 000 €", "plafond pour les versements de 2026 : 4 710 €, le minimum légal, faute de plafond saisi dans la fiche de Sophie"])
    expect(lignes[3]).toEqual(["Reste du plafond", "1 710 €", "du plafond de 2026, utilisables jusqu'en 2031"])
  })

  it("dit que le reste d'un plafond saisi n'est pas reporté", () => {
    const report = simuler([nommee("s", "Sophie", 10000)], [], [["s", "salary", 50000], ["s", "versement_per", 3000]])

    expect(bloc(report, { s: "Sophie" }).lignes[3]).toEqual(["Reste du plafond", "7 000 €", "du plafond saisi ; non reporté sur les années suivantes, faute de connaître l'année d'origine de chaque part"])
  })

  it("détaille les plafonds reportés d'une année suivante", () => {
    const herites = { plafondCalcule: 5400, plafondsRestants: [{ annee: 2024, montant: 3399, utilisableJusquEn: 2027 }, { annee: 2025, montant: 4400, utilisableJusquEn: 2028 }] }
    const report = simuler([nommee("s", "Sophie")], [], [["s", "salary", 60000], ["s", "versement_per", 6000]], { epargneRetraite: { parPersonne: { s: herites } } })
    const { lignes } = bloc(report, { s: "Sophie" })

    expect(lignes[1]).toEqual(["Déduit du revenu", "− 6 000 €", "plafonds utilisables en 2026 : 13 199 €, dont 7 799 € reportés des années précédentes (plafond de l'année : 5 400 €, calculé sur les revenus de 2025)"])
    expect(lignes[3]).toEqual(["Reste du plafond", "7 199 €", "2 799 € du plafond de 2024, jusqu'en 2027 ; 4 400 € du plafond de 2025, jusqu'en 2028"])
  })

  it("nomme chacun dans un couple, dit ce qui est pris sur le plafond du conjoint et donne la consigne de la case 6QR (maquette 3)", () => {
    const acteurs = [nommee("p", "Paul"), nommee("s", "Sophie")]
    const herites = { p: { plafondCalcule: 9000, plafondsRestants: [] }, s: { plafondCalcule: 4710, plafondsRestants: [] } }
    const report = simuler(acteurs, [relation("p", "s", "Marié(e)")], [["p", "salary", 100000], ["p", "versement_per", 12000]], { epargneRetraite: { parPersonne: herites } })

    expect(bloc(report, { p: "Paul", s: "Sophie" })).toEqual({
      lignes: [
        ["Versé en 2026 par Paul", "12 000 €", null],
        ["Déduit du revenu", "− 12 000 €", "9 000 € sur le plafond de Paul, 3 000 € sur celui de Sophie"],
        ["Impôt économisé", "3 600 €", "impôt recalculé sans le versement ; tranche marginale : 30 % (indicatif)"],
        ["Reste à Sophie", "1 710 €", "de son plafond de 2026, utilisables jusqu'en 2031"],
        ["Plafonds calculés sur 2026", "9 000 € et 4 806 €", "Paul et Sophie, pour les versements de 2027"]
      ],
      consigne: "Pour déduire les 3 000 € pris sur le plafond de Sophie, cochez la case 6QR de la déclaration de revenus. Sans elle, ils ne seraient pas déduits : 900 € d'impôt en plus."
    })
  })

  it("ne parle que de celui qui verse quand son conjoint n'a rien à prêter", () => {
    const report = simuler([nommee("p", "Paul", 9000), nommee("s", "Sophie", 4710)], [relation("p", "s", "Marié(e)")], [["p", "salary", 100000], ["p", "versement_per", 5000]])
    const { lignes, consigne } = bloc(report, { p: "Paul", s: "Sophie" })

    expect(lignes.map(ligne => ligne[0])).toEqual(["Versé en 2026 par Paul", "Déduit du revenu", "Impôt économisé", "Reste à Paul", "Plafond calculé sur 2026"])
    expect(lignes[1][2]).toBe("plafond pour les versements de 2026 : 9 000 €, saisi dans la fiche de Paul")
    expect(consigne).toBeNull()
  })

  it("dit qu'il n'y a aucun revenu au barème dont déduire le versement (maquette 4)", () => {
    const atelier: MicroEntreprise = { ...micro("m1", { opteVFL: true }), rfrN2: 20000 }
    const report = simuler([nommee("k", "Karim", 4710), atelier], [relation("k", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 50000], ["k", "versement_per", 4710]])

    expect(bloc(report, { k: "Karim" }).lignes).toEqual([
      ["Versé en 2026", "4 710 €", null],
      ["Déduit du revenu", "0 €", "aucun revenu imposable au barème"],
      ["Impôt économisé", "0 €", null],
      ["Plafond calculé sur 2026", "4 806 €", "pour les versements de 2027 : le minimum légal (10 % des revenus d'activité professionnelle de 2026 ne donnent que 3 300 €)"]
    ])
  })

  it("dit que le revenu imposable limite la déduction", () => {
    const report = simuler([nommee("s", "Sophie", 4710)], [], [["s", "salary", 3000], ["s", "versement_per", 4000]])

    // 3 000 € de salaire : 2 491 € imposables après la déduction minimale de 509 €.
    expect(bloc(report, { s: "Sophie" }).lignes[1]).toEqual(["Déduit du revenu", "− 2 491 €", "le foyer n'a que 2 491 € de revenu imposable au barème"])
  })
})

describe("mentions de la carte du foyer", () => {
  it("dit sous le net la part d'épargne retraite, bloquée", () => {
    expect(enTexteBrut(mentionDeLEpargneDansLeNet(5000)!)).toBe("dont 5 000 € d'épargne retraite (PER), bloqués jusqu'à la retraite")
    expect(mentionDeLEpargneDansLeNet(undefined)).toBeNull()
    expect(mentionDeLEpargneDansLeNet(0)).toBeNull()
  })

  it("précise le revenu fiscal de référence : ce qui y est rajouté, et à quoi il sert", () => {
    expect(precisionDuRevenuFiscalDeReference({})).toBe("pour le versement libératoire dans deux ans")
    expect(precisionDuRevenuFiscalDeReference({ deductionEpargneRetraite: 4710 })).toBe("versement PER déduit, puis rajouté ; pour le versement libératoire dans deux ans")
    expect(enTexteBrut(precisionDuRevenuFiscalDeReference({ beneficesExoneres: 12400, deductionEpargneRetraite: 4710 }))).toBe("dont 12 400 € de bénéfice exonéré en zone ; versement PER déduit, puis rajouté ; pour le versement libératoire dans deux ans")
    // Une déduction nulle (versement sans effet) n'est pas rajoutée : rien à en dire.
    expect(precisionDuRevenuFiscalDeReference({ deductionEpargneRetraite: 0 })).toBe("pour le versement libératoire dans deux ans")
  })
})

describe("champ du plafond dans la fiche d'une personne", () => {
  it("nomme la première année de la simulation, la ligne de l'avis d'impôt et le minimum retenu sans saisie", () => {
    const { libelle, aide } = texteDuPlafondSaisi([2026], 4710)

    expect(libelle).toBe("Plafond épargne retraite 2026")
    expect(enTexteBrut(aide)).toBe("La ligne « Plafond pour les cotisations versées en 2026 » de l'avis d'impôt reçu en 2026. Vide : le minimum légal est retenu (4 710 €). Les versements se saisissent dans la grille, avec le type « Versement PER ». Marié ou pacsé : chacun saisit le sien.")
  })

  it("dit que les années suivantes sont calculées, quand la simulation en compte plusieurs", () => {
    const { libelle, aide } = texteDuPlafondSaisi([2026, 2024, 2025], 4399)

    expect(libelle).toBe("Plafond épargne retraite 2024")
    expect(aide).toContain("versées en 2024")
    expect(aide).toContain("Les années suivantes, il est calculé sur les revenus de l'année précédente.")
  })

  it("reste lisible sans année", () => {
    expect(texteDuPlafondSaisi([], 0).libelle).toBe("Plafond épargne retraite")
  })
})

describe("épargne retraite dans les exports", () => {
  // Le couple de la maquette 3 : Paul verse 12 000 €, dont 3 000 € pris sur le plafond de Sophie.
  const donnees = session([nommee("p", "Paul", 9000), nommee("s", "Sophie", 4710)], [relation("p", "s", "Marié(e)")], [["p", "salary", 100000], ["p", "versement_per", 12000]])
  const report = runMetaSimulation(donnees, reglesPubliees(2026), { annee: 2026 })
  const sansVersement = session([nommee("p", "Paul")], [], [["p", "salary", 100000]])
  const lignesDuCsv = (csv: string) => csv.split(/\r?\n/)

  it("le CSV ajoute au tableau des foyers ce qui est déduit, économisé et versé, puis une ligne par membre du foyer", () => {
    const lignes = lignesDuCsv(csvResultats(donnees, report))
    const foyers = lignes.findIndex(ligne => ligne.startsWith("Foyer fiscal;"))
    const entete = lignes[foyers].split(";")
    const valeurs = lignes[foyers + 1].split(";")
    const valeur = (colonne: string) => valeurs[entete.indexOf(colonne)]

    expect(valeur("Versements PER déduits")).toBe("12000,00")
    expect(valeur("Impôt économisé grâce au PER")).toBe("3600,00")
    expect(valeur("dont épargne retraite (PER)")).toBe("12000,00")

    const epargne = lignes.findIndex(ligne => ligne.startsWith("Épargne retraite (PER);"))
    expect(lignes[epargne]).toBe("Épargne retraite (PER);Foyer fiscal;Versé;Plafond de l'année;Origine du plafond;Plafonds reportés;Imputé sur ses plafonds;Imputé sur le plafond du conjoint;Pris par le conjoint sur ses plafonds;Non déduit;Reste reportable;Reste non reporté;Revenus d'activité professionnelle;Plafond calculé pour l'année suivante;Tranche marginale du foyer (%)")
    expect(lignes[epargne + 1]).toBe("Paul;Paul, Sophie;12000,00;9000,00;saisi dans la fiche;0,00;9000,00;3000,00;0,00;0,00;0,00;0,00;90000,00;9000,00;30")
    expect(lignes[epargne + 2]).toBe("Sophie;Paul, Sophie;0,00;4710,00;saisi dans la fiche;0,00;0,00;0,00;3000,00;0,00;0,00;1710,00;0,00;4806,00;30")
  })

  it("le rapport Markdown reprend les lignes de la carte et la consigne de la case 6QR", () => {
    const rapport = rapportMarkdown({ session: donnees, report, comparaison: null, date: new Date(2026, 10, 26) })

    expect(rapport).toContain("### Épargne retraite (PER)")
    expect(rapport).toContain("Versements sur un plan d'épargne retraite déduits du revenu imposable, dans la limite du plafond de chaque personne.")
    expect(rapport).toContain("| Paul, Sophie | Versé en 2026 par Paul | 12 000 € | — |")
    expect(rapport).toContain("| Paul, Sophie | Déduit du revenu | − 12 000 € | 9 000 € sur le plafond de Paul, 3 000 € sur celui de Sophie |")
    expect(rapport).toContain("| Paul, Sophie | Impôt économisé | **3 600 €** | impôt recalculé sans le versement ; tranche marginale : 30 % (indicatif) |")
    expect(rapport).toContain("- Paul, Sophie : **Plafonds mis en commun.** Pour déduire les 3 000 € pris sur le plafond de Sophie, cochez la case 6QR de la déclaration de revenus. Sans elle, ils ne seraient pas déduits : 900 € d'impôt en plus.")
    // Le tableau des foyers porte les trois montants, à leur place.
    const entete = rapport.split("\n").find(ligne => ligne.startsWith("| Foyer (membres) |"))!
    expect(entete).toContain("| Revenu imposable | Versements PER déduits |")
    expect(entete).toContain("| Net après impôts | dont épargne retraite (PER) |")
  })

  it("rien de plus sans versement : ni colonnes, ni tableau, ni sous-section", () => {
    const rapportSans = runMetaSimulation(sansVersement, reglesPubliees(2026), { annee: 2026 })
    const csv = csvResultats(sansVersement, rapportSans)
    const rapport = rapportMarkdown({ session: sansVersement, report: rapportSans, comparaison: null, date: new Date(2026, 10, 26) })
    // La partie « Résultats », jusqu'à la partie suivante : les limites du modèle, plus bas, parlent de l'épargne retraite.
    const resultats = rapport.slice(rapport.indexOf("## Résultats")).split("\n## ")[0]

    expect(resultats).toContain("### Par foyer fiscal")
    for (const texte of ["Épargne retraite", "épargne retraite", "PER"]) {
      expect(csv).not.toContain(texte)
      expect(resultats).not.toContain(texte)
    }
  })
})
