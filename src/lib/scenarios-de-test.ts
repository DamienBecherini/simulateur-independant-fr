// src/lib/scenarios-de-test.ts
// Scénarios de test, pour vérifier à la main une fonctionnalité dans l'application : des sessions prêtes à charger,
// chacune avec la liste de ce qu'il faut regarder. Ils ne servent qu'en mode développement (bouton « Tests » de la
// barre d'outils) : ce ne sont pas des montages types, leurs chiffres sont choisis pour faire apparaître un cas, pas
// pour décrire une situation courante.

import type { Relationship, SessionState } from "@/types"
import { comparateurAuMeilleurNet, fluxDuMois, personne, relation, societe, type FluxDuMontage } from "./montages/construction"

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

/** Un président seul et sa SASU ; `reservesInitiales` en euros, absent : aucune. */
function presidentEtSasu(capital: number, reservesInitiales?: number) {
  const sasu = { ...societe("s-test", "SASU de test", "SASU", capital), ...(reservesInitiales === undefined ? {} : { reservesInitiales }) }
  return { entities: [personne("p-test", "Camille"), sasu], relationships: [relation("p-test", "s-test", "Président")] }
}

const FACTURATION = (montantMensuel: number): FluxDuMontage => ({ entityId: "s-test", type: "ca_services", amount: montantMensuel, label: "Facturation" })
const FRAIS = (montantMensuel: number): FluxDuMontage => ({ entityId: "s-test", type: "deductible_expense", amount: montantMensuel, label: "Frais" })
const DIVIDENDES_EN_DECEMBRE = (montant: number): FluxDuMontage => ({ entityId: "s-test", type: "dividends_payment", amount: montant, label: "Dividendes", mois: 11 })

export const SCENARIOS_DE_TEST: ScenarioDeTest[] = [
  {
    id: "reserves-deux-annees",
    titre: "Réserves sur deux années",
    resume: "SASU au capital de 5 000 €. 2025 : 60 000 € facturés, aucun dividende. 2026 : 36 000 € facturés, 50 000 € de dividendes en décembre, plus que le bénéfice de l'année.",
    aVerifier: [
      "Année 2025, carte de la SASU : réserves au 31 décembre, et dotation à la réserve légale de 500 € au plus (10 % du capital).",
      "Année 2026 : les dividendes dépassent le bénéfice de l'année et puisent dans les réserves de 2025, avec la mention « pris sur les réserves ».",
      "Les réserves au 1er janvier 2026 sont celles du 31 décembre 2025.",
      "Exports CSV et Markdown : les réserves de chaque année y figurent."
    ],
    session: () => {
      const { entities, relationships } = presidentEtSasu(5000)
      return sessionSurPlusieursAnnees("Test : réserves sur deux années", entities, relationships, { 2025: [FACTURATION(5000)], 2026: [FACTURATION(3000), DIVIDENDES_EN_DECEMBRE(50000)] })
    }
  },
  {
    id: "reserves-de-depart",
    titre: "Réserves de départ",
    resume: "SASU déjà en activité, avec 20 000 € de réserves au début de la simulation. 2026 : 36 000 € facturés et 40 000 € de dividendes.",
    aVerifier: [
      "Fiche de la SASU : le champ des réserves de départ montre 20 000 €.",
      "Carte de la SASU : les réserves au 1er janvier 2026 valent 20 000 €, et les dividendes au-delà du bénéfice y sont pris.",
      "Comparateur ouvert sur la SASU : les réserves de départ suivent l'activité convertie en EURL.",
      "Vider le champ des réserves de départ : les dividendes au-delà du bénéfice sont alors signalés."
    ],
    session: () => {
      const { entities, relationships } = presidentEtSasu(1000, 20000)
      return sessionSurPlusieursAnnees("Test : réserves de départ", entities, relationships, { 2026: [FACTURATION(3000), DIVIDENDES_EN_DECEMBRE(40000)] }, comparateurAuMeilleurNet("s-test", false))
    }
  },
  {
    id: "deficit-puis-benefice",
    titre: "Déficit, puis bénéfice",
    resume: "SASU en perte en 2025 (12 000 € facturés pour 36 000 € de frais), puis bénéficiaire en 2026 (72 000 € facturés, 6 000 € de frais).",
    aVerifier: [
      "Année 2025 : bénéfice négatif, aucun impôt sur les sociétés, déficit reportable de 24 000 €.",
      "Année 2026 : l'impôt sur les sociétés est calculé après déduction du déficit de 2025, avec la mention « déficit déduit ».",
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
  }
]
