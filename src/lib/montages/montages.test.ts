// src/lib/montages/montages.test.ts
// Intégrité de la bibliothèque des montages types : chaque montage se charge tel quel, sans rien perdre au nettoyage.

import { describe, expect, it } from "vitest"
import { erreurDesAnnees, NOMBRE_MAX_ANNEES } from "@/backend/logic/annees"
import { rapportAvecCorrections, sanitizeStateAndFillDefaults } from "@/backend/logic/data-sanitizer"
import { withFormatVersion } from "@/backend/logic/fichiers-de-donnees"
import { availableIcons } from "@/lib/avatar-constants"
import { ANNEE_PAR_DEFAUT } from "@/types"
import { ANNEE_DES_MONTAGES, comparateurAuMeilleurNet, sessionDuMontage } from "./construction"
import { MONTAGES_TYPES, sessionDUnMontage } from "./montages"

const doublons = (valeurs: string[]) => valeurs.filter((valeur, i) => valeurs.indexOf(valeur) !== i)

/** Domaines des sources officielles acceptées dans les explications. */
const DOMAINES_OFFICIELS = ["entreprendre.service-public.gouv.fr", "www.service-public.gouv.fr", "www.impots.gouv.fr", "www.urssaf.fr", "www.lassuranceretraite.fr"]

describe("Bibliothèque des montages types", () => {
  it("au moins huit montages, aux identifiants et aux titres uniques", () => {
    expect(MONTAGES_TYPES.length).toBeGreaterThanOrEqual(8)
    expect(doublons(MONTAGES_TYPES.map(m => m.id))).toEqual([])
    expect(doublons(MONTAGES_TYPES.map(m => m.titre))).toEqual([])
  })

  it("portent sur l'année par défaut d'une nouvelle session", () => {
    expect(ANNEE_DES_MONTAGES).toBe(ANNEE_PAR_DEFAUT)
  })

  describe.each(MONTAGES_TYPES.map(montage => [montage.id, montage] as const))("%s", (_id, montage) => {
    const session = sessionDUnMontage(montage)

    it("explication complète, avec des sources officielles", () => {
      expect(montage.resume).toMatch(/[.?]$/)
      expect(montage.etiquettes.length).toBeGreaterThan(0)
      for (const liste of [montage.questions, montage.illustre, montage.conditions, montage.pointsDAttention, montage.sources]) expect(liste.length).toBeGreaterThan(0)
      for (const source of montage.sources) expect(DOMAINES_OFFICIELS).toContain(new URL(source.url).hostname)
    })

    it("une session nommée d'après le montage, d'une seule année", () => {
      expect(session.name).toBe(montage.titre)
      expect(session.annees.map(a => a.annee)).toEqual([ANNEE_DES_MONTAGES])
      expect(session.annees.length).toBeLessThanOrEqual(NOMBRE_MAX_ANNEES)
      expect(erreurDesAnnees(session.annees.map(a => a.annee))).toBeNull()
    })

    it("aucun identifiant en double", () => {
      const flux = session.annees.flatMap(a => a.monthlyData.flatMap(m => m.flows))
      expect(doublons(session.entities.map(e => e.id))).toEqual([])
      expect(doublons(session.relationships.map(r => r.id))).toEqual([])
      expect(doublons(flux.map(f => f.id))).toEqual([])
    })

    it("passe le nettoyage au format actuel sans rien perdre ni changer", () => {
      const { safeState, report } = sanitizeStateAndFillDefaults(withFormatVersion(session))
      expect(report).toEqual({ entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0, reglagesRemoved: 0, professionsRemoved: 0, anneesEcartees: [], migrationNotes: [] })
      expect(rapportAvecCorrections(report)).toBe(false)
      expect(safeState).toEqual(session)
    })

    it("des avatars que l'interface sait afficher", () => {
      for (const { avatar } of session.entities) if (avatar.type === "icon") expect(Object.keys(availableIcons)).toContain(avatar.value)
    })

    it("le comparateur s'ouvre sur une activité du montage", () => {
      const activiteComparee = session.comparateur?.activiteComparee
      if (activiteComparee !== undefined) expect(session.entities.map(e => e.id)).toContain(activiteComparee)
    })

    it("chaque chargement fournit une session neuve", () => {
      const autre = sessionDUnMontage(montage)
      expect(autre).toEqual(session)
      expect(autre.entities).not.toBe(session.entities)
    })
  })

  it("un flux ponctuel n'apparaît que dans son mois, un flux mensuel chaque mois", () => {
    const session = sessionDuMontage("Essai", {
      entities: [],
      relationships: [],
      flux: [
        { entityId: "a", type: "ca_services", amount: 100, label: "Mensuel" },
        { entityId: "a", type: "dividends_payment", amount: 50, label: "Ponctuel", mois: 11 }
      ],
      comparateur: comparateurAuMeilleurNet("a", true)
    })
    const grille = session.annees[0].monthlyData
    expect(grille.map(m => m.flows.length)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2])
    expect(grille[11].flows[1]).toEqual({ id: "a-dividends_payment-11", label: "Ponctuel", amount: 50, entityId: "a", type: "dividends_payment" })
    expect(session.comparateur?.reglagesParActivite.a.repartition).toEqual({ mode: "meilleurNet", partDistribuee: 1, avecRetraite: true })
  })
})
