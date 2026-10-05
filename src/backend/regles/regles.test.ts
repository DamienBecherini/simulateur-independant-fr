// src/backend/regles/regles.test.ts

import { describe, expect, it } from "vitest"
import config from "../config.json" with { type: "json" }
import { PUISSANCES_FISCALES } from "../../types.js"
import { reductionGenerale } from "../logic/cotisationsSalarie.js"
import { montantBaremeKilometrique } from "../logic/frais-kilometriques.js"
import type { BaremeProgressif, ReglesFiscales, TrancheCotisation } from "../logic/regles.js"
import fichier2024 from "./2024.json" with { type: "json" }
import fichier2025 from "./2025.json" with { type: "json" }

/*
 * Garde-fous des règles par année (convention : documentation/adr/007-convention-annee-des-regles.md).
 * Le moteur les lit par reglesDeLAnnee (src/backend/logic/regles.ts) : ces tests attrapent les fautes de frappe
 * et les oublis, ils ne vérifient pas les calculs.
 */

// Vérification de type : chaque fichier respecte le schéma du moteur (champ manquant ou de mauvais type : erreur de compilation)…
const regles2024: ReglesFiscales = fichier2024
const regles2025: ReglesFiscales = fichier2025
const regles2026: ReglesFiscales = config

// … et a exactement la forme de config.json, descriptions et sources comprises (champ en trop ou manquant : erreur de compilation).
type MemeForme<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const formesIdentiques: [MemeForme<typeof fichier2024, typeof config>, MemeForme<typeof fichier2025, typeof config>] = [true, true]

/** Les années connues, dans l'ordre chronologique, avec leur fichier brut (pour parcourir descriptions et sources). */
const annees = [
  { annee: 2024, regles: regles2024, brut: fichier2024 as unknown },
  { annee: 2025, regles: regles2025, brut: fichier2025 as unknown },
  { annee: 2026, regles: regles2026, brut: config as unknown }
]

/** Les paires d'années consécutives : l'année précédente et la suivante. */
const consecutives = annees.slice(1).map((apres, i) => ({ avant: annees[i], apres }))

/** Toutes les feuilles d'un objet JSON, avec leur chemin (`IR.bareme.0.taux`). */
function feuilles(valeur: unknown, chemin = ""): [string, unknown][] {
  if (valeur === null || typeof valeur !== "object") return [[chemin, valeur]]
  return Object.entries(valeur).flatMap(([cle, enfant]) => feuilles(enfant, chemin ? `${chemin}.${cle}` : cle))
}

/**
 * Tous les taux du fichier, c'est-à-dire des fractions entre 0 et 1, avec leur nom. Dans le bloc du régime général,
 * ne sont pas des taux : le plafond de la sécurité sociale et le SMIC annuel (des montants), les limites de tranche
 * `jusquA` (des multiples du plafond), l'exposant `puissance` et le seuil `plafondEnSmic` de la réduction générale
 * (1,75 et 3 en 2026). Le reste en est : parts de chaque tranche, part du brut retenue pour la CSG, taux de CSG et de
 * CRDS, bornes Tmin et Tdelta du coefficient de réduction.
 */
function taux(r: ReglesFiscales): [string, number][] {
  const rg = r.regimeGeneral
  const tns = r.TNS
  const micro = r.microEntreprise
  const parTranches = (nom: string, tranches: TrancheCotisation[]) => tranches.map(({ taux }, i): [string, number] => [`${nom}.${i}`, taux])
  const progressif = (nom: string, { points, tauxAuDela }: BaremeProgressif) => [...points.map(({ taux }, i): [string, number] => [`${nom}.${i}`, taux]), [`${nom}.auDela`, tauxAuDela] as [string, number]]
  const parActivite = (nom: string, t: { venteBic: number; servicesBic: number; servicesBnc: number }): [string, number][] => [
    [`${nom}.venteBic`, t.venteBic],
    [`${nom}.servicesBic`, t.servicesBic],
    [`${nom}.servicesBnc`, t.servicesBnc]
  ]
  return [
    ...r.IR.bareme.map(({ taux }, i): [string, number] => [`IR.bareme.${i}`, taux]),
    ["IR.decote.taux", r.IR.decote.taux],
    ["IR.abattementSalaires.taux", r.IR.abattementSalaires.taux],
    ["baremeKilometrique.majorationElectrique", r.baremeKilometrique.majorationElectrique],
    ...Object.entries(r.baremeKilometrique.voitures).flatMap(([cv, tranches]) => tranches.map(({ taux }, i): [string, number] => [`baremeKilometrique.voitures.${cv}.${i}`, taux])),
    ["IS.tauxReduit", r.IS.tauxReduit],
    ["IS.tauxNormal", r.IS.tauxNormal],
    ["dividendes.tauxIrForfaitaire", r.dividendes.tauxIrForfaitaire],
    ["dividendes.prelevementsSociaux", r.dividendes.prelevementsSociaux],
    ["dividendes.abattementBareme", r.dividendes.abattementBareme],
    ["dividendes.csgDeductible", r.dividendes.csgDeductible],
    ...Object.entries(rg.cotisations).flatMap(([nom, { salariale, patronale }]) => [
      ...parTranches(`regimeGeneral.cotisations.${nom}.salariale`, salariale),
      ...parTranches(`regimeGeneral.cotisations.${nom}.patronale`, patronale)
    ]),
    ...parTranches("regimeGeneral.csgCrds.assiette", rg.csgCrds.assiette),
    ["regimeGeneral.csgCrds.csgDeductible", rg.csgCrds.csgDeductible],
    ["regimeGeneral.csgCrds.csgNonDeductible", rg.csgCrds.csgNonDeductible],
    ["regimeGeneral.csgCrds.crds", rg.csgCrds.crds],
    ["regimeGeneral.reductionGenerale.tMin", rg.reductionGenerale.tMin],
    ["regimeGeneral.reductionGenerale.tDelta", rg.reductionGenerale.tDelta],
    ["TNS.abattement.taux", tns.abattement.taux],
    ...progressif("TNS.maladieMaternite", tns.maladieMaternite),
    ...progressif("TNS.allocationsFamiliales", tns.allocationsFamiliales),
    ...parTranches("TNS.indemnitesJournalieres", tns.indemnitesJournalieres.tranches),
    ...parTranches("TNS.retraiteDeBase", tns.retraiteDeBase.tranches),
    ...parTranches("TNS.retraiteComplementaire", tns.retraiteComplementaire.tranches),
    ...parTranches("TNS.invaliditeDeces", tns.invaliditeDeces.tranches),
    ["TNS.csgCrds.csgDeductible", tns.csgCrds.csgDeductible],
    ["TNS.csgCrds.csgNonDeductible", tns.csgCrds.csgNonDeductible],
    ["TNS.csgCrds.crds", tns.csgCrds.crds],
    ["TNS.formationProfessionnelle.tauxSurPlafond", tns.formationProfessionnelle.tauxSurPlafond],
    ["protectionSociale.tauxRetraiteDeBase", r.protectionSociale.tauxRetraiteDeBase],
    ...parActivite("protectionSociale.partRetraiteDeBaseMicro", r.protectionSociale.partRetraiteDeBaseMicro),
    ["EURL.seuilDividendesPartDuCapital", r.EURL.seuilDividendesPartDuCapital],
    ...parActivite("microEntreprise.cotisations", micro.cotisations),
    ["microEntreprise.reductionACRE", micro.reductionACRE],
    ...parActivite("microEntreprise.abattement", micro.abattement),
    ...parActivite("microEntreprise.versementLiberatoire.taux", micro.versementLiberatoire.taux)
  ]
}

/** Les limites chiffrées du barème de l'impôt sur le revenu (sans la dernière tranche, illimitée). */
const limitesIR = (r: ReglesFiscales) => r.IR.bareme.flatMap(({ trancheJusqua }) => (trancheJusqua === null ? [] : [trancheJusqua]))

/** Vérifie qu'une suite est strictement croissante. */
function expectCroissante(valeurs: number[]) {
  valeurs.slice(1).forEach((valeur, i) => expect(valeur).toBeGreaterThan(valeurs[i]))
}

describe("règles par année", () => {
  it("ont exactement la forme de config.json", () => {
    expect(formesIdentiques).toEqual([true, true])
    // Même vérification à l'exécution, indices des listes confondus.
    const cles = (brut: unknown) => [...new Set(feuilles(brut).map(([chemin]) => chemin.replace(/\.\d+(?=\.|$)/g, ".n")))].sort()
    expect(cles(fichier2024)).toEqual(cles(config))
    expect(cles(fichier2025)).toEqual(cles(config))
  })

  describe.each(annees)("$annee", ({ annee, regles, brut }) => {
    it("porte son année", () => {
      expect(regles.annee).toBe(annee)
    })

    it("a des descriptions renseignées et des sources en adresse directe", () => {
      for (const [chemin, valeur] of feuilles(brut)) {
        if (/(^|\.)(description|\w+Description)$/.test(chemin)) expect(valeur, chemin).toMatch(/\S{3,}/)
        if (/(^|\.)source$/.test(chemin)) expect(valeur, chemin).toMatch(/^https:\/\/\S+$/)
      }
    })

    it("n'a que des montants et des taux finis et positifs", () => {
      for (const [chemin, valeur] of feuilles(brut)) {
        if (typeof valeur === "number") {
          expect(Number.isFinite(valeur), chemin).toBe(true)
          expect(valeur, chemin).toBeGreaterThanOrEqual(0)
        }
      }
    })

    it("a tous ses taux entre 0 et 1", () => {
      for (const [nom, valeur] of taux(regles)) {
        expect(valeur, nom).toBeGreaterThanOrEqual(0)
        expect(valeur, nom).toBeLessThanOrEqual(1)
      }
    })

    it("a un barème d'impôt sur le revenu ordonné, dont seule la dernière tranche est illimitée", () => {
      const { bareme } = regles.IR
      expect(bareme.at(-1)?.trancheJusqua).toBeNull()
      expect(limitesIR(regles)).toHaveLength(bareme.length - 1)
      expectCroissante(limitesIR(regles))
      expectCroissante(bareme.map(({ taux }) => taux))
      expect(bareme[0].taux).toBe(0)
    })

    it("a une décote plus forte pour un couple et une déduction de 10 % bornée", () => {
      const { decote, abattementSalaires, plafonnementQuotientFamilial } = regles.IR
      expect(decote.forfaitCouple).toBeGreaterThan(decote.forfaitSeul)
      expect(abattementSalaires.maximum).toBeGreaterThan(abattementSalaires.minimum)
      expect(plafonnementQuotientFamilial.avantageMaxParDemiPart).toBeGreaterThan(0)
    })

    it("a un barème kilométrique des voitures de 3 à 7 CV, en trois tranches (5 000 km, 20 000 km, au-delà)", () => {
      const { voitures, majorationElectrique, domicileTravail } = regles.baremeKilometrique
      expect(Object.keys(voitures).sort()).toEqual([...PUISSANCES_FISCALES])
      for (const [cv, tranches] of Object.entries(voitures)) {
        expect(tranches.map(({ jusquA }) => jusquA), cv).toEqual([5000, 20000, null])
        tranches.forEach(({ taux }) => expect(taux, cv).toBeGreaterThan(0))
        // Seule la tranche du milieu a un forfait.
        expect(tranches.map(({ forfait }) => forfait > 0), cv).toEqual([false, true, false])
      }
      expect(majorationElectrique).toBe(0.2)
      expect(domicileTravail.distanceMaxParTrajet).toBe(40)
    })

    it("a un barème kilométrique continu aux limites des tranches, aux arrondis près", () => {
      // Les taux sont publiés au millième : à la limite L, chacun des deux taux peut s'écarter de 0,0005 €/km, et le
      // forfait d'un demi-euro ; on tolère donc 2 x 0,0005 x L + 1 € (6 € à 5 000 km, 21 € à 20 000 km).
      for (const [cv, tranches] of Object.entries(regles.baremeKilometrique.voitures)) {
        tranches.slice(0, -1).forEach((tranche, i) => {
          const limite = tranche.jusquA ?? 0
          const suivante = tranches[i + 1]
          const ecart = Math.abs(limite * tranche.taux + tranche.forfait - (limite * suivante.taux + suivante.forfait))
          expect(ecart, `${cv} CV à ${limite} km`).toBeLessThanOrEqual(2 * 0.0005 * limite + 1)
        })
      }
    })

    it("a un barème kilométrique qui croît avec la puissance fiscale", () => {
      const { voitures } = regles.baremeKilometrique
      for (const distance of [3000, 12000, 30000]) {
        expectCroissante(PUISSANCES_FISCALES.map(cv => montantBaremeKilometrique(distance, { puissanceFiscale: cv, electrique: false }, regles.baremeKilometrique)))
      }
      expect(voitures["3"][0].taux).toBeLessThan(1)
    })

    it("a un impôt sur les sociétés au taux réduit inférieur au taux normal", () => {
      expect(regles.IS.tauxReduit).toBeLessThan(regles.IS.tauxNormal)
      expect(regles.IS.plafondTauxReduit).toBeGreaterThan(0)
    })

    it("a des barèmes de cotisation des travailleurs non salariés ordonnés", () => {
      const tns = regles.TNS
      for (const { points } of [tns.maladieMaternite, tns.allocationsFamiliales]) {
        expectCroissante(points.map(({ partDuPlafond }) => partDuPlafond))
        // Taux non décroissants : le barème de 2024 garde 6,7 % de 110 % à 5 PASS.
        points.slice(1).forEach(({ taux }, i) => expect(taux).toBeGreaterThanOrEqual(points[i].taux))
      }
      for (const { tranches } of [tns.indemnitesJournalieres, tns.retraiteDeBase, tns.retraiteComplementaire, tns.invaliditeDeces]) {
        const bornes = tranches.map(({ jusquA }) => jusquA ?? Infinity)
        expectCroissante(bornes)
        expect(bornes[0]).toBeGreaterThan(0)
      }
      expect(tns.abattement.minimumPartDuPlafond).toBeLessThan(tns.abattement.maximumPartDuPlafond)
    })

    it("a des assiettes minimales cohérentes avec le plafond de la sécurité sociale et le revenu d'un trimestre", () => {
      const { plafondSecuriteSociale, cotisationsMinimales } = regles.TNS
      // Indemnités journalières : 40 % du PASS ; invalidité-décès : 11,5 % du PASS (à l'euro près).
      expect(Math.abs(cotisationsMinimales.indemnitesJournalieres - 0.4 * plafondSecuriteSociale)).toBeLessThanOrEqual(1)
      expect(Math.abs(cotisationsMinimales.invaliditeDeces - 0.115 * plafondSecuriteSociale)).toBeLessThanOrEqual(1)
      // Retraite de base : de quoi valider au moins 3 trimestres, sans dépasser le plafond.
      expect(cotisationsMinimales.retraiteDeBase).toBeGreaterThanOrEqual(3 * regles.protectionSociale.revenuParTrimestre - 1)
      expect(cotisationsMinimales.retraiteDeBase).toBeLessThan(plafondSecuriteSociale)
    })

    it("a des cotisations du régime général par tranches ordonnées du plafond de la sécurité sociale", () => {
      const rg = regles.regimeGeneral
      expect(rg.plafondSecuriteSociale).toBe(regles.TNS.plafondSecuriteSociale)
      const listes = [...Object.values(rg.cotisations).flatMap(({ salariale, patronale }) => [salariale, patronale]), rg.csgCrds.assiette]
      for (const tranches of listes) {
        const bornes = tranches.map(({ jusquA }) => jusquA ?? Infinity)
        expectCroissante(bornes)
        if (bornes.length > 0) expect(bornes[0]).toBeGreaterThan(0)
        // Aucune assiette ne dépasse 8 plafonds (tranche 2 de l'Agirc-Arrco) sans être illimitée.
        bornes.forEach(borne => expect(borne === Infinity || borne <= 8).toBe(true))
      }
      // Chaque ligne est due par quelqu'un.
      for (const [nom, { salariale, patronale }] of Object.entries(rg.cotisations)) expect(salariale.length + patronale.length, nom).toBeGreaterThan(0)
      expect(rg.csgCrds.assiette).toEqual([{ jusquA: 4, taux: 0.9825 }, { jusquA: null, taux: 1 }])
    })

    it("réserve aux salariés l'assurance chômage, l'AGS et le dialogue social, et ne doit la CET qu'au-delà du plafond", () => {
      const { cotisations } = regles.regimeGeneral
      expect(Object.entries(cotisations).filter(([, c]) => c.salariesSeulement).map(([nom]) => nom)).toEqual(["assuranceChomage", "ags", "dialogueSocial"])
      expect(Object.entries(cotisations).filter(([, c]) => c.auDelaDuPlafondSeulement).map(([nom]) => nom)).toEqual(["contributionEquilibreTechnique"])
    })

    it("a une réduction générale cohérente avec le SMIC de l'année", () => {
      const rg = regles.regimeGeneral.reductionGenerale
      // SMIC annuel = 1 820 heures au SMIC horaire du 1er janvier, et un trimestre de retraite = 150 heures (à l'euro près).
      expect(Math.abs(rg.smicAnnuel - (regles.protectionSociale.revenuParTrimestre * 1820) / 150)).toBeLessThanOrEqual(1)
      expect(rg.plafondEnSmic).toBeGreaterThan(1)
      expect(rg.puissance).toBeGreaterThanOrEqual(1)
      expect(rg.tMin + rg.tDelta).toBeLessThan(1)
      // Maximale au SMIC (Tmin + Tdelta, arrondi à 4 décimales), nulle à partir du plafond.
      expect(reductionGenerale(rg.smicAnnuel, rg)).toBeCloseTo(rg.smicAnnuel * Math.round((rg.tMin + rg.tDelta) * 10000) / 10000, 6)
      expect(reductionGenerale(rg.plafondEnSmic * rg.smicAnnuel, rg)).toBe(0)
    })

    it("a des seuils de micro-entreprise et de TVA positifs et ordonnés", () => {
      const { plafonds, abattement } = regles.microEntreprise
      expect(plafonds.vente).toBeGreaterThan(plafonds.services)
      expect(abattement.minimum).toBeGreaterThan(0)
      for (const activite of ["services", "vente"] as const) {
        const { franchiseBase, seuilMajore } = regles.TVA[activite]
        expect(seuilMajore).toBeGreaterThan(franchiseBase)
        expect(franchiseBase).toBeLessThan(plafonds[activite])
      }
      expect(regles.TVA.vente.franchiseBase).toBeGreaterThan(regles.TVA.services.franchiseBase)
    })
  })

  describe.each(consecutives)("de $avant.annee à $apres.annee", ({ avant, apres }) => {
    const [a, b] = [avant.regles, apres.regles]

    it("fait croître le plafond de la sécurité sociale, le SMIC, le revenu d'un trimestre et les assiettes minimales", () => {
      expect(b.TNS.plafondSecuriteSociale).toBeGreaterThan(a.TNS.plafondSecuriteSociale)
      expect(b.regimeGeneral.plafondSecuriteSociale).toBeGreaterThan(a.regimeGeneral.plafondSecuriteSociale)
      expect(b.regimeGeneral.reductionGenerale.smicAnnuel).toBeGreaterThan(a.regimeGeneral.reductionGenerale.smicAnnuel)
      expect(b.protectionSociale.revenuParTrimestre).toBeGreaterThan(a.protectionSociale.revenuParTrimestre)
      expect(b.TNS.cotisationsMinimales.indemnitesJournalieres).toBeGreaterThan(a.TNS.cotisationsMinimales.indemnitesJournalieres)
      expect(b.TNS.cotisationsMinimales.invaliditeDeces).toBeGreaterThan(a.TNS.cotisationsMinimales.invaliditeDeces)
    })

    it("ne fait jamais baisser les limites du barème de l'impôt sur le revenu ni les montants associés", () => {
      // Égalité permise : l'année en cours reprend le dernier barème voté (ADR 007).
      const [limitesAvant, limitesApres] = [limitesIR(a), limitesIR(b)]
      expect(limitesApres).toHaveLength(limitesAvant.length)
      limitesApres.forEach((limite, i) => expect(limite).toBeGreaterThanOrEqual(limitesAvant[i]))
      expect(b.IR.plafonnementQuotientFamilial.avantageMaxParDemiPart).toBeGreaterThanOrEqual(a.IR.plafonnementQuotientFamilial.avantageMaxParDemiPart)
      expect(b.IR.decote.forfaitSeul).toBeGreaterThanOrEqual(a.IR.decote.forfaitSeul)
      expect(b.IR.decote.forfaitCouple).toBeGreaterThanOrEqual(a.IR.decote.forfaitCouple)
      expect(b.IR.abattementSalaires.minimum).toBeGreaterThanOrEqual(a.IR.abattementSalaires.minimum)
      expect(b.IR.abattementSalaires.maximum).toBeGreaterThanOrEqual(a.IR.abattementSalaires.maximum)
    })

    it("fait croître le plafond de revenu fiscal de référence du versement libératoire", () => {
      expect(b.microEntreprise.versementLiberatoire.plafondRfrParPart).toBeGreaterThan(a.microEntreprise.versementLiberatoire.plafondRfrParPart)
    })

    it("ne fait jamais baisser les plafonds de la micro-entreprise", () => {
      expect(b.microEntreprise.plafonds.services).toBeGreaterThanOrEqual(a.microEntreprise.plafonds.services)
      expect(b.microEntreprise.plafonds.vente).toBeGreaterThanOrEqual(a.microEntreprise.plafonds.vente)
    })

    it("garde des taux du même ordre", () => {
      // Un écart de plus de 10 points d'une année à l'autre trahirait une faute de frappe (0,3 au lieu de 0,03…).
      // Les barèmes des travailleurs non salariés changent de structure avec la réforme de l'assiette : ils sont exclus.
      const [tauxAvant, tauxApres] = [new Map(taux(a)), taux(b)]
      for (const [nom, valeur] of tauxApres) {
        const precedent = tauxAvant.get(nom)
        if (precedent !== undefined && !nom.startsWith("TNS.")) expect(Math.abs(valeur - precedent), nom).toBeLessThanOrEqual(0.1)
      }
    })
  })

  describe("barème kilométrique", () => {
    it("est le même de 2024 à 2026 : non revalorisé depuis l'arrêté du 27 mars 2023, et repris pour 2026 en attendant sa publication", () => {
      // Les valeurs seulement : descriptions et sources diffèrent d'une année à l'autre.
      const valeurs = ({ baremeKilometrique: b }: ReglesFiscales) => ({ voitures: b.voitures, majorationElectrique: b.majorationElectrique, distanceMaxParTrajet: b.domicileTravail.distanceMaxParTrajet })
      expect(valeurs(regles2025)).toEqual(valeurs(regles2024))
      expect(valeurs(regles2026)).toEqual(valeurs(regles2025))
    })

    it("retrouve la ligne des 5 CV publiée par l'administration : d x 0,636 ; d x 0,357 + 1 395 ; d x 0,427", () => {
      expect(regles2026.baremeKilometrique.voitures["5"]).toEqual([
        { jusquA: 5000, taux: 0.636, forfait: 0 },
        { jusquA: 20000, taux: 0.357, forfait: 1395 },
        { jusquA: null, taux: 0.427, forfait: 0 }
      ])
    })
  })

  describe("réduction « Fillon » de 2024 et 2025, portée par les paramètres de la réduction dégressive unique", () => {
    // C = (T / 0,6) x (1,6 x SMIC / brut - 1) : Tmin = 0, Tdelta = T, P = 1, plafond de 1,6 SMIC.
    it.each([regles2024, regles2025])("$annee : Tmin = 0, P = 1, jusqu'à 1,6 SMIC", ({ regimeGeneral }) => {
      expect(regimeGeneral.reductionGenerale).toMatchObject({ tMin: 0, tDelta: 0.3194, puissance: 1, plafondEnSmic: 1.6 })
    })

    it("retrouve l'exemple de l'Urssaf pour 2024 : 1 900 € brut par mois, SMIC de 1 766,92 €, coefficient de 0,2597", () => {
      expect(reductionGenerale(12 * 1900, regles2024.regimeGeneral.reductionGenerale)).toBeCloseTo(12 * 1900 * 0.2597, 6)
    })

    it("retrouve l'exemple de l'Urssaf pour mai 2025 : 2 000 € brut par mois, T de 0,3193, coefficient de 0,2349", () => {
      // Le fichier garde le T du 1er janvier (0,3194) ; l'exemple de l'Urssaf porte sur le T de mai à décembre.
      const tDeMai = { ...regles2025.regimeGeneral.reductionGenerale, tDelta: 0.3193 }
      expect(reductionGenerale(12 * 2000, tDeMai)).toBeCloseTo(12 * 2000 * 0.2349, 6)
    })
  })
})
