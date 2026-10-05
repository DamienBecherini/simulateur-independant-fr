// src/backend/logic/sauvegardes-groupees.test.ts

import { describe, expect, it, vi } from "vitest"
import type { SaveSlot } from "../../types.js"
import { FORMAT_VERSION_ACTUEL } from "./migrations.js"
import { TYPE_FICHIER_SAUVEGARDES, construireFichierSauvegardes, fusionnerSauvegardes, lireFichierSauvegardes, nomFichierSauvegardes } from "./sauvegardes-groupees.js"

const avatar = { type: "initials" as const, value: "AB", color: "#3b82f6" }

function grille(): SaveSlot["annees"][number]["monthlyData"] {
  return Array.from({ length: 12 }, (_, month) => ({ month, flows: [] }))
}

/** Une sauvegarde valide, avec une personne. */
function sauvegarde(id: string, name: string, contenu: Partial<SaveSlot> = {}): SaveSlot {
  return {
    id,
    name,
    lastModified: Date.UTC(2026, 8, 1),
    entities: [{ id: `${id}-p`, type: "person", name: `Personne de ${name}`, fiscalParts: 1, avatar, locked: false }],
    relationships: [],
    annees: [{ annee: 2026, monthlyData: grille() }],
    ...contenu
  }
}

/** Contenu d'un fichier de sauvegardes, écrit à la main. */
function fichier(slots: unknown[], autres: Record<string, unknown> = {}): string {
  return JSON.stringify({ formatVersion: FORMAT_VERSION_ACTUEL, type: TYPE_FICHIER_SAUVEGARDES, exportedAt: "2026-10-04T08:00:00.000Z", slots, slotOrder: [], ...autres })
}

function lireAvecSucces(contenu: string) {
  const resultat = lireFichierSauvegardes(contenu)
  if (!resultat.ok) throw new Error(`Lecture refusée : ${resultat.erreur}`)
  return resultat
}

describe("construireFichierSauvegardes", () => {
  it("rassemble les sauvegardes dans leur ordre d'affichage, marquées du format actuel", () => {
    const a = sauvegarde("a", "Alpha")
    const b = sauvegarde("b", "Bravo")
    const c = sauvegarde("c", "Charlie")

    const resultat = construireFichierSauvegardes([a, b, c], ["c", "a", "b"], new Date("2026-10-04T08:00:00.000Z"))

    expect(resultat).toEqual({
      formatVersion: FORMAT_VERSION_ACTUEL,
      type: TYPE_FICHIER_SAUVEGARDES,
      exportedAt: "2026-10-04T08:00:00.000Z",
      slots: [c, a, b].map(slot => ({ ...slot, formatVersion: FORMAT_VERSION_ACTUEL })),
      slotOrder: ["c", "a", "b"]
    })
  })

  it("n'oublie aucune sauvegarde absente de l'ordre, et ignore les identifiants d'ordre sans sauvegarde", () => {
    const a = sauvegarde("a", "Alpha")
    const b = sauvegarde("b", "Bravo")

    const resultat = construireFichierSauvegardes([a, b], ["fantome", "b", "b"])

    expect(resultat.slotOrder).toEqual(["b", "a"])
    expect(resultat.slots.map(slot => slot.id)).toEqual(["b", "a"])
  })

  it("se relit à l'identique", () => {
    const slots = [sauvegarde("a", "Alpha"), sauvegarde("b", "Bravo")]
    const relu = lireAvecSucces(JSON.stringify(construireFichierSauvegardes(slots, ["b", "a"])))

    expect(relu.slots).toEqual([slots[1], slots[0]])
    expect(relu.rapport).toEqual({ lues: 2, ecartees: 0, refusees: [], notesMigration: [] })
  })
})

describe("nomFichierSauvegardes", () => {
  it("date le fichier du jour, en heure locale", () => {
    expect(nomFichierSauvegardes(new Date(2026, 9, 4, 23, 30))).toBe("sauvegardes-simulateur-2026-10-04.json")
    expect(nomFichierSauvegardes(new Date(2027, 0, 9))).toBe("sauvegardes-simulateur-2027-01-09.json")
  })

  it("prend la date du jour par défaut", () => {
    expect(nomFichierSauvegardes()).toMatch(/^sauvegardes-simulateur-\d{4}-\d{2}-\d{2}\.json$/)
  })
})

describe("lireFichierSauvegardes", () => {
  it("refuse un contenu qui n'est pas du JSON", () => {
    expect(lireFichierSauvegardes("{ pas du json")).toEqual({ ok: false, erreur: expect.stringContaining("pas un fichier JSON valide") })
  })

  it("refuse un JSON sans rapport avec le simulateur", () => {
    for (const contenu of ["[]", "42", "null", JSON.stringify({ nom: "autre chose" }), JSON.stringify({ type: "autre", slots: [] })]) {
      expect(lireFichierSauvegardes(contenu)).toEqual({ ok: false, erreur: "Ce fichier n'est pas un export de sauvegardes du simulateur." })
    }
  })

  it("reconnaît l'export d'une simulation seule et renvoie vers l'import d'une simulation", () => {
    const simulationSeule = { ...sauvegarde("a", "Alpha"), formatVersion: FORMAT_VERSION_ACTUEL }
    const resultat = lireFichierSauvegardes(JSON.stringify(simulationSeule))

    expect(resultat).toEqual({ ok: false, erreur: expect.stringContaining("une seule simulation") })
    expect(resultat).toEqual({ ok: false, erreur: expect.stringContaining("« Importer une simulation... »") })
  })

  it("refuse un fichier de sauvegardes sans liste de sauvegardes", () => {
    expect(lireFichierSauvegardes(JSON.stringify({ type: TYPE_FICHIER_SAUVEGARDES, formatVersion: 2 }))).toEqual({ ok: false, erreur: expect.stringContaining("incomplet") })
  })

  it("lit un fichier vide de sauvegardes", () => {
    expect(lireAvecSucces(fichier([]))).toEqual({ ok: true, slots: [], rapport: { lues: 0, ecartees: 0, refusees: [], notesMigration: [] } })
  })

  it("écarte une sauvegarde corrompue sans perdre les autres", () => {
    const a = sauvegarde("a", "Alpha")
    const b = sauvegarde("b", "Bravo")
    const sansIdentifiant = { ...sauvegarde("x", "Sans identifiant"), id: undefined }
    const grilleCassee = { ...sauvegarde("y", "Grille cassée"), annees: [{ annee: 2026, monthlyData: "illisible" }] }

    const resultat = lireAvecSucces(fichier([a, sansIdentifiant, "texte", grilleCassee, b]))

    expect(resultat.slots).toEqual([a, b])
    expect(resultat.rapport).toEqual({ lues: 2, ecartees: 3, refusees: [], notesMigration: [] })
  })

  it("lit un fichier dont la seule sauvegarde est corrompue : rien à ajouter, une sauvegarde écartée", () => {
    const resultat = lireAvecSucces(fichier([{ ...sauvegarde("x", "Cassée"), entities: "illisible" }], { slotOrder: ["x"] }))

    expect(resultat).toEqual({ ok: true, slots: [], rapport: { lues: 0, ecartees: 1, refusees: [], notesMigration: [] } })
  })

  it("écarte une année en double d'une sauvegarde écrite à la main, et trie les années", () => {
    const a = sauvegarde("a", "Alpha", { annees: [{ annee: 2026, monthlyData: grille() }, { annee: 2025, monthlyData: grille() }, { annee: 2026, monthlyData: grille() }] })

    expect(lireAvecSucces(fichier([a])).slots[0].annees.map(annee => annee.annee)).toEqual([2025, 2026])
  })

  it("refuse une sauvegarde aux années trop nombreuses ou non consécutives, la nomme et dit pourquoi, sans perdre les autres", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const a = sauvegarde("a", "Alpha")
    const trouee = sauvegarde("t", "Trouée", { annees: [2024, 2027].map(annee => ({ annee, monthlyData: grille() })) })
    const onzeAnnees = sauvegarde("o", "Onze ans", { annees: Array.from({ length: 11 }, (_, i) => ({ annee: 2024 + i, monthlyData: grille() })) })

    const resultat = lireAvecSucces(fichier([a, trouee, onzeAnnees, "texte"]))

    expect(resultat.slots).toEqual([a])
    expect(resultat.rapport).toEqual({
      lues: 1,
      ecartees: 1,
      refusees: [
        { nom: "Trouée", raison: expect.stringContaining("il manque 2025 et 2026 entre 2024 et 2027") },
        { nom: "Onze ans", raison: expect.stringContaining("11 années, de 2024 à 2034") }
      ],
      notesMigration: []
    })
  })

  it("nettoie l'intérieur de chaque sauvegarde (flux orphelin retiré)", () => {
    const a = sauvegarde("a", "Alpha")
    const fluxOrphelin = { id: "f1", label: "Orphelin", amount: 100, entityId: "inconnu", type: "salary" }
    const grilleAvecOrphelin = grille().map(mois => (mois.month === 0 ? { ...mois, flows: [fluxOrphelin] } : mois))

    const resultat = lireAvecSucces(fichier([{ ...a, annees: [{ annee: 2026, monthlyData: grilleAvecOrphelin }] }]))

    expect(resultat.slots).toEqual([a])
  })

  it("convertit au format actuel une sauvegarde d'un format précédent et rapporte les points à vérifier, sans doublon", () => {
    const relation = { id: "r1", fromId: "a-p", toId: "a-p2", type: "Enfant" }
    const enfant = { id: "a-p2", type: "person", name: "Léo", fiscalParts: 1, avatar, locked: false }
    const ancienne = sauvegarde("a", "Ancienne")
    const ancienneBrute = { ...ancienne, entities: [...ancienne.entities, enfant], relationships: [relation], formatVersion: 1 }
    const autreAncienne = { ...ancienneBrute, id: "b", name: "Autre ancienne" }

    const resultat = lireAvecSucces(fichier([ancienneBrute, autreAncienne, sauvegarde("c", "Actuelle")]))

    expect(resultat.slots.map(slot => slot.id)).toEqual(["a", "b", "c"])
    expect(resultat.slots[0].relationships).toEqual([relation])
    expect(resultat.rapport.lues).toBe(3)
    expect(resultat.rapport.notesMigration).toHaveLength(1)
    expect(resultat.rapport.notesMigration[0]).toContain("relation « Enfant »")
  })

  it("applique le numéro de format du fichier aux sauvegardes qui n'en portent pas", () => {
    const relation = { id: "r1", fromId: "a-p", toId: "a-p", type: "Enfant" }
    const sansNumero = { ...sauvegarde("a", "Alpha"), relationships: [relation] }

    expect(lireAvecSucces(fichier([sansNumero])).rapport.notesMigration).toEqual([])
    expect(lireAvecSucces(fichier([sansNumero], { formatVersion: 1 })).rapport.notesMigration).toEqual([expect.stringContaining("relation « Enfant »")])
  })

  it("ne rapporte pas les points à vérifier d'une sauvegarde écartée", () => {
    const relation = { id: "r1", fromId: "a-p", toId: "a-p", type: "Enfant" }
    const ancienneCorrompue = { ...sauvegarde("a", "Alpha"), relationships: [relation], lastModified: "hier", formatVersion: 1 }

    expect(lireAvecSucces(fichier([ancienneCorrompue])).rapport).toEqual({ lues: 0, ecartees: 1, refusees: [], notesMigration: [] })
  })

  it("importe un fichier de sauvegardes au format 2 : chaque grille devient l'année 2026", () => {
    const fluxDeJanvier = { id: "f1", label: "Salaire", amount: 2000, entityId: "a-p", type: "salary" }
    const ancienneGrille = grille().map(mois => (mois.month === 0 ? { ...mois, flows: [fluxDeJanvier] } : mois))
    const a: Partial<SaveSlot> = sauvegarde("a", "Alpha")
    delete a.annees
    const b: Partial<SaveSlot> = sauvegarde("b", "Bravo")
    delete b.annees
    const contenu = JSON.stringify({ formatVersion: 2, type: TYPE_FICHIER_SAUVEGARDES, exportedAt: "2026-09-01T08:00:00.000Z", slots: [{ ...a, monthlyData: ancienneGrille }, { ...b, monthlyData: grille() }], slotOrder: ["b", "a"] })

    const resultat = lireAvecSucces(contenu)

    expect(resultat.slots.map(slot => slot.id)).toEqual(["b", "a"])
    expect(resultat.slots.map(slot => slot.annees.map(x => x.annee))).toEqual([[2026], [2026]])
    expect(resultat.slots[1].annees[0].monthlyData[0].flows).toEqual([fluxDeJanvier])
    expect(resultat.slots[1]).not.toHaveProperty("monthlyData")
    // La même note pour les deux sauvegardes : elle n'est rapportée qu'une fois.
    expect(resultat.rapport.notesMigration).toEqual([expect.stringContaining("placée en 2026")])
  })

  it("signale une sauvegarde d'un format plus récent", () => {
    const resultat = lireAvecSucces(fichier([{ ...sauvegarde("a", "Alpha"), formatVersion: FORMAT_VERSION_ACTUEL + 1 }]))

    expect(resultat.slots).toHaveLength(1)
    expect(resultat.rapport.notesMigration).toEqual([expect.stringContaining("version plus récente")])
  })

  it("remet les sauvegardes dans l'ordre d'affichage du fichier", () => {
    const [a, b, c] = [sauvegarde("a", "Alpha"), sauvegarde("b", "Bravo"), sauvegarde("c", "Charlie")]

    expect(lireAvecSucces(fichier([a, b, c], { slotOrder: ["c", "a"] })).slots).toEqual([c, a, b])
    expect(lireAvecSucces(fichier([a, b, c], { slotOrder: "illisible" })).slots).toEqual([a, b, c])
    expect(lireAvecSucces(fichier([a, b, c], { slotOrder: [42, "b"] })).slots).toEqual([b, a, c])
  })
})

describe("fusionnerSauvegardes", () => {
  const creerId = () => "nouvel-id"

  it("ajoute les nouvelles sauvegardes après les existantes, dans l'ordre du fichier", () => {
    const a = sauvegarde("a", "Alpha")
    const [b, c] = [sauvegarde("b", "Bravo"), sauvegarde("c", "Charlie")]

    const resultat = fusionnerSauvegardes([a], ["a"], [c, b], creerId)

    expect(resultat.slots).toEqual([a, c, b])
    expect(resultat.slotOrder).toEqual(["a", "c", "b"])
    expect(resultat.rapport).toEqual({ ajoutees: 2, doublons: 0, renommees: [] })
  })

  it("ignore une sauvegarde déjà présente à l'identique, même si sa date ou l'ordre de ses clés diffère", () => {
    const a = sauvegarde("a", "Alpha")
    const memeContenu = { lastModified: Date.UTC(2026, 9, 1), annees: a.annees, relationships: [], entities: a.entities, name: "Alpha", id: "a" }

    const resultat = fusionnerSauvegardes([a], ["a"], [memeContenu], creerId)

    expect(resultat.slots).toEqual([a])
    expect(resultat.slotOrder).toEqual(["a"])
    expect(resultat.rapport).toEqual({ ajoutees: 0, doublons: 1, renommees: [] })
  })

  it("importe en copie renommée une sauvegarde de même identifiant mais au contenu différent", () => {
    const a = sauvegarde("a", "Alpha")
    const modifiee = sauvegarde("a", "Alpha", { relationships: [], entities: [] })

    const resultat = fusionnerSauvegardes([a], ["a"], [modifiee], creerId)

    expect(resultat.slots).toEqual([a, { ...modifiee, id: "nouvel-id", name: "Alpha (importée)" }])
    expect(resultat.slotOrder).toEqual(["a", "nouvel-id"])
    expect(resultat.rapport).toEqual({ ajoutees: 1, doublons: 0, renommees: [{ ancienNom: "Alpha", nouveauNom: "Alpha (importée)" }] })
  })

  it("renomme aussi une copie de même identifiant dont le nom a changé", () => {
    const a = sauvegarde("a", "Alpha")
    const renommee = sauvegarde("a", "Alpha v2")

    const resultat = fusionnerSauvegardes([a], ["a"], [renommee], creerId)

    expect(resultat.slots[1]).toEqual({ ...renommee, id: "nouvel-id", name: "Alpha v2 (importée)" })
  })

  it("renomme une sauvegarde de même nom, en gardant son identifiant", () => {
    const a = sauvegarde("a", "Alpha")
    const homonyme = sauvegarde("b", "Alpha")

    const resultat = fusionnerSauvegardes([a], ["a"], [homonyme], creerId)

    expect(resultat.slots).toEqual([a, { ...homonyme, name: "Alpha (importée)" }])
    expect(resultat.slotOrder).toEqual(["a", "b"])
    expect(resultat.rapport.renommees).toEqual([{ ancienNom: "Alpha", nouveauNom: "Alpha (importée)" }])
  })

  it("numérote les copies quand le nom suffixé est déjà pris", () => {
    const existantes = [sauvegarde("a", "Alpha"), sauvegarde("b", "Alpha (importée)")]
    const homonymes = [sauvegarde("c", "Alpha"), sauvegarde("d", "Alpha")]

    const resultat = fusionnerSauvegardes(existantes, ["a", "b"], homonymes, creerId)

    expect(resultat.slots.map(slot => slot.name)).toEqual(["Alpha", "Alpha (importée)", "Alpha (importée 2)", "Alpha (importée 3)"])
    expect(resultat.rapport.ajoutees).toBe(2)
  })

  it("traite les sauvegardes du fichier qui se répètent comme des doublons", () => {
    const a = sauvegarde("a", "Alpha")

    const resultat = fusionnerSauvegardes([], [], [a, a], creerId)

    expect(resultat.slots).toEqual([a])
    expect(resultat.rapport).toEqual({ ajoutees: 1, doublons: 1, renommees: [] })
  })

  it("réimporter le fichier qu'on vient d'importer n'ajoute rien : tout est doublon", () => {
    const existantes = [sauvegarde("a", "Alpha")]
    const contenu = JSON.stringify(construireFichierSauvegardes([sauvegarde("b", "Bravo"), sauvegarde("c", "Charlie")], ["b", "c"]))

    const premier = fusionnerSauvegardes(existantes, ["a"], lireAvecSucces(contenu).slots, creerId)
    const second = fusionnerSauvegardes(premier.slots, premier.slotOrder, lireAvecSucces(contenu).slots, creerId)

    expect(premier.rapport).toEqual({ ajoutees: 2, doublons: 0, renommees: [] })
    expect(second.rapport).toEqual({ ajoutees: 0, doublons: 2, renommees: [] })
    expect(second.slots).toEqual(premier.slots)
    expect(second.slotOrder).toEqual(["a", "b", "c"])
  })

  it("réimporter son propre export, sauvegardes inchangées, n'ajoute rien non plus", () => {
    const existantes = [sauvegarde("a", "Alpha"), sauvegarde("b", "Alpha (importée)")]
    const contenu = JSON.stringify(construireFichierSauvegardes(existantes, ["a", "b"]))

    expect(fusionnerSauvegardes(existantes, ["a", "b"], lireAvecSucces(contenu).slots, creerId).rapport).toEqual({ ajoutees: 0, doublons: 2, renommees: [] })
  })

  it("renomme sans écraser une sauvegarde déjà suffixée « (importée) » quand ce nom est pris", () => {
    // Le suffixe s'ajoute au nom tel qu'il est : aucun nom existant n'est réutilisé.
    const existantes = [sauvegarde("a", "Alpha (importée)")]
    const homonyme = sauvegarde("b", "Alpha (importée)")

    const resultat = fusionnerSauvegardes(existantes, ["a"], [homonyme, { ...homonyme, id: "c" }], creerId)

    expect(resultat.slots.map(slot => slot.name)).toEqual(["Alpha (importée)", "Alpha (importée) (importée)", "Alpha (importée) (importée 2)"])
    expect(new Set(resultat.slots.map(slot => slot.id)).size).toBe(3)
    expect(resultat.rapport.renommees).toEqual([
      { ancienNom: "Alpha (importée)", nouveauNom: "Alpha (importée) (importée)" },
      { ancienNom: "Alpha (importée)", nouveauNom: "Alpha (importée) (importée 2)" }
    ])
  })

  it("n'ajoute rien et ne touche à rien pour un fichier vide", () => {
    const existantes = [sauvegarde("a", "Alpha")]

    expect(fusionnerSauvegardes(existantes, ["a"], [], creerId)).toEqual({ slots: existantes, slotOrder: ["a"], rapport: { ajoutees: 0, doublons: 0, renommees: [] } })
  })

  it("garde l'ordre existant tel quel et ne modifie pas les listes reçues", () => {
    const existantes = [sauvegarde("a", "Alpha")]
    const ordre = ["a", "ancien"]
    const importees = [sauvegarde("b", "Bravo")]

    const resultat = fusionnerSauvegardes(existantes, ordre, importees, creerId)

    expect(resultat.slotOrder).toEqual(["a", "ancien", "b"])
    expect(existantes).toHaveLength(1)
    expect(ordre).toEqual(["a", "ancien"])
  })

  it("génère par défaut un identifiant unique de sauvegarde", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("0000-1111-2222-3333-4444")
    const a = sauvegarde("a", "Alpha")

    const resultat = fusionnerSauvegardes([a], ["a"], [sauvegarde("a", "Autre")])

    expect(resultat.slots[1].id).toBe("slot-0000-1111-2222-3333-4444")
    vi.restoreAllMocks()
  })
})
