// src/lib/ecart-de-repartition.test.ts

import { describe, expect, it } from "vitest"
import type { ComparaisonResult, PartageDuBenefice, RepartitionSaisie, ScenarioStatut } from "@/types"
import { ecartDeRepartition } from "./ecart-de-repartition"
import { GARANTIES_DE_TEST } from "@/backend/logic/testing/garanties-de-test"

const partage = (remunerationNette: number, dividendesNets: number, resultatConserve = 0): PartageDuBenefice => ({ beneficeAvantRemuneration: 78000, remunerationNette, cotisationsRemuneration: 0, impotSocietes: 0, dividendesNets, cotisationsSurDividendes: 0, resultatConserve })

function colonne(net: number, autres: Partial<ScenarioStatut> = {}): ScenarioStatut {
  return {
    statut: "SASU",
    libelle: "SASU, rémunération optimisée",
    actuel: true,
    telleQueSaisie: false,
    ecartDeFrais: { total: 0, postes: {} },
    resultatConserveActivite: 0,
    horsPlafond: false,
    protectionSociale: { etoiles: 3, trimestres: 0, resume: "", garanties: GARANTIES_DE_TEST },
    netApresImpots: net,
    revenusAvantPrelevements: 78000,
    totalPrelevements: 78000 - net,
    cotisationsSociales: 0,
    impotSocietes: 0,
    impotSurLeRevenu: 0,
    prelevementsSociaux: 0,
    resultatConserve: 0,
    warnings: [],
    ...autres
  }
}

const comparaison = (scenario: ScenarioStatut, net: number, repartition?: RepartitionSaisie): ComparaisonResult => ({
  scenarios: [scenario],
  meilleur: "SASU",
  situationSaisie: { statut: "SASU", libelle: "SASU", netApresImpots: net, ...(repartition ? { repartition } : {}) },
  couples: [],
  warnings: []
})

const lisible = (texte: string) => texte.replace(/\s/g, " ")

describe("écart d'une société avec la situation saisie, à statut égal", () => {
  // SASU en zone franche urbaine, tout en dividendes : 55 191 € de net. Avec 400 € de salaire : 55 206 €.
  const saisie: RepartitionSaisie = { remunerationNette: 0, dividendes: 73800, impotSurLeRevenu: 4882, prelevementsSociaux: 13727, resultatConserve: 0 }
  const avecSalaire = colonne(55206, { partage: partage(400, 73210.75), impotSurLeRevenu: 4788, prelevementsSociaux: 13617 })

  it("met chaque poste du net du foyer côte à côte : la somme des effets est l'écart de la colonne", () => {
    const ecart = ecartDeRepartition(comparaison(avecSalaire, 55191, saisie), avecSalaire)!
    expect(lisible(ecart.resume)).toBe("avec 400 € de rémunération nette au lieu de 0 €")
    expect(ecart.postes).toEqual([
      { libelle: "Rémunération nette", saisie: 0, colonne: 400, effet: 400 },
      { libelle: "Dividendes", saisie: 73800, colonne: 73211, effet: -589 },
      // Un impôt ou un prélèvement en moins ajoute au net.
      { libelle: "Impôt sur le revenu", saisie: 4882, colonne: 4788, effet: 94 },
      { libelle: "Prélèvements sociaux", saisie: 13727, colonne: 13617, effet: 110 }
    ])
    expect(ecart.postes.reduce((somme, poste) => somme + poste.effet, 0)).toBe(55206 - 55191)
    expect(ecart.autres).toBeUndefined()
    expect(ecart.conserve).toBeUndefined()
  })

  it("à rémunération égale, ce sont les dividendes qui la distinguent, et le bénéfice laissé dans la société est dit", () => {
    const toutDistribue = colonne(50000, { partage: partage(12000, 40000), impotSurLeRevenu: 3000, prelevementsSociaux: 7000 })
    const ecart = ecartDeRepartition(comparaison(toutDistribue, 34000, { remunerationNette: 12000, dividendes: 20000, impotSurLeRevenu: 1500, prelevementsSociaux: 3500, resultatConserve: 20000 }), toutDistribue)!
    expect(lisible(ecart.resume)).toBe("avec 40 000 € de dividendes au lieu de 20 000 €")
    expect(ecart.conserve).toEqual({ saisie: 20000, colonne: 0 })
    // 20 000 - 1 500 - 3 500 = 15 000 € ; la colonne annonce 16 000 € de plus : le reste est signalé à part.
    expect(ecart.autres).toBe(1000)
  })

  it("un reste d'un euro, simple arrondi, n'est pas signalé", () => {
    const colonneArrondie = { ...avecSalaire, netApresImpots: 55207 }
    expect(ecartDeRepartition(comparaison(colonneArrondie, 55191, saisie), colonneArrondie)?.autres).toBeUndefined()
  })

  it("rien pour la situation saisie elle-même, une colonne d'un autre statut, une activité qui n'est pas une société, ou un partage identique", () => {
    const telleQueSaisie = { ...avecSalaire, telleQueSaisie: true }
    expect(ecartDeRepartition(comparaison(telleQueSaisie, 55191, saisie), telleQueSaisie)).toBeNull()
    const autreStatut = { ...avecSalaire, statut: "EURL" as const, actuel: false }
    expect(ecartDeRepartition(comparaison(autreStatut, 55191, saisie), autreStatut)).toBeNull()
    expect(ecartDeRepartition(comparaison(avecSalaire, 55191), avecSalaire)).toBeNull()
    const sansPartage = colonne(55206)
    expect(ecartDeRepartition(comparaison(sansPartage, 55191, saisie), sansPartage)).toBeNull()
    const identique = colonne(55191, { partage: partage(0, 73800), impotSurLeRevenu: 4882, prelevementsSociaux: 13727 })
    expect(ecartDeRepartition(comparaison(identique, 55191, saisie), identique)).toBeNull()
  })
})
