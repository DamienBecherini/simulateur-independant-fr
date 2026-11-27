// src/lib/epargne-retraite.test.ts
// Les textes de l'épargne retraite sur la carte d'un foyer, comparés aux maquettes validées (ADR 021), sur les cas de
// l'étude calculés par le moteur avec les règles de 2026.

import { describe, expect, it } from "vitest"
import type { Entity, MicroEntreprise, Person, Relationship, SimulationReport } from "@/types"
import { enTexteBrut } from "@/backend/logic/format"
import { reglesPubliees } from "@/backend/logic/regles"
import { runMetaSimulation, type ContexteDeLAnnee } from "@/backend/logic/simulation-engine"
import { chiffreDAffairesPour, remunerationNettePour } from "@/backend/logic/testing/revenus-exacts"
import { exercant, micro, personne, relation, session, societe, type Flux } from "@/backend/logic/testing/session-de-test"
import { blocEpargneRetraite, ligneDEpargneRetraiteDeLActivite, mentionDeLEpargneDansLeNet, precisionDuRevenuFiscalDeReference, resteApresDepenses, texteDuPlafondSaisi } from "./epargne-retraite"
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

describe("bloc d'un entrepreneur individuel qui déduit aussi de son bénéfice (maquette 5)", () => {
  // Cas 1 de l'étude : 60 000 € de bénéfice imposable, plafond non saisi (4 710 €).
  const conseil = { ...societe("ei", "EI"), name: "Conseil de Sophie" }
  const chiffreDAffaires: Flux = ["ei", "ca_services", chiffreDAffairesPour(60000, reglesPubliees(2026))]
  const sophie = (verse: number) => simuler([nommee("s", "Sophie"), conseil], exercant("s", "ei", "EI"), [chiffreDAffaires, ["s", "versement_per", verse]])

  it("détaille les deux déductions, et ce que celle du bénéfice fait au plafond suivant", () => {
    expect(bloc(sophie(6000), { s: "Sophie" })).toEqual({
      lignes: [
        ["Versé en 2026", "6 000 €", null],
        ["Déduit du revenu global", "− 4 710 €", "plafond pour les versements de 2026 : 4 710 €, le minimum légal, faute de plafond saisi dans la fiche de Sophie"],
        ["Déduit du bénéfice", "− 1 290 €", "sous sa limite de 7 791 €"],
        ["Impôt économisé", "1 800 €", "impôt recalculé sans le versement ; tranche marginale : 30 % (indicatif)"],
        ["Plafond calculé sur 2026", "5 871 €", "pour les versements de 2027 : 10 % des revenus d'activité professionnelle de 2026 (58 710 €) ; la part déduite du bénéfice ne le réduit pas ici"]
      ],
      consigne: null
    })
  })

  it("dit ce qui dépasse aussi la limite du bénéfice, et la réduction du plafond suivant", () => {
    const { lignes } = bloc(sophie(15000), { s: "Sophie" })

    expect(lignes[2]).toEqual(["Déduit du bénéfice", "− 7 791 €", "à sa limite de 7 791 €"])
    expect(lignes[3]).toEqual(["Non déduit", "2 499 €", "au-delà du plafond et de ce qui se déduit du bénéfice, sans report"])
    // 10 % de 52 209 € = 5 221 €, moins 7 791 - 15 % x (52 209 - 48 060) = 7 169 € : rien.
    expect(lignes[5]).toEqual(["Plafond calculé sur 2026", "0 €", "pour les versements de 2027 : 10 % des revenus d'activité professionnelle de 2026 (52 209 €) ; ramené à zéro par les 7 791 € déduits du bénéfice"])
  })

  it("précise que seule la part du revenu global revient dans le revenu fiscal de référence", () => {
    expect(precisionDuRevenuFiscalDeReference(sophie(6000).foyers[0])).toBe("versement PER déduit du revenu global, puis rajouté ; versement PER déduit du bénéfice, non rajouté ; pour le versement libératoire dans deux ans")
  })

  it("donne la ligne de la carte de l'activité : sans signe moins, elle ne change pas ce qui est versé", () => {
    const deduction = sophie(6000).activities.find(a => a.entityId === "ei")!.epargneRetraite!
    const ligne = ligneDEpargneRetraiteDeLActivite(deduction, 2026)

    expect([ligne.libelle, enTexteBrut(ligne.valeur), enTexteBrut(ligne.precision)]).toEqual([
      "Versement PER déduit du bénéfice",
      "1 290 €",
      "au-delà du plafond du revenu global ; limite de 7 791 € : 10 % du bénéfice, plus 15 % de sa part au-delà du plafond de la sécurité sociale. Seul le revenu imposable baisse : ni les cotisations ni ce que l'activité verse ne changent"
    ])
    const duGerant = ligneDEpargneRetraiteDeLActivite({ ...deduction, cadre: "remuneration", montant: 3290, limite: 4806, baseDeLaLimite: "minimum" }, 2026)
    expect([duGerant.libelle, enTexteBrut(duGerant.precision)]).toEqual(["Versement PER déduit de la rémunération", "au-delà du plafond du revenu global, avant la déduction pour frais ; limite de 4 806 € : le minimum, 10 % du plafond de la sécurité sociale. Seul le revenu imposable baisse : ni les cotisations ni ce que l'activité verse ne changent"])
  })

  it("dit qu'un gérant dont la rémunération est sous la limite la déduit en entier", () => {
    // 3 000 € de rémunération imposable : la limite minimale de 4 806 € ne joue pas, la rémunération arrête la déduction.
    const eurl = { ...societe("s1", "EURL"), name: "Atelier" }
    const flux: Flux[] = [["s1", "ca_services", 40000], ["s1", "director_remuneration", remunerationNettePour(3000, reglesPubliees(2026))], ["g", "versement_per", 10000]]
    const { lignes } = bloc(simuler([nommee("g", "Gaël"), eurl], exercant("g", "s1", "EURL"), flux), { g: "Gaël" })

    expect(lignes[2]).toEqual(["Déduit de la rémunération", "− 3 000 €", "avant la déduction pour frais ; toute la rémunération imposable, sous la limite de 4 806 €"])
  })

  it("nomme celui qui déduit dans un couple, et donne la consigne de la case 6QR sans la chiffrer", () => {
    const acteurs = [nommee("p", "Paul", 4000), nommee("s", "Sophie", 4710), { ...conseil, name: "Atelier de Paul" }]
    const report = simuler(acteurs, [...exercant("p", "ei", "EI"), relation("p", "s", "Marié(e)")], [chiffreDAffaires, ["p", "versement_per", 12000]])

    expect(bloc(report, { p: "Paul", s: "Sophie" })).toEqual({
      lignes: [
        ["Versé en 2026 par Paul", "12 000 €", null],
        ["Déduit du revenu global", "− 8 710 €", "4 000 € sur le plafond de Paul, 4 710 € sur celui de Sophie"],
        ["Déduit du bénéfice de Paul", "− 3 290 €", "sous sa limite de 7 791 €"],
        ["Impôt économisé", "1 729 €", "impôt recalculé sans le versement ; tranche marginale : 30 % (indicatif)"],
        // Paul : 10 % de 56 710 € = 5 671 €, moins 3 290 - 15 % x (56 710 - 48 060) = 1 993 €.
        ["Plafonds calculés sur 2026", "3 678 € et 4 806 €", "Paul et Sophie, pour les versements de 2027 ; celui de Paul : diminué de 1 993 € sur les 3 290 € déduits du bénéfice"]
      ],
      consigne: "Pour déduire les 4 710 € pris sur le plafond de Sophie, cochez la case 6QR de la déclaration de revenus. Sans elle, ils ne se déduiraient que du bénéfice, dans la limite de l'année."
    })
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

describe("reste après les dépenses saisies", () => {
  it("retire aussi l'épargne retraite, que le net contient mais qui n'est pas disponible", () => {
    const reste = resteApresDepenses({ netApresImpots: 30000, depenses: 20000, versementsEpargneRetraite: 6000 })!

    expect(reste.libelle).toBe("Reste après dépenses et épargne retraite")
    expect(reste.montant).toBe(4000)
    expect(enTexteBrut(reste.precision)).toBe("20 000 € de dépenses, 6 000 € d'épargne retraite")
  })

  it("ne change pas sans versement, et n'existe pas sans dépense saisie", () => {
    expect(resteApresDepenses({ netApresImpots: 30000, depenses: 20000 })).toMatchObject({ libelle: "Reste après dépenses saisies", montant: 10000 })
    expect(resteApresDepenses({ netApresImpots: 30000, depenses: 0, versementsEpargneRetraite: 6000 })).toBeNull()
  })
})

describe("champ du plafond dans la fiche d'une personne", () => {
  it("nomme la première année de la simulation, la ligne de l'avis d'impôt et le minimum retenu sans saisie", () => {
    const { libelle, aide } = texteDuPlafondSaisi([2026])

    expect(libelle).toBe("Plafond épargne retraite 2026")
    // 10 % du plafond de la sécurité sociale de 2025, lu dans les règles de 2026.
    expect(enTexteBrut(aide)).toBe("La ligne « Plafond pour les cotisations versées en 2026 » de l'avis d'impôt reçu en 2026. Vide : le minimum légal est retenu (4 710 €). Les versements se saisissent dans la grille, avec le type « Versement PER ». Marié ou pacsé : chacun saisit le sien.")
  })

  it("dit que les années suivantes sont calculées, quand la simulation en compte plusieurs", () => {
    const { libelle, aide } = texteDuPlafondSaisi([2026, 2024, 2025])

    expect(libelle).toBe("Plafond épargne retraite 2024")
    expect(enTexteBrut(aide)).toContain("versées en 2024 » de l'avis d'impôt reçu en 2024. Vide : le minimum légal est retenu (4 399 €).")
    expect(aide).toContain("Les années suivantes, il est calculé sur les revenus de l'année précédente.")
  })

  it("nomme la première année que le simulateur sait simuler : une année d'avant les premières règles ne compte pas", () => {
    const { libelle, aide } = texteDuPlafondSaisi([2022, 2023, 2024, 2025])

    expect(libelle).toBe("Plafond épargne retraite 2024")
    expect(aide).toContain("Les années suivantes")
    expect(texteDuPlafondSaisi([2023, 2024]).aide).not.toContain("Les années suivantes")
  })

  it("nomme l'année enregistrée avec le plafond, et dit ce qu'il en est de la première année quand elle est avant", () => {
    const { libelle, aide } = texteDuPlafondSaisi([2025, 2026, 2027], 2026)

    expect(libelle).toBe("Plafond épargne retraite 2026")
    expect(enTexteBrut(aide)).toContain("versées en 2026 » de l'avis d'impôt reçu en 2026. Vide : le minimum légal est retenu (4 710 €). Les années suivantes, il est calculé sur les revenus de l'année précédente. En 2025, première année de la simulation, le minimum légal est retenu.")
  })

  it("dit qu'un plafond enregistré pour une année absente de la simulation ne sert pas", () => {
    const { libelle, aide } = texteDuPlafondSaisi([2026], 2025)

    expect(libelle).toBe("Plafond épargne retraite 2025")
    expect(aide).toContain("2025 n'est pas dans la simulation : ce plafond ne sert pas.")
  })

  it("reste lisible sans année, ou sans année que le simulateur sache simuler", () => {
    expect(texteDuPlafondSaisi([]).libelle).toBe("Plafond épargne retraite")
    expect(texteDuPlafondSaisi([2020]).libelle).toBe("Plafond épargne retraite")
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

    expect(valeur("PER déduit du revenu global")).toBe("12000,00")
    expect(valeur("Impôt économisé grâce au PER")).toBe("3600,00")
    expect(valeur("dont épargne retraite (PER)")).toBe("12000,00")

    const epargne = lignes.findIndex(ligne => ligne.startsWith("Épargne retraite (PER);"))
    expect(lignes[epargne]).toBe(
      "Épargne retraite (PER);Foyer fiscal;Versé;Plafond de l'année;Origine du plafond;Plafonds reportés;Imputé sur ses plafonds;Imputé sur le plafond du conjoint;Pris par le conjoint sur ses plafonds;Déduit du bénéfice ou de la rémunération;Activité de cette déduction;Limite de cette déduction;Non déduit;Reste reportable;Reste non reporté;Revenus d'activité professionnelle;Réduction du plafond calculé;Plafond calculé pour l'année suivante;Tranche marginale du foyer (%)"
    )
    expect(lignes[epargne + 1]).toBe("Paul;Paul, Sophie;12000,00;9000,00;saisi dans la fiche;0,00;9000,00;3000,00;0,00;0,00;;;0,00;0,00;0,00;90000,00;0,00;9000,00;30")
    expect(lignes[epargne + 2]).toBe("Sophie;Paul, Sophie;0,00;4710,00;saisi dans la fiche;0,00;0,00;0,00;3000,00;0,00;;;0,00;0,00;1710,00;0,00;0,00;4806,00;30")
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
    expect(entete).toContain("| Revenu imposable | PER déduit du revenu global |")
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
