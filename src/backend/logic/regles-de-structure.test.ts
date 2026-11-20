// src/backend/logic/regles-de-structure.test.ts
// La table des règles de structure, telle qu'elle est décidée (ADR 018) : la changer est un acte délibéré, que ce test
// fait remarquer. Ses conséquences sur toutes les combinaisons de relations : src/lib/regles-de-structure.exhaustif.test.ts.

import { describe, expect, it } from "vitest"
import { anomaliesDeStructure, maximumDuRole, obstacleAuRole, phraseDeLObstacle, REGLES_DE_STRUCTURE, rolesDeLaStructure, rolesDeQuiExerce, rolesDisponibles, rolesQui, type GenreDeStructure } from "./regles-de-structure.js"
import { micro, personne, portage, relation, societe } from "./testing/session-de-test.js"

const GENRES = Object.keys(REGLES_DE_STRUCTURE) as GenreDeStructure[]

describe("table des règles de structure", () => {
  it("dit les rôles que la saisie propose pour chaque forme d'activité, dans l'ordre", () => {
    expect(Object.fromEntries(GENRES.map(genre => [genre, rolesDeLaStructure(genre)]))).toEqual({
      SASU: ["Président", "Associé", "Salarié"],
      EURL: ["Gérant", "Associé", "Salarié"],
      EI: ["Titulaire", "Salarié"],
      // Leurs salariés, gardés d'un autre statut, ne se proposent pas.
      "micro-entreprise": ["Titulaire"],
      portage: ["Titulaire"]
    })
  })

  it("dit qui dirige et qui est associé : le président de SASU n'est pas associé d'office, le gérant d'EURL l'est toujours", () => {
    expect(Object.fromEntries(GENRES.map(genre => [genre, { dirige: rolesQui(genre, "dirige"), associe: rolesQui(genre, "associe") }]))).toEqual({
      SASU: { dirige: ["Président"], associe: ["Associé"] },
      EURL: { dirige: ["Gérant"], associe: ["Gérant", "Associé"] },
      EI: { dirige: ["Titulaire"], associe: [] },
      "micro-entreprise": { dirige: ["Titulaire"], associe: [] },
      portage: { dirige: ["Titulaire"], associe: [] }
    })
  })

  it("un seul président de SASU, un seul titulaire ; une EURL peut avoir plusieurs gérants, une société plusieurs associés", () => {
    expect(maximumDuRole("SASU", "Président")).toBe(1)
    for (const genre of ["EI", "micro-entreprise", "portage"] as const) expect(maximumDuRole(genre, "Titulaire")).toBe(1)
    expect(maximumDuRole("EURL", "Gérant")).toBeUndefined()
    expect(maximumDuRole("SASU", "Associé")).toBeUndefined()
    expect(maximumDuRole("EURL", "Associé")).toBeUndefined()
    // Un rôle que la forme n'a pas n'a pas de maximum : c'est un rôle inconnu.
    expect(maximumDuRole("SASU", "Gérant")).toBeUndefined()
  })

  it("donne à qui exerce seul l'activité de quoi la diriger et, en société, en être l'associé", () => {
    expect(Object.fromEntries(GENRES.map(genre => [genre, rolesDeQuiExerce(genre)]))).toEqual({
      SASU: ["Président", "Associé"],
      EURL: ["Gérant"],
      EI: ["Titulaire"],
      "micro-entreprise": ["Titulaire"],
      portage: ["Titulaire"]
    })
  })
})

describe("obstacle à un rôle", () => {
  const sasu = societe("s", "SASU")
  const nomDe = (id: string) => ({ alice: "Alice", bob: "Bob" })[id] ?? id

  it("refuse un rôle que la forme n'a pas, en donnant ceux qu'elle a", () => {
    const obstacle = obstacleAuRole([], "alice", sasu, "Gérant")!
    expect(obstacle).toEqual({ genre: "inconnu", possibles: ["Président", "Associé", "Salarié"] })
    expect(phraseDeLObstacle(obstacle, "Gérant", "Alice", sasu, nomDe)).toBe("Relations possibles d'une personne vers « s » (SASU) : Président, Associé, Salarié.")
    // Le salarié d'une micro-entreprise ou d'un portage existe pour le calcul, pas pour la saisie.
    expect(obstacleAuRole([], "alice", micro("m"), "Salarié")).toEqual({ genre: "inconnu", possibles: ["Titulaire"] })
    expect(obstacleAuRole([], "alice", portage("p"), "Salarié")).toEqual({ genre: "inconnu", possibles: ["Titulaire"] })
  })

  it("refuse un second président, en disant qui l'est et pourquoi ; le président lui-même n'est pas un obstacle", () => {
    const relations = [relation("alice", "s", "Président")]
    const obstacle = obstacleAuRole(relations, "bob", sasu, "Président")!
    expect(obstacle).toEqual({ genre: "maximum", tenuPar: "alice", raison: "une SAS n'a qu'un président (article L227-6 du Code de commerce)" })
    expect(phraseDeLObstacle(obstacle, "Président", "Bob", sasu, nomDe)).toBe("« s » a déjà un président, « Alice » : une SAS n'a qu'un président (article L227-6 du Code de commerce). Supprimez d'abord cette relation pour en changer.")
    expect(obstacleAuRole(relations, "alice", sasu, "Président")).toBeNull()
    expect(obstacleAuRole(relations, "bob", sasu, "Associé")).toBeNull()
  })

  it("refuse de diriger l'activité dont on est salarié, et d'être salarié de celle qu'on dirige ; l'associé peut en être salarié", () => {
    const dirige = obstacleAuRole([relation("alice", "s", "Président")], "alice", sasu, "Salarié")!
    expect(phraseDeLObstacle(dirige, "Salarié", "Alice", sasu, nomDe)).toBe("« Alice » dirige déjà « s » : pas de relation « Salarié » en plus.")
    const salarie = obstacleAuRole([relation("s", "bob", "Salarié")], "bob", sasu, "Président")!
    expect(phraseDeLObstacle(salarie, "Président", "Bob", sasu, nomDe)).toBe("« Bob » est déjà salarié(e) de « s » : pas de relation de direction en plus.")
    expect(obstacleAuRole([relation("bob", "s", "Associé")], "bob", sasu, "Salarié")).toBeNull()
  })

  it("donne les rôles encore disponibles pour une personne", () => {
    expect(rolesDisponibles([], "alice", sasu)).toEqual(["Président", "Associé", "Salarié"])
    expect(rolesDisponibles([relation("alice", "s", "Président")], "alice", sasu)).toEqual(["Associé"])
    expect(rolesDisponibles([relation("alice", "s", "Président")], "bob", sasu)).toEqual(["Associé", "Salarié"])
    expect(rolesDisponibles([relation("alice", "m", "Titulaire")], "bob", micro("m"))).toEqual([])
  })
})

describe("anomalies d'une structure venue d'une ancienne sauvegarde", () => {
  const entities = [personne("alice"), personne("bob"), societe("s", "SASU"), micro("m")]

  it("rien à dire d'une structure régulière, ni des salariés qu'une micro-entreprise a gardés d'un autre statut", () => {
    expect(anomaliesDeStructure({ entities, relationships: [relation("alice", "s", "Président"), relation("alice", "s", "Associé"), relation("bob", "s", "Salarié")] }, societe("s", "SASU"))).toEqual([])
    expect(anomaliesDeStructure({ entities, relationships: [relation("alice", "m", "Titulaire"), relation("bob", "m", "Salarié")] }, micro("m"))).toEqual([])
  })

  it("dit le rôle inconnu, le rôle tenu par trop de personnes, et le cumul de la direction et du salariat", () => {
    const relationships = [relation("alice", "s", "Président"), relation("bob", "s", "Président"), relation("bob", "s", "Salarié"), relation("alice", "s", "Titulaire")]
    expect(anomaliesDeStructure({ entities, relationships }, societe("s", "SASU"))).toEqual([
      "Plusieurs relations « Président » (« alice », « bob ») : une SAS n'a qu'un président (article L227-6 du Code de commerce). Le calcul ne retient que « alice » ; supprimez les autres.",
      "« bob » est à la fois président et salarié de « s » : on ne dirige pas l'activité dont on est salarié. Supprimez l'une des deux relations.",
      "Relation « Titulaire » de « alice » : ce rôle n'existe pas pour une SASU, le calcul l'ignore. Remplacez-la par l'une de celles-ci : Président, Associé, Salarié."
    ])
  })

  it("ignore une relation vers autre chose qu'une personne", () => {
    expect(anomaliesDeStructure({ entities, relationships: [relation("m", "s", "Président"), relation("fantome", "s", "Président")] }, societe("s", "SASU"))).toEqual([])
  })
})
