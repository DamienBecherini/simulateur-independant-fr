// src/lib/export-csv.test.ts

import { describe, expect, it } from "vitest"
import type { SimulationAnnuelle } from "@/types"
import { BOM } from "./csv"
import { nomDuFoyer } from "./export-commun"
import { csvComparaison, csvCourbeRemuneration, csvGrilleMensuelle, csvResultats, reglagesDuComparateur } from "./export-csv"
import { comparaisonExemple, optimisationExemple, optionsExemple, rapportExemple, sessionExemple } from "./testing/exports-fixtures"

/** Lignes d'un CSV, sans le BOM ni la dernière fin de ligne. */
const lignes = (csv: string) => csv.slice(1).replace(/\r\n$/, "").split("\r\n")

describe("csvGrilleMensuelle", () => {
  it("écrit une ligne par acteur et par type de flux, les douze mois puis le total", () => {
    const csv = csvGrilleMensuelle(sessionExemple())

    expect(csv.startsWith("\uFEFF")).toBe(true)
    expect(csv.endsWith("\r\n")).toBe(true)
    expect(lignes(csv)).toEqual([
      "Acteur;Nature;Flux;Sens;Janvier;Février;Mars;Avril;Mai;Juin;Juillet;Août;Septembre;Octobre;Novembre;Décembre;Total",
      "Ma SASU;SASU;CA - Prestation de services;Entrée;3000,00;3000,00;3000,00;3000,00;3000,00;3000,00;3000,00;3000,00;3000,00;3000,00;3000,00;3000,00;36000,00",
      "Ma SASU;SASU;Charge déductible;Sortie;0,00;0,00;100,50;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;100,50"
    ])
  })

  it("protège un nom d'acteur qui contient un point-virgule", () => {
    const session = sessionExemple()
    session.entities[2] = { ...session.entities[2], name: "Martin; Fils" }
    expect(lignes(csvGrilleMensuelle(session))[1].startsWith('"Martin; Fils";SASU;')).toBe(true)
  })

  it("se limite à l'en-tête pour une grille vide", () => {
    const session: SimulationAnnuelle = { ...sessionExemple(), monthlyData: Array.from({ length: 12 }, (_, month) => ({ month, flows: [] })) }
    expect(lignes(csvGrilleMensuelle(session))).toHaveLength(1)
  })
})

describe("csvResultats", () => {
  it("écrit le bilan, les activités, les personnes et les foyers, séparés par une ligne vide", () => {
    expect(lignes(csvResultats(sessionExemple(), rapportExemple()))).toEqual([
      "Bilan;Montant",
      "Année simulée;2026",
      "Année des règles fiscales;2026",
      "Chiffre d'affaires;36000,00",
      "Charges;100,50",
      "Revenus directs des personnes;0,00",
      "Cotisations salariales;0,00",
      "Revenus avant prélèvements;35899,50",
      "Cotisations sociales des activités;8000,00",
      "Impôt sur les sociétés;1000,00",
      "Impôt sur le revenu;1500,00",
      "Prélèvements sociaux;0,00",
      "Total des prélèvements;10500,00",
      "Résultat conservé dans les sociétés;400,00",
      "Revenus non rattachés à une personne;0,00",
      "Net après impôts (tous les foyers);24999,50",
      "",
      "Activité;Statut;Chiffre d'affaires;Charges;Cotisations sociales;Impôt sur les sociétés;Revenu versé aux personnes;Résultat conservé;Bénéficiaires",
      "Ma SASU;SASU;36000,00;100,50;8000,00;1000,00;26499,50;400,00;Alice",
      "",
      "Personne;Revenus directs;Revenus des activités;Salaires;Allocations chômage;Autres revenus;Rémunérations de dirigeant;Dividendes;Bénéfices;Cotisations salariales;Dépenses",
      "Alice;0,00;26499,50;0,00;0,00;0,00;20000,00;6499,50;0,00;0,00;0,00",
      "Bob;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00",
      "",
      "Foyer fiscal;Parts;Revenus encaissés;Revenu imposable;Impôt sur le revenu;Prélèvements sociaux;Imposition des dividendes;Net après impôts;Revenus avant prélèvements;Total des prélèvements;Résultat conservé;Dépenses",
      "Alice, Bob;2,5;26499,50;18000,00;1500,00;0,00;Prélèvement forfaitaire unique;24999,50;35899,50;10500,00;400,00;0,00"
    ])
  })

  it("nomme l'imposition au barème, et laisse la case vide sans dividendes", () => {
    const rapport = rapportExemple()
    rapport.foyers = [{ ...rapport.foyers[0], optionDividendes: "bareme" }, { ...rapport.foyers[0], optionDividendes: null }]
    const foyers = lignes(csvResultats(sessionExemple(), rapport)).slice(-2)
    expect(foyers[0]).toContain(";Barème progressif;")
    expect(foyers[1]).toContain(";0,00;;24999,50;")
  })
})

describe("nomDuFoyer", () => {
  it("liste ses membres, même supprimés depuis", () => {
    expect(nomDuFoyer(sessionExemple(), { ...rapportExemple().foyers[0], personIds: ["p2", "x"] })).toBe("Bob, x")
  })
})

/**
 * Relit un CSV comme le ferait un tableur : cellules séparées par des points-virgules, entre guillemets si besoin
 * (guillemets doublés), lignes terminées par CRLF, retours à la ligne permis dans une cellule entre guillemets.
 */
function relire(csv: string): string[][] {
  const lignesLues: string[][] = []
  let ligne: string[] = []
  let cellule = ""
  let entreGuillemets = false
  const texte = csv.slice(BOM.length)
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]
    if (entreGuillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        cellule += '"'
        i++
      } else if (c === '"') entreGuillemets = false
      else cellule += c
    } else if (c === '"') entreGuillemets = true
    else if (c === ";") {
      ligne.push(cellule)
      cellule = ""
    } else if (c === "\r" && texte[i + 1] === "\n") {
      lignesLues.push([...ligne, cellule])
      ligne = []
      cellule = ""
      i++
    } else cellule += c
  }
  return lignesLues
}

describe("noms saisis hostiles : séparateurs, guillemets, retours à la ligne et formules", () => {
  // Noms qu'un utilisateur peut saisir, ou trouver dans un fichier importé.
  const NOMS = {
    p1: 'Alice "la grande"\nMartin',
    p2: "+33 6 12 34 56 78",
    c1: '=HYPERLINK("http://exemple.invalid";"Cliquez")'
  }

  function sessionHostile(): SimulationAnnuelle {
    const session = sessionExemple()
    session.name = "-Famille; Martin"
    session.entities = session.entities.map(e => ({ ...e, name: NOMS[e.id as keyof typeof NOMS] }))
    return session
  }

  it("garde chaque nom dans une seule cellule de la grille, neutralisé s'il commence comme une formule", () => {
    const cellules = relire(csvGrilleMensuelle(sessionHostile()))

    expect(cellules.every(ligne => ligne.length === 17)).toBe(true)
    expect(cellules.slice(1).map(ligne => ligne[0])).toEqual([`'${NOMS.c1}`, `'${NOMS.c1}`])
  })

  it("protège de même les résultats : activités, bénéficiaires, personnes et foyers", () => {
    const rapport = rapportExemple()
    rapport.activities = rapport.activities.map(a => ({ ...a, name: NOMS.c1 }))
    rapport.persons = rapport.persons.map(p => ({ ...p, name: NOMS[p.entityId as keyof typeof NOMS] }))
    const cellules = relire(csvResultats(sessionHostile(), rapport))
    const ligneQuiCommencePar = (debut: string) => cellules.find(ligne => ligne[0] === debut)

    // Toutes les lignes d'un même tableau ont autant de cellules que son en-tête.
    expect(ligneQuiCommencePar(`'${NOMS.c1}`)).toHaveLength(9)
    expect(ligneQuiCommencePar(`'${NOMS.c1}`)?.[8]).toBe(NOMS.p1)
    expect(ligneQuiCommencePar(NOMS.p1)).toHaveLength(11)
    expect(ligneQuiCommencePar(`'${NOMS.p2}`)).toHaveLength(11)
    expect(ligneQuiCommencePar(`${NOMS.p1}, ${NOMS.p2}`)).toHaveLength(12)
  })

  it("protège le nom de l'activité comparée", () => {
    const cellules = relire(csvComparaison(comparaisonExemple(), optionsExemple(), NOMS.c1))
    expect(cellules.find(ligne => ligne[0] === "Activité comparée")).toEqual(["Activité comparée", `'${NOMS.c1}`])
    expect(cellules.find(ligne => ligne[0].startsWith("Conservé dans"))?.[0]).toBe(`Conservé dans « ${NOMS.c1} »`)
  })
})

describe("csvComparaison", () => {
  it("écrit un statut par colonne, puis les réglages et les avertissements", () => {
    expect(lignes(csvComparaison(comparaisonExemple(), optionsExemple(), "Ma SASU"))).toEqual([
      "Indicateur;SASU;Micro-entreprise",
      "Statut actuel;oui;non",
      "Meilleur net;non;oui",
      "Net dans la poche;20000,00;22500,50",
      "Taux global de prélèvement (%);25;25",
      "Revenus avant prélèvements;30000,00;30000,00",
      "Frais de fonctionnement;1000,00;1000,00",
      "Cotisations sociales;6000,00;6000,00",
      "Impôt sur les sociétés;0,00;0,00",
      "Impôt sur le revenu;1500,00;1500,00",
      "Prélèvements sociaux;0,00;0,00",
      "Total des prélèvements;7500,00;7500,00",
      "Conservé dans « Ma SASU »;400,00;0,00",
      "Protection sociale (étoiles sur 5);3;2",
      "Trimestres de retraite validés;4;4",
      "Écart avec le statut actuel;0,00;2500,50",
      "",
      "Réglage;Valeur",
      "Activité comparée;Ma SASU",
      "Bénéfice de la société (SASU, EURL);Rémunération saisie, le reste en dividendes",
      "Rémunération nette annuelle (SASU, EURL);20000,00",
      "Part des prestations en BNC en micro (%);50",
      "Frais de fonctionnement annuels, SASU;2900,00",
      "Frais de fonctionnement annuels, EURL;2900,00",
      "Frais de fonctionnement annuels, EI au réel;2050,00",
      "Frais de fonctionnement annuels, Micro-entreprise;850,00",
      "",
      "Avertissement;Statuts concernés",
      "Comparaison indicative.;Tous",
      "Plafond dépassé.;Micro-entreprise"
    ])
  })

  it("laisse vides le taux sans revenus et l'écart sans statut actuel, et omet les avertissements absents", () => {
    const result = comparaisonExemple()
    result.scenarios = result.scenarios.map(s => ({ ...s, actuel: false, warnings: [], revenusAvantPrelevements: 0 }))
    result.warnings = []
    const csv = lignes(csvComparaison(result, { ...optionsExemple(), fraisFonctionnement: undefined, repartition: { mode: "grille", partDistribuee: 1 } }, "Ma SASU"))
    expect(csv).toContain("Taux global de prélèvement (%);;")
    expect(csv).toContain("Écart avec le statut actuel;;")
    expect(csv).toContain("Bénéfice de la société (SASU, EURL);Dividendes saisis dans la grille")
    expect(csv[csv.length - 1]).toBe("Part des prestations en BNC en micro (%);50")
  })
})

describe("reglagesDuComparateur", () => {
  it("donne la part distribuée d'une répartition personnalisée, et aucune rémunération chiffrée quand tout part en rémunération", () => {
    const personnalisee = reglagesDuComparateur({ ...optionsExemple(), repartition: { mode: "personnalisee", partDistribuee: 0.35 } }, "X")
    expect(personnalisee).toContainEqual(["Bénéfice de la société (SASU, EURL)", "Répartition personnalisée"])
    expect(personnalisee).toContainEqual(["Part du bénéfice distribuable versée en dividendes (%)", 35])
    const remuneration = reglagesDuComparateur({ ...optionsExemple(), repartition: { mode: "remuneration", partDistribuee: 1 } }, "X")
    expect(remuneration).toContainEqual(["Rémunération nette annuelle (SASU, EURL)", "la plus haute possible"])
    expect(remuneration.map(([libelle]) => libelle)).not.toContain("Part du bénéfice distribuable versée en dividendes (%)")
  })

  it("au meilleur net, donne la rémunération retenue dans chaque colonne de société, et si 4 trimestres sont exigés", () => {
    const optimale = (remunerationNette: number) => ({ remunerationOptimale: { remunerationNette, avecRetraite: true, retraiteHorsDAtteinte: false } })
    const [sasu, micro] = comparaisonExemple().scenarios
    const scenarios = [{ ...sasu, ...optimale(12300) }, { ...sasu, statut: "EURL" as const, libelle: "EURL", ...optimale(25700) }, micro]
    const reglages = reglagesDuComparateur({ ...optionsExemple(), repartition: { mode: "meilleurNet", partDistribuee: 1, avecRetraite: true } }, "X", scenarios)

    expect(reglages).toContainEqual(["Bénéfice de la société (SASU, EURL)", "Au meilleur net"])
    expect(reglages).toContainEqual(["Rémunération nette annuelle (SASU, EURL)", "au meilleur net de chaque statut"])
    expect(reglages).toContainEqual(["4 trimestres de retraite exigés", "oui"])
    expect(reglages).toContainEqual(["Rémunération nette annuelle retenue, SASU", { montant: 12300 }])
    expect(reglages).toContainEqual(["Rémunération nette annuelle retenue, EURL", { montant: 25700 }])
    expect(reglages.map(([libelle]) => libelle)).not.toContain("Rémunération nette annuelle retenue, Micro-entreprise")
    expect(reglagesDuComparateur({ ...optionsExemple(), repartition: { mode: "meilleurNet", partDistribuee: 1 } }, "X")).toContainEqual(["4 trimestres de retraite exigés", "non"])
  })

  it("omet les frais quand le comparateur n'en ajoute pas", () => {
    expect(reglagesDuComparateur({ ...optionsExemple(), fraisFonctionnement: undefined }, "X")).toHaveLength(4)
  })
})

describe("csvCourbeRemuneration", () => {
  it("écrit tous les points et signale la meilleure rémunération", () => {
    expect(lignes(csvCourbeRemuneration(optimisationExemple()))).toEqual([
      "Statut;Rémunération nette;Dividendes;Net du foyer;Cotisations sociales;Impôt sur les sociétés;Impôt sur le revenu;Prélèvements sociaux;Trimestres de retraite;Repère",
      "SASU;0,00;10000,00;9000,00;0,00;500,00;300,00;100,00;0;",
      "SASU;5000,00;5000,00;9500,00;4000,00;500,00;300,00;100,00;4;Meilleur net, 4 trimestres validés",
      "SASU;10000,00;0,00;9200,00;8000,00;500,00;300,00;100,00;4;"
    ])
  })

  it("distingue le meilleur net du meilleur net avec 4 trimestres", () => {
    const optimisation = optimisationExemple()
    optimisation.meilleur = optimisation.points[0]
    optimisation.meilleurAvecRetraite = optimisation.points[2]
    const reperes = lignes(csvCourbeRemuneration(optimisation)).slice(1).map(l => l.split(";").pop())
    expect(reperes).toEqual(["Meilleur net", "", "Meilleur net avec 4 trimestres"])
  })

  it("se limite à l'en-tête sans point", () => {
    expect(lignes(csvCourbeRemuneration({ ...optimisationExemple(), points: [], meilleur: null, meilleurAvecRetraite: null }))).toHaveLength(1)
  })
})
