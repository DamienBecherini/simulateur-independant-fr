// src/web/outils-ia-liberaux.test.ts
// Outils pour les IA et professions libérales réglementées (ADR 015) : lecture des règles et des résultats,
// proposition d'une profession sur une activité.

import { describe, expect, it } from "vitest"
import type { Company, SessionState } from "@/types"
import { appeler, appliquer, erreurDe, geler, type ResultatProposition } from "./outils-ia.testing"
import { sessionExemple } from "./session-exemple"

/** L'exemple, avec un cabinet de kinésithérapie en EI au réel tenu par Camille, sur 2026. */
function avecUnCabinet(): SessionState {
  const session = sessionExemple()
  const cabinet: Company = { id: "e-cabinet", type: "company", name: "Cabinet", legalStatus: "EI", capitalSocial: 0, profession: "masseur-kinesitherapeute", partConventionnee: 0.9, avatar: { type: "icon", value: "User", color: "#7e22ce" }, locked: false }
  const camille = session.entities.find(e => e.type === "person")!
  const annees = session.annees.map(a => ({ ...a, monthlyData: a.monthlyData.map(m => (m.month === 0 ? { ...m, flows: [...m.flows, { id: "f-cabinet", label: "Honoraires", amount: 60000, entityId: "e-cabinet", type: "ca_services" as const }] } : m)) }))
  return geler({ ...session, entities: [...session.entities, cabinet], relationships: [...session.relationships, { id: "r-cabinet", fromId: camille.id, toId: "e-cabinet", type: "Titulaire" }], annees })
}

describe("outils pour les IA et professions libérales réglementées", () => {
  it("decrire_simulation donne la profession et la part conventionnée saisies", () => {
    const description = appeler<{ acteurs: { id: string; reglages: Record<string, unknown> }[] }>("decrire_simulation", avecUnCabinet())
    expect(description.acteurs.find(a => a.id === "e-cabinet")?.reglages).toMatchObject({ profession: "masseur-kinesitherapeute", partConventionnee: 0.9 })
  })

  it("regles_de_l_annee liste les professions, leur caisse, et les barèmes de la CIPAV et de la CARPIMKO", () => {
    const { regles } = appeler<{ regles: { sujet: string; valeurs: Record<string, unknown> }[] }>("regles_de_l_annee", avecUnCabinet(), { annee: 2026 })
    const professions = regles.find(r => r.sujet.startsWith("Professions libérales réglementées"))!.valeurs.professions as { id: string; caisse: string | null }[]
    expect(professions).toContainEqual(expect.objectContaining({ id: "osteopathe", caisse: "CIPAV" }))
    expect(regles.find(r => r.sujet.startsWith("CIPAV"))?.valeurs).toMatchObject({ retraiteComplementaire: [{ jusquA: 1, taux: 0.11 }, { jusquA: 4, taux: 0.21 }] })
    expect(regles.find(r => r.sujet.startsWith("CARPIMKO"))?.valeurs).toMatchObject({ invaliditeDeces: { forfait: 1022 } })
  })

  it("expliquer_resultat détaille l'ASV, la CURPS, la prise en charge et la base de la complémentaire", () => {
    const { lignes, informations } = appeler<{ lignes: { libelle: string; composantes?: { libelle: string; montant: number }[] }[]; informations: string[] }>("expliquer_resultat", avecUnCabinet(), { acteurId: "e-cabinet" })
    const tns = lignes.find(l => l.libelle.startsWith("Cotisations du travailleur non salarié, Masseur-kinésithérapeute (CARPIMKO)"))!
    expect(tns.composantes).toContainEqual({ libelle: "CURPS", montant: 44 })
    expect(informations[0]).toBe("Profession : Masseur-kinésithérapeute, caisse CARPIMKO.")
    expect(informations).toContainEqual(expect.stringMatching(/^Pris en charge par l'Assurance maladie \(part conventionnée 90 %\)/))
    expect(informations).toContainEqual(expect.stringContaining("faute de l'année 2025 dans la simulation"))
  })

  it("comparer_statuts retire les colonnes micro d'un kinésithérapeute, avec la raison", () => {
    const resultat = appeler<{ scenarios: { statut: string }[]; notes: string[] }>("comparer_statuts", avecUnCabinet(), { activiteId: "e-cabinet" })
    expect(resultat.scenarios.map(s => s.statut)).toEqual(["SASU", "EURL", "EI"])
    expect(resultat.notes).toContainEqual(expect.stringContaining("Micro-entreprise non proposée"))
  })

  it("propose une profession sur une activité, et refuse une profession inconnue ou une part conventionnée sans objet", () => {
    const session = avecUnCabinet()
    const { proposition } = appeler<ResultatProposition>("proposer_modification", session, { modifications: [{ cible: "acteur", acteurId: "e-cabinet", reglages: { profession: "infirmier", partConventionnee: 0.5 } }] })
    expect(appliquer(session, proposition).entities.find(e => e.id === "e-cabinet")).toMatchObject({ profession: "infirmier", partConventionnee: 0.5 })

    expect(erreurDe("proposer_modification", session, { modifications: [{ cible: "acteur", acteurId: "e-cabinet", reglages: { profession: "druide" } }] })).toContain("Profession inconnue")
    expect(erreurDe("proposer_acteur", session, { genre: "micro-entreprise", nom: "Ostéo", reglages: { profession: "osteopathe", partConventionnee: 1 } })).toContain("La part conventionnée ne vaut que pour une profession conventionnable")
    expect(erreurDe("proposer_modification", session, { modifications: [{ cible: "acteur", acteurId: "company-conseil", reglages: { profession: "osteopathe" } }] })).toContain("ne s'applique pas à un acteur « SASU »")
  })
})
