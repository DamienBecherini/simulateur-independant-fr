// src/web/outils-ia-zone.test.ts
// Outils pour les IA et exonération d'impôt sur les bénéfices en zone (ADR 017) : le réglage « partEnZone » se lit et
// se propose ; les règles de l'année donnent les régimes et leurs hypothèses ; les résultats donnent le bénéfice exonéré
// et ce que le calcul suppose, pour que l'IA le dise à l'utilisateur.

import { describe, expect, it } from "vitest"
import type { Company, SessionState } from "@/types"
import { appeler, appliquer, erreurDe, geler, type ResultatProposition } from "./outils-ia.testing"
import { sessionExemple } from "./session-exemple"

const ATELIER = "e-atelier"

/** L'exemple, avec une SASU créée en janvier 2024, implantée en zone, qui facture 80 000 € en 2026 sans rien verser. */
function avecUnAtelierEnZone(zone: Company["implantationEnZone"] | "hors zone" = {}): SessionState {
  const implantationEnZone = zone === "hors zone" ? undefined : zone
  const session = sessionExemple()
  const atelier: Company = { id: ATELIER, type: "company", name: "Atelier", legalStatus: "SASU", capitalSocial: 1000, dateDeCreation: "2024-01", implantationEnZone, avatar: { type: "icon", value: "Store", color: "#d97706" }, locked: false }
  const personne = session.entities.find(e => e.type === "person")!
  const annees = session.annees.map(a => ({ ...a, monthlyData: a.monthlyData.map(m => (m.month === 0 ? { ...m, flows: [...m.flows, { id: "f-atelier", label: "Prestations", amount: 80000, entityId: ATELIER, type: "ca_services" as const }] } : m)) }))
  return geler({ ...session, entities: [...session.entities, atelier], relationships: [...session.relationships, { id: "r-atelier", fromId: personne.id, toId: ATELIER, type: "Président" }], annees })
}

const atelierDe = (session: SessionState) => session.entities.find(e => e.id === ATELIER)

describe("outils pour les IA et exonération d'impôt en zone", () => {
  it("decrire_simulation donne la part du chiffre d'affaires en zone, et rien pour une activité hors zone", () => {
    const reglages = (session: SessionState) => appeler<{ acteurs: { id: string; reglages: Record<string, unknown> }[] }>("decrire_simulation", session).acteurs.find(a => a.id === ATELIER)!.reglages
    expect(reglages(avecUnAtelierEnZone())).toMatchObject({ dateDeCreation: "2024-01", partEnZone: 1 })
    expect(reglages(avecUnAtelierEnZone({ partDuChiffreDAffaires: 0.6 }))).toMatchObject({ partEnZone: 0.6 })
    expect(reglages(avecUnAtelierEnZone("hors zone"))).not.toHaveProperty("partEnZone")
  })

  it("regles_de_l_annee donne les deux régimes, leur calendrier, leur plafond et leurs hypothèses", () => {
    const { regles } = appeler<{ regles: { sujet: string; valeurs: Record<string, unknown>; source: string | null }[] }>("regles_de_l_annee", avecUnAtelierEnZone(), { annee: 2026 })
    const zone = regles.find(r => r.sujet.startsWith("Exonération d'impôt sur les bénéfices en zone"))!
    expect(zone.source).toEqual(expect.any(String))
    const regimes = zone.valeurs.regimes as { id: string; plafondAnnuel: number | null; hypotheses: string[] }[]
    expect(regimes).toEqual([
      expect.objectContaining({ id: "zfuTe", nom: "ZFU-TE", creationDepuis: "2015-01", creationJusquA: "2025-12", moisExonerationTotale: 60, partsExonereesEnsuite: [0.6, 0.4, 0.2], plafondAnnuel: 50000 }),
      expect.objectContaining({ id: "qpv", nom: "QPV", creationDepuis: "2026-01", creationJusquA: "2030-12", plafondAnnuel: null, liberauxHorsSanteExclus: true })
    ])
    expect(regimes[0].hypotheses.length).toBeGreaterThan(0)
  })

  it("simuler et expliquer_resultat donnent le bénéfice exonéré, sa note, l'avertissement et les hypothèses du calcul", () => {
    const session = avecUnAtelierEnZone()
    const { activites } = appeler<{ activites: { id: string; impotSocietes: number; beneficeExonereEnZone?: number; dispositifs: string[]; avertissements: string[] }[] }>("simuler", session, { annee: 2026 })
    const atelier = activites.find(a => a.id === ATELIER)!
    // 80 000 € de bénéfice : 50 000 € exonérés (plafond), 30 000 € imposés à 15 %.
    expect(atelier).toMatchObject({ beneficeExonereEnZone: 50000, impotSocietes: 4500 })
    expect(atelier.dispositifs).toContainEqual(expect.stringMatching(/^ZFU-TE : bénéfice exonéré d'impôt à 100\s% en 2026, soit 50\s000\s€/))
    expect(atelier.avertissements).toContainEqual(expect.stringContaining("Exonération ZFU-TE appliquée sans vérifier ses conditions"))
    // Les autres activités n'ont pas ce champ.
    expect(activites.filter(a => a.id !== ATELIER).every(a => a.beneficeExonereEnZone === undefined)).toBe(true)

    const { lignes, informations } = appeler<{ lignes: { libelle: string; montant: number }[]; informations: string[] }>("expliquer_resultat", session, { acteurId: ATELIER })
    const rangs = lignes.map(l => l.libelle)
    const exonere = lignes.find(l => l.libelle.startsWith("Bénéfice exonéré d'impôt en zone"))!
    expect(exonere.libelle).toMatch(/^Bénéfice exonéré d'impôt en zone \(ZFU-TE, exonéré à 100\s%, plafond atteint\)$/)
    expect(exonere.montant).toBe(50000)
    expect(rangs.indexOf(exonere.libelle)).toBe(rangs.indexOf("Impôt sur les sociétés") - 1)
    expect(informations[informations.length - 1]).toMatch(/^Exonération en zone, ce que le calcul suppose : Une année à cheval sur deux taux d'exonération/)

    // Hors zone : ni ligne, ni hypothèses.
    const sans = appeler<{ lignes: { libelle: string }[]; informations: string[] }>("expliquer_resultat", avecUnAtelierEnZone("hors zone"), { acteurId: ATELIER })
    expect(sans.lignes.map(l => l.libelle).join("\n")).not.toContain("Bénéfice exonéré")
    expect(sans.informations.join("\n")).not.toContain("Exonération en zone")
  })

  it("propose de déclarer une activité en zone, d'en changer la part, puis de l'en retirer ; refuse le réglage sur une personne", () => {
    const horsZone = avecUnAtelierEnZone("hors zone")
    const proposer = (session: SessionState, partEnZone: number) => appeler<ResultatProposition>("proposer_modification", session, { modifications: [{ cible: "acteur", acteurId: ATELIER, reglages: { partEnZone } }] })

    // Tout le chiffre d'affaires dans la zone : seule la case est enregistrée, comme dans la fiche de l'activité.
    const enZone = appliquer(horsZone, proposer(horsZone, 1).proposition)
    expect(atelierDe(enZone)).toMatchObject({ implantationEnZone: {} })
    expect(atelierDe(enZone)).not.toHaveProperty("implantationEnZone.partDuChiffreDAffaires")
    expect(proposer(horsZone, 1).resume.join("\n")).toContain("partEnZone")

    const enPartie = appliquer(enZone, proposer(enZone, 0.6).proposition)
    expect(atelierDe(enPartie)).toMatchObject({ implantationEnZone: { partDuChiffreDAffaires: 0.6 } })

    // À 0, l'activité n'est plus en zone, et le reste de sa fiche ne bouge pas.
    const retiree = appliquer(enPartie, proposer(enPartie, 0).proposition)
    expect(atelierDe(retiree)?.type === "company" && atelierDe(retiree)).toMatchObject({ dateDeCreation: "2024-01", capitalSocial: 1000 })
    expect((atelierDe(retiree) as Company).implantationEnZone).toBeUndefined()

    const personne = horsZone.entities.find(e => e.type === "person")!
    expect(erreurDe("proposer_modification", horsZone, { modifications: [{ cible: "acteur", acteurId: personne.id, reglages: { partEnZone: 1 } }] })).toContain("Le réglage « partEnZone » ne s'applique pas à un acteur « personne »")
    expect(erreurDe("proposer_modification", horsZone, { modifications: [{ cible: "acteur", acteurId: ATELIER, reglages: { partEnZone: 1.5 } }] })).not.toBe("")
  })

  it("comparer_statuts garde l'exonération d'un statut à l'autre, et le dit dans les avertissements de chaque colonne", () => {
    type Colonne = { statut: string; impotSocietes: number; avertissements: string[] }
    const comparer = (session: SessionState) => appeler<{ scenarios: Colonne[] }>("comparer_statuts", session, { activiteId: ATELIER }).scenarios
    const sasu = (colonnes: Colonne[]) => colonnes.find(c => c.statut === "SASU")!
    const enZone = comparer(avecUnAtelierEnZone())
    expect(sasu(enZone).impotSocietes).toBeLessThan(sasu(comparer(avecUnAtelierEnZone("hors zone"))).impotSocietes)
    expect(sasu(enZone).avertissements.join("\n")).toContain("Exonération ZFU-TE appliquée sans vérifier ses conditions")
  })

  it("crée une micro-entreprise déjà déclarée en zone", () => {
    const session = avecUnAtelierEnZone("hors zone")
    const { proposition } = appeler<ResultatProposition>("proposer_acteur", session, { genre: "micro-entreprise", nom: "Boutique", reglages: { dateDeCreation: "2026-03", partEnZone: 0.8 } })
    expect(appliquer(session, proposition).entities.find(e => e.name === "Boutique")).toMatchObject({ type: "micro-entreprise", dateDeCreation: "2026-03", implantationEnZone: { partDuChiffreDAffaires: 0.8 } })
  })
})
