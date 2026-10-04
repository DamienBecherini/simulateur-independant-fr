// src/backend/logic/migrations.test.ts

import { describe, expect, it } from "vitest"
import { sanitizeSlots, sanitizeStateAndFillDefaults } from "./data-sanitizer.js"
import { FORMAT_VERSION_ACTUEL, migrerVersFormatActuel, versionDuFormat } from "./migrations.js"

const avatar = { type: "initials", value: "AB", color: "#3b82f6" }
const alice = { id: "p1", type: "person", name: "Alice", fiscalParts: 1, avatar, locked: false }
const enfant = { id: "p2", type: "person", name: "Léo", fiscalParts: 1, avatar, locked: false }
const sasu = { id: "c1", type: "company", name: "Ma SASU", legalStatus: "SASU", avatar, locked: false }
const eurl = { id: "c2", type: "company", name: "Mon EURL", legalStatus: "EURL", avatar, locked: false }
const ei = { id: "c3", type: "company", name: "Mon EI", legalStatus: "EI", avatar, locked: false }

function grille(fluxDeJanvier: unknown[] = []) {
  return Array.from({ length: 12 }, (_, month) => ({ month, flows: month === 0 ? fluxDeJanvier : [] }))
}

/** Une session écrite avant le versionnage : aucun numéro de format. */
function ancienneSession(contenu: Record<string, unknown> = {}) {
  return { name: "Ancienne", entities: [], relationships: [], monthlyData: grille(), ...contenu }
}

describe("versionDuFormat", () => {
  it("lit le numéro de format d'un fichier", () => {
    expect(versionDuFormat({ formatVersion: 2 })).toBe(2)
    expect(versionDuFormat({ formatVersion: 7 })).toBe(7)
  })

  it("considère un fichier sans numéro, ou avec un numéro invalide, comme la version 1", () => {
    for (const donnees of [{}, { formatVersion: "2" }, { formatVersion: 0 }, { formatVersion: 1.5 }, null, [], "texte"]) {
      expect(versionDuFormat(donnees)).toBe(1)
    }
  })
})

describe("migrerVersFormatActuel", () => {
  it("marque le fichier du numéro de format actuel", () => {
    const { donnees, versionOrigine } = migrerVersFormatActuel(ancienneSession())

    expect(versionOrigine).toBe(1)
    expect(donnees).toMatchObject({ formatVersion: FORMAT_VERSION_ACTUEL, name: "Ancienne" })
  })

  it("laisse un fichier déjà au format actuel sans note", () => {
    const fichier = { ...ancienneSession({ entities: [alice, sasu] }), formatVersion: FORMAT_VERSION_ACTUEL }

    expect(migrerVersFormatActuel(fichier)).toEqual({ donnees: fichier, versionOrigine: FORMAT_VERSION_ACTUEL, notes: [] })
  })

  it("rend telles quelles des données qui ne sont pas un objet", () => {
    expect(migrerVersFormatActuel(null)).toEqual({ donnees: null, versionOrigine: 1, notes: [] })
    expect(migrerVersFormatActuel([1, 2])).toEqual({ donnees: [1, 2], versionOrigine: 1, notes: [] })
  })

  it("prévient sans rien modifier quand le fichier vient d'une version plus récente", () => {
    const fichier = { ...ancienneSession(), formatVersion: FORMAT_VERSION_ACTUEL + 1 }

    const resultat = migrerVersFormatActuel(fichier)

    expect(resultat.donnees).toBe(fichier)
    expect(resultat.notes).toHaveLength(1)
    expect(resultat.notes[0]).toContain("version plus récente")
  })

  describe("version 1 → 2", () => {
    it("ne signale rien pour une session sans société ni relation « Enfant »", () => {
      expect(migrerVersFormatActuel(ancienneSession({ entities: [alice] })).notes).toEqual([])
    })

    it("signale les relations « Enfant » à vérifier, avec leur nombre", () => {
      const relations = [
        { id: "r1", fromId: "p1", toId: "p2", type: "Enfant" },
        { id: "r2", fromId: "p2", toId: "p1", type: "Enfant" }
      ]

      const { notes } = migrerVersFormatActuel(ancienneSession({ entities: [alice, enfant], relationships: relations }))

      expect(notes).toHaveLength(1)
      expect(notes[0]).toMatch(/^2 relations « Enfant »/)
    })

    it("signale qu'une SASU ou une EURL sans dividendes saisis ne distribue plus rien", () => {
      const { notes } = migrerVersFormatActuel(ancienneSession({ entities: [alice, sasu] }))

      expect(notes).toEqual([expect.stringContaining("dividendes ne sont plus déduits d'office")])
    })

    it("ne le signale pas quand chaque société a des dividendes saisis", () => {
      const flux = [{ id: "f1", label: "Dividendes", amount: 5000, entityId: "c1", type: "dividends_payment" }]

      expect(migrerVersFormatActuel(ancienneSession({ entities: [alice, sasu], monthlyData: grille(flux) })).notes).toEqual([])
    })

    it("ne le signale pas pour une entreprise individuelle, qui ne verse pas de dividendes", () => {
      expect(migrerVersFormatActuel(ancienneSession({ entities: [alice, ei] })).notes).toEqual([])
    })

    it("invite à renseigner le capital social d'une EURL", () => {
      const { notes } = migrerVersFormatActuel(ancienneSession({ entities: [eurl] }))

      expect(notes).toHaveLength(2)
      expect(notes[1]).toContain("capital social des EURL")
    })

    it("reste défensive face à des listes absentes ou malformées", () => {
      const { notes, donnees } = migrerVersFormatActuel({ entities: "rien", relationships: [null, 3], monthlyData: [{ flows: "aucun" }, null] })

      expect(notes).toEqual([])
      expect(donnees).toMatchObject({ formatVersion: FORMAT_VERSION_ACTUEL })
    })
  })
})

describe("migration au chargement", () => {
  it("transmet les notes de conversion dans le rapport de nettoyage", () => {
    const { safeState, report } = sanitizeStateAndFillDefaults(ancienneSession({ entities: [alice, eurl] }))

    expect(report.migrationNotes).toHaveLength(2)
    expect(safeState.entities[1]).toMatchObject({ id: "c2", capitalSocial: 1000 })
  })

  it("ne garde pas le numéro de format dans la session : il appartient au fichier", () => {
    const { safeState, report } = sanitizeStateAndFillDefaults({ ...ancienneSession(), formatVersion: FORMAT_VERSION_ACTUEL })

    expect(safeState).not.toHaveProperty("formatVersion")
    expect(report.migrationNotes).toEqual([])
  })

  it("convertit chaque sauvegarde selon son propre format", () => {
    const ancienne = { ...ancienneSession({ entities: [eurl] }), id: "s1", lastModified: 1 }
    const recente = { ...ancienneSession({ entities: [eurl] }), id: "s2", lastModified: 2, formatVersion: FORMAT_VERSION_ACTUEL }

    const slots = sanitizeSlots([ancienne, recente])

    expect(slots.map(s => s.id)).toEqual(["s1", "s2"])
    expect(slots.every(s => !("formatVersion" in s))).toBe(true)
  })
})
