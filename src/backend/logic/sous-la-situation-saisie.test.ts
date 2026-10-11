// src/backend/logic/sous-la-situation-saisie.test.ts

import { describe, expect, it } from "vitest"
import type { RemunerationOptimale, ScenarioStatut, StatutCompare } from "../../types.js"
import { sousLaSituationSaisie, type ReferenceDeLaSituationSaisie } from "./sous-la-situation-saisie.js"

const espaces = (texte: string | undefined) => texte?.replace(/\s/g, " ")

function scenario(statut: StatutCompare, net: number, autres: Partial<ScenarioStatut> = {}): ScenarioStatut {
  return { statut, libelle: statut, actuel: false, telleQueSaisie: false, ecartDeFrais: { total: 0, postes: {} }, resultatConserveActivite: 0, horsPlafond: false, protectionSociale: { etoiles: 2, trimestres: 0, resume: "" }, netApresImpots: net, revenusAvantPrelevements: 60000, totalPrelevements: 60000 - net, cotisationsSociales: 0, impotSocietes: 0, impotSurLeRevenu: 0, prelevementsSociaux: 0, resultatConserve: 0, warnings: [], ...autres }
}

/** Une société au meilleur net avec 4 trimestres exigés, qui coûtent `cout` de net. */
const avecTrimestres = (net: number, cout: number): ScenarioStatut => {
  const remunerationOptimale: RemunerationOptimale = { remunerationNette: 12000, avecRetraite: true, retraiteHorsDAtteinte: false, coutDesQuatreTrimestres: cout }
  return scenario("SASU", net, { libelle: "SASU, rémunération optimisée", actuel: true, remunerationOptimale, protectionSociale: { etoiles: 2, trimestres: 4, resume: "" } })
}

const saisie = (autres: Partial<ReferenceDeLaSituationSaisie> = {}): ReferenceDeLaSituationSaisie => ({ netApresImpots: 47960, trimestres: 0, motifNonRetenu: null, ...autres })

describe("meilleur statut sous la situation saisie", () => {
  it("SASU sans salaire, au meilleur net avec 4 trimestres : le coût des trimestres explique l'écart", () => {
    const sous = sousLaSituationSaisie(avecTrimestres(47204, 760), saisie())

    expect(sous).toMatchObject({ ecart: 756, raison: "trimestres" })
    expect(espaces(sous?.explication)).toBe("Valider 4 trimestres de retraite vous coûterait environ 756 € par rapport à votre situation telle que saisie.")
  })

  it("tolère l'écart dû à la précision de l'optimiseur (100 €)", () => {
    expect(sousLaSituationSaisie(avecTrimestres(47204, 656), saisie())?.raison).toBe("trimestres")
    expect(sousLaSituationSaisie(avecTrimestres(47204, 655), saisie())?.raison).toBe("reglages")
  })

  it("n'invoque pas les trimestres quand la situation saisie en valide autant", () => {
    const sous = sousLaSituationSaisie(avecTrimestres(47204, 760), saisie({ trimestres: 4 }))

    expect(sous?.raison).toBe("reglages")
    expect(espaces(sous?.explication)).toBe("Avec ces réglages du comparateur, aucun statut comparé ne fait mieux que votre situation telle que saisie : le meilleur vous coûterait environ 756 €.")
  })

  it("dit que le statut actuel n'est pas retenu, et pourquoi", () => {
    const sous = sousLaSituationSaisie(scenario("EI", 40000), saisie({ netApresImpots: 42000, motifNonRetenu: "plafond de la micro-entreprise dépassé" }))

    expect(sous).toMatchObject({ ecart: 2000, raison: "statutActuelNonRetenu" })
    expect(espaces(sous?.explication)).toBe("Votre statut actuel n'est pas retenu comme meilleur statut (plafond de la micro-entreprise dépassé) : le meilleur des autres vous coûterait environ 2 000 € par rapport à votre situation telle que saisie.")
  })

  it("rien quand le meilleur statut fait au moins aussi bien, ou qu'il est la situation saisie", () => {
    expect(sousLaSituationSaisie(scenario("EI", 47960), saisie())).toBeUndefined()
    expect(sousLaSituationSaisie(scenario("EI", 47959.6), saisie())).toBeUndefined()
    expect(sousLaSituationSaisie(scenario("micro", 30000, { telleQueSaisie: true }), saisie())).toBeUndefined()
    expect(sousLaSituationSaisie(undefined, saisie())).toBeUndefined()
  })
})
