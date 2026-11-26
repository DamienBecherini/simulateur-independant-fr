// src/web/outils-ia-epargne-retraite.test.ts
// Épargne retraite (PER, ADR 021) par les outils pour les clients d'IA, sur une situation type (Julien,
// kinésithérapeute en entreprise individuelle, imposé dans la tranche à 30 %) : un versement se propose sur une personne,
// le plafond de l'avis d'impôt se règle dans sa fiche, et les montants rendus sont ceux du moteur.

import { describe, expect, it } from "vitest"
import type { Person, SessionState } from "@/types"
import { enTexteBrut } from "@/backend/logic/format"
import { simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { MONTAGES_TYPES, sessionDUnMontage } from "@/lib/montages/montages"
import { appeler, appliquer, erreurDe, geler, TOUTE_L_ANNEE, type ResultatProposition } from "./outils-ia.testing"

const exemple = () => geler(sessionDUnMontage(MONTAGES_TYPES.find(m => m.id === "kinesitherapeute-ei")!))
const foyerDe = (session: SessionState) => simulerLesAnnees(session).annees.find(a => a.annee === 2026)!.report!.foyers[0]
// Julien verse 300 € par mois : 3 600 € dans l'année, sous le minimum légal de 4 710 €.
const versement = { annee: 2026, acteurId: "p-julien", typeFlux: "versement_per", libelle: "Versement PER", montant: 300, mois: TOUTE_L_ANNEE }
const avecVersement = () => appliquer(exemple(), appeler<ResultatProposition>("proposer_flux", exemple(), { flux: [versement] }).proposition)

interface Explication {
  lignes: { libelle: string; montant: number; composantes?: { libelle: string; montant: number }[] }[]
  informations: string[]
  avertissements: string[]
}

describe("proposer un versement PER", () => {
  it("l'ajoute à une personne, et l'aperçu montre le net du foyer relevé de l'impôt économisé", () => {
    const resultat = appeler<ResultatProposition>("proposer_flux", exemple(), { flux: [versement] })

    expect(resultat.resume).toEqual(["Ajouter « Versement PER » (versement_per) sur « Julien » : 300 € par mois, toute l'année 2026 (12 flux, 3 600 €)."])
    const foyer = foyerDe(avecVersement())
    expect(foyer.versementsEpargneRetraite).toBe(3600)
    // Tranche à 30 % avec ou sans le versement : 30 % de 3 600 €.
    expect(foyer.impotEconomiseEpargneRetraite).toBe(1080)
    // Le versement reste dans le net du foyer : seul l'impôt change.
    expect(resultat.apercu).toEqual([expect.objectContaining({ annee: 2026, ecart: 1080 })])
  })

  it("refuse le type sur une activité, et dit lesquels elle porte", () => {
    expect(erreurDe("proposer_flux", exemple(), { flux: [{ ...versement, acteurId: "ei-julien" }] })).toContain("Le type de flux « versement_per » ne convient pas à « Cabinet de kinésithérapie de Julien » (EI)")
  })
})

describe("plafond d'épargne retraite d'une personne", () => {
  it("se lit dans decrire_simulation, se propose pour une personne et se refuse pour une activité", () => {
    const reglagesDe = (session: SessionState) => appeler<{ acteurs: { id: string; reglages: Record<string, unknown> }[] }>("decrire_simulation", session).acteurs.find(a => a.id === "p-julien")!.reglages
    expect(reglagesDe(exemple())).toMatchObject({ plafondEpargneRetraite: null })

    const { proposition } = appeler<ResultatProposition>("proposer_modification", exemple(), { modifications: [{ cible: "acteur", acteurId: "p-julien", reglages: { plafondEpargneRetraite: 12500 } }] })
    const apres = appliquer(exemple(), proposition)
    expect((apres.entities.find(e => e.id === "p-julien") as Person).plafondEpargneRetraite).toBe(12500)
    expect(reglagesDe(apres)).toMatchObject({ plafondEpargneRetraite: 12500 })

    expect(erreurDe("proposer_modification", exemple(), { modifications: [{ cible: "acteur", acteurId: "ei-julien", reglages: { plafondEpargneRetraite: 5000 } }] })).toContain("« plafondEpargneRetraite » ne s'applique pas à un acteur « EI »")
  })
})

describe("simuler et expliquer_resultat avec un versement PER", () => {
  it("simuler rend les montants du moteur, et 0 sans versement", () => {
    const session = avecVersement()
    const foyer = foyerDe(session)
    const rendu = appeler<{ foyers: Record<string, number>[] }>("simuler", session).foyers[0]

    expect(rendu).toMatchObject({ versementsEpargneRetraite: 3600, deductionEpargneRetraite: foyer.deductionEpargneRetraite, impotEconomiseEpargneRetraite: foyer.impotEconomiseEpargneRetraite, revenuImposable: foyer.revenuImposableGlobal, netApresImpots: foyer.netApresImpots })
    expect(appeler<{ foyers: Record<string, number>[] }>("simuler", exemple()).foyers[0]).toMatchObject({ versementsEpargneRetraite: 0, deductionEpargneRetraite: 0, impotEconomiseEpargneRetraite: 0 })
  })

  it("expliquer_resultat détaille les versements d'une personne, ses plafonds, et ce que la déduction change pour son foyer", () => {
    const session = avecVersement()
    const foyer = foyerDe(session)
    const julien = foyer.epargneRetraite.personnes.find(p => p.personId === "p-julien")!
    const { lignes, informations, avertissements } = appeler<Explication>("expliquer_resultat", session, { acteurId: "p-julien" })
    const ligne = (debut: string) => lignes.find(l => l.libelle.startsWith(debut))!

    expect(ligne("Épargne retraite : versements PER de l'année")).toMatchObject({ montant: 3600, composantes: [{ montant: 3600 }, { montant: 0 }, { montant: 0 }] })
    expect(ligne("Épargne retraite : plafond des versements de 2026")).toMatchObject({ libelle: "Épargne retraite : plafond des versements de 2026 (le minimum légal, faute de plafond saisi dans la fiche)", montant: 4710 })
    expect(ligne("Épargne retraite : plafond calculé sur 2026, pour les versements de 2027").montant).toBe(julien.plafondCalcule)
    expect(ligne("Foyer : versements PER déduits du revenu imposable").montant).toBe(foyer.deductionEpargneRetraite)
    expect(ligne("Foyer : impôt économisé par cette déduction").montant).toBe(foyer.impotEconomiseEpargneRetraite)
    expect(informations.join("\n")).toContain("Tranche marginale du foyer avant la déduction des versements PER")
    expect(avertissements.join("\n")).toContain("le plafond de 2026 n'est pas saisi, le minimum légal est retenu")
    // Un texte destiné à un modèle n'a pas d'espace insécable.
    const textes = [...lignes.map(l => l.libelle), ...informations].join("")
    expect(enTexteBrut(textes)).toBe(textes)
  })

  it("expliquer_resultat donne les plafonds d'une personne qui ne verse rien, sans lignes de versement", () => {
    const { lignes, informations } = appeler<Explication>("expliquer_resultat", exemple(), { acteurId: "p-julien" })
    const libelles = lignes.map(l => l.libelle)

    expect(libelles.some(l => l.startsWith("Épargne retraite : plafond des versements de 2026"))).toBe(true)
    expect(libelles.some(l => l.startsWith("Épargne retraite : plafond calculé sur 2026"))).toBe(true)
    expect(libelles.some(l => l.includes("versements PER"))).toBe(false)
    expect(informations.join("\n")).not.toContain("Tranche marginale")
  })
})
