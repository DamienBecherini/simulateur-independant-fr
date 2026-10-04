// src/backend/regles/regles.test.ts

import { describe, expect, it } from "vitest"
import config from "../config.json" with { type: "json" }
import type { BaremeProgressif, ReglesFiscales, TrancheCotisation } from "../logic/regles.js"
import fichier2024 from "./2024.json" with { type: "json" }
import fichier2025 from "./2025.json" with { type: "json" }

/*
 * Garde-fous des règles par année (convention : documentation/adr/007-convention-annee-des-regles.md).
 * Ces fichiers ne sont pas encore lus par le moteur (phase 13) : ces tests attrapent les fautes de frappe
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

/** Les paires d'années consécutives : [année précédente, année suivante]. */
const consecutives = annees.slice(1).map((suivante, i) => [annees[i], suivante] as const)

/** Toutes les feuilles d'un objet JSON, avec leur chemin (`IR.bareme.0.taux`). */
function feuilles(valeur: unknown, chemin = ""): [string, unknown][] {
  if (valeur === null || typeof valeur !== "object") return [[chemin, valeur]]
  return Object.entries(valeur).flatMap(([cle, enfant]) => feuilles(enfant, chemin ? `${chemin}.${cle}` : cle))
}

/** Tous les taux du fichier, c'est-à-dire des fractions entre 0 et 1, avec leur nom. */
function taux(r: ReglesFiscales): [string, number][] {
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
    ["IS.tauxReduit", r.IS.tauxReduit],
    ["IS.tauxNormal", r.IS.tauxNormal],
    ["dividendes.tauxIrForfaitaire", r.dividendes.tauxIrForfaitaire],
    ["dividendes.prelevementsSociaux", r.dividendes.prelevementsSociaux],
    ["dividendes.abattementBareme", r.dividendes.abattementBareme],
    ["dividendes.csgDeductible", r.dividendes.csgDeductible],
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
    ["protectionSociale.tauxNetSurBrutSalarie", r.protectionSociale.tauxNetSurBrutSalarie],
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

  describe.each(consecutives)("de $0.annee à $1.annee", (avant, apres) => {
    const [a, b] = [avant.regles, apres.regles]

    it("fait croître le plafond de la sécurité sociale, le revenu d'un trimestre et les assiettes minimales", () => {
      expect(b.TNS.plafondSecuriteSociale).toBeGreaterThan(a.TNS.plafondSecuriteSociale)
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
})
