// src/lib/testing/session-maximale.ts
// Une session qui remplit chaque champ du schéma, chaque type d'acteur, de relation et de flux, et chaque mode du
// comparateur : les tests « rien ne se perd » la font passer par chaque enregistrement et chaque relecture.
// Un test vérifie qu'aucun champ du schéma n'y manque : un champ ajouté au schéma doit l'être ici aussi.

import { defaultFraisFonctionnement } from "@/lib/comparateur-options"
import type { AnneeSimulee, FinancialFlow, FraisFonctionnement, SaveSlot, SessionState, UserPreferences } from "@/types"

const initiales = (value: string, color: string) => ({ type: "initials" as const, value, color })
const icone = (value: string, color: string) => ({ type: "icon" as const, value, color })

/** Un flux de chaque type, sur l'acteur qui peut le porter ; un salaire avec son brut. */
const FLUX_PAR_ACTEUR: [FinancialFlow["entityId"], FinancialFlow["type"], number][] = [
  ["p-alice", "salary", 2100],
  ["p-alice", "are", 900],
  ["p-bob", "other_taxable_income", 300],
  ["p-bob", "income", 50],
  ["p-bob", "expense", 40],
  ["c-sasu", "ca_services", 9000],
  ["c-sasu", "ca_vente", 1500],
  ["c-sasu", "deductible_expense", 700],
  ["c-sasu", "director_remuneration", 2500],
  ["c-eurl", "dividends_payment", 4000],
  ["m-bic", "ca_micro_services_bic", 2200],
  ["m-bnc", "ca_micro_services_bnc", 1800],
  ["m-bnc", "ca_micro_vente", 600]
]

function grilleDeLAnnee(annee: number, facteur: number): AnneeSimulee {
  return {
    annee,
    monthlyData: Array.from({ length: 12 }, (_, month) => ({
      month,
      flows: FLUX_PAR_ACTEUR.filter((_, i) => (i + month) % 3 === 0).map(([entityId, type, montant], i) => ({
        id: `f-${annee}-${month}-${i}`,
        label: `${type} ${month + 1}/${annee}`,
        amount: Math.round(montant * facteur * 100) / 100,
        entityId,
        type,
        ...(type === "salary" ? { grossAmount: Math.round(montant * facteur * 1.28 * 100) / 100 } : {})
      }))
    }))
  }
}

function fraisModifies(delta: number): FraisFonctionnement {
  const frais = defaultFraisFonctionnement()
  return { ...frais, SASU: { ...frais.SASU, cfe: 300 + delta }, micro: { ...frais.micro, banque: 100 + delta } }
}

/** Trois années consécutives, toutes les entités et options, des réglages du comparateur dans chaque mode. */
export function sessionMaximale(): SessionState {
  return {
    // Une version passée : un enregistrement par la version actuelle la remplace, une simple relecture la garde.
    appVersion: "0.8.0",
    name: "Famille Martin — tout rempli",
    entities: [
      {
        id: "p-alice",
        type: "person",
        name: "Alice Martin",
        fiscalParts: 1,
        fraisReels: {
          trajets: [
            { libelle: "Siège", kmParTrajet: 48.5, joursTravailles: 180, puissanceFiscale: "7", electrique: true, distanceJustifiee: true },
            { libelle: "Agence", kmParTrajet: 12, joursTravailles: 30, puissanceFiscale: "3", electrique: false, distanceJustifiee: false }
          ],
          autresFrais: 640
        },
        avatar: initiales("AM", "#3b82f6"),
        locked: true
      },
      { id: "p-bob", type: "person", name: "Bob Martin", fiscalParts: 1.5, fraisReels: { trajets: [{ libelle: "Atelier", kmParTrajet: 5, joursTravailles: 200, puissanceFiscale: "4", electrique: false, distanceJustifiee: false }, { libelle: "Client A", kmParTrajet: 22, joursTravailles: 10, puissanceFiscale: "5", electrique: true, distanceJustifiee: false }, { libelle: "Client B", kmParTrajet: 60, joursTravailles: 4, puissanceFiscale: "6", electrique: false, distanceJustifiee: true }], autresFrais: 0 }, avatar: initiales("BM", "#10b981"), locked: false },
      { id: "p-chloe", type: "person", name: "Chloé", fiscalParts: 0.5, avatar: icone("Baby", "#f59e0b"), locked: false },
      { id: "p-dan", type: "person", name: "Dan", fiscalParts: 1, avatar: icone("User", "#64748b"), locked: false },
      { id: "c-sasu", type: "company", name: "Martin Conseil", legalStatus: "SASU", capitalSocial: 5000, deplacementsProfessionnels: { kmParAn: 8000, puissanceFiscale: "6", electrique: true }, avatar: icone("Briefcase", "#ef4444"), locked: true },
      { id: "c-eurl", type: "company", name: "Martin Bois", legalStatus: "EURL", capitalSocial: 1500, deplacementsProfessionnels: { kmParAn: 450, puissanceFiscale: "7", electrique: false }, avatar: icone("Hammer", "#8b5cf6"), locked: false },
      { id: "c-ei", type: "company", name: "Bob Réparations", legalStatus: "EI", capitalSocial: 0, dateDeCreation: "2025-04", deplacementsProfessionnels: { kmParAn: 1200, puissanceFiscale: "5", electrique: false }, avatar: icone("Wrench", "#0ea5e9"), locked: false },
      { id: "m-bic", type: "micro-entreprise", name: "Alice Formations", beneficieACRE: true, opteVFL: true, rfrN2: 24000, dateDeCreation: "2026-09", horsPlafondAnneePrecedente: false, deplacementsProfessionnels: { kmParAn: 300, puissanceFiscale: "3", electrique: false }, avatar: icone("Store", "#f97316"), locked: false },
      { id: "m-bnc", type: "micro-entreprise", name: "Bob Photos", beneficieACRE: false, opteVFL: false, rfrN2: 0, horsPlafondAnneePrecedente: true, deplacementsProfessionnels: { kmParAn: 0, puissanceFiscale: "4", electrique: true }, avatar: initiales("BP", "#14b8a6"), locked: true }
    ],
    relationships: [
      { id: "r-mariage", fromId: "p-alice", toId: "p-bob", type: "Marié(e)" },
      { id: "r-pacs", fromId: "p-dan", toId: "p-chloe", type: "PACSé(e)" },
      { id: "r-couple", fromId: "p-dan", toId: "p-alice", type: "En couple" },
      { id: "r-enfant", fromId: "p-alice", toId: "p-chloe", type: "Enfant" },
      { id: "r-president", fromId: "p-alice", toId: "c-sasu", type: "Président" },
      { id: "r-gerant", fromId: "p-bob", toId: "c-eurl", type: "Gérant" },
      { id: "r-associe", fromId: "p-alice", toId: "c-eurl", type: "Associé" },
      { id: "r-titulaire", fromId: "p-bob", toId: "c-ei", type: "Titulaire" },
      { id: "r-titulaire-micro", fromId: "p-alice", toId: "m-bic", type: "Titulaire" },
      { id: "r-salarie", fromId: "p-dan", toId: "c-sasu", type: "Salarié" }
    ],
    annees: [grilleDeLAnnee(2024, 0.9), grilleDeLAnnee(2025, 1), grilleDeLAnnee(2026, 1.1)],
    comparateur: {
      activiteComparee: "c-eurl",
      reglagesParActivite: {
        "c-sasu": { repartition: { mode: "meilleurNet", partDistribuee: 1, avecRetraite: true }, partBncPrestations: 0.3, fraisFonctionnement: fraisModifies(50), statutEtudie: "EURL" },
        "c-eurl": { repartition: { mode: "personnalisee", partDistribuee: 0.35 }, remunerationParAnnee: { "2024": 12000, "2026": 18500.5 }, fraisFonctionnement: fraisModifies(-20), statutEtudie: "SASU" },
        "c-ei": { repartition: { mode: "dividendes", partDistribuee: 1, avecRetraite: false }, remunerationParAnnee: { "2025": 9000 }, partBncPrestations: 0 },
        "m-bic": { repartition: { mode: "remuneration", partDistribuee: 0.8 }, fraisFonctionnement: fraisModifies(0) },
        "m-bnc": { repartition: { mode: "grille", partDistribuee: 0 }, partBncPrestations: 1 }
      }
    }
  }
}

/** La session maximale enregistrée sous un nom. */
export function sauvegardeMaximale(id = "slot-maximal"): SaveSlot {
  return { ...sessionMaximale(), id, lastModified: 1_780_000_000_000 }
}

/**
 * Préférences remplies : ordre des sauvegardes, couleurs des types de flux, affichage choisi, sauvegarde chargée,
 * zoom, et sections repliables ouvertes comme fermées.
 */
export function preferencesMaximales(): UserPreferences {
  return {
    slotOrder: ["slot-maximal", "slot-2"],
    flowTypeColors: { salary: "#123456", ca_services: "#abcdef" },
    affichage: "vues",
    loadedSlotId: "slot-2",
    zoom: 1.3,
    sectionsOuvertes: { "legende-des-flux": true, "detail-du-calcul": false }
  }
}
