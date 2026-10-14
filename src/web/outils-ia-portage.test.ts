// src/web/outils-ia-portage.test.ts
// Outils pour les IA et portage salarial (ADR 016) : une activité en portage se lit (decrire_simulation, simuler,
// expliquer_resultat) ; elle ne se crée pas encore par une proposition. Le comparateur a sa colonne « Portage salarial »
// (comparer_statuts, chiffre_affaires_pour_net_vise), mais ne compare pas encore une activité déjà en portage.

import { describe, expect, it } from "vitest"
import { grilleVide, type SessionState } from "@/types"
import { appeler, erreurDe, geler, TOUTE_L_ANNEE, type ResultatProposition } from "./outils-ia.testing"

/** Lucie, seule, facture 5 000 € HT par mois en portage salarial (CDI saisi, les autres conditions typiques), en 2026. */
function lucieEnPortage(): SessionState {
  const monthlyData = grilleVide().map(mois => ({ ...mois, flows: [{ id: `f-${mois.month}`, label: "Mission", amount: 5000, entityId: "portage-lucie", type: "ca_services" as const }] }))
  return geler({
    name: "Lucie en portage",
    entities: [
      { id: "person-lucie", type: "person", name: "Lucie", fiscalParts: 1, avatar: { type: "initials", value: "L", color: "#3b82f6" }, locked: false },
      { id: "portage-lucie", type: "portage", name: "Missions de Lucie", conditions: { contrat: "CDI" }, avatar: { type: "icon", value: "Briefcase", color: "#0891b2" }, locked: false }
    ],
    relationships: [{ id: "rel-porte", fromId: "person-lucie", toId: "portage-lucie", type: "Titulaire" }],
    annees: [{ annee: 2026, monthlyData }]
  })
}

/** Lucie, seule, micro-entrepreneuse en prestations BNC à 5 000 € par mois, en 2026. */
function sessionDeMicro(): SessionState {
  const monthlyData = grilleVide().map(mois => ({ ...mois, flows: [{ id: `f-${mois.month}`, label: "Mission", amount: 5000, entityId: "micro-lucie", type: "ca_micro_services_bnc" as const }] }))
  return geler({
    name: "Lucie en micro",
    entities: [
      { id: "person-lucie", type: "person", name: "Lucie", fiscalParts: 1, avatar: { type: "initials", value: "L", color: "#3b82f6" }, locked: false },
      { id: "micro-lucie", type: "micro-entreprise", name: "Conseil de Lucie", beneficieACRE: false, opteVFL: false, avatar: { type: "icon", value: "Store", color: "#f97316" }, locked: false }
    ],
    relationships: [{ id: "rel-titulaire", fromId: "person-lucie", toId: "micro-lucie", type: "Titulaire" }],
    annees: [{ annee: 2026, monthlyData }]
  })
}

describe("outils pour les IA et portage salarial", () => {
  it("decrire_simulation donne le genre, les conditions retenues, les valeurs typiques et le salarié porté", () => {
    const description = appeler<{ acteurs: { id: string; genre: string; reglages: Record<string, unknown> }[]; relations: { phrase: string }[] }>("decrire_simulation", lucieEnPortage())
    const acteur = description.acteurs.find(a => a.id === "portage-lucie")
    expect(acteur?.genre).toBe("portage")
    expect(acteur?.reglages).toMatchObject({ tauxFraisDeGestion: 0.07, contrat: "CDI", effectif: "50EtPlus", reductionGeneraleReversee: false, plancherMensuel: null })
    expect(acteur?.reglages.valeursTypiques).not.toContain("contrat")
    expect(acteur?.reglages.valeursTypiques).toContain("tauxFraisDeGestion")
    expect(description.relations[0].phrase).toBe("Lucie — Titulaire (salarié porté) — Missions de Lucie")
  })

  it("simuler rend l'activité, son salaire et la réserve conservée (cas de référence en CDI)", () => {
    const resultat = appeler<{ activites: Record<string, unknown>[]; foyers: { netApresImpots: number; resultatConserve: number }[] }>("simuler", lucieEnPortage())
    expect(resultat.activites[0]).toMatchObject({ statut: "Portage salarial", chiffreAffaires: 60000, charges: 4200, revenuVerse: 27752, resultatConserve: 2643 })
    expect(resultat.foyers[0]).toMatchObject({ netApresImpots: 26366, resultatConserve: 2643 })
  })

  it("expliquer_resultat détaille le portage pas à pas, le bulletin du cadre et les conditions", () => {
    const { genre, lignes, informations } = appeler<{ genre: string; lignes: { libelle: string; montant: number; composantes?: { libelle: string; montant: number }[] }[]; informations: string[] }>("expliquer_resultat", lucieEnPortage(), { acteurId: "portage-lucie" })
    expect(genre).toBe("portage")
    expect(lignes.find(l => l.libelle === "Portage salarial : enveloppe disponible")).toMatchObject({ montant: 55800, composantes: [{ libelle: "Chiffre d'affaires", montant: 60000 }, { libelle: "Frais de gestion (en moins)", montant: -4200 }, { libelle: "Frais professionnels remboursés, ni cotisés ni imposés (en moins)", montant: 0 }] })
    expect(lignes.find(l => l.libelle === "Masse salariale brute payée par l'enveloppe")?.composantes).toContainEqual({ libelle: "Réserve financière, gardée sur le compte d'activité", montant: 3346 })
    expect(lignes.find(l => l.libelle.startsWith("Bulletin du salarié porté"))?.composantes).toContainEqual({ libelle: "APEC (cadres) (salariale + patronale)", montant: 23 })
    expect(lignes.find(l => l.libelle.startsWith("Bulletin du salarié porté"))?.composantes).toContainEqual({ libelle: "Forfait social sur la prévoyance patronale (salariale + patronale)", montant: 46 })
    expect(lignes.find(l => l.libelle === "Gardé sur le compte d'activité")?.montant).toBe(2643)
    expect(informations).toContainEqual(expect.stringMatching(/^Conditions retenues : frais de gestion de 7\s%/))
    expect(informations).toContainEqual(expect.stringContaining("Valeurs typiques, à remplacer par celles de la société de portage : tauxFraisDeGestion"))
    expect(informations).toContainEqual("Réduction générale des cotisations patronales gardée par la société de portage : 3144 €.")

    const personne = appeler<{ lignes: { libelle: string; composantes?: { libelle: string; montant: number }[] }[] }>("expliquer_resultat", lucieEnPortage(), { acteurId: "person-lucie" })
    expect(personne.lignes[0].composantes).toContainEqual({ libelle: "Salaire en portage salarial", montant: 27752 })
  })

  it("une activité déjà en portage n'est pas encore comparée ; une proposition ne crée pas d'activité en portage", () => {
    expect(erreurDe("comparer_statuts", lucieEnPortage(), { activiteId: "portage-lucie" })).toContain("le comparateur ne convertit pas encore une activité en portage")
    expect(erreurDe("comparer_statuts", lucieEnPortage())).toContain("aucune activité à comparer")
    expect(erreurDe("proposer_acteur", lucieEnPortage(), { genre: "portage", nom: "Autre mission" })).toContain("genre")
  })

  it("comparer_statuts et chiffre_affaires_pour_net_vise ont la colonne du portage salarial ; optimiser_remuneration la refuse", () => {
    const session = sessionDeMicro()
    const comparaison = appeler<{ scenarios: { statut: string; libelle: string; netApresImpots: number; protectionSociale: { etoiles: number }; avertissements: string[] }[] }>("comparer_statuts", session, { activiteId: "micro-lucie" })
    const portage = comparaison.scenarios.find(s => s.statut === "portage")
    expect(portage).toMatchObject({ libelle: "Portage salarial", protectionSociale: { etoiles: 5 } })
    expect(portage?.avertissements).toContainEqual(expect.stringContaining("Conditions typiques d'une société de portage"))
    const aLEnvers = appeler<{ colonnes: { statut: string; chiffreDAffaires: number | null }[] }>("chiffre_affaires_pour_net_vise", session, { activiteId: "micro-lucie", netVise: 30000 })
    expect(aLEnvers.colonnes.find(c => c.statut === "portage")?.chiffreDAffaires).toBeGreaterThan(55000)
    expect(erreurDe("optimiser_remuneration", session, { activiteId: "micro-lucie", statut: "portage" })).toContain("statut")
  })

  it("propose des frais professionnels remboursés sur l'activité en portage, pas de vente de marchandises", () => {
    const flux = { annee: 2026, acteurId: "portage-lucie", typeFlux: "deductible_expense", libelle: "Déplacements remboursés", montant: 200, mois: TOUTE_L_ANNEE }
    expect(appeler<ResultatProposition>("proposer_flux", lucieEnPortage(), { flux: [flux] }).recapitulatif).toBe("Ajouter 12 flux ?")
    expect(erreurDe("proposer_flux", lucieEnPortage(), { flux: [{ ...flux, typeFlux: "ca_vente" }] })).toContain("Types possibles : ca_services, deductible_expense")
  })
})
