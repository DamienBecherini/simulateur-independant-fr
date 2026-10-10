// src/lib/nature-de-l-activite.test.ts
// La nature du chiffre d'affaires d'une micro-entreprise, telle que l'explique la fenêtre des flux : les taux viennent
// des règles de l'année affichée, la nature proposée d'office est celle déjà saisie, sinon les prestations libérales.

import { describe, expect, it } from "vitest"
import { pourcent } from "@/backend/logic/format"
import { ANNEE_COURANTE, reglesPubliees } from "@/backend/logic/regles"
import { makeFlow, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { descriptionsDesNatures, introductionDesNatures, NATURES_MICRO, noteSurLesAchats, typeProposeDOffice } from "./nature-de-l-activite"

const regles = reglesPubliees(ANNEE_COURANTE)
const { cotisations, abattement } = regles.microEntreprise

describe("descriptions des natures", () => {
  it("donne, pour chaque nature, son libellé complet, ses taux de l'année et des exemples de métiers", () => {
    const [bnc, bic, vente] = descriptionsDesNatures(makeMicro(), regles)
    expect(bnc).toEqual({ type: "ca_micro_services_bnc", libelle: "Prestations libérales (BNC)", taux: `cotisations de ${pourcent(cotisations.servicesBnc)} du chiffre d'affaires, abattement de ${pourcent(abattement.servicesBnc)} pour l'impôt`, exemples: expect.stringContaining("développeur, consultant") })
    expect(bnc.exemples).toContain("ostéopathe")
    expect(bic.libelle).toBe("Prestations artisanales ou commerciales (BIC)")
    expect(bic.taux).toBe(`cotisations de ${pourcent(cotisations.servicesBic)} du chiffre d'affaires, abattement de ${pourcent(abattement.servicesBic)} pour l'impôt`)
    expect(bic.exemples).toMatch(/plombier.*coiffeur/)
    expect(vente.libelle).toBe("Vente de marchandises (BIC)")
    expect(vente.taux).toBe(`cotisations de ${pourcent(cotisations.venteBic)} du chiffre d'affaires, abattement de ${pourcent(abattement.venteBic)} pour l'impôt`)
    expect(vente.exemples).toMatch(/revente/)
  })

  it("suit les règles reçues : un autre taux de l'année se lit dans le texte", () => {
    const autres = { ...regles, microEntreprise: { ...regles.microEntreprise, cotisations: { ...cotisations, servicesBnc: 0.3 } } }
    expect(descriptionsDesNatures(makeMicro(), autres)[0].taux).toContain(pourcent(0.3))
  })

  it("prend le taux propre de la caisse d'une profession réglementée (CIPAV), celui que retient le calcul", () => {
    const tauxCipav = regles.liberauxReglementes.CIPAV.microEntreprise.cotisations
    const [bnc, bic] = descriptionsDesNatures(makeMicro({ profession: "osteopathe" }), regles)
    expect(bnc.taux).toBe(`cotisations de ${pourcent(tauxCipav)} du chiffre d'affaires (taux de la CIPAV), abattement de ${pourcent(abattement.servicesBnc)} pour l'impôt`)
    expect(bic.taux).toContain(pourcent(cotisations.servicesBic))
  })

  it("garde l'ordre de la liste des types : prestations libérales, prestations artisanales ou commerciales, vente", () => {
    expect(NATURES_MICRO).toEqual(["ca_micro_services_bnc", "ca_micro_services_bic", "ca_micro_vente"])
  })
})

describe("introduction et note sur les achats", () => {
  it("nomme l'année des taux et justifie la nature proposée d'office", () => {
    const texte = introductionDesNatures(makeMicro(), regles)
    expect(texte).toContain(`taux de ${ANNEE_COURANTE}`)
    expect(texte).toContain("celle déjà saisie pour cette activité dans l'année, sinon les prestations libérales, la plus prudente (cotisations les plus élevées, abattement le plus faible)")
  })

  it("ne dit pas les prestations libérales les plus prudentes si les règles cessent de le permettre", () => {
    const autres = { ...regles, microEntreprise: { ...regles.microEntreprise, cotisations: { ...cotisations, servicesBic: cotisations.servicesBnc + 0.01 } } }
    expect(introductionDesNatures(makeMicro(), autres)).not.toContain("prudente")
  })

  it("rappelle la nature attendue d'une profession réglementée", () => {
    expect(introductionDesNatures(makeMicro({ profession: "osteopathe" }), regles)).toMatch(/Ostéopathe : prestations libérales \(BNC\)\.$/)
  })

  it("explique que les achats ne se déduisent pas, avec l'abattement et les cotisations de la vente de l'année", () => {
    const note = noteSurLesAchats(regles)
    expect(note).toContain("ne se déduisent pas en micro-entreprise")
    expect(note).toContain(`l'abattement de ${pourcent(abattement.venteBic)} est censé les couvrir`)
    expect(note).toContain(`les cotisations de ${pourcent(cotisations.venteBic)} portent sur tout le chiffre d'affaires`)
    expect(note).toContain("« Charge de l'activité (non déductible en micro) »")
    expect(note).toContain("comparateur de statuts")
  })
})

describe("type proposé d'office sur la ligne d'ajout", () => {
  const micro = makeMicro({ id: "m" })

  it("micro-entreprise sans chiffre d'affaires : les prestations libérales", () => {
    expect(typeProposeDOffice(micro, [])).toBe("ca_micro_services_bnc")
    expect(typeProposeDOffice(micro, [makeFlow({ entityId: "m", type: "expense" })])).toBe("ca_micro_services_bnc")
  })

  it("micro-entreprise qui a déjà un chiffre d'affaires : sa nature, pas celle d'une autre activité", () => {
    expect(typeProposeDOffice(micro, [makeFlow({ entityId: "autre", type: "ca_micro_services_bic" }), makeFlow({ entityId: "m", type: "ca_micro_vente" })])).toBe("ca_micro_vente")
  })

  it("autre acteur : le premier type permis", () => {
    expect(typeProposeDOffice(makePerson(), [])).toBe("are")
  })
})
