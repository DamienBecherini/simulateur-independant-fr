// src/lib/export-markdown.test.ts

import { describe, expect, it } from "vitest"
import { reglesPubliees } from "@/backend/logic/regles"
import type { ComparaisonOptions, SimulationAnnuelle } from "@/types"
import { eurosEnTexteBrut as euros } from "@/backend/logic/format"
import { echapper, LIMITES, rapportMarkdown, repartition, type DonneesDuRapport } from "./export-markdown"
import { comparaisonExemple, optionsExemple, pluriannuelleExemple, rapportAvecFrais, rapportAvecReserves, rapportExemple, sessionAvecFrais, sessionExemple } from "./testing/exports-fixtures"

const DATE = new Date(2026, 9, 4)

const sessionVide = (): SimulationAnnuelle => ({ name: "Vide", annee: 2026, entities: [], relationships: [], monthlyData: Array.from({ length: 12 }, (_, month) => ({ month, flows: [] })) })

function rapportComplet(changements: Partial<DonneesDuRapport> = {}): string {
  return rapportMarkdown({ session: sessionExemple(), report: rapportExemple(), comparaison: { nomActivite: "Ma SASU", options: optionsExemple(), resultat: comparaisonExemple() }, date: DATE, ...changements })
}

describe("euros", () => {
  it("arrondit à l'euro, avec des espaces ordinaires entre les milliers", () => {
    expect(euros(1234567.4)).toBe("1 234 567 €")
    expect(euros(-2500)).toBe("-2 500 €")
    expect(euros(-0.2)).toBe("0 €")
  })
})

describe("echapper", () => {
  it("protège les caractères de mise en forme et remplace les retours à la ligne par une espace", () => {
    expect(echapper("A | B")).toBe("A \\| B")
    expect(echapper("*gras* _x_ [lien] <b> `code` #1 \\")).toBe("\\*gras\\* \\_x\\_ \\[lien\\] \\<b\\> \\`code\\` \\#1 \\\\")
    expect(echapper("ligne 1\r\n  ligne 2")).toBe("ligne 1 ligne 2")
  })

  it("remplace toute suite d'espaces qui contient un retour à la ligne par une seule espace, et garde les autres", () => {
    expect(echapper("a \n \n b")).toBe("a b")
    expect(echapper("  a  b\n")).toBe("  a  b ")
    expect(echapper("\t\r\t")).toBe(" ")
  })

  it("traite en temps linéaire un texte très long fait d'espaces", () => {
    // L'ancienne expression (\s*[\r\n]+\s*) recommençait à chaque espace d'une longue suite sans retour à la ligne.
    expect(echapper(`a${" ".repeat(50_000)}b`)).toBe(`a${" ".repeat(50_000)}b`)
  })
})

describe("repartition", () => {
  it("résume un flux constant, liste les mois d'un flux variable, et signale un flux nul", () => {
    expect(repartition(Array(12).fill(3000))).toBe("12 × 3 000 €")
    expect(repartition([1000, 0, 2000, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe("janvier 1 000 €, mars 2 000 €")
    expect(repartition(Array(12).fill(0))).toBe("—")
  })
})

describe("rapportMarkdown", () => {
  it("décrit une simulation vide, sans résultats ni activité à comparer", () => {
    const limites = LIMITES.map(l => `- ${l}`).join("\n")
    expect(rapportMarkdown({ session: sessionVide(), report: null, comparaison: null, date: DATE })).toBe(
      `# Simulation « Vide »

Rapport exporté le 4 octobre 2026 depuis le Simulateur de revenus pour indépendants, année 2026.

> Ce document décrit une simulation de revenus d'indépendants en France. Il se lit tel quel ou se confie à une IA (un assistant conversationnel) pour l'analyser : les montants sont annuels et en euros, sauf mention contraire.

## Hypothèses et limites

${limites}

## Acteurs

Aucun acteur saisi.

## Relations

Aucune relation saisie.

## Flux saisis

Aucun flux saisi dans la grille.

## Résultats

Résultats indisponibles : la simulation n'a pas pu être calculée.

## Comparateur de statuts

Aucune activité à comparer.

## Avertissements

Aucun avertissement.
`
    )
  })

  it("donne le titre, la date et l'année des règles fiscales", () => {
    expect(rapportComplet()).toMatch(/^# Simulation « Famille Martin »\n\nRapport exporté le 4 octobre 2026 depuis le Simulateur de revenus pour indépendants, année 2026, règles fiscales 2026\.\n/)
  })

  it("présente les acteurs et leurs relations", () => {
    const rapport = rapportComplet()
    expect(rapport).toContain(`## Acteurs

| Nom | Nature | Détails |
| --- | --- | --- |
| Alice | Personne | 1 part fiscale |
| Bob | Personne | 1,5 parts fiscales |
| Ma SASU | SASU | Société à l'impôt sur les sociétés, capital social 1 000 € |

## Relations

- Alice et Bob : mariés
- Alice : président de « Ma SASU »`)
  })

  it("détaille les autres natures d'acteurs et de relations", () => {
    const session = sessionExemple()
    session.entities.push(
      { id: "e1", type: "company", name: "Mon EI", legalStatus: "EI", capitalSocial: 0, avatar: session.entities[0].avatar, locked: false },
      { id: "m1", type: "micro-entreprise", name: "Atelier", beneficieACRE: true, opteVFL: false, avatar: session.entities[0].avatar, locked: false },
      { id: "m2", type: "micro-entreprise", name: "Studio", beneficieACRE: false, opteVFL: true, rfrN2: 25000, avatar: session.entities[0].avatar, locked: false }
    )
    session.relationships = [
      { id: "r1", fromId: "p1", toId: "p2", type: "PACSé(e)" },
      { id: "r2", fromId: "p1", toId: "p2", type: "En couple" },
      { id: "r3", fromId: "p1", toId: "p2", type: "Enfant" },
      { id: "r4", fromId: "m1", toId: "p2", type: "Titulaire" }
    ]
    const rapport = rapportComplet({ session })
    expect(rapport).toContain("| Mon EI | EI au réel | Entreprise individuelle au régime réel |")
    expect(rapport).toContain("| Atelier | Micro-entreprise | ACRE : oui ; versement libératoire demandé : non ; revenu fiscal de référence N-2 : non renseigné |")
    expect(rapport).toContain("| Studio | Micro-entreprise | ACRE : non ; versement libératoire demandé : oui ; revenu fiscal de référence N-2 : 25 000 € |")
    expect(rapport).toContain(`- Alice et Bob : pacsés
- Alice et Bob : en couple (union libre, deux foyers fiscaux distincts)
- Bob : enfant à charge de Alice
- Bob : titulaire de « Atelier »`)
  })

  it("donne les flux de chaque acteur : total annuel et répartition sur les mois", () => {
    expect(rapportComplet()).toContain(`### Ma SASU (SASU)

| Flux | Sens | Total annuel | Répartition |
| --- | --- | ---: | --- |
| CA - Prestation de services | Entrée | 36 000 € | 12 × 3 000 € |
| Charge déductible | Sortie | 101 € | mars 101 € |`)
  })

  it("donne le bilan, les résultats par activité et par foyer fiscal", () => {
    const rapport = rapportComplet()
    expect(rapport).toContain("## Résultats 2026 (règles fiscales 2026)")
    expect(rapport).toContain("| Taux global de prélèvement | 29,2 % |\n| Conservé dans les sociétés | 400 € |\n| Non rattaché à une personne | 0 € |\n| **Net dans la poche (tous les foyers)** | **25 000 €** |")
    expect(rapport).toContain("| Ma SASU | SASU | 36 000 € | 101 € | 8 000 € | 1 000 € | 26 500 € | 400 € | Alice |")
    expect(rapport).toContain("| Alice, Bob | 2,5 | 26 500 € | 18 000 € | 19 500 € | 1 500 € | 0 € | prélèvement forfaitaire unique | **25 000 €** |")
  })

  it("détaille les trajets domicile-travail des personnes et les déplacements des activités parmi les acteurs", () => {
    const rapport = rapportComplet({ session: sessionAvecFrais(), report: rapportAvecFrais() })
    expect(rapport).toContain("| Alice | Personne | 1 part fiscale ; frais réels saisis : 2 trajets domicile-travail, autres frais 500 € |")
    expect(rapport).toContain("capital social 1 000 € ; déplacements professionnels : 5 000 km par an, 5 CV |")
    expect(rapport).toContain("revenu fiscal de référence N-2 : 25 000 € ; déplacements professionnels : 1 000 km par an, 4 CV |")
    expect(rapport).toContain(`### Trajets domicile-travail

Un aller-retour par jour travaillé, avec une voiture personnelle, pour les frais réels.

| Personne | Trajet | Aller simple | Jours travaillés | Puissance fiscale | Électrique | Distance au-delà de 40 km justifiée |
| --- | --- | ---: | ---: | --- | --- | --- |
| Alice | Bureau | 20 km | 120 | 5 CV | non | non |
| Alice | Trajet 2 | 50 km | 25 | 3 CV et moins | oui | oui |

## Relations`)
  })

  it("dit qu'une personne a saisi des frais réels sans trajet, et omet alors le tableau des trajets", () => {
    const session = sessionExemple()
    session.entities = session.entities.map(e => (e.id === "p2" && e.type === "person" ? { ...e, fraisReels: { trajets: [], autresFrais: 1200 } } : e))
    const rapport = rapportComplet({ session })
    expect(rapport).toContain("| Bob | Personne | 1,5 parts fiscales ; frais réels saisis : 0 trajet domicile-travail, autres frais 1 200 € |")
    expect(rapport).not.toContain("### Trajets domicile-travail")
  })

  it("donne les déplacements professionnels, le versement libératoire et les frais réels dans les résultats", () => {
    const rapport = rapportComplet({ session: sessionAvecFrais(), report: rapportAvecFrais() })
    expect(rapport).toContain(`### Déplacements professionnels

Au barème kilométrique, compris dans les charges de l'activité.

| Activité | Distance | Montant | Traitement |
| --- | ---: | ---: | --- |
| Ma SASU | 5 000 km | 3 180 € | déductible |
| Atelier | 1 000 km | 606 € | non déductible (micro-entreprise) |

### Versement libératoire

| Micro-entreprise | Année du revenu fiscal de référence | Revenu fiscal de référence | Origine | Seuil | Issue |
| --- | --- | ---: | --- | ---: | --- |
| Atelier | 2024 | 25 000 € | saisi dans la fiche | 28 797 € (1 part) | sous le seuil, versement libératoire appliqué |`)
    expect(rapport).toContain(`### Frais professionnels

Sur les revenus imposés comme des salaires, la plus favorable de la déduction de 10 % et des frais réels.

| Personne | Revenus imposés comme des salaires | Déduction de 10 % | Frais réels | Retenue | Trajets | Distance retenue | Trajets au barème, par voiture | Autres frais |
| --- | ---: | ---: | ---: | --- | ---: | ---: | --- | ---: |
| Alice | 20 000 € | 2 000 € | 4 880 € | **Frais réels** : 4 880 € | 2 | 7 300 km | 5 CV : 4 800 km, 2 880 € ; 3 CV et moins, électrique : 2 500 km, 1 500 € | 500 € |`)
  })

  it("signale un revenu fiscal de référence calculé, dépassé ou inconnu, et une déduction de 10 % retenue sans trajet", () => {
    const report = rapportAvecFrais()
    const [sasu, atelier] = report.activities
    const vfl = atelier.versementLiberatoire!
    report.activities = [
      sasu,
      { ...atelier, versementLiberatoire: { ...vfl, partsFiscales: 2.5, rfrN2: 90000, origineRfr: "calcule", eligible: false, applique: false } },
      { ...atelier, name: "Studio", versementLiberatoire: { ...vfl, rfrN2: null, origineRfr: null, eligible: null, applique: false } },
      { ...atelier, name: "Boutique", versementLiberatoire: { ...vfl, applique: false } }
    ]
    report.persons = report.persons.map(p => (p.fraisProfessionnels ? { ...p, fraisProfessionnels: { ...p.fraisProfessionnels, voitures: [], nombreDeTrajets: 0, retenue: "forfait", deduction: 2000 } } : p))
    const rapport = rapportComplet({ session: sessionAvecFrais(), report })
    expect(rapport).toContain("| Atelier | 2024 | 90 000 € | calculé par la simulation | 28 797 € (2,5 parts) | seuil dépassé, versement libératoire inaccessible |")
    expect(rapport).toContain("| Studio | 2024 | — | inconnu | 28 797 € (1 part) | revenu fiscal de référence inconnu |")
    expect(rapport).toContain("| Boutique | 2024 | 25 000 € | saisi dans la fiche | 28 797 € (1 part) | sous le seuil, versement libératoire non appliqué |")
    expect(rapport).toContain("| **Déduction de 10 %** : 2 000 € | 0 | 7 300 km | — | 500 € |")
  })

  it("nomme la déduction au taux du résultat et la distance des trajets selon les règles de l'année", () => {
    const report = rapportAvecFrais()
    report.persons = report.persons.map(p => (p.fraisProfessionnels ? { ...p, fraisProfessionnels: { ...p.fraisProfessionnels, tauxDeductionForfaitaire: 0.12, retenue: "forfait", deduction: 2000 } } : p))
    const rapport = rapportComplet({ session: sessionAvecFrais(), report })
    expect(rapport).toContain("la plus favorable de la déduction de 12 % et des frais réels")
    expect(rapport).toContain("| Personne | Revenus imposés comme des salaires | Déduction de 12 % | Frais réels |")
    expect(rapport).toContain("| **Déduction de 12 %** : 2 000 € |")
    const distance = reglesPubliees(2026).baremeKilometrique.domicileTravail.distanceMaxParTrajet
    expect(rapport).toContain(`| Électrique | Distance au-delà de ${distance} km justifiée |`)
  })

  it("omet les frais réels, les déplacements et le versement libératoire quand la simulation n'en a pas", () => {
    const rapport = rapportComplet()
    for (const titre of ["### Trajets domicile-travail", "### Déplacements professionnels", "### Versement libératoire", "### Frais professionnels", "## Toutes les années"]) expect(rapport).not.toContain(titre)
  })

  it("ajoute la synthèse de toutes les années : une ligne par année, le revenu fiscal de référence et les dispositifs", () => {
    const rapport = rapportComplet({ pluriannuelle: pluriannuelleExemple() })
    expect(rapport).toContain(`## Toutes les années

Une ligne par année de la session, avec les mêmes acteurs et la grille de chaque année.

| Année | Règles fiscales | Net après impôts | Total des prélèvements | Revenus avant prélèvements |
| --- | --- | ---: | ---: | ---: |
| 2026 | 2026 | 25 000 € | 10 500 € | 35 900 € |
| 2027 | 2027 | 26 000 € | 10 500 € | 35 900 € |
| 2028 | — | non calculée : Grille invalide. | — | — |

### Revenu fiscal de référence, année par année

| Année | Foyer (membres) | Revenu fiscal de référence |
| --- | --- | ---: |
| 2026 | Alice, Bob | 19 500 € |
| 2027 | Alice, Bob | 21 000 € |

### Dispositifs dans le temps, année par année

- 2027, Ma SASU : Plafonds au prorata.

## Comparateur de statuts`)
  })

  it("n'ajoute pas la synthèse pour une seule année, et la réduit à son tableau sans foyer ni dispositif", () => {
    expect(rapportComplet({ pluriannuelle: { annees: [{ annee: 2026, report: rapportExemple(), erreur: null }] } })).not.toContain("## Toutes les années")
    const rapport = rapportComplet({ pluriannuelle: { annees: [2026, 2027].map(annee => ({ annee, report: null, erreur: null })) } })
    expect(rapport).toContain("| 2027 | — | non calculée : erreur inconnue | — | — |\n\n## Comparateur de statuts")
  })

  it("liste les dispositifs de l'année, et la date de création des activités", () => {
    const report = rapportExemple()
    report.activities = report.activities.map(a => ({ ...a, dispositifs: ["Sortie du régime micro au 1er janvier 2028."] }))
    const session = sessionExemple()
    session.entities = session.entities.map(e => (e.type === "company" ? { ...e, dateDeCreation: "2026-09" } : e))
    const rapport = rapportComplet({ report, session })
    expect(rapport).toContain("### Dispositifs dans le temps\n\n- Ma SASU : Sortie du régime micro au 1er janvier 2028.\n\n### Par foyer fiscal")
    expect(rapport).toContain("capital social 1 000 € ; créée en septembre 2026 |")
    expect(rapportComplet()).not.toContain("### Dispositifs dans le temps")
  })

  it("dans le comparateur, signale les colonnes plus accessibles et la CFE de l'année", () => {
    const resultat = comparaisonExemple()
    resultat.scenarios = resultat.scenarios.map(s => (s.statut === "micro" ? { ...s, regimeMicroFerme: { depuis: 2028, depassements: [2026, 2027] } } : s))
    resultat.noteCFE = "CFE de 2027, l'année qui suit la création : base d'imposition réduite de moitié."
    const rapport = rapportComplet({ comparaison: { nomActivite: "Ma SASU", options: optionsExemple(), resultat } })
    expect(rapport).toContain("| Indicateur | SASU (actuel) | Micro-entreprise (meilleur net, plus accessible) |")
    expect(rapport).toContain("- CFE de 2027, l'année qui suit la création : base d'imposition réduite de moitié.\n- Votre situation telle que saisie (SASU) : 20 000 € de net, comme dans les résultats\n\n| Indicateur |")
  })

  it("gère un rapport sans revenus, sans activité ni foyer", () => {
    const report = { ...rapportExemple(), activities: [], foyers: [] }
    report.bilan = { ...report.bilan, revenusAvantPrelevements: 0 }
    const rapport = rapportComplet({ report })
    expect(rapport).toContain("| Taux global de prélèvement | — |")
    expect(rapport).toContain("### Par activité\n\nAucune activité.")
    expect(rapport).toContain("### Par foyer fiscal\n\nAucun foyer fiscal.")
  })

  it("nomme l'imposition au barème et signale un foyer sans dividendes ou une activité sans bénéficiaire", () => {
    const report = rapportExemple()
    report.foyers = [{ ...report.foyers[0], optionDividendes: "bareme" }, { ...report.foyers[0], optionDividendes: null }]
    report.activities = [{ ...report.activities[0], beneficiaireIds: [] }]
    const rapport = rapportComplet({ report })
    expect(rapport).toContain("| barème progressif |")
    expect(rapport).toContain("| 0 € | — | **25 000 €** |")
    expect(rapport).toContain("| 400 € | — |")
  })

  it("donne le tableau du comparateur avec les réglages utilisés, les notes et les avertissements", () => {
    const rapport = rapportComplet()
    expect(rapport).toContain(`- Bénéfice de la société en SASU et EURL : Rémunération saisie, le reste en dividendes (rémunération nette de 20 000 €, tout le bénéfice restant versé en dividendes)
- En micro-entreprise, part des prestations de services en BNC : 50 % (le reste en BIC)
- Frais de fonctionnement supposés : SASU 2 900 €, EURL 2 900 €, EI au réel 2 050 €, micro-entreprise 850 € ; la grille contient déjà les frais réels du statut actuel, chaque autre statut ne reçoit que l'écart avec lui
- Votre situation telle que saisie (SASU) : 20 000 € de net, comme dans les résultats

| Indicateur | SASU (actuel) | Micro-entreprise (meilleur net) |
| --- | ---: | ---: |
| **Net dans la poche** | **20 000 €** | **22 501 €** |
| Taux global de prélèvement | 25 % | 25 % |
| Frais de gestion par rapport au statut actuel | — | -2 050 € |`)
    expect(rapport).toContain("| Protection sociale | 3/5, 4 trim. de retraite | 2/5, 4 trim. de retraite |\n| Écart avec votre situation telle que saisie | — | +2 501 € |\n\nNotes :\n\n1. Micro-entreprise : Plafond dépassé.")
    expect(rapport).toContain(`## Avertissements

- Ma SASU : Société peu rentable.
- Foyer Alice, Bob : Vérifier les parts.
- Comparateur : Comparaison indicative.
`)
  })

  it("reprend les avertissements de l'année en tête de la liste", () => {
    const report = { ...rapportExemple(), annee: 2027, anneeDesRegles: 2026, avertissements: ["Règles de 2026 reprises pour 2027."] }
    const rapport = rapportMarkdown({ session: { ...sessionExemple(), annee: 2027 }, report, comparaison: null, date: new Date(2026, 9, 4) })

    expect(rapport).toContain("pour indépendants, année 2027, règles fiscales 2026.")
    expect(rapport).toContain("## Résultats 2027 (règles fiscales 2026)")
    expect(rapport).toContain("## Avertissements\n\n- Règles de 2026 reprises pour 2027.\n- Ma SASU : Société peu rentable.")
  })

  it("décrit la répartition personnalisée et le mode « tout en rémunération »", () => {
    const resultat = comparaisonExemple()
    const rapport = (choix: ComparaisonOptions["repartition"]) => rapportComplet({ comparaison: { nomActivite: "Ma SASU", options: { ...optionsExemple(), repartition: choix }, resultat } })
    expect(rapport({ mode: "personnalisee", partDistribuee: 0.35 })).toContain("- Bénéfice de la société en SASU et EURL : Répartition personnalisée (rémunération nette de 20 000 €, 35 % du bénéfice distribuable versé en dividendes, le reste conservé dans la société)")
    expect(rapport({ mode: "remuneration", partDistribuee: 1 })).toContain("- Bénéfice de la société en SASU et EURL : Tout en rémunération (la plus haute rémunération que la société peut verser, sans dividendes)")
  })

  it("au meilleur net, décrit le mode et la rémunération retenue dans chaque colonne de société", () => {
    const resultat = comparaisonExemple()
    const optimale = (remunerationNette: number, retraiteHorsDAtteinte = false) => ({ remunerationOptimale: { remunerationNette, avecRetraite: !retraiteHorsDAtteinte, retraiteHorsDAtteinte } })
    resultat.scenarios = [{ ...resultat.scenarios[0], ...optimale(12300) }, { ...resultat.scenarios[0], statut: "EURL", libelle: "EURL", actuel: false, telleQueSaisie: false, ...optimale(25700, true) }, resultat.scenarios[1]]
    const options = { ...optionsExemple(), repartition: { mode: "meilleurNet" as const, partDistribuee: 1, avecRetraite: true } }

    const rapport = rapportComplet({ comparaison: { nomActivite: "Ma SASU", options, resultat } })

    expect(rapport).toContain(`- Bénéfice de la société en SASU et EURL : Au meilleur net (dans chaque statut, la rémunération nette au meilleur net du foyer parmi celles qui valident 4 trimestres de retraite, tout le bénéfice restant versé en dividendes ; rémunération nette retenue : SASU ${euros(12300)}, EURL ${euros(25700)} (4 trimestres hors d'atteinte))`)
    const sansRetraite = rapportComplet({ comparaison: { nomActivite: "Ma SASU", options: { ...options, repartition: { mode: "meilleurNet", partDistribuee: 1 } }, resultat } })
    expect(sansRetraite).toContain("Au meilleur net (dans chaque statut, la rémunération nette au meilleur net du foyer, tout le bénéfice restant versé en dividendes ; rémunération nette retenue : SASU")
  })

  it("au meilleur net, dit ce que coûtent les 4 trimestres de retraite dans chaque colonne de société", () => {
    const resultat = comparaisonExemple()
    const sasu = { ...resultat.scenarios[0], remunerationOptimale: { remunerationNette: 5800, avecRetraite: true, retraiteHorsDAtteinte: false, coutDesQuatreTrimestres: 1234 } }
    const eurl = { ...resultat.scenarios[0], statut: "EURL" as const, libelle: "EURL", actuel: false, telleQueSaisie: false, remunerationOptimale: { remunerationNette: 9000, avecRetraite: true, retraiteHorsDAtteinte: false } }
    resultat.scenarios = [sasu, eurl, resultat.scenarios[1]]
    const options = { ...optionsExemple(), repartition: { mode: "meilleurNet" as const, partDistribuee: 1, avecRetraite: true } }

    expect(rapportComplet({ comparaison: { nomActivite: "Ma SASU", options, resultat } })).toContain(`rémunération nette retenue : SASU ${euros(5800)} (4 trimestres : −${euros(1234)} de net), EURL ${euros(9000)})`)
  })

  it("adapte les réglages, l'écart négatif et les colonnes sans revenus ni situation saisie", () => {
    const resultat = comparaisonExemple()
    resultat.scenarios = [{ ...resultat.scenarios[1], netApresImpots: 15000, revenusAvantPrelevements: 0, warnings: [] }, { ...resultat.scenarios[0], warnings: [] }]
    const options = { ...optionsExemple(), repartition: { mode: "grille" as const, partDistribuee: 1 }, fraisFonctionnement: undefined }
    const rapport = rapportComplet({ comparaison: { nomActivite: "Ma SASU", options, resultat } })
    expect(rapport).toContain("- Bénéfice de la société en SASU et EURL : Dividendes saisis dans la grille (rémunération nette de 20 000 €, dividendes saisis dans la grille)")
    expect(rapport).toContain("- Frais de fonctionnement supposés : aucun ;")
    expect(rapport).toContain("| Taux global de prélèvement | — | 25 % |")
    expect(rapport).toContain("| Écart avec votre situation telle que saisie | -5 000 € | — |")
    expect(rapport).not.toContain("Notes :")

    resultat.scenarios = resultat.scenarios.map(s => ({ ...s, actuel: false, telleQueSaisie: false }))
    resultat.situationSaisie = undefined
    expect(rapportComplet({ comparaison: { nomActivite: "Ma SASU", options, resultat } })).toContain("| Écart avec votre situation telle que saisie | — | — |")
  })

  it("réunit les mentions d'un statut à la fois actuel et meilleur net", () => {
    const resultat = { ...comparaisonExemple(), meilleur: "SASU" as const }
    expect(rapportComplet({ comparaison: { nomActivite: "Ma SASU", options: optionsExemple(), resultat } })).toContain("| Indicateur | SASU (actuel, meilleur net) | Micro-entreprise |")
  })

  it("compare les couples en union libre avec une imposition commune", () => {
    const resultat = { ...comparaisonExemple(), couples: [{ personIds: ["p1", "p2"] as [string, string], netApresImpotsActuel: 30000, impotSurLeRevenuActuel: 3000, netApresImpotsMaries: 31000, impotSurLeRevenuMaries: 2000 }] }
    expect(rapportComplet({ comparaison: { nomActivite: "Ma SASU", options: optionsExemple(), resultat } })).toContain(
      "### Et si le couple était marié ou pacsé ?\n\n- Alice et Bob : impôt sur le revenu de 3 000 € en union libre, 2 000 € avec une imposition commune ; net après impôts de 30 000 €, contre 31 000 € mariés ou pacsés."
    )
  })

  it("signale une comparaison impossible ou sans statut", () => {
    expect(rapportComplet({ comparaison: { nomActivite: "Ma SASU", erreur: "Moteur indisponible." } })).toContain("## Comparateur de statuts : « Ma SASU »\n\nComparaison indisponible : Moteur indisponible.")
    const vide = { ...comparaisonExemple(), scenarios: [], warnings: [] }
    expect(rapportComplet({ comparaison: { nomActivite: "Ma SASU", options: optionsExemple(), resultat: vide } })).toContain("Aucun statut comparé.")
  })

  it("protège les noms saisis qui contiennent des caractères de tableau", () => {
    const session = sessionExemple()
    session.entities[0] = { ...session.entities[0], name: "Alice | Martin" }
    expect(rapportComplet({ session })).toContain("| Alice \\| Martin | Personne |")
  })

  it("garde la structure de chaque tableau quand tous les noms contiennent des barres, des retours à la ligne ou du balisage", () => {
    const session = sessionAvecFrais()
    session.name = "Famille | Martin\n# pas un titre"
    session.entities = session.entities.map(e => ({ ...e, name: `${e.name} | *gras*\n[lien](x)`, ...(e.type === "person" && e.fraisReels ? { fraisReels: { ...e.fraisReels, trajets: e.fraisReels.trajets.map(t => ({ ...t, libelle: "Bureau | A\n# B" })) } } : {}) }))
    const rapport = rapportAvecFrais()
    rapport.activities = rapport.activities.map(a => ({ ...a, name: `${a.name} | *gras*\n[lien](x)` }))
    rapport.persons = rapport.persons.map(p => ({ ...p, name: `${p.name} | *gras*\n[lien](x)` }))
    const texte = rapportComplet({ session, report: rapport, comparaison: { nomActivite: "Ma SASU | x", options: optionsExemple(), resultat: comparaisonExemple() }, pluriannuelle: pluriannuelleExemple() })

    // Le titre reste sur une ligne, et aucune ligne ne commence par un titre que l'utilisateur aurait glissé dans un nom.
    expect(texte.split("\n")[0]).toBe("# Simulation « Famille \\| Martin \\# pas un titre »")
    expect(texte).not.toMatch(/^# pas un titre/m)
    expect(texte).toContain("### Ma SASU \\| \\*gras\\* \\[lien\\](x) (SASU)")
    expect(texte).toContain("## Comparateur de statuts : « Ma SASU \\| x »")
    // Dans chaque tableau, toutes les lignes ont autant de cellules que l'en-tête : les barres échappées n'en créent pas.
    const tableaux = texte.split(/\n\n/).filter(bloc => bloc.startsWith("| "))
    expect(tableaux.length).toBeGreaterThan(8)
    for (const tableau of tableaux) {
      const colonnes = tableau.split("\n").map(ligne => ligne.split(/(?<!\\)\|/).length)
      expect(new Set(colonnes).size, tableau).toBe(1)
    }
  })
})

describe("réserves des sociétés", () => {
  it("donne les réserves de départ dans les acteurs, et les réserves de l'année et de chaque année", () => {
    const session = sessionExemple()
    session.entities = session.entities.map(e => (e.type === "company" ? { ...e, reservesInitiales: 1000 } : e))
    const pluriannuelle = { annees: [{ annee: 2026, report: rapportAvecReserves(), erreur: null }, { annee: 2027, report: { ...rapportAvecReserves(), annee: 2027 }, erreur: null }] }
    const rapport = rapportComplet({ session, report: rapportAvecReserves(), pluriannuelle })

    expect(rapport).toContain("Société à l'impôt sur les sociétés, capital social 1 000 €, réserves au début de la simulation 1 000 €")
    expect(rapport).toContain(`### Réserves des sociétés

Bénéfices gardés dans la société d'une année sur l'autre : l'impôt sur les sociétés est payé, l'impôt du foyer le sera quand ils seront distribués.

| Société | Ajouté aux réserves | Dont réserve légale | Dividendes pris sur les réserves | Déficit de l'année | Déficit antérieur déduit avant l'IS | Réserves au 31 décembre | Réserve légale |`)
    expect(rapport).toContain("| Ma SASU | 400 € | 20 € | 0 € | 0 € | 0 € | **1 380 €** | 100 € |")
    expect(rapport).toContain("### Réserves des sociétés, année par année")
    expect(rapport).toContain("| 2027 | Ma SASU | 1 380 € | 100 € |")
  })

  it("rien sans réserves", () => {
    expect(rapportComplet()).not.toContain("### Réserves des sociétés")
  })
})
