// src/lib/montages/montages.test.ts
// Intégrité de la bibliothèque des montages types : chaque montage se charge tel quel, sans rien perdre au nettoyage.

import { describe, expect, it } from "vitest"
import { erreurDesAnnees, NOMBRE_MAX_ANNEES } from "@/backend/logic/annees"
import { euros, pourcent } from "@/backend/logic/format"
import { reglesDeLAnnee, reglesPubliees } from "@/backend/logic/regles"
import { rapportAvecCorrections, sanitizeStateAndFillDefaults } from "@/backend/logic/data-sanitizer"
import { withFormatVersion } from "@/backend/logic/fichiers-de-donnees"
import { availableIcons } from "@/lib/avatar-constants"
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

  it("portent sur une année dont les règles sont publiées, simulée sans reprise d'autres règles", () => {
    // Les montages restent en 2026 quand une année plus récente arrive (leurs chiffres et leurs textes sont ceux de
    // 2026) : ils ne suivent pas l'année d'une nouvelle session.
    expect(reglesDeLAnnee(ANNEE_DES_MONTAGES)).toMatchObject({ regles: { annee: ANNEE_DES_MONTAGES }, avertissement: null })
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

  describe("textes tirés des règles de l'année des montages", () => {
    const regles = reglesPubliees(ANNEE_DES_MONTAGES)
    const micro = regles.microEntreprise
    const parId = (id: string) => {
      const montage = MONTAGES_TYPES.find(m => m.id === id)
      if (!montage) throw new Error(`Montage inconnu : ${id}`)
      return montage
    }
    const texte = (id: string) => {
      const m = parId(id)
      return [m.resume, ...m.questions, ...m.illustre, ...m.conditions, ...m.pointsDAttention, ...m.sources.map(s => s.libelle)].join("\n")
    }

    it("micro-entreprise seule : taux micro du BNC, formation, versement libératoire, abattement, seuils et premier taux du barème", () => {
      const t = texte("micro-bnc-seule")
      for (const valeur of [pourcent(micro.cotisations.servicesBnc), pourcent(micro.formationProfessionnelle.servicesBnc), pourcent(micro.versementLiberatoire.taux.servicesBnc), pourcent(micro.abattement.servicesBnc), euros(micro.versementLiberatoire.plafondRfrParPart), euros(micro.plafonds.services), pourcent(regles.IR.bareme[1].taux)]) {
        expect(t).toContain(valeur)
      }
      // Les valeurs de 2026, pour qu'un changement de mise en forme ne passe pas inaperçu.
      expect(t.replace(/\s/g, " ")).toContain("25,6 % pour une activité libérale non réglementée en 2026")
      expect(t.replace(/\s/g, " ")).toContain("d'au plus 29 315 € par part pour 2026")
    })

    it("SASU sans salaire : prélèvement forfaitaire, abattement des dividendes, taux réduit d'IS et plafond micro", () => {
      const t = texte("sasu-sans-salaire")
      const d = regles.dividendes
      for (const valeur of [pourcent(d.tauxIrForfaitaire + d.prelevementsSociaux), pourcent(d.tauxIrForfaitaire), pourcent(d.prelevementsSociaux), pourcent(d.abattementBareme), pourcent(regles.IS.tauxReduit), euros(regles.IS.plafondTauxReduit), euros(micro.plafonds.services)]) {
        expect(t).toContain(valeur)
      }
      expect(t.replace(/\s/g, " ")).toContain("prélèvement forfaitaire de 31,4 % (12,8 % d'impôt et 18,6 % de prélèvements sociaux)")
      expect(t.replace(/\s/g, " ")).toContain("plafond de la micro-entreprise (83 600 €)")
    })

    it("SASU avec salaire : revenu qui valide un trimestre", () => {
      expect(texte("sasu-salaire-4-trimestres")).toContain(euros(regles.protectionSociale.revenuParTrimestre))
    })

    it("EURL : part du capital au-delà de laquelle les dividendes supportent les cotisations", () => {
      const seuil = regles.EURL.seuilDividendesPartDuCapital
      expect(texte("eurl-is-remuneration-gerant")).toContain(`au-delà de ${pourcent(seuil)} du capital social : avec ${euros(5000)} de capital, seuls ${euros(5000 * seuil)}`)
    })

    it("versement libératoire des autres montages : plafond de revenu fiscal de référence par part", () => {
      for (const id of ["micro-et-sasu-du-conjoint", "salarie-et-micro"]) expect(texte(id)).toContain(`d'au plus ${euros(micro.versementLiberatoire.plafondRfrParPart)} par part pour ${ANNEE_DES_MONTAGES}`)
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
