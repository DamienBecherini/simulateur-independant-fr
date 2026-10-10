// @vitest-environment jsdom
// src/web/rien-ne-se-perd.test.ts
// « Rien ne se perd » : une session qui remplit chaque champ du schéma revient à l'identique de chaque enregistrement
// et de chaque relecture : nettoyage, fichiers de l'application de bureau, stockage de la démo web, sauvegardes
// groupées, export puis import d'un fichier.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { z } from "zod"
import { SaveSlotSchema, SessionStateSchema, UserPreferencesSchema, type SaveSlot } from "@/types"
import { rapportAvecCorrections, sanitizeSlots, sanitizeStateAndFillDefaults } from "@/backend/logic/data-sanitizer"
import { contenuDesSauvegardes, contenuDuFichier, lireLaSession, lireLesPreferences, lireLesSauvegardes, lireUneSimulationImportee, sauvegardesAEcrire } from "@/backend/logic/fichiers-de-donnees"
import { FORMAT_VERSION_ACTUEL } from "@/backend/logic/migrations"
import { construireFichierSauvegardes, fusionnerSauvegardes, lireFichierSauvegardes } from "@/backend/logic/sauvegardes-groupees"
import { contenuDeLaSession, createNewSlotFromSession, updateSlotWithSession } from "@/lib/session-service"
import { preferencesMaximales, sauvegardeMaximale, sessionMaximale } from "@/lib/testing/session-maximale"
import { AFFICHAGES } from "@/lib/affichage"
import { VERSION_DE_L_APPLICATION } from "@/lib/version"
import { creerApiNavigateur } from "./api-navigateur"

// --- Garde : chaque champ du schéma est rempli dans la session maximale ---

/** Le strict nécessaire de la définition d'un schéma Zod pour le parcourir. */
interface Definition {
  type: string
  innerType?: z.ZodType
  out?: z.ZodType
  shape?: Record<string, z.ZodType>
  element?: z.ZodType
  valueType?: z.ZodType
  options?: z.ZodType[]
  entries?: Record<string, string>
}

const definition = (schema: z.ZodType) => (schema as unknown as { def: Definition }).def
const estObjet = (valeur: unknown): valeur is Record<string, unknown> => typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)

/** Ce que le parcours relève : champs absents partout, et, par chemin, les valeurs possibles et celles rencontrées. */
interface Releve {
  manques: string[]
  possibles: Map<string, unknown[]>
  vues: Map<string, Set<unknown>>
}

/** Note les valeurs rencontrées à un chemin, parmi celles qu'il peut prendre (toutes variantes d'union confondues). */
function noterValeurs(releve: Releve, chemin: string, possibles: unknown[], valeurs: unknown[]) {
  releve.possibles.set(chemin, possibles)
  const vues = releve.vues.get(chemin) ?? new Set()
  valeurs.forEach(valeur => vues.add(valeur))
  releve.vues.set(chemin, vues)
}

/** Chaque champ d'un objet : absent de toutes les valeurs, il est relevé ; sinon on parcourt ses valeurs. */
function parcourirLesChamps(shape: Record<string, z.ZodType>, valeurs: unknown[], chemin: string, releve: Releve): void {
  for (const [cle, champ] of Object.entries(shape)) {
    const sous = valeurs.filter(estObjet).map(v => v[cle]).filter(v => v !== undefined)
    if (sous.length === 0) releve.manques.push(`${chemin}.${cle}`)
    else parcourir(champ, sous, `${chemin}.${cle}`, releve)
  }
}

/** Chaque variante d'une union : sans exemple parmi les valeurs, elle est relevée ; sinon on parcourt ses exemples. */
function parcourirLesVariantes(options: z.ZodType[], valeurs: unknown[], chemin: string, releve: Releve): void {
  options.forEach((option, i) => {
    const exemples = valeurs.filter(v => option.safeParse(v).success)
    if (exemples.length === 0) releve.manques.push(`${chemin}|variante ${i}`)
    else parcourir(option, exemples, chemin, releve)
  })
}

function parcourir(schema: z.ZodType, valeurs: unknown[], chemin: string, releve: Releve): void {
  const def = definition(schema)
  switch (def.type) {
    case "optional":
    case "default":
    case "catch":
      return parcourir(def.innerType!, valeurs.filter(v => v !== undefined), chemin, releve)
    case "pipe":
      return parcourir(def.out!, valeurs, chemin, releve)
    case "object":
      return parcourirLesChamps(def.shape!, valeurs, chemin, releve)
    case "array":
      return parcourir(def.element!, valeurs.flat(), `${chemin}[]`, releve)
    case "record":
      return parcourir(def.valueType!, valeurs.filter(estObjet).flatMap(v => Object.values(v)), `${chemin}{}`, releve)
    case "union":
      return parcourirLesVariantes(def.options!, valeurs, chemin, releve)
    case "enum":
      return noterValeurs(releve, chemin, Object.values(def.entries!), valeurs)
    case "boolean":
      return noterValeurs(releve, chemin, [true, false], valeurs)
  }
}

/**
 * Les champs du schéma qu'aucune des valeurs ne remplit : un champ d'objet absent partout, une variante d'union sans
 * exemple, une valeur d'énumération jamais prise, un booléen jamais vrai ou jamais faux (à ce chemin, toutes
 * variantes confondues : une puissance fiscale prise par un trajet d'une personne ou par les déplacements d'une activité).
 */
function champsNonRemplis(schema: z.ZodType, valeurs: unknown[], chemin: string): string[] {
  const releve: Releve = { manques: [], possibles: new Map(), vues: new Map() }
  parcourir(schema, valeurs, chemin, releve)
  const valeursJamaisPrises = [...releve.possibles].flatMap(([ou, possibles]) => possibles.filter(valeur => !releve.vues.get(ou)?.has(valeur)).map(valeur => `${ou}=${String(valeur)}`))
  return [...releve.manques, ...valeursJamaisPrises]
}

describe("la session maximale", () => {
  it("remplit chaque champ du schéma, chaque type et chaque option : un champ ajouté au schéma doit y être ajouté", () => {
    expect(champsNonRemplis(SessionStateSchema, [sessionMaximale()], "session")).toEqual([])
    expect(champsNonRemplis(SaveSlotSchema, [sauvegardeMaximale()], "sauvegarde")).toEqual([])
    // Un affichage n'est choisi qu'à la fois : les autres sont pris par des préférences qui ne diffèrent que par lui.
    const autresAffichages = AFFICHAGES.map(({ valeur }) => ({ ...preferencesMaximales(), affichage: valeur }))
    expect(champsNonRemplis(UserPreferencesSchema, [preferencesMaximales(), ...autresAffichages], "préférences")).toEqual([])
  })

  it("le garde-fou parcourt aussi les champs qui écartent seuls une valeur invalide (préférences)", () => {
    const sansSections = { ...preferencesMaximales(), sectionsOuvertes: { "legende-des-flux": true } }
    expect(champsNonRemplis(UserPreferencesSchema, [sansSections], "préférences")).toEqual(expect.arrayContaining(["préférences.sectionsOuvertes{}=false", "préférences.affichage=classique"]))
  })

  it("le garde-fou repère un champ, une option ou une variante oubliés", () => {
    const sansComparateur = { ...sessionMaximale(), comparateur: undefined }
    expect(champsNonRemplis(SessionStateSchema, [sansComparateur], "session")).toEqual(["session.comparateur"])
    const sansElectrique = { ...sessionMaximale(), entities: sessionMaximale().entities.filter(e => e.type === "person") }
    expect(champsNonRemplis(SessionStateSchema, [sansElectrique], "session")).toEqual(expect.arrayContaining(["session.entities[]|variante 1", "session.entities[]|variante 2"]))
  })

  it("est une session valide, qui passe le schéma sans rien perdre", () => {
    expect(SessionStateSchema.parse(sessionMaximale())).toEqual(sessionMaximale())
  })
})

// --- Allers-retours ---

/** Comme si le fichier avait été écrit sur le disque puis relu. */
const surLeDisque = <T>(valeur: T): unknown => JSON.parse(JSON.stringify({ ...valeur, formatVersion: FORMAT_VERSION_ACTUEL }))

/** La session maximale telle que l'écrit la version actuelle de l'application : seule sa version change. */
const ecriteParLaVersionActuelle = () => ({ ...sessionMaximale(), appVersion: VERSION_DE_L_APPLICATION })

describe("rien ne se perd au nettoyage", () => {
  it("d'une session relue", () => {
    const { safeState, report } = sanitizeStateAndFillDefaults(surLeDisque(sessionMaximale()))
    expect(safeState).toEqual(sessionMaximale())
    expect(rapportAvecCorrections(report)).toBe(false)
  })

  it("d'une sauvegarde relue", () => {
    expect(sanitizeSlots([surLeDisque(sauvegardeMaximale())])).toEqual([sauvegardeMaximale()])
  })
})

describe("rien ne se perd dans les fichiers de l'application de bureau", () => {
  it("session en cours écrite puis relue", () => {
    const { safeState, report, versionOrigine } = lireLaSession(contenuDuFichier(sessionMaximale(), VERSION_DE_L_APPLICATION))
    expect(safeState).toEqual(ecriteParLaVersionActuelle())
    expect(versionOrigine).toBe(FORMAT_VERSION_ACTUEL)
    expect(rapportAvecCorrections(report)).toBe(false)
  })

  it("sauvegardes validées, écrites puis relues", () => {
    const slots = sauvegardesAEcrire([sauvegardeMaximale(), sauvegardeMaximale("slot-2")])
    expect(slots).toEqual([sauvegardeMaximale(), sauvegardeMaximale("slot-2")])
    expect(lireLesSauvegardes(contenuDesSauvegardes(slots))).toMatchObject({ slots: [sauvegardeMaximale(), sauvegardeMaximale("slot-2")], refusees: [] })
  })

  it("simulation complète exportée puis importée, avec son nom, les réglages du comparateur et la version qui l'a écrite", () => {
    const exportee = { ...contenuDeLaSession(sessionMaximale()), simulation: null, simulationError: null, exportedAt: "2026-10-05T12:00:00.000Z" }
    const { data, report } = lireUneSimulationImportee(contenuDuFichier(exportee, VERSION_DE_L_APPLICATION))
    expect(data).toEqual(ecriteParLaVersionActuelle())
    expect(rapportAvecCorrections(report)).toBe(false)
  })

  it("sauvegarde exportée seule puis importée", () => {
    expect(lireUneSimulationImportee(contenuDuFichier(sauvegardeMaximale())).data).toEqual(sessionMaximale())
  })

  it("préférences écrites puis relues", () => {
    expect(lireLesPreferences(JSON.stringify(preferencesMaximales()))).toEqual(preferencesMaximales())
  })
})

describe("rien ne se perd entre la session et les sauvegardes", () => {
  it("enregistrer, mettre à jour puis recharger une sauvegarde", () => {
    const sauvegarde = createNewSlotFromSession(sessionMaximale())
    expect(contenuDeLaSession(sauvegarde)).toEqual(ecriteParLaVersionActuelle())
    const miseAJour = updateSlotWithSession({ ...sauvegarde, comparateur: undefined }, sessionMaximale())
    expect(contenuDeLaSession(miseAJour)).toEqual(ecriteParLaVersionActuelle())
  })
})

describe("rien ne se perd dans les sauvegardes groupées", () => {
  it("export de toutes les sauvegardes puis import", () => {
    const fichier = construireFichierSauvegardes([sauvegardeMaximale(), sauvegardeMaximale("slot-2")], ["slot-2", "slot-maximal"])
    const lecture = lireFichierSauvegardes(JSON.stringify(fichier))
    expect(lecture).toEqual({ ok: true, slots: [sauvegardeMaximale("slot-2"), sauvegardeMaximale()], rapport: { lues: 2, ecartees: 0, refusees: [], notesMigration: [] } })
  })

  it("une sauvegarde qui ne diffère que par les réglages du comparateur n'est pas un doublon", () => {
    const existante = sauvegardeMaximale()
    const autresReglages: SaveSlot = { ...existante, comparateur: { reglagesParActivite: {} } }
    expect(fusionnerSauvegardes([existante], [existante.id], [sauvegardeMaximale()]).rapport.doublons).toBe(1)
    expect(fusionnerSauvegardes([existante], [existante.id], [autresReglages], () => "slot-copie").slots[1]).toEqual({ ...autresReglages, id: "slot-copie", name: `${existante.name} (importée)` })
  })
})

describe("rien ne se perd dans la démo web", () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it("session, sauvegardes et préférences stockées dans le navigateur, puis relues", async () => {
    const api = creerApiNavigateur()
    await api.saveCurrentSession(sessionMaximale())
    await api.saveSlots([sauvegardeMaximale(), sauvegardeMaximale("slot-2")], { silencieux: true })
    await api.saveUserPreferences(preferencesMaximales())

    const relue = creerApiNavigateur()
    expect(await relue.getCurrentSession()).toEqual(ecriteParLaVersionActuelle())
    expect(await relue.getSaveSlots()).toEqual([sauvegardeMaximale(), sauvegardeMaximale("slot-2")])
    expect(await relue.getUserPreferences()).toEqual(preferencesMaximales())
  })

  it("enregistrement synchrone à la fermeture de la page", async () => {
    creerApiNavigateur().saveCurrentSessionSync(sessionMaximale())
    expect(await creerApiNavigateur().getCurrentSession()).toEqual(ecriteParLaVersionActuelle())
  })

  it("simulation exportée en fichier puis réimportée", async () => {
    const creerUrl = vi.fn<(blob: Blob) => string>(() => "blob:export")
    Object.assign(URL, { createObjectURL: creerUrl, revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    const api = creerApiNavigateur()
    await api.exportState({ ...contenuDeLaSession(sessionMaximale()), simulation: null })
    const contenu = await creerUrl.mock.calls[0][0].text()

    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, "files", { value: [new File([contenu], "export.json", { type: "application/json" })] })
      this.dispatchEvent(new Event("change"))
    })
    const { data, report } = await api.importState()
    expect(data).toEqual(ecriteParLaVersionActuelle())
    expect(report && rapportAvecCorrections(report)).toBe(false)
  })
})
