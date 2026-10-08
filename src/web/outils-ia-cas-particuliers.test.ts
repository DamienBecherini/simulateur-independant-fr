// src/web/outils-ia-cas-particuliers.test.ts
// Outils pour les clients d'IA sur des cas moins courants : ACRE, versement libératoire sans revenu fiscal connu,
// déplacements, frais réels, salariés, année sans règles, filtres et regroupements de lister_flux, montages types.
// Chaque résultat est vérifié par le schéma de son outil (voir outils-ia.testing.ts).

import { describe, expect, it } from "vitest"
import type { Company, MicroEntreprise, Person, SessionState } from "@/types"
import { executerOutil } from "@/backend/logic/outils/catalogue"
import { texteSansControle } from "@/backend/logic/outils/limites"
import { PREMIERE_ANNEE_DES_REGLES } from "@/backend/logic/regles"
import { MONTAGES_TYPES, sessionDUnMontage } from "@/lib/montages/montages"
import { appeler, erreurDe, geler, TOUTE_L_ANNEE, type ResultatProposition } from "./outils-ia.testing"
import { sessionExemple } from "./session-exemple"

interface Explication {
  lignes: { libelle: string; montant: number }[]
  informations: string[]
  avertissements: string[]
}

/** L'exemple, l'atelier en ACRE depuis mars, sans revenu fiscal connu, avec des déplacements ; Julien aux frais réels. */
function exempleParticulier(): SessionState {
  const session = sessionExemple()
  session.entities = session.entities.map(e => {
    if (e.id === "micro-atelier") return { ...(e as MicroEntreprise), beneficieACRE: true, dateDeCreation: "2026-03", rfrN2: undefined, deplacementsProfessionnels: { kmParAn: 4000, puissanceFiscale: "5", electrique: false } }
    if (e.id === "person-julien") return { ...(e as Person), fraisReels: { trajets: [{ libelle: "Domicile - bureau", kmParTrajet: 30, joursTravailles: 200, distanceJustifiee: false, puissanceFiscale: "5", electrique: false }], autresFrais: 1500 } }
    if (e.id === "company-conseil") return { ...(e as Company), deplacementsProfessionnels: { kmParAn: 8000, puissanceFiscale: "5", electrique: false } }
    return e
  })
  return geler(session)
}

describe("expliquer_resultat, cas particuliers", () => {
  it("détaille l'ACRE, le versement libératoire sans revenu fiscal connu et les déplacements d'une micro-entreprise", () => {
    const { informations } = appeler<Explication>("expliquer_resultat", exempleParticulier(), { acteurId: "micro-atelier" })
    expect(informations.join("\n")).toMatch(/ACRE : réduction de/)
    expect(informations.join("\n")).toMatch(/revenu fiscal de référence \d{4} inconnu/)
    expect(informations.join("\n")).toMatch(/Déplacements professionnels : 4000 km, .* non déductibles en micro-entreprise/)
  })

  it("détaille la formation professionnelle d'une micro-entreprise, que l'ACRE ne réduit pas", () => {
    // Atelier : 34 800 € de prestations BNC (0,2 %) et 5 400 € de ventes (0,1 %) : 69,60 + 5,40 = 75 €.
    const { lignes } = appeler<Explication>("expliquer_resultat", exempleParticulier(), { acteurId: "micro-atelier" })
    expect(lignes).toContainEqual({ libelle: "dont contribution à la formation professionnelle (micro-entreprise, non réduite par l'ACRE)", montant: 75 })
  })

  it("détaille les déplacements déductibles d'une société et les frais réels d'une personne", () => {
    const session = exempleParticulier()
    expect(appeler<Explication>("expliquer_resultat", session, { acteurId: "company-conseil" }).informations.join("\n")).toMatch(/8000 km, .* déductibles\./)
    const julien = appeler<Explication>("expliquer_resultat", session, { acteurId: "person-julien" })
    expect(julien.lignes.map(l => l.libelle).join("\n")).toMatch(/Frais professionnels retenus \((frais réels|déduction forfaitaire de 10 %)\)/)
    expect(julien.lignes.some(l => l.libelle.startsWith("Foyer fiscal"))).toBe(true)
  })

  it("signale la sortie du régime micro après deux années au-delà des plafonds", () => {
    const session = sessionExemple()
    session.entities = session.entities.map(e => (e.id === "micro-atelier" ? { ...(e as MicroEntreprise), horsPlafondAnneePrecedente: true } : e))
    const grille = session.annees[0].monthlyData.map(m => ({ ...m, flows: [...m.flows, { id: `gros-${m.month}`, label: "Gros contrat", amount: 10000, entityId: "micro-atelier", type: "ca_micro_services_bnc" as const }] }))
    session.annees = [{ annee: 2026, monthlyData: grille }, { annee: 2027, monthlyData: grille }]
    const { informations } = appeler<Explication>("expliquer_resultat", geler(session), { acteurId: "micro-atelier", annee: 2027 })
    expect(informations.join("\n")).toMatch(/Sortie du régime micro depuis le 1er janvier 2027/)
  })

  it("dit comment les dividendes du foyer sont imposés", () => {
    const foyers = ["person-camille", "person-julien"].map(id => appeler<Explication>("expliquer_resultat", geler(sessionExemple()), { acteurId: id }).informations.join("\n"))
    expect(foyers.join("\n")).toMatch(/Dividendes imposés (au prélèvement forfaitaire unique|au barème)/)
  })

  it("décrit les réglages détaillés, trajets compris", () => {
    const description = appeler<{ acteurs: { id: string; reglages: Record<string, unknown> }[] }>("decrire_simulation", exempleParticulier(), { detaille: true })
    const julien = description.acteurs.find(a => a.id === "person-julien")!
    expect(JSON.parse(julien.reglages.trajets as string)).toHaveLength(1)
    expect(description.acteurs.find(a => a.id === "micro-atelier")!.reglages).toMatchObject({ beneficieACRE: true, rfrN2: null, dateDeCreation: "2026-03", deplacementsKmParAn: 4000 })
  })

  it("explique chaque acteur de chaque montage type, et compare chacune de leurs activités", () => {
    for (const montage of MONTAGES_TYPES) {
      const session = geler(sessionDUnMontage(montage))
      for (const acteur of session.entities) {
        const explication = appeler<Explication>("expliquer_resultat", session, { acteurId: acteur.id })
        expect(explication.lignes.length).toBeGreaterThan(0)
        if (acteur.type !== "person") expect(appeler<{ scenarios: unknown[] }>("comparer_statuts", session, { activiteId: acteur.id }).scenarios.length).toBeGreaterThan(0)
      }
    }
  })
})

describe("année sans règles fiscales", () => {
  /** Une session dont la seule année n'a pas de règles connues : le moteur ne sait pas la calculer. */
  const AVANT = PREMIERE_ANNEE_DES_REGLES - 1
  const sansRegles = () => geler({ ...sessionExemple(), annees: sessionExemple().annees.map(a => ({ ...a, annee: AVANT })) })

  it("le dit, au lieu d'inventer un résultat", () => {
    expect(erreurDe("simuler", sansRegles())).toContain(`L'année ${AVANT} ne peut pas être simulée`)
    expect(erreurDe("expliquer_resultat", sansRegles(), { acteurId: "micro-atelier" })).toContain(String(AVANT))
    const synthese = appeler<{ annees: { annee: number; erreur: string | null; totalNetApresImpots: number | null }[] }>("synthese_des_annees", sansRegles())
    expect(synthese.annees[0]).toMatchObject({ annee: AVANT, totalNetApresImpots: null, erreur: expect.any(String) })
  })

  it("montre l'année impossible à calculer dans l'aperçu d'une proposition", () => {
    const resultat = appeler<ResultatProposition>("proposer_acteur", sansRegles(), { genre: "personne", nom: "Bruno Durand" })
    expect(resultat.apercu[0]).toMatchObject({ annee: AVANT, netAvant: null, netApres: null, ecart: null, erreur: expect.any(String) })
  })
})

describe("lister_flux, filtres et regroupements", () => {
  const session = geler(sessionExemple())

  it("liste les flux un par un, avec leur montant brut s'il est saisi", () => {
    const avecBrut = geler({
      ...sessionExemple(),
      annees: sessionExemple().annees.map(a => ({ ...a, monthlyData: a.monthlyData.map(m => ({ ...m, flows: m.flows.map(f => (f.type === "salary" ? { ...f, grossAmount: f.amount * 1.3 } : f)) })) }))
    })
    const { lignes } = appeler<{ lignes: { montantBrut?: number; typeFlux: string }[] }>("lister_flux", avecBrut, { regroupement: "mois" })
    expect(lignes.length).toBeGreaterThan(12)
    expect(lignes.filter(l => l.montantBrut !== undefined).every(l => l.typeFlux === "salary")).toBe(true)
  })

  it("filtre par acteur, type et mois", () => {
    const { lignes } = appeler<{ lignes: { acteurId: string; mois: number[] }[] }>("lister_flux", session, { acteurId: "micro-atelier", mois: [1, 2] })
    expect(lignes.length).toBeGreaterThan(0)
    expect(lignes.every(l => l.acteurId === "micro-atelier" && l.mois.every(m => m <= 2))).toBe(true)
    expect(appeler<{ nombreDeLignes: number }>("lister_flux", session, { typeFlux: "are" }).nombreDeLignes).toBe(0)
  })
})

describe("propositions, cas particuliers", () => {
  it("résume chaque genre d'opération : relation, modification, suppression, réglages du comparateur", () => {
    const session = geler(sessionExemple())
    const relation = appeler<ResultatProposition>("proposer_relation", session, { deId: "person-camille", versId: "company-conseil", typeRelation: "Associé" })
    const serie = { acteurId: "micro-atelier", typeFlux: "ca_micro_services_bnc", libelle: appeler<{ lignes: { libelle: string; typeFlux: string }[] }>("lister_flux", session, { acteurId: "micro-atelier" }).lignes[0].libelle }
    const modification = executerOutil("proposer_modification", session, { modifications: [{ cible: "serie", annee: 2026, serie, mois: [1], montant: 1 }], suiteDe: relation.proposition })
    const suppression = executerOutil("proposer_suppression", session, { suppression: { cible: "relation", relationId: "rel-enfant" } })
    const reglages = executerOutil("proposer_reglages_comparateur", session, { activiteId: "company-conseil", reglages: { mode: "meilleurNet" } })
    for (const reponse of [modification, suppression, reglages]) {
      // Chaque outil répond : une proposition, ou un refus expliqué en français.
      expect(reponse.ok ? (reponse.resultat as ResultatProposition).resume.length : (reponse as { erreur: string }).erreur.length).toBeGreaterThan(0)
    }
  })

  it("propose des flux sur une année voisine absente, en l'ajoutant", () => {
    const resultat = appeler<ResultatProposition>("proposer_flux", geler(sessionExemple()), { flux: [{ annee: 2025, acteurId: "micro-atelier", typeFlux: "ca_micro_services_bnc", libelle: "Prestations 2025", montant: 1000, mois: TOUTE_L_ANNEE }] })
    expect(resultat.resume[0]).toBe("Ajouter l'année 2025, avec une grille vide.")
    expect(resultat.apercu.map(a => a.annee).sort()).toEqual([2025, 2026])
  })

  it("refuse les caractères de contrôle et de mise en forme bidirectionnelle", () => {
    expect(texteSansControle("Loyer du bureau")).toBe(true)
    expect(texteSansControle("Loyer\u202Eurenob")).toBe(false)
    expect(erreurDe("proposer_acteur", geler(sessionExemple()), { genre: "personne", nom: "Bruno\u0007" })).toMatch(/invalides/)
  })
})
