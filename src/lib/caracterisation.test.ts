// src/lib/caracterisation.test.ts
// Test de caractérisation : il fige ce que le moteur produit aujourd'hui pour des sessions entières, sans juger si
// c'est juste (les cas de référence le font, règle par règle). Il sert de filet aux refontes « à résultats
// inchangés » : un champ secondaire qui bouge, même loin de la règle touchée, le fait échouer.
//
// Ce qui est figé, dans `caracterisation/*.json` (hors de `src`, pour rester hors des mesures de duplication) :
// le rapport entier de chaque année et la comparaison des statuts de chaque activité, pour les situations types, les
// scénarios de test et la session maximale. Montants arrondis au centime, clés triées.
//
// Quand un changement voulu modifie un résultat (règle corrigée, champ ajouté) : `npm run caracterisation:figer`,
// puis relire le diff des fichiers figés avant de le commiter. Voir le guide du développeur, « Tests ».

import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { vueDeLAnnee } from "@/backend/logic/annees"
import { optionsDuComparateur } from "@/backend/logic/options-du-comparateur"
import { comparerStatutsDeLAnnee, simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { estEntrepriseOuMicro, type ComparaisonResult, type OptimisationRemuneration, type SessionState } from "@/types"
import { MONTAGES_TYPES, sessionDUnMontage } from "./montages/montages"
import { SCENARIOS_DE_TEST } from "./scenarios-de-test"
import { sessionMaximale } from "./testing/session-maximale"

const DOSSIER = fileURLToPath(new URL("../../caracterisation/", import.meta.url))

/**
 * Les années figées : celles dont les règles sont publiées à la date où le test a été écrit. Une année simulée avec
 * les règles d'une autre (2027 avant leur parution) changerait le jour où ses règles paraissent, sans que rien
 * n'ait été cassé. À étendre quand une année est publiée.
 */
const ANNEES_FIGEES = [2024, 2025, 2026]

const CAS: { nom: string; session: () => SessionState }[] = [
  ...MONTAGES_TYPES.map(montage => ({ nom: `situation-${montage.id}`, session: () => sessionDUnMontage(montage) })),
  ...SCENARIOS_DE_TEST.map(scenario => ({ nom: `scenario-${scenario.id}`, session: scenario.session })),
  { nom: "session-maximale", session: sessionMaximale }
]

/** Montants au centime (sans zéro négatif), clés triées : ni le bruit des flottants ni l'ordre d'écriture d'un objet ne comptent. */
function normaliser(valeur: unknown): unknown {
  if (typeof valeur === "number") return Math.round(valeur * 100) / 100 || 0
  if (Array.isArray(valeur)) return valeur.map(normaliser)
  if (valeur === null || typeof valeur !== "object") return valeur
  return Object.fromEntries(
    Object.entries(valeur)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([cle, v]) => [cle, normaliser(v)])
  )
}

/**
 * La courbe de l'optimiseur pesait plus de la moitié des fichiers figés : un point sur dix est gardé, avec le premier,
 * le dernier et leur nombre. Les deux points retenus (`meilleur`, `meilleurAvecRetraite`) restent entiers.
 */
function courbeAllegee(optimisation: OptimisationRemuneration) {
  const { points, ...reste } = optimisation
  return { ...reste, nombreDePoints: points.length, unPointSurDix: points.filter((_, i) => i % 10 === 0 || i === points.length - 1) }
}

function comparaisonAllegee(resultat: ComparaisonResult) {
  const { optimisations, ...reste } = resultat
  if (!optimisations) return reste
  return { ...reste, optimisations: Object.fromEntries(Object.entries(optimisations).map(([statut, optimisation]) => [statut, courbeAllegee(optimisation)])) }
}

/** Tout ce que le moteur dit d'une session : le rapport de chaque année figée, et la comparaison de chaque activité. */
function resultats(session: SessionState) {
  const annees = simulerLesAnnees(session).annees.filter(a => ANNEES_FIGEES.includes(a.annee))
  const activites = session.entities.filter(estEntrepriseOuMicro)
  const comparaisons = annees.flatMap(({ annee }) =>
    activites.map(activite => ({
      annee,
      activite: activite.id,
      resultat: comparaisonAllegee(comparerStatutsDeLAnnee(session, optionsDuComparateur(vueDeLAnnee(session, annee), activite.id, session.comparateur?.reglagesParActivite[activite.id]), annee))
    }))
  )
  return { annees, comparaisons }
}

describe("caractérisation : les résultats complets, figés", () => {
  it("un fichier figé par cas, et aucun autre", () => {
    expect(readdirSync(DOSSIER).sort()).toEqual(CAS.map(cas => `${cas.nom}.json`).sort())
  })

  it.each(CAS.map(cas => [cas.nom, cas] as const))("%s", async (nom, cas) => {
    const texte = `${JSON.stringify(normaliser(resultats(cas.session())), null, 1)}\n`
    await expect(texte).toMatchFileSnapshot(`${DOSSIER}${nom}.json`)
  })
})
