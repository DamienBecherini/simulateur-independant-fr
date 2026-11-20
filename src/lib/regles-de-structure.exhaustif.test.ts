// src/lib/regles-de-structure.exhaustif.test.ts
// Les règles de structure (src/backend/logic/regles-de-structure.ts, ADR 018) vérifiées sur toutes les combinaisons, pas
// sur les cas
// auxquels on a pensé : une activité de chaque forme, deux ou trois personnes, chaque rôle présent ou absent pour
// chacune. Quelques milliers de petites simulations, pour quatre garanties :
// 1. la saisie et les propositions des IA acceptent exactement les mêmes relations, dans toutes les situations ;
// 2. ce qu'elles laissent construire est exactement ce que le calcul tient pour régulier : tout le reste, qu'une
//    sauvegarde ancienne ou un fichier importé peuvent porter, est signalé sur la carte de l'activité ;
// 3. le calcul ne perd ni ne crée d'argent : ce que l'activité verse arrive aux personnes, ou reste « non rattaché » ;
//    seul qui dirige ou est associé en reçoit ;
// 4. changer une activité de statut ne fabrique jamais une structure irrégulière, ni la simuler dans une colonne du
//    comparateur.
// C'est ce test qui aurait montré les deux titulaires d'une micro-entreprise, dont le second était ignoré sans un mot.

import { describe, expect, it } from "vitest"
import type { Entity, Relationship } from "@/types"
import { getAvailableRelationships } from "./graph-logic"
import { STATUTS_COMPARES } from "@/types"
import { changerLeStatut, type StatutDUneActivite } from "@/backend/logic/changement-de-statut"
import { convertirLActivite, genreDuStatut } from "@/backend/logic/conversion-de-statut"
import { verifierNouvelleRelation } from "@/backend/logic/outils/commun"
import { anomaliesDeStructure, genreDeStructure, REGLES_DE_STRUCTURE, rolesDeLaStructure, rolesQui, type Activite, type GenreDeStructure, type RoleDansUneActivite } from "@/backend/logic/regles-de-structure"
import { runMetaSimulation } from "@/backend/logic/simulation-engine"
import { reglesDeTest } from "@/backend/logic/testing/regles-de-test"
import { micro, personne, portage, relation, session, societe, type Flux } from "@/backend/logic/testing/session-de-test"

const ROLES: RoleDansUneActivite[] = ["Président", "Gérant", "Associé", "Titulaire", "Salarié"]
const GENRES = Object.keys(REGLES_DE_STRUCTURE) as GenreDeStructure[]

/** Une activité de cette forme, et les flux qui lui font verser tout ce qu'elle peut verser. */
function activiteDuGenre(genre: GenreDeStructure): { activite: Activite; flux: Flux[] } {
  if (genre === "micro-entreprise") return { activite: micro("a"), flux: [["a", "ca_micro_services_bnc", 40000]] }
  if (genre === "portage") return { activite: portage("a"), flux: [["a", "ca_services", 60000]] }
  const chiffre: Flux = ["a", "ca_services", 100000]
  if (genre === "EI") return { activite: societe("a", "EI", 0), flux: [chiffre] }
  return { activite: societe("a", genre), flux: [chiffre, ["a", "director_remuneration", 30000], ["a", "dividends_payment", 20000]] }
}

/** Une relation possible : telle personne, tel rôle. Une structure est un ensemble de ces relations. */
interface Lien {
  personne: string
  role: RoleDansUneActivite
}
const cleDuLien = (lien: Lien) => `${lien.personne}:${lien.role}`
const cleDeLaStructure = (liens: Lien[]) => liens.map(cleDuLien).sort().join(" ")
const relationsDe = (liens: Lien[]): Relationship[] => liens.map(lien => relation(lien.personne, "a", lien.role))

/** Toutes les parties d'un ensemble de liens. */
function parties(liens: Lien[]): Lien[][] {
  return Array.from({ length: 2 ** liens.length }, (_, masque) => liens.filter((_lien, rang) => (masque >> rang) & 1))
}

const personnes = (nombre: number) => Array.from({ length: nombre }, (_, rang) => personne(`p${rang + 1}`))
const liensPossibles = (nombre: number, roles: RoleDansUneActivite[]): Lien[] => personnes(nombre).flatMap(p => roles.map(role => ({ personne: p.id, role })))

/** La saisie propose-t-elle ce lien, dans cette structure ? Dans les deux sens : depuis la personne et depuis l'activité. */
function proposeParLaSaisie(entities: Entity[], activite: Activite, liens: Lien[], lien: Lien): boolean {
  const p = entities.find(e => e.id === lien.personne)!
  const depuisLaPersonne = getAvailableRelationships(p, activite, relationsDe(liens)).includes(lien.role)
  const depuisLActivite = getAvailableRelationships(activite, p, relationsDe(liens)).includes(lien.role)
  expect(depuisLActivite, `${cleDuLien(lien)} dans [${cleDeLaStructure(liens)}] : les deux sens de la saisie`).toBe(depuisLaPersonne)
  return depuisLaPersonne
}

/** Une IA peut-elle proposer ce lien, dans cette structure ? */
function accepteParLesIA(entities: Entity[], liens: Lien[], lien: Lien): boolean {
  try {
    verifierNouvelleRelation({ entities, relationships: relationsDe(liens) }, lien.personne, "a", lien.role)
    return true
  } catch {
    return false
  }
}

/**
 * Les structures que l'on peut construire relation après relation, depuis une activité sans personne : à chaque pas,
 * la saisie et les IA doivent proposer exactement les mêmes liens.
 */
function structuresConstructibles(entities: Entity[], activite: Activite, candidats: Lien[]): Map<string, Lien[]> {
  const vues = new Map<string, Lien[]>([["", []]])
  const aVoir: Lien[][] = [[]]
  while (aVoir.length > 0) {
    const liens = aVoir.pop()!
    for (const lien of candidats) {
      if (liens.some(l => cleDuLien(l) === cleDuLien(lien))) continue
      const propose = proposeParLaSaisie(entities, activite, liens, lien)
      expect(accepteParLesIA(entities, liens, lien), `${cleDuLien(lien)} dans [${cleDeLaStructure(liens)}] : saisie et IA`).toBe(propose)
      if (!propose) continue
      const suivante = [...liens, lien]
      const cle = cleDeLaStructure(suivante)
      if (!vues.has(cle)) {
        vues.set(cle, suivante)
        aVoir.push(suivante)
      }
    }
  }
  return vues
}

describe.each(GENRES)("règles de structure, toutes combinaisons : %s", genre => {
  const { activite, flux } = activiteDuGenre(genre)
  const deuxPersonnes = [...personnes(2), activite]
  // Deux personnes et les cinq rôles, permis ou non à cette forme : 1 024 structures, dont celles d'une ancienne sauvegarde.
  const toutes = parties(liensPossibles(2, ROLES))
  const constructibles = structuresConstructibles(deuxPersonnes, activite, liensPossibles(2, ROLES))

  it("la saisie et les IA proposent les mêmes relations, et ne laissent construire que des structures régulières", () => {
    expect(constructibles.size).toBeGreaterThan(1)
    for (const liens of constructibles.values()) {
      expect(anomaliesDeStructure({ entities: deuxPersonnes, relationships: relationsDe(liens) }, activite), cleDeLaStructure(liens)).toEqual([])
    }
  })

  it("toute structure que la saisie ne laisse pas construire est signalée, et seulement celles-là", () => {
    let irregulieres = 0
    for (const liens of toutes) {
      const anomalies = anomaliesDeStructure({ entities: deuxPersonnes, relationships: relationsDe(liens) }, activite)
      const constructible = constructibles.has(cleDeLaStructure(liens))
      // Les rôles hors saisie (salariés gardés d'un autre statut) ne se construisent pas à la main, sans être irréguliers.
      const horsSaisie = liens.some(lien => REGLES_DE_STRUCTURE[genre].roles[lien.role]?.horsSaisie)
      if (!constructible && !horsSaisie) expect(anomalies.length, `[${cleDeLaStructure(liens)}] n'est pas constructible : une anomalie attendue`).toBeGreaterThan(0)
      if (constructible) expect(anomalies, cleDeLaStructure(liens)).toEqual([])
      if (anomalies.length > 0) irregulieres++
    }
    expect(irregulieres).toBeGreaterThan(0)
  })

  it("le calcul reporte chaque anomalie sur la carte de l'activité, et n'en invente pas pour une structure régulière", () => {
    for (const liens of toutes) {
      const relationships = relationsDe(liens)
      const anomalies = anomaliesDeStructure({ entities: deuxPersonnes, relationships }, activite)
      const avertissements = runMetaSimulation(session(deuxPersonnes, relationships, flux), reglesDeTest).activities[0].warnings
      for (const anomalie of anomalies) expect(avertissements, cleDeLaStructure(liens)).toContain(anomalie)
      if (anomalies.length === 0) expect(avertissements.filter(a => /^Plusieurs relations|ce rôle n'existe pas|est à la fois/.test(a)), cleDeLaStructure(liens)).toEqual([])
    }
  })

  it("le calcul ne perd ni ne crée d'argent, et ne verse qu'à qui dirige l'activité ou en est associé", () => {
    const dirigent = rolesQui(genre, "dirige")
    const associes = rolesQui(genre, "associe")
    for (const liens of toutes) {
      const report = runMetaSimulation(session(deuxPersonnes, relationsDe(liens), flux), reglesDeTest)
      const verse = report.activities[0].revenuVerse
      const recu = report.persons.reduce((somme, p) => somme + p.revenusActivites, 0)
      expect(Math.abs(recu + report.bilan.nonRattache - verse), `[${cleDeLaStructure(liens)}] : ${recu} reçus, ${report.bilan.nonRattache} non rattachés, ${verse} versés`).toBeLessThanOrEqual(1)
      for (const p of report.persons) {
        const sesRoles = liens.filter(lien => lien.personne === p.entityId).map(lien => lien.role)
        const ayantDroit = sesRoles.some(role => dirigent.includes(role) || associes.includes(role))
        if (!ayantDroit) expect(p.revenusActivites, `[${cleDeLaStructure(liens)}] : ${p.entityId} ne dirige pas et n'est pas associé`).toBe(0)
      }
    }
  })

  it("dans une structure régulière, la rémunération va à qui dirige et les dividendes se partagent entre les associés", () => {
    if (genre !== "SASU" && genre !== "EURL") return
    const dirige = rolesQui(genre, "dirige")
    const associe = rolesQui(genre, "associe")
    for (const liens of constructibles.values()) {
      const report = runMetaSimulation(session(deuxPersonnes, relationsDe(liens), flux), reglesDeTest)
      const dirigeants = [...new Set(liens.filter(lien => dirige.includes(lien.role)).map(lien => lien.personne))]
      const lesAssocies = [...new Set(liens.filter(lien => associe.includes(lien.role)).map(lien => lien.personne))]
      const partage = report.activities[0].partage!
      for (const p of report.persons) {
        // La rémunération au premier dirigeant (un seul en SASU ; en EURL, l'avertissement dit qu'il y en a deux) ; les dividendes à parts égales.
        const remuneration = dirigeants[0] === p.entityId ? partage.remunerationNette : 0
        const dividendes = lesAssocies.includes(p.entityId) ? partage.dividendesNets / lesAssocies.length : 0
        expect(Math.abs(p.revenusActivites - remuneration - dividendes), `[${cleDeLaStructure(liens)}] : ${p.entityId}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it("à trois personnes, la saisie et les IA s'accordent encore, et rien de constructible n'est irrégulier", () => {
    const trois = [...personnes(3), activite]
    const structures = structuresConstructibles(trois, activite, liensPossibles(3, rolesDeLaStructure(genre)))
    for (const liens of structures.values()) expect(anomaliesDeStructure({ entities: trois, relationships: relationsDe(liens) }, activite), cleDeLaStructure(liens)).toEqual([])
    // Le maximum de chaque rôle tient aussi à trois : jamais plus de personnes que la table n'en admet.
    for (const role of rolesDeLaStructure(genre)) {
      const maximum = REGLES_DE_STRUCTURE[genre].roles[role]?.maximum?.nombre ?? 3
      const plusGrandNombre = Math.max(...[...structures.values()].map(liens => liens.filter(lien => lien.role === role).length))
      expect(plusGrandNombre, role).toBe(maximum)
    }
  })

  it("changer de statut une structure régulière en donne une autre régulière, quel que soit le statut d'arrivée", () => {
    if (activite.type === "portage") return
    const statuts: StatutDUneActivite[] = ["micro", "EI", "SASU", "EURL"]
    for (const liens of constructibles.values()) {
      const avant = { name: "Structure", entities: deuxPersonnes, relationships: relationsDe(liens), annees: [{ annee: 2026, monthlyData: session(deuxPersonnes, [], flux).monthlyData }] }
      for (const cible of statuts) {
        const { session: apres, activite: convertie } = changerLeStatut(avant, activite, cible)
        expect(genreDeStructure(convertie), cible).toBe(cible === "micro" ? "micro-entreprise" : cible)
        expect(anomaliesDeStructure(apres, convertie), `[${cleDeLaStructure(liens)}] en ${genre}, passé en ${cible}`).toEqual([])
      }
    }
  })

  it("chaque colonne du comparateur simule une structure régulière, où la personne principale garde ce qu'elle possédait", () => {
    if (activite.type === "portage") return
    for (const liens of constructibles.values()) {
      const annee = session(deuxPersonnes, relationsDe(liens), flux)
      for (const statut of STATUTS_COMPARES) {
        const convertie = convertirLActivite(annee, activite, statut)
        const colonne = convertie.entities.find(e => e.id === "a") as Activite
        expect(genreDeStructure(colonne), statut).toBe(genreDuStatut(statut))
        expect(anomaliesDeStructure(convertie, colonne), `[${cleDeLaStructure(liens)}] en ${genre}, colonne ${statut}`).toEqual([])
      }
    }
  })
})
