// src/web/outils-ia-lecture.test.ts
// Outils de lecture pour les clients d'IA, sur la simulation d'exemple et un montage type : les chiffres rendus sont
// ceux du moteur, arrondis à l'euro ; la session n'est jamais modifiée ; les erreurs disent quoi corriger.

import { describe, expect, it } from "vitest"
import type { SessionState } from "@/types"
import { vueDeLAnnee } from "@/backend/logic/annees"
import { optionsDuComparateur } from "@/backend/logic/options-du-comparateur"
import { comparerStatutsDeLAnnee, optimiserRemunerationDeLAnnee, simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { MONTAGES_TYPES, sessionDUnMontage } from "@/lib/montages/montages"
import { appeler, erreurDe, geler } from "./outils-ia.testing"
import { sessionExemple } from "./session-exemple"

const exemple = () => geler(sessionExemple())
const rapport2026 = (session: SessionState) => simulerLesAnnees(session).annees.find(a => a.annee === 2026)!.report!
const montage = (id: string) => geler(sessionDUnMontage(MONTAGES_TYPES.find(m => m.id === id)!))

describe("decrire_simulation", () => {
  it("décrit acteurs, relations et années, avec les identifiants et sans l'apparence des acteurs", () => {
    const description = appeler<{ nom: string; empreinte: string; annees: number[]; acteurs: { id: string; genre: string; reglages: Record<string, unknown> }[]; relations: { phrase: string }[]; flux: { nombreDeFlux: number; nombreDeSeries: number }[] }>("decrire_simulation", exemple())
    expect(description.nom).toBe("Famille Martin, simulation 2026")
    expect(description.empreinte).toMatch(/^[0-9a-f]{16}$/)
    expect(description.annees).toEqual([2026])
    expect(description.acteurs.map(a => [a.id, a.genre])).toEqual([
      ["person-camille", "personne"],
      ["person-julien", "personne"],
      ["person-lea", "personne"],
      ["micro-atelier", "micro-entreprise"],
      ["company-conseil", "SASU"]
    ])
    expect(description.acteurs[3].reglages).toMatchObject({ opteVFL: true, rfrN2: 38000 })
    expect(description.relations.map(r => r.phrase)).toContain("Léa Martin est l'enfant à charge de Camille Martin")
    expect(description.flux).toEqual([{ annee: 2026, nombreDeFlux: 49, nombreDeSeries: 5 }])
    expect(JSON.stringify(description)).not.toContain("#3b82f6")
  })

  it("détaille les trajets d'une personne seulement sur demande", () => {
    const session = geler({ ...sessionExemple(), entities: sessionExemple().entities.map(e => (e.id === "person-julien" ? { ...e, fraisReels: { trajets: [{ libelle: "Client", kmParTrajet: 30, joursTravailles: 200, puissanceFiscale: "5" as const, electrique: false, distanceJustifiee: false }], autresFrais: 100 } } : e)) })
    const reglagesDeJulien = (detaille: boolean) => appeler<{ acteurs: { id: string; reglages: Record<string, unknown> }[] }>("decrire_simulation", session, { detaille }).acteurs.find(a => a.id === "person-julien")!.reglages
    expect(reglagesDeJulien(false)).toEqual({ partsFiscales: 1, fraisReels: "1 trajet(s), 100 € d'autres frais" })
    expect(reglagesDeJulien(true).trajets).toContain("Client")
  })
})

describe("lister_flux", () => {
  it("regroupe les flux en séries, avec les mois de 1 à 12 et les montants saisis", () => {
    const liste = appeler<{ nombreDeLignes: number; tronque: boolean; lignes: { typeFlux: string; mois: number[]; total: number }[] }>("lister_flux", exemple(), { acteurId: "company-conseil" })
    expect(liste.tronque).toBe(false)
    expect(liste.lignes.map(l => [l.typeFlux, l.mois.length, l.total])).toEqual([
      ["ca_services", 12, 78000],
      ["director_remuneration", 12, 30000],
      ["dividends_payment", 1, 12000]
    ])
  })

  it("liste aussi flux par flux, filtrés par mois et par type", () => {
    const liste = appeler<{ lignes: { mois: number; id: string; montant: number }[] }>("lister_flux", exemple(), { annee: 2026, mois: [12], typeFlux: "dividends_payment", regroupement: "mois" })
    expect(liste.lignes).toEqual([expect.objectContaining({ mois: 12, id: "company-conseil-dividends_payment-11", montant: 12000 })])
  })

  it("coupe une liste trop longue et le signale", () => {
    const session = sessionExemple()
    session.annees[0].monthlyData[0].flows.push(...Array.from({ length: 600 }, (_, i) => ({ id: `f${i}`, label: `Achat ${i}`, amount: 1, entityId: "company-conseil", type: "deductible_expense" as const })))
    const liste = appeler<{ nombreDeLignes: number; tronque: boolean; lignes: unknown[] }>("lister_flux", geler(session), { typeFlux: "deductible_expense" })
    expect([liste.nombreDeLignes, liste.tronque, liste.lignes.length]).toEqual([600, true, 500])
  })

  it("dit quels acteurs et quelles années existent quand le filtre n'en désigne aucun", () => {
    expect(erreurDe("lister_flux", exemple(), { acteurId: "inconnu" })).toContain("company-conseil (Conseil SASU)")
    expect(erreurDe("lister_flux", exemple(), { annee: 2025 })).toBe("L'année 2025 n'est pas dans la simulation. Années disponibles : 2026.")
  })
})

describe("simuler et synthese_des_annees", () => {
  it("rendent les chiffres du moteur, arrondis à l'euro", () => {
    const session = exemple()
    const rapport = rapport2026(session)
    const resultat = appeler<{ totalNetApresImpots: number; bilan: Record<string, number>; foyers: { netApresImpots: number; personnes: string[] }[]; activites: { id: string; cotisationsSociales: number }[] }>("simuler", session)
    expect(resultat.totalNetApresImpots).toBe(Math.round(rapport.totalNetApresImpots))
    expect(resultat.bilan.impotSurLeRevenu).toBe(Math.round(rapport.bilan.impotSurLeRevenu))
    expect(resultat.foyers).toEqual([expect.objectContaining({ personnes: ["Camille Martin", "Julien Martin", "Léa Martin"], netApresImpots: Math.round(rapport.foyers[0].netApresImpots) })])
    expect(resultat.activites.map(a => a.cotisationsSociales)).toEqual(rapport.activities.map(a => Math.round(a.cotisationsSociales)))

    const synthese = appeler<{ annees: { annee: number; totalNetApresImpots: number }[] }>("synthese_des_annees", session)
    expect(synthese.annees).toEqual([expect.objectContaining({ annee: 2026, erreur: null, totalNetApresImpots: resultat.totalNetApresImpots })])
  })

  it("rendent l'erreur d'une année que le simulateur ne sait pas calculer", () => {
    const session = geler({ ...sessionExemple(), annees: [{ ...sessionExemple().annees[0], annee: 2020 }] })
    expect(erreurDe("simuler", session)).toContain("L'année 2020 ne peut pas être simulée")
    expect(appeler<{ annees: { erreur: string | null; totalNetApresImpots: number | null }[] }>("synthese_des_annees", session).annees[0]).toMatchObject({ totalNetApresImpots: null, erreur: expect.stringContaining("2024") })
  })

  it("donnent le même résultat à chaque appel", () => {
    const session = exemple()
    expect(appeler("simuler", session)).toEqual(appeler("simuler", session))
  })
})

describe("expliquer_resultat", () => {
  it("détaille les cotisations du président, ligne à ligne, d'après le moteur", () => {
    const session = exemple()
    const activite = rapport2026(session).activities.find(a => a.entityId === "company-conseil")!
    const explication = appeler<{ lignes: { libelle: string; montant: number; composantes?: { montant: number }[] }[] }>("expliquer_resultat", session, { acteurId: "company-conseil" })
    const cotisations = explication.lignes.find(l => l.libelle.startsWith("Cotisations du président"))!
    expect(cotisations.montant).toBe(Math.round(activite.cotisationsSociales))
    expect(Math.abs(cotisations.composantes!.reduce((s, c) => s + c.montant, 0) - cotisations.montant)).toBeLessThanOrEqual(cotisations.composantes!.length)
    expect(explication.lignes.find(l => l.libelle === "Impôt sur les sociétés")!.montant).toBe(Math.round(activite.impotSocietes))
  })

  it("donne les réserves d'une société à l'IS, dans simuler comme dans expliquer_resultat", () => {
    const session = exemple()
    const activite = rapport2026(session).activities.find(a => a.entityId === "company-conseil")!
    const simulation = appeler<{ activites: { id: string; reservesALaFin?: number }[] }>("simuler", session)
    expect(simulation.activites.find(a => a.id === "company-conseil")!.reservesALaFin).toBe(Math.round(activite.reserves!.aLaFin.reserves))
    expect(simulation.activites.find(a => a.id === "micro-atelier")).not.toHaveProperty("reservesALaFin")

    const explication = appeler<{ informations: string[] }>("expliquer_resultat", session, { acteurId: "company-conseil" })
    expect(explication.informations).toContainEqual(expect.stringMatching(/^Réserves distribuables : 0 € au 1er janvier, .* € au 31 décembre ; bénéfice distribuable de l'année/))
  })

  it("explique le versement libératoire d'une micro-entreprise et l'impôt du foyer d'une personne", () => {
    const session = exemple()
    const micro = appeler<{ informations: string[] }>("expliquer_resultat", session, { acteurId: "micro-atelier" })
    expect(micro.informations[0]).toMatch(/^Versement libératoire appliqué : revenu fiscal de référence 2024 de 38 ?000 € \(saisi\)/)
    const camille = appeler<{ lignes: { libelle: string; montant: number }[] }>("expliquer_resultat", session, { acteurId: "person-camille" })
    expect(camille.lignes.find(l => l.libelle === "Foyer : net après impôts")!.montant).toBe(Math.round(rapport2026(session).totalNetApresImpots))
  })

  it("détaille les cotisations d'un gérant d'EURL et d'un salarié", () => {
    const eurl = appeler<{ lignes: { libelle: string; composantes?: unknown[] }[] }>("expliquer_resultat", montage("eurl-is-remuneration-gerant"), { acteurId: "e-nicolas" })
    expect(eurl.lignes.find(l => l.libelle.startsWith("Cotisations du travailleur non salarié"))!.composantes).toHaveLength(9)
    const gerant = appeler<{ lignes: { libelle: string }[] }>("expliquer_resultat", montage("eurl-is-remuneration-gerant"), { acteurId: "p-nicolas" })
    expect(gerant.lignes.map(l => l.libelle)).toContain("Foyer fiscal (Nicolas, 1 part) : revenu imposable")
    const conjoint = montage("conjoint-salarie-sasu")
    const societe = conjoint.entities.find(e => e.type === "company")!
    expect(appeler<{ lignes: { libelle: string }[] }>("expliquer_resultat", conjoint, { acteurId: societe.id }).lignes.some(l => l.libelle.startsWith("Salarié "))).toBe(true)
  })

  it("refuse un acteur inconnu", () => {
    expect(erreurDe("expliquer_resultat", exemple(), { acteurId: "x" })).toMatch(/^Aucun acteur « x »/)
  })
})

describe("comparer_statuts et optimiser_remuneration", () => {
  it("comparent avec les réglages que l'application affiche, et rendent les chiffres du comparateur", () => {
    const session = exemple()
    const options = optionsDuComparateur(vueDeLAnnee(session, 2026), "company-conseil", undefined)
    const attendu = comparerStatutsDeLAnnee(session, options, 2026)
    const comparaison = appeler<{ meilleur: string; reglages: { mode: string }; scenarios: { statut: string; netApresImpots: number; actuel: boolean }[] }>("comparer_statuts", session, { activiteId: "company-conseil" })
    expect(comparaison.meilleur).toBe(attendu.meilleur)
    expect(comparaison.reglages.mode).toBe("grille")
    expect(comparaison.scenarios.map(s => s.netApresImpots)).toEqual(attendu.scenarios.map(s => Math.round(s.netApresImpots)))
    expect(comparaison.scenarios.find(s => s.actuel)!.statut).toBe("SASU")
  })

  it("essaient une variante sans rien enregistrer", () => {
    const session = exemple()
    const variante = appeler<{ reglages: { mode: string; remunerationNette: number } }>("comparer_statuts", session, { activiteId: "company-conseil", mode: "dividendes", remunerationNette: 20000, partDistribuee: 1, avecRetraite: false, partBncPrestations: 0.5 })
    expect(variante.reglages).toMatchObject({ mode: "dividendes", remunerationNette: 20000 })
    expect(session.comparateur).toBeUndefined()
  })

  it("reprennent les réglages enregistrés d'un montage type", () => {
    const session = montage("sasu-salaire-4-trimestres")
    const comparaison = appeler<{ activiteId: string; reglages: { mode: string; avecRetraite: boolean }; scenarios: { remunerationRetenue: number | null }[] }>("comparer_statuts", session)
    expect(comparaison.activiteId).toBe("s-antoine")
    expect(comparaison.reglages).toMatchObject({ mode: "meilleurNet", avecRetraite: false })
    expect(comparaison.scenarios[0].remunerationRetenue).not.toBeNull()
  })

  it("trouvent la rémunération au meilleur net du moteur, avec une courbe courte", () => {
    const session = exemple()
    const options = optionsDuComparateur(vueDeLAnnee(session, 2026), "company-conseil", undefined)
    const attendu = optimiserRemunerationDeLAnnee(session, options, "SASU", 2026)
    const optimisation = appeler<{ meilleur: { remunerationNette: number; netApresImpots: number }; meilleurAvecRetraite: { trimestres: number }; courbe: { remunerationNette: number }[] }>("optimiser_remuneration", session, { activiteId: "company-conseil", statut: "SASU" })
    expect(optimisation.meilleur).toMatchObject({ remunerationNette: attendu.meilleur!.remunerationNette, netApresImpots: Math.round(attendu.meilleur!.netApresImpots) })
    expect(optimisation.meilleurAvecRetraite.trimestres).toBe(4)
    expect(optimisation.courbe).toHaveLength(11)
    expect(optimisation.courbe[10].remunerationNette).toBe(attendu.remunerationMaximale)
  })

  it("situent la grille actuelle sur la courbe : rémunération et dividendes saisis, net du foyer, écarts aux meilleurs points", () => {
    const session = exemple()
    const options = optionsDuComparateur(vueDeLAnnee(session, 2026), "company-conseil", undefined)
    // Les réglages de l'exemple partagent le bénéfice d'après la grille : la colonne actuelle du comparateur est la situation actuelle.
    expect(options.repartition.mode).toBe("grille")
    const colonne = comparerStatutsDeLAnnee(session, options, 2026).scenarios.find(s => s.actuel)!
    const flux = session.annees[0].monthlyData.flatMap(m => m.flows).filter(f => f.entityId === "company-conseil")
    const total = (type: string) => Math.round(flux.filter(f => f.type === type).reduce((somme, f) => somme + f.amount, 0))
    type Point = { netApresImpots: number; trimestres: number }
    const optimisation = appeler<{ fraisFonctionnement: number; noteCFE: string | null; situationActuelle: Point & { statut: string; remunerationNette: number; dividendes: number; fraisFonctionnement: number }; meilleur: Point; meilleurAvecRetraite: Point; ecartAuMeilleur: number; ecartAuMeilleurAvecRetraite: number }>("optimiser_remuneration", session, { activiteId: "company-conseil", statut: "SASU" })
    expect(optimisation.situationActuelle).toMatchObject({ statut: "SASU", remunerationNette: total("director_remuneration"), dividendes: total("dividends_payment"), netApresImpots: Math.round(colonne.netApresImpots), trimestres: colonne.protectionSociale.trimestres, fraisFonctionnement: colonne.fraisFonctionnement })
    expect(total("director_remuneration")).toBeGreaterThan(0)
    expect(optimisation.ecartAuMeilleur).toBe(optimisation.meilleur.netApresImpots - optimisation.situationActuelle.netApresImpots)
    expect(optimisation.ecartAuMeilleurAvecRetraite).toBe(optimisation.meilleurAvecRetraite.netApresImpots - optimisation.situationActuelle.netApresImpots)
    // Les frais de fonctionnement retenus, ceux de l'application par défaut : de quoi rapprocher ces nets de ceux de simuler.
    expect(optimisation).toMatchObject({ fraisFonctionnement: 2900, noteCFE: null })
  })

  it("comptent la CFE de l'année de création comme le comparateur, et situent une activité d'un autre statut", () => {
    const base = sessionExemple()
    const creeeCetteAnnee = geler({ ...base, entities: base.entities.map(e => (e.id === "company-conseil" ? { ...e, dateDeCreation: "2026-03" } : e)) })
    const options = optionsDuComparateur(vueDeLAnnee(creeeCetteAnnee, 2026), "company-conseil", undefined)
    const comparaison = comparerStatutsDeLAnnee(creeeCetteAnnee, options, 2026)
    const eurl = appeler<{ fraisFonctionnement: number; noteCFE: string; situationActuelle: { statut: string; netApresImpots: number; fraisFonctionnement: number } }>("optimiser_remuneration", creeeCetteAnnee, { activiteId: "company-conseil", statut: "EURL" })
    expect(eurl.noteCFE).toBe(comparaison.noteCFE)
    expect(eurl.fraisFonctionnement).toBe(comparaison.scenarios.find(s => s.statut === "EURL")!.fraisFonctionnement)
    expect(eurl.fraisFonctionnement).toBe(2600)
    // La situation actuelle reste celle de la SASU saisie, avec ses propres frais.
    expect(eurl.situationActuelle).toMatchObject({ statut: "SASU", netApresImpots: Math.round(comparaison.scenarios.find(s => s.actuel)!.netApresImpots), fraisFonctionnement: 2600 })

    const micro = appeler<{ situationActuelle: { statut: string; remunerationNette: null; dividendes: null } }>("optimiser_remuneration", exemple(), { activiteId: "micro-atelier", statut: "SASU" })
    expect(micro.situationActuelle).toMatchObject({ statut: expect.stringMatching(/^micro/), remunerationNette: null, dividendes: null })
  })

  it("refusent une personne, ou une simulation sans activité", () => {
    expect(erreurDe("comparer_statuts", exemple(), { activiteId: "person-lea" })).toContain("est une personne")
    const sansActivite = geler({ ...sessionExemple(), entities: sessionExemple().entities.filter(e => e.type === "person"), relationships: [], annees: [{ annee: 2026, monthlyData: Array.from({ length: 12 }, (_, month) => ({ month, flows: [] })) }] })
    expect(erreurDe("optimiser_remuneration", sansActivite, { statut: "EURL" })).toContain("aucune activité")
  })
})

describe("regles_de_l_annee", () => {
  it("donne les seuils de l'année avec leurs sources, sans les textes d'explication", () => {
    const regles = appeler<{ anneeDesRegles: number; avertissement: string | null; regles: { sujet: string; valeurs: Record<string, unknown>; source: string | null }[] }>("regles_de_l_annee", exemple())
    expect(regles.anneeDesRegles).toBe(2026)
    expect(regles.avertissement).toBeNull()
    expect(regles.regles.find(r => r.sujet === "Impôt sur les sociétés")).toEqual({ sujet: "Impôt sur les sociétés", valeurs: { tauxReduit: 0.15, plafondTauxReduit: 42500, tauxNormal: 0.25 }, source: expect.stringMatching(/^https:\/\//) })
    expect(JSON.stringify(regles)).not.toContain("description")
  })

  it("reprend les dernières règles connues pour une année future, et refuse une année trop ancienne", () => {
    expect(appeler<{ anneeDesRegles: number; avertissement: string }>("regles_de_l_annee", exemple(), { annee: 2030 })).toMatchObject({ anneeDesRegles: 2026, avertissement: expect.stringContaining("2030") })
    expect(erreurDe("regles_de_l_annee", exemple(), { annee: 2020 })).toContain("d'avant 2024")
  })
})
