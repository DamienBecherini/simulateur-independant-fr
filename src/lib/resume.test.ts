// src/lib/resume.test.ts

import { describe, expect, it } from "vitest"
import type { ComparaisonResult, ScenarioStatut, SimulationReport, StatutCompare } from "@/types"
import { emptyReport } from "@/ui/testing/fixtures"
import { avecUnBeneficeGarde, avecUnePerteConservee, ecartAvecLaSituationSaisie, estNonRetenue, gainDuMariageOuDuPacs, libelleDuCoutDesTrimestres, meilleurStatut, netDeLaSituationSaisie, nombreDAlertes, porteurDeLaPremiereAlerte, phraseDuVerdict, netEtReste, raisonDeNonRetenue, referenceDesEcarts, remunerationOptimale, tauxDePrelevement } from "./resume"
import { GARANTIES_DE_TEST } from "@/backend/logic/testing/garanties-de-test"
import { avecSaRaison } from "@/backend/logic/testing/colonne-de-test"

const espaces = (texte: string | null) => texte?.replace(/\s/g, " ") ?? null

function scenario(statut: StatutCompare, libelle: string, net: number, actuel = false): ScenarioStatut {
  return avecSaRaison({ statut, libelle, actuel, telleQueSaisie: actuel, ecartDeFrais: { total: 0, postes: {} }, resultatConserveActivite: 0, horsPlafond: false, protectionSociale: { etoiles: 2, trimestres: 4, resume: "", garanties: GARANTIES_DE_TEST }, netApresImpots: net, revenusAvantPrelevements: 50000, totalPrelevements: 50000 - net, cotisationsSociales: 0, impotSocietes: 0, impotSurLeRevenu: 0, prelevementsSociaux: 0, resultatConserve: 0, warnings: [] })
}

function comparaison(meilleur: StatutCompare): ComparaisonResult {
  return { scenarios: [scenario("SASU", "SASU", 30000), scenario("micro", "Micro-entreprise", 32000, true), scenario("micro-vfl", "Micro + versement libératoire", 31000)], meilleur, situationSaisie: { statut: "micro", libelle: "Micro-entreprise", netApresImpots: 32000 }, couples: [], warnings: [] }
}

describe("barre de résumé", () => {
  it("désigne ce qui porte la première alerte affichée : l'année, sinon la première carte qui en a, foyers d'abord", () => {
    const foyer = (personIds: string[], warnings: string[]) => ({ personIds, warnings }) as SimulationReport["foyers"][number]
    const activite = (entityId: string, warnings: string[]) => ({ entityId, warnings }) as SimulationReport["activities"][number]
    expect(porteurDeLaPremiereAlerte(null)).toBeNull()
    expect(porteurDeLaPremiereAlerte(emptyReport())).toBeNull()
    const cartes = { foyers: [foyer(["p1"], []), foyer(["p2", "p3"], ["a"])], activities: [activite("sasu", ["b"])] }
    expect(porteurDeLaPremiereAlerte({ ...emptyReport(), ...cartes, avertissements: ["Règles reprises."] })).toBe("annee")
    expect(porteurDeLaPremiereAlerte({ ...emptyReport(), ...cartes })).toBe("foyer:p2-p3")
    expect(porteurDeLaPremiereAlerte({ ...emptyReport(), foyers: [foyer(["p1"], [])], activities: [activite("micro", []), activite("sasu", ["b"])] })).toBe("activite:sasu")
  })

  it("compte les alertes de l'année, des foyers et des activités", () => {
    const report: SimulationReport = { ...emptyReport(), avertissements: ["Règles 2026 reprises pour 2027."] }
    expect(nombreDAlertes(null)).toBe(0)
    expect(nombreDAlertes(report)).toBe(1)
    const foyer = { warnings: ["a", "b"] } as SimulationReport["foyers"][number]
    const activite = { warnings: ["c"] } as SimulationReport["activities"][number]
    expect(nombreDAlertes({ ...report, foyers: [foyer], activities: [activite] })).toBe(4)
  })

  it("calcule le taux global de prélèvement comme le bilan, sans revenus aucun taux", () => {
    const report = emptyReport()
    expect(tauxDePrelevement(report)).toBeNull()
    expect(espaces(tauxDePrelevement({ ...report, bilan: { ...report.bilan, revenusAvantPrelevements: 1000, totalPrelevements: 326 } }))).toBe("32,6 %")
  })

  it("nomme le meilleur statut, et son écart avec le statut actuel quand ce n'est pas lui", () => {
    expect(meilleurStatut(null)).toBeNull()
    expect(meilleurStatut(comparaison("micro"))).toBe("Micro-entreprise (actuel)")
    expect(espaces(meilleurStatut({ ...comparaison("SASU"), scenarios: comparaison("SASU").scenarios.map(s => (s.statut === "SASU" ? { ...s, netApresImpots: 33500 } : s)) }))).toBe("SASU, +1 500 €")
    expect(meilleurStatut({ ...comparaison("SASU"), situationSaisie: undefined, scenarios: [scenario("SASU", "SASU", 30000)] })).toBe("SASU")
  })

  it("au meilleur net d'une société, mesure l'écart à la situation saisie, qui n'est pas une colonne", () => {
    const optimisee = { ...scenario("SASU", "SASU, rémunération optimisée", 41000), actuel: true }
    const result: ComparaisonResult = { scenarios: [optimisee, scenario("EI", "EI au réel", 38000)], meilleur: "SASU", situationSaisie: { statut: "SASU", libelle: "SASU", netApresImpots: 40000 }, couples: [], warnings: [] }
    expect(espaces(meilleurStatut(result))).toBe("SASU, rémunération optimisée, +1 000 €")
    expect(netDeLaSituationSaisie(result)).toBe(40000)
    expect(ecartAvecLaSituationSaisie(result, result.scenarios[1])).toBe(-2000)
    expect(espaces(phraseDuVerdict(result, "Conseil"))).toBe("Pour « Conseil », SASU, rémunération optimisée donnerait le meilleur net : 41 000 €, soit +1 000 € par rapport à votre situation telle que saisie (SASU, 40 000 €).")
  })

  it("meilleur statut sous la situation saisie : ni présenté comme un gain, ni remplacé par elle, l'écart est expliqué", () => {
    const optimisee = { ...scenario("SASU", "SASU, rémunération optimisée", 47204), actuel: true }
    const explication = "Valider 4 trimestres de retraite vous coûterait environ 756 € par rapport à votre situation telle que saisie."
    const result: ComparaisonResult = { scenarios: [optimisee, scenario("EI", "EI au réel", 38000)], meilleur: "SASU", situationSaisie: { statut: "SASU", libelle: "SASU", netApresImpots: 47960 }, sousLaSituationSaisie: { ecart: 756, raison: "trimestres", explication }, couples: [], warnings: [] }

    expect(espaces(phraseDuVerdict(result, "Conseil"))).toBe("Pour « Conseil », le meilleur des statuts comparés, SASU, rémunération optimisée, donnerait 47 204 €, contre 47 960 € pour votre situation telle que saisie (SASU). Valider 4 trimestres de retraite vous coûterait environ 756 € par rapport à votre situation telle que saisie.")
    expect(espaces(meilleurStatut(result))).toBe("SASU, rémunération optimisée, −756 € pour 4 trimestres de retraite")
    expect(espaces(meilleurStatut({ ...result, sousLaSituationSaisie: { ecart: 756, raison: "reglages", explication } }))).toBe("SASU, rémunération optimisée, −756 € (aucun ne fait mieux que la saisie)")
    expect(espaces(meilleurStatut({ ...result, sousLaSituationSaisie: { ecart: 756, raison: "statutActuelNonRetenu", explication } }))).toBe("SASU, rémunération optimisée, −756 € (statut actuel non retenu)")
  })

  it("sans chiffre d'affaires, invite à en saisir un au lieu de désigner un statut", () => {
    const result: ComparaisonResult = { ...comparaison("micro"), meilleur: null, sansChiffreDAffaires: true }
    expect(meilleurStatut(result)).toBe("saisissez un chiffre d'affaires")
    expect(phraseDuVerdict(result, "Atelier")).toBeNull()
  })
})

describe("verdict du comparateur", () => {
  it("quand le statut actuel est le meilleur, nomme le suivant et son écart", () => {
    expect(espaces(phraseDuVerdict(comparaison("micro"), "Atelier"))).toBe("Pour « Atelier », le statut actuel, Micro-entreprise, donne le meilleur net : 32 000 €. Juste derrière : Micro + versement libératoire, −1 000 €.")
  })

  it("quand un autre statut est meilleur, donne son gain par rapport au statut actuel", () => {
    const result = { ...comparaison("SASU"), scenarios: comparaison("SASU").scenarios.map(s => (s.statut === "SASU" ? { ...s, netApresImpots: 34000 } : s)) }
    expect(espaces(phraseDuVerdict(result, "Atelier"))).toBe("Pour « Atelier », SASU donnerait le meilleur net : 34 000 €, soit +2 000 € par rapport à votre situation telle que saisie (Micro-entreprise, 32 000 €).")
  })

  it("déduit la perte restée dans la société : des écarts, du classement et du verdict, qui la dit", () => {
    // Une année de perte : l'EI porte −21 500 € dans le net du foyer ; la SASU affiche 0 €, et garde 20 000 € de perte.
    const sasu = { ...scenario("SASU", "SASU", 0, true), perteConservee: 20000 }
    const ei = scenario("EI", "EI au réel", -21500)
    const eurl = { ...scenario("EURL", "EURL", 0), perteConservee: 21654 }
    const perte: ComparaisonResult = { scenarios: [sasu, eurl, ei], meilleur: "SASU", situationSaisie: { statut: "SASU", libelle: "SASU", netApresImpots: 0, perteConservee: 20000 }, couples: [], warnings: [] }

    expect(referenceDesEcarts(perte)).toBe(-20000)
    expect(avecUnePerteConservee(perte)).toBe(true)
    expect(ecartAvecLaSituationSaisie(perte, sasu)).toBeNull()
    // L'EI ne fait que 1 500 € de moins, pas 21 500 € ; l'EURL, au même net affiché que la SASU, fait moins bien.
    expect(ecartAvecLaSituationSaisie(perte, ei)).toBe(-1500)
    expect(ecartAvecLaSituationSaisie(perte, eurl)).toBe(-1654)
    expect(espaces(phraseDuVerdict(perte, "Atelier"))).toBe("Pour « Atelier », le statut actuel, SASU, donne le meilleur net : 0 € (et 20 000 € de perte restée dans la société). Juste derrière : EI au réel, −1 500 €.")

    // Vue depuis l'EI : la SASU n'apporte que 1 500 €, et sa perte est dite.
    const depuisLEi: ComparaisonResult = { ...perte, scenarios: [{ ...sasu, telleQueSaisie: false }, { ...ei, telleQueSaisie: true }], situationSaisie: { statut: "EI", libelle: "EI au réel", netApresImpots: -21500 } }
    expect(espaces(phraseDuVerdict(depuisLEi, "Atelier"))).toBe("Pour « Atelier », SASU donnerait le meilleur net : 0 € (et 20 000 € de perte restée dans la société), soit +1 500 € par rapport à votre situation telle que saisie (EI au réel, -21 500 €).")
    expect(espaces(meilleurStatut(depuisLEi))).toBe("SASU, +1 500 €")

    // Sans perte, rien ne change.
    expect(avecUnePerteConservee(comparaison("micro"))).toBe(false)
    expect(referenceDesEcarts(comparaison("micro"))).toBe(32000)
    expect(netEtReste({ statut: "micro", netApresImpots: 32000 }).replace(/\s/g, " ")).toBe("32 000 €")
    expect(netEtReste({ statut: "portage", netApresImpots: 0, perteConservee: 17800 }).replace(/\s/g, " ")).toBe("0 € (et 17 800 € de perte restée sur le compte d'activité)")
  })

  it("dit le bénéfice gardé dans la société à côté du net, sans le compter dans les écarts", () => {
    expect(espaces(netEtReste({ statut: "SASU", netApresImpots: 30000, beneficeGarde: 12000 }))).toBe("30 000 € (et 12 000 € gardés dans la société)")
    expect(espaces(netEtReste({ statut: "portage", netApresImpots: 30000, beneficeGarde: 2000 }))).toBe("30 000 € (et 2 000 € gardés sur le compte d'activité)")

    const sasu = { ...scenario("SASU", "SASU", 30000), actuel: true, telleQueSaisie: true, beneficeGarde: 12000 }
    const ei = scenario("EI", "EI au réel", 38000)
    const result: ComparaisonResult = { scenarios: [sasu, ei], meilleur: "EI", situationSaisie: { statut: "SASU", libelle: "SASU", netApresImpots: 30000, beneficeGarde: 12000 }, couples: [], warnings: [] }
    expect(avecUnBeneficeGarde(result)).toBe(true)
    expect(avecUnBeneficeGarde(comparaison("micro"))).toBe(false)
    // La réserve du compte d'une activité en portage est écrite sous son net, sans l'explication sous le tableau.
    expect(avecUnBeneficeGarde({ ...result, scenarios: [ei, { ...scenario("portage", "Portage salarial", 27000), beneficeGarde: 2780 }] })).toBe(false)
    // L'écart reste celui des nets : les 12 000 € gardés ne rapprochent pas la SASU de l'EI.
    expect(ecartAvecLaSituationSaisie(result, ei)).toBe(8000)
    expect(espaces(phraseDuVerdict(result, "Conseil"))).toBe("Pour « Conseil », EI au réel donnerait le meilleur net : 38 000 €, soit +8 000 € par rapport à votre situation telle que saisie (SASU, 30 000 € (et 12 000 € gardés dans la société)).")
  })

  it("ne conclut pas sans meilleur statut ou sans statut actuel", () => {
    expect(phraseDuVerdict({ ...comparaison("micro"), meilleur: null }, "Atelier")).toBeNull()
    expect(phraseDuVerdict({ ...comparaison("SASU"), situationSaisie: undefined }, "Atelier")).toBeNull()
  })

  it("ne cite pas derrière le statut actuel une colonne micro qui n'est plus accessible", () => {
    const result = { ...comparaison("micro"), scenarios: comparaison("micro").scenarios.map(s => (s.statut === "micro-vfl" ? { ...s, nonRetenue: "regimeMicroFerme" as const, regimeMicroFerme: { depuis: 2028, depassements: [2026, 2027] as [number, number] } } : s)) }
    expect(espaces(phraseDuVerdict(result, "Atelier"))).toBe("Pour « Atelier », le statut actuel, Micro-entreprise, donne le meilleur net : 32 000 €. Juste derrière : SASU, −2 000 €.")
  })

  it("le portage salarial peut être désigné ; non retenu, il n'est pas cité derrière le statut actuel et sa cellule dit pourquoi", () => {
    const portage = scenario("portage", "Portage salarial", 35000)
    const gagnant = { ...comparaison("portage"), scenarios: [...comparaison("portage").scenarios, portage] }
    expect(espaces(phraseDuVerdict(gagnant, "Atelier"))).toBe("Pour « Atelier », Portage salarial donnerait le meilleur net : 35 000 €, soit +3 000 € par rapport à votre situation telle que saisie (Micro-entreprise, 32 000 €).")
    expect(espaces(meilleurStatut(gagnant))).toBe("Portage salarial, +3 000 €")

    const nonRetenu = { ...portage, netApresImpots: 31500, nonRetenue: "portageSansPrestations" as const }
    expect(estNonRetenue(nonRetenu)).toBe(true)
    expect(raisonDeNonRetenue(nonRetenu)).toBe("non retenue : aucune prestation à facturer")
    expect(raisonDeNonRetenue({ nonRetenue: "portageSalaries" })).toBe("non retenue : salariés de l'activité")
    expect(espaces(phraseDuVerdict({ ...comparaison("micro"), scenarios: [...comparaison("micro").scenarios, nonRetenu] }, "Atelier"))).toContain("Juste derrière : Micro + versement libératoire")
  })

  it("une société dont la grille verse plus que son bénéfice n'est pas retenue, et sa cellule dit pourquoi", () => {
    const societe = { ...scenario("SASU", "SASU", 40000), nonRetenue: "remunerationNonCouverte" as const }
    expect(estNonRetenue(societe)).toBe(true)
    expect(raisonDeNonRetenue(societe)).toBe("non retenue : rémunération supérieure au bénéfice")
    // Une rémunération choisie ramenée à ce que la société peut verser reste une colonne retenue.
    const plafonnee = { ...scenario("SASU", "SASU", 30000), remunerationPlafonnee: { demandee: 80000000, retenue: 38000 } }
    expect(estNonRetenue(plafonnee)).toBe(false)
    expect(raisonDeNonRetenue(plafonnee)).toBeNull()
  })

  it("la SASU d'une profession en société d'exercice libéral n'est pas citée derrière le statut actuel, même avec un net supérieur", () => {
    const ei = { ...scenario("EI", "EI au réel", 63137, true) }
    const sasu = { ...scenario("SASU", "SASU", 68228), nonRetenue: "societeExerciceLiberal" as const }
    const micro = scenario("micro", "Micro-entreprise", 60000)
    const result: ComparaisonResult = { scenarios: [sasu, ei, micro], meilleur: "EI", situationSaisie: { statut: "EI", libelle: "EI au réel", netApresImpots: 63137 }, couples: [], warnings: [] }
    expect(raisonDeNonRetenue(sasu)).toBe("non retenue : société d'exercice libéral")
    expect(espaces(phraseDuVerdict(result, "Cabinet"))).toBe("Pour « Cabinet », le statut actuel, EI au réel, donne le meilleur net : 63 137 €. Juste derrière : Micro-entreprise, −3 137 €.")
  })

  it("seul en tête, le statut actuel n'a personne derrière lui", () => {
    expect(espaces(phraseDuVerdict({ ...comparaison("micro"), scenarios: [scenario("micro", "Micro-entreprise", 32000, true)] }, "Atelier"))).toBe("Pour « Atelier », le statut actuel, Micro-entreprise, donne le meilleur net : 32 000 €.")
  })
})

describe("coût des 4 trimestres de retraite", () => {
  it("écrit ce que coûte leur exigence dans une colonne", () => {
    expect(libelleDuCoutDesTrimestres(1234).replace(/\s/g, " ")).toBe("4 trimestres : −1 234 € de net")
  })

  it("donne le gain d'un mariage ou d'un Pacs du premier couple en union libre, rien sans couple", () => {
    const couple = { personIds: ["hugo", "emma"] as [string, string], netApresImpotsActuel: 46460, impotSurLeRevenuActuel: 4444, netApresImpotsMaries: 48789, impotSurLeRevenuMaries: 2115 }
    expect(gainDuMariageOuDuPacs(null)).toBeNull()
    expect(gainDuMariageOuDuPacs(comparaison("micro"))).toBeNull()
    expect(gainDuMariageOuDuPacs({ ...comparaison("micro"), couples: [couple] })).toBe(2329)
  })

  it("donne la rémunération au meilleur net de l'arbitrage, rien tant qu'il n'a pas de résultat", () => {
    const point = { remunerationNette: 5800, dividendes: 40000, netApresImpots: 45780, cotisationsSociales: 0, impotSocietes: 0, impotSurLeRevenu: 0, prelevementsSociaux: 0, trimestres: 4 }
    const optimisation = { statut: "SASU" as const, remunerationMaximale: 60000, points: [point], meilleur: point, meilleurAvecRetraite: point, warnings: [] }
    expect(remunerationOptimale(undefined)).toBeNull()
    expect(remunerationOptimale(null)).toBeNull()
    expect(remunerationOptimale({ ...optimisation, meilleur: null })).toBeNull()
    expect(remunerationOptimale(optimisation)).toBe(5800)
  })

  it("quand la colonne de la société a gardé la répartition saisie, c'est sa rémunération : la barre ne conseille pas un autre salaire que le tableau", () => {
    const point = { remunerationNette: 400, dividendes: 73211, netApresImpots: 55206, cotisationsSociales: 0, impotSocietes: 0, impotSurLeRevenu: 0, prelevementsSociaux: 0, trimestres: 0 }
    const optimisation = { statut: "SASU" as const, remunerationMaximale: 60000, points: [point], meilleur: point, meilleurAvecRetraite: null, warnings: [] }
    const gardee: ScenarioStatut = { ...scenario("SASU", "SASU", 55191, true), saisieAuMeilleurNet: true, remunerationOptimale: { remunerationNette: 0, avecRetraite: false, retraiteHorsDAtteinte: false } }
    expect(remunerationOptimale(optimisation, { ...comparaison("SASU"), scenarios: [gardee] })).toBe(0)
    // L'arbitrage d'un autre statut de société, étudié dans « Rémunération ou dividendes ? », garde le sien.
    expect(remunerationOptimale({ ...optimisation, statut: "EURL" }, { ...comparaison("SASU"), scenarios: [gardee] })).toBe(400)
    expect(remunerationOptimale(optimisation, comparaison("micro"))).toBe(400)
  })
})
