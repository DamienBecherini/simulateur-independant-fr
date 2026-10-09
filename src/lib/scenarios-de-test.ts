// src/lib/scenarios-de-test.ts
// Scénarios de test, pour vérifier à la main une fonctionnalité dans l'application : des sessions prêtes à charger,
// chacune avec la liste de ce qu'il faut regarder. Ils ne servent qu'en mode développement (bouton « Tests » de la
// barre d'outils) : ce ne sont pas des montages types, leurs chiffres sont choisis pour faire apparaître un cas, pas
// pour décrire une situation courante. Comme les montages types, ils portent sur des années fixes (2024 à 2026) et
// leurs chiffres attendus viennent des règles de ces années : ils ne suivent pas l'année en cours.

import type { Company, MicroEntreprise, Relationship, SessionState } from "@/types"
import { comparateurAuMeilleurNet, fluxDuMois, microEntreprise, personne, relation, societe, type FluxDuMontage } from "./montages/construction"

export interface ScenarioDeTest {
  id: string
  titre: string
  /** Ce que le scénario met en place. */
  resume: string
  /** Ce qu'il faut vérifier, dans l'ordre, et où le voir. */
  aVerifier: string[]
  session: () => SessionState
}

/** Une session sur plusieurs années consécutives : les flux de chaque année, saisis chaque mois ou un seul mois. */
function sessionSurPlusieursAnnees(name: string, entities: SessionState["entities"], relationships: Relationship[], fluxParAnnee: Record<number, FluxDuMontage[]>, comparateur?: SessionState["comparateur"]): SessionState {
  const annees = Object.entries(fluxParAnnee)
    .map(([annee, flux]) => ({
      annee: Number(annee),
      monthlyData: Array.from({ length: 12 }, (_, month) => ({
        month,
        flows: flux.filter(f => f.mois === undefined || f.mois === month).map(f => ({ ...fluxDuMois(f, month), id: `${annee}-${f.entityId}-${f.type}-${month}` }))
      }))
    }))
    .sort((a, b) => a.annee - b.annee)
  return { name, entities, relationships, annees, ...(comparateur ? { comparateur } : {}) }
}

/**
 * Un président seul et sa SASU ; `reservesInitiales` en euros, absent : aucune. Sans `dateDeCreation` (« AAAA-MM »),
 * la société est réputée installée : sa réserve légale est déjà constituée (ADR 014).
 */
function presidentEtSasu(capital: number, options: { reservesInitiales?: number; dateDeCreation?: string } = {}) {
  const sasu = { ...societe("s-test", "SASU de test", "SASU", capital), ...options }
  return { entities: [personne("p-test", "Camille"), sasu], relationships: [relation("p-test", "s-test", "Président")] }
}

/** Une personne seule et son activité libérale réglementée (« a-test »), dont elle est titulaire (voir l'ADR 015). */
function liberal(activite: Company | MicroEntreprise) {
  return { entities: [personne("p-test", "Camille"), activite], relationships: [relation("p-test", "a-test", "Titulaire")] }
}

/** Le chiffre d'affaires de l'année d'une activité libérale, saisi en janvier : seul le total annuel compte ici. */
const HONORAIRES = (type: "ca_services" | "ca_micro_services_bnc", montant: number): FluxDuMontage => ({ entityId: "a-test", type, amount: montant, label: "Honoraires de l'année", mois: 0 })

const FACTURATION = (montantMensuel: number): FluxDuMontage =>({ entityId: "s-test", type: "ca_services", amount: montantMensuel, label: "Facturation" })
const FRAIS = (montantMensuel: number): FluxDuMontage => ({ entityId: "s-test", type: "deductible_expense", amount: montantMensuel, label: "Frais" })
const DIVIDENDES_EN_DECEMBRE = (montant: number): FluxDuMontage => ({ entityId: "s-test", type: "dividends_payment", amount: montant, label: "Dividendes", mois: 11 })

export const SCENARIOS_DE_TEST: ScenarioDeTest[] = [
  {
    id: "reserves-deux-annees",
    titre: "Réserves sur deux années",
    resume: "SASU créée en janvier 2025, au capital de 5 000 €. 2025 : 60 000 € facturés, aucun dividende. 2026 : 36 000 € facturés, 50 000 € de dividendes en décembre, plus que le bénéfice de l'année.",
    aVerifier: [
      "Année 2025, carte de la SASU : « Ajouté aux réserves » 49 250 €, dont 500 € de réserve légale (10 % du capital, la société part de zéro) ; « Réserves au 31 décembre » 48 750 €, plus 500 € de réserve légale.",
      "Année 2026 : « Dividendes pris sur les réserves » 19 400 € (50 000 € demandés pour 30 600 € de bénéfice) ; « Réserves au 31 décembre » 29 350 €.",
      "Les réserves au 1er janvier 2026 sont celles du 31 décembre 2025.",
      "Exports CSV et Markdown : les réserves de chaque année y figurent."
    ],
    session: () => {
      const { entities, relationships } = presidentEtSasu(5000, { dateDeCreation: "2025-01" })
      return sessionSurPlusieursAnnees("Test : réserves sur deux années", entities, relationships, { 2025: [FACTURATION(5000)], 2026: [FACTURATION(3000), DIVIDENDES_EN_DECEMBRE(50000)] })
    }
  },
  {
    id: "reserves-de-depart",
    titre: "Réserves de départ",
    resume: "SASU déjà en activité, avec 20 000 € de réserves au début de la simulation. 2026 : 36 000 € facturés et 40 000 € de dividendes.",
    aVerifier: [
      "Fiche de la SASU : le champ « Réserves au début » montre 20 000 €.",
      "Carte de la SASU : « Dividendes pris sur les réserves » 9 400 € (40 000 € demandés pour 30 600 € de bénéfice) ; « Réserves au 31 décembre » 10 600 €.",
      "Comparateur ouvert sur la SASU : les réserves de départ suivent l'activité convertie en EURL.",
      "Vider le champ des réserves de départ : les dividendes au-delà du bénéfice sont alors signalés."
    ],
    session: () => {
      const { entities, relationships } = presidentEtSasu(1000, { reservesInitiales: 20000 })
      return sessionSurPlusieursAnnees("Test : réserves de départ", entities, relationships, { 2026: [FACTURATION(3000), DIVIDENDES_EN_DECEMBRE(40000)] }, comparateurAuMeilleurNet("s-test", false))
    }
  },
  {
    id: "deficit-puis-benefice",
    titre: "Déficit, puis bénéfice",
    resume: "SASU en perte en 2025 (12 000 € facturés pour 36 000 € de frais), puis bénéficiaire en 2026 (72 000 € facturés, 6 000 € de frais).",
    aVerifier: [
      "Année 2025 : « Déficit de la société » 24 000 €, aucun impôt sur les sociétés, « Pertes à combler au 31 décembre » 24 000 €.",
      "Année 2026 : « Déficit des années précédentes déduit » 24 000 €, avant l'impôt sur les sociétés, qui baisse d'autant sa base.",
      "Supprimer les frais de 2025 : l'impôt 2026 remonte."
    ],
    session: () => {
      const { entities, relationships } = presidentEtSasu(1000)
      return sessionSurPlusieursAnnees("Test : déficit puis bénéfice", entities, relationships, { 2025: [FACTURATION(1000), FRAIS(3000)], 2026: [FACTURATION(6000), FRAIS(500)] })
    }
  },
  {
    id: "comparateur-toutes-les-annees",
    titre: "Comparateur sur toutes les années",
    resume: "SASU sur trois années (2024 à 2026), 84 000 € facturés et 6 000 € de frais par an, sans rémunération ni dividendes ; comparateur ouvert sur la SASU.",
    aVerifier: [
      "Comparateur, section « Sur toutes les années » : la meilleure stratégie est désignée.",
      "Faire varier la part du bénéfice mise en réserve : le net cumulé et la stratégie désignée changent.",
      "Recharger la page (ou fermer et rouvrir l'application) : la part mise en réserve est retrouvée.",
      "Barre d'outils : « Montages types » et « Donner mon avis » sont toujours là."
    ],
    session: () => {
      const { entities, relationships } = presidentEtSasu(1000)
      const annee = [FACTURATION(7000), FRAIS(500)]
      return sessionSurPlusieursAnnees("Test : comparateur sur toutes les années", entities, relationships, { 2024: annee, 2025: annee, 2026: annee }, comparateurAuMeilleurNet("s-test", false))
    }
  },
  {
    id: "osteopathe-micro",
    titre: "Ostéopathe en micro-entreprise",
    resume: "Ostéopathe (CIPAV) en micro-entreprise, 40 000 € d'honoraires en 2026, sans versement libératoire ; comparateur ouvert sur l'activité.",
    aVerifier: [
      "Fiche de l'activité : profession « Ostéopathe » ; la ligne sous la liste dit « Caisse : CIPAV. Micro-entreprise possible, au taux de 23,2 % du chiffre d'affaires ».",
      "Carte de l'activité : « Micro-entreprise · Ostéopathe (CIPAV, 23,2 % du chiffre d'affaires) » ; cotisations sociales 9 360 € (23,2 % de 40 000 €, plus 80 € de formation professionnelle), au lieu de 10 320 € pour un libéral non réglementé.",
      "Foyer de Camille : impôt sur le revenu 1 468 € (26 400 € imposables) ; net après impôts 29 172 €.",
      "Comparateur : colonne micro-entreprise à 4 trimestres (40 000 € ≥ 11 168 €) ; colonnes SASU et EURL avec l'avertissement « exerce en principe en société d'exercice libéral » ; protection de la colonne EI « Profession libérale de la CIPAV ».",
      "Repasser la profession à « Non réglementée » : cotisations 10 320 €."
    ],
    session: () => {
      const { entities, relationships } = liberal({ ...microEntreprise("a-test", "Cabinet d'ostéopathie", { opteVFL: false }), profession: "osteopathe" })
      return sessionSurPlusieursAnnees("Test : ostéopathe en micro-entreprise", entities, relationships, { 2026: [HONORAIRES("ca_micro_services_bnc", 40000)] }, comparateurAuMeilleurNet("a-test", false))
    }
  },
  {
    id: "kine-deux-annees",
    titre: "Kinésithérapeute conventionné sur deux années",
    resume: "Masseur-kinésithérapeute conventionné (CARPIMKO, 100 % de recettes conventionnées) en EI au réel, 60 000 € de bénéfice en 2025 et en 2026.",
    aVerifier: [
      "Année 2026, carte de l'activité : cotisations sociales 14 535 € ; « dont maladie (Urssaf) » 44 € (2 451 € pris en charge par l'Assurance maladie) ; retraite de base (CNAVPL) 4 706 € ; retraite complémentaire (CARPIMKO) 3 863 €, « calculée sur le revenu 2025 » ; invalidité-décès 1 022 € ; ASV 295 € (554 € pris en charge) ; CURPS 44 €.",
      "Année 2025 : complémentaire 2 887 € (forfait de 2 312 € plus 3 % au-delà de 25 246 €) et ASV 292 €, « calculée sur le revenu 2025 (2024 n'est pas dans la simulation) ».",
      "Passer les honoraires 2025 à 40 000 € : en 2026, la complémentaire tombe à 2 575 € (8,70 % de 29 600 €) et l'ASV à 271 €, la retraite de base 2026 ne bouge pas.",
      "Fiche : part conventionnée à 80 % : la prise en charge de la maladie et de l'ASV baisse, le reste de la maladie suit le barème majoré de 3,25 points.",
      "Comparateur : pas de colonne micro-entreprise, avec la note « Micro-entreprise non proposée »."
    ],
    session: () => {
      const { entities, relationships } = liberal({ ...societe("a-test", "Cabinet de kinésithérapie", "EI", 0), profession: "masseur-kinesitherapeute" })
      return sessionSurPlusieursAnnees("Test : kinésithérapeute sur deux années", entities, relationships, { 2025: [HONORAIRES("ca_services", 60000)], 2026: [HONORAIRES("ca_services", 60000)] }, comparateurAuMeilleurNet("a-test", false))
    }
  },
  {
    id: "psychologue-ei",
    titre: "Psychologue en EI au réel",
    resume: "Psychologue (CIPAV) en EI au réel, 25 000 € de bénéfice en 2026 ; comparateur ouvert sur l'activité.",
    aVerifier: [
      "Carte de l'activité : « EI au réel · Psychologue (CIPAV) » ; cotisations sociales 6 317 € (7 312 € pour un libéral non réglementé) ; retraite de base 1 961 €, retraite complémentaire (CIPAV) 2 035 € (11 % de 18 500 €), invalidité-décès 93 €, maladie 257 €.",
      "Comparateur : 4 trimestres en EI (assiette de 18 500 €) ; colonne micro-entreprise au taux de la CIPAV : 5 850 € de cotisations (23,2 % de 25 000 €, plus 50 € de formation professionnelle).",
      "Exports CSV et Markdown : la profession suit le statut, et un tableau « Cotisations par caisse » détaille les lignes."
    ],
    session: () => {
      const { entities, relationships } = liberal({ ...societe("a-test", "Cabinet de psychologie", "EI", 0), profession: "psychologue" })
      return sessionSurPlusieursAnnees("Test : psychologue en EI au réel", entities, relationships, { 2026: [HONORAIRES("ca_services", 25000)] }, comparateurAuMeilleurNet("a-test", false))
    }
  },
  {
    id: "infirmiere-statuts",
    titre: "Infirmière : comparer les statuts",
    resume: "Infirmière conventionnée (CARPIMKO) en EI au réel, 20 000 € de bénéfice en 2026 ; comparateur au meilleur net.",
    aVerifier: [
      "Carte de l'activité : cotisations sociales 6 572 €, minimums de la CARPIMKO compris (complémentaire 2 091 € sur 0,5 PASS, invalidité-décès 1 022 €).",
      "Comparateur : trois colonnes seulement (SASU, EURL, EI au réel) et la note « Micro-entreprise non proposée : elle est interdite aux praticiens et auxiliaires médicaux ».",
      "Colonnes SASU et EURL : l'avertissement sur les sociétés d'exercice libéral ; la colonne EURL calcule le gérant avec les cotisations de la CARPIMKO.",
      "Fiche : choisir « Ostéopathe » : les colonnes micro-entreprise reviennent, au taux de 23,2 %."
    ],
    session: () => {
      const { entities, relationships } = liberal({ ...societe("a-test", "Cabinet infirmier", "EI", 0), profession: "infirmier" })
      return sessionSurPlusieursAnnees("Test : infirmière, comparer les statuts", entities, relationships, { 2026: [HONORAIRES("ca_services", 20000)] }, comparateurAuMeilleurNet("a-test", false))
    }
  }
]
