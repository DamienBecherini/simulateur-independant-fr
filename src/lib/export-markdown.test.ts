// src/lib/export-markdown.test.ts

import { describe, expect, it } from "vitest"
import type { ComparaisonOptions, SimulationAnnuelle } from "@/types"
import { echapper, euros, LIMITES, rapportMarkdown, repartition, type DonneesDuRapport } from "./export-markdown"
import { comparaisonExemple, optionsExemple, rapportExemple, sessionExemple } from "./testing/exports-fixtures"

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
    expect(rapport).toContain("| Alice, Bob | 2,5 | 26 500 € | 18 000 € | 1 500 € | 0 € | prélèvement forfaitaire unique | **25 000 €** |")
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
- Frais de fonctionnement annuels ajoutés aux charges : SASU 2 900 €, EURL 2 900 €, EI au réel 2 050 €, micro-entreprise 850 €

| Indicateur | SASU (actuel) | Micro-entreprise (meilleur net) |
| --- | ---: | ---: |
| **Net dans la poche** | **20 000 €** | **22 501 €** |
| Taux global de prélèvement | 25 % | 25 % |`)
    expect(rapport).toContain("| Protection sociale | 3/5, 4 trim. de retraite | 2/5, 4 trim. de retraite |\n| Écart avec le statut actuel | — | +2 501 € |\n\nNotes :\n\n1. Micro-entreprise : Plafond dépassé.")
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
    resultat.scenarios = [{ ...resultat.scenarios[0], ...optimale(12300) }, { ...resultat.scenarios[0], statut: "EURL", libelle: "EURL", actuel: false, ...optimale(25700, true) }, resultat.scenarios[1]]
    const options = { ...optionsExemple(), repartition: { mode: "meilleurNet" as const, partDistribuee: 1, avecRetraite: true } }

    const rapport = rapportComplet({ comparaison: { nomActivite: "Ma SASU", options, resultat } })

    expect(rapport).toContain(`- Bénéfice de la société en SASU et EURL : Au meilleur net (dans chaque statut, la rémunération nette au meilleur net du foyer parmi celles qui valident 4 trimestres de retraite, tout le bénéfice restant versé en dividendes ; rémunération nette retenue : SASU ${euros(12300)}, EURL ${euros(25700)} (4 trimestres hors d'atteinte))`)
    const sansRetraite = rapportComplet({ comparaison: { nomActivite: "Ma SASU", options: { ...options, repartition: { mode: "meilleurNet", partDistribuee: 1 } }, resultat } })
    expect(sansRetraite).toContain("Au meilleur net (dans chaque statut, la rémunération nette au meilleur net du foyer, tout le bénéfice restant versé en dividendes ; rémunération nette retenue : SASU")
  })

  it("au meilleur net, dit ce que coûtent les 4 trimestres de retraite dans chaque colonne de société", () => {
    const resultat = comparaisonExemple()
    const sasu = { ...resultat.scenarios[0], remunerationOptimale: { remunerationNette: 5800, avecRetraite: true, retraiteHorsDAtteinte: false, coutDesQuatreTrimestres: 1234 } }
    const eurl = { ...resultat.scenarios[0], statut: "EURL" as const, libelle: "EURL", actuel: false, remunerationOptimale: { remunerationNette: 9000, avecRetraite: true, retraiteHorsDAtteinte: false } }
    resultat.scenarios = [sasu, eurl, resultat.scenarios[1]]
    const options = { ...optionsExemple(), repartition: { mode: "meilleurNet" as const, partDistribuee: 1, avecRetraite: true } }

    expect(rapportComplet({ comparaison: { nomActivite: "Ma SASU", options, resultat } })).toContain(`rémunération nette retenue : SASU ${euros(5800)} (4 trimestres : −${euros(1234)} de net), EURL ${euros(9000)})`)
  })

  it("adapte les réglages, l'écart négatif et les colonnes sans revenus ni statut actuel", () => {
    const resultat = comparaisonExemple()
    resultat.scenarios = [{ ...resultat.scenarios[1], netApresImpots: 15000, revenusAvantPrelevements: 0, warnings: [] }, { ...resultat.scenarios[0], warnings: [] }]
    const options = { ...optionsExemple(), repartition: { mode: "grille" as const, partDistribuee: 1 }, fraisFonctionnement: undefined }
    const rapport = rapportComplet({ comparaison: { nomActivite: "Ma SASU", options, resultat } })
    expect(rapport).toContain("- Bénéfice de la société en SASU et EURL : Dividendes saisis dans la grille (rémunération nette de 20 000 €, dividendes saisis dans la grille)")
    expect(rapport).toContain("- Frais de fonctionnement annuels ajoutés aux charges : aucun")
    expect(rapport).toContain("| Taux global de prélèvement | — | 25 % |")
    expect(rapport).toContain("| Écart avec le statut actuel | -5 000 € | — |")
    expect(rapport).not.toContain("Notes :")

    resultat.scenarios = resultat.scenarios.map(s => ({ ...s, actuel: false }))
    expect(rapportComplet({ comparaison: { nomActivite: "Ma SASU", options, resultat } })).toContain("| Écart avec le statut actuel | — | — |")
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
    const session = sessionExemple()
    session.name = "Famille | Martin\n# pas un titre"
    session.entities = session.entities.map(e => ({ ...e, name: `${e.name} | *gras*\n[lien](x)` }))
    const rapport = rapportExemple()
    rapport.activities = rapport.activities.map(a => ({ ...a, name: "Ma SASU | *gras*\n[lien](x)" }))
    const texte = rapportComplet({ session, report: rapport, comparaison: { nomActivite: "Ma SASU | x", options: optionsExemple(), resultat: comparaisonExemple() } })

    // Le titre reste sur une ligne, et aucune ligne ne commence par un titre que l'utilisateur aurait glissé dans un nom.
    expect(texte.split("\n")[0]).toBe("# Simulation « Famille \\| Martin \\# pas un titre »")
    expect(texte).not.toMatch(/^# pas un titre/m)
    expect(texte).toContain("### Ma SASU \\| \\*gras\\* \\[lien\\](x) (SASU)")
    expect(texte).toContain("## Comparateur de statuts : « Ma SASU \\| x »")
    // Dans chaque tableau, toutes les lignes ont autant de cellules que l'en-tête : les barres échappées n'en créent pas.
    const tableaux = texte.split(/\n\n/).filter(bloc => bloc.startsWith("| "))
    expect(tableaux.length).toBeGreaterThan(3)
    for (const tableau of tableaux) {
      const colonnes = tableau.split("\n").map(ligne => ligne.split(/(?<!\\)\|/).length)
      expect(new Set(colonnes).size, tableau).toBe(1)
    }
  })
})
