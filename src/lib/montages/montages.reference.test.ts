// src/lib/montages/montages.reference.test.ts
// Chiffres de référence des montages types : chaque montage passe par le vrai moteur, avec les règles 2026, et ses
// résultats clés sont figés ici. Un changement de règle ou de calcul qui les modifie fait échouer ce test : il faut
// alors vérifier le nouvel écart, puis mettre à jour ces chiffres et, si besoin, les explications des montages.

import { describe, expect, it } from "vitest"
import { vueDeLAnnee } from "@/backend/logic/annees"
import { AUCUNE_CHARGE } from "@/backend/logic/options-du-comparateur"
import { casDeReference, verifierIdentiteDuBilan } from "@/backend/logic/testing/cas-de-reference"
import { comparerStatutsDeLAnnee, simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { reglagesDeLActiviteComparee } from "@/lib/comparateur-options"
import { activitesSansCharge } from "@/lib/testing/activites-sans-charge"
import type { StatutCompare } from "@/types"
import { ANNEE_DES_MONTAGES } from "./construction"
import { MONTAGES_TYPES, sessionDUnMontage, type MontageType } from "./montages"

interface FoyerAttendu {
  personIds: string[]
  impotSurLeRevenu: number
  prelevementsSociaux: number
  totalPrelevements: number
  netApresImpots: number
}

interface ChiffresAttendus {
  totalNetApresImpots: number
  foyers: FoyerAttendu[]
  /** Cotisations sociales et impôt sur les sociétés, par activité. */
  activites: Record<string, { cotisationsSociales: number; impotSocietes: number; resultatConserve: number }>
  /** Activité ouverte dans le comparateur et statut au meilleur net. */
  comparateur: { activite: string; meilleur: StatutCompare | null }
}

const foyer = (personIds: string[], impotSurLeRevenu: number, prelevementsSociaux: number, totalPrelevements: number, netApresImpots: number): FoyerAttendu => ({ personIds, impotSurLeRevenu, prelevementsSociaux, totalPrelevements, netApresImpots })
const activite = (cotisationsSociales: number, impotSocietes: number, resultatConserve = 0) => ({ cotisationsSociales, impotSocietes, resultatConserve })

const ATTENDUS: Record<string, ChiffresAttendus> = {
  "micro-bnc-seule": {
    // 36 000 € : cotisations 25,6 % = 9 216 €, plus 0,2 % de formation professionnelle = 72 € ; versement libératoire 2,2 % = 792 €.
    // Charges non déductibles (CFE 300 €, assurance 360 €, banque 120 €) : 780 € de moins sur le net, rien sur les prélèvements.
    totalNetApresImpots: 25140,
    foyers: [foyer(["p-sophie"], 792, 0, 10080, 25140)],
    activites: { "m-sophie": activite(9288, 0) },
    comparateur: { activite: "m-sophie", meilleur: "micro-vfl" }
  },
  "osteopathe-micro": {
    // 37 200 € : cotisations au taux de la CIPAV, 23,2 % = 8 630,40 €, plus 0,2 % de formation professionnelle = 74,40 €
    // (25,6 % pour un libéral non réglementé : 9 523,20 €). Barème : 37 200 x 66 % = 24 552 € imposables ;
    // (24 552 - 11 600) x 11 % = 1 424,72 €, moins la décote (897 - 45,25 % x 1 424,72 = 252,31 €) : 1 172 €.
    // Charges non déductibles (loyer 4 800 €, CFE 350 €, assurance 250 €, banque 120 €) : 5 520 € de moins sur le net.
    // 37 200 - 8 705 - 5 520 - 1 172 = 21 803 €. Sous le seuil de franchise en base de TVA des services (37 500 €).
    totalNetApresImpots: 21803,
    foyers: [foyer(["p-lea"], 1172, 0, 9877, 21803)],
    activites: { "m-lea": activite(8705, 0) },
    comparateur: { activite: "m-lea", meilleur: "micro-vfl" }
  },
  "kinesitherapeute-ei": {
    // Charges déductibles : loyer 10 800 €, matériel 1 800 €, comptable 1 440 €, banque 180 €, CFE 500 €, assurance 300 €,
    // et 4 000 km au barème des 5 CV (4 000 x 0,636 = 2 544 €) : 17 564 €. Bénéfice 78 000 - 17 564 = 60 436 €.
    // Assiette sociale 60 436 x 74 % = 44 722,64 € : retraite de base 10,60 % = 4 741 €, complémentaire 8,70 % = 3 891 €,
    // invalidité-décès 1 022 €, indemnités journalières 0,30 % = 134 €, maladie 0,10 % restée à la charge du praticien
    // = 45 €, CSG-CRDS 9,70 % = 4 338 €, formation 0,25 % du PASS = 120 €, CURPS 0,10 % = 45 €, ASV 224 € + 0,16 %
    // = 296 € ; pas d'allocations familiales sous 110 % du PASS : 14 631 €.
    // Imposable : 60 436 - (14 631 - 1 297 de CSG non déductible et CRDS) = 47 102 € ; (29 579 - 11 600) x 11 %
    // + (47 102 - 29 579) x 30 % = 7 235 €. Net : 60 436 - 14 631 - 7 235 = 38 570 €.
    totalNetApresImpots: 38570,
    foyers: [foyer(["p-julien"], 7235, 0, 21866, 38570)],
    activites: { "ei-julien": activite(14631, 0) },
    comparateur: { activite: "ei-julien", meilleur: "EI" }
  },
  "sasu-sans-salaire": {
    // Bénéfice 78 000 € ; IS 42 500 x 15 % + 35 500 x 25 % = 15 250 € ; 62 750 € de dividendes, imposés au barème.
    totalNetApresImpots: 47960,
    foyers: [foyer(["p-thomas"], 3119, 11672, 30041, 47960)],
    activites: { "s-thomas": activite(0, 15250) },
    comparateur: { activite: "s-thomas", meilleur: "SASU" }
  },
  "sasu-salaire-4-trimestres": {
    totalNetApresImpots: 46296,
    foyers: [foyer(["p-antoine"], 3962, 8742, 31552, 46296)],
    activites: { "s-antoine": activite(8797, 10051, 152) },
    comparateur: { activite: "s-antoine", meilleur: "SASU" }
  },
  "eurl-is-remuneration-gerant": {
    totalNetApresImpots: 28666,
    foyers: [foyer(["p-nicolas"], 1741, 93, 20613, 28666)],
    activites: { "e-nicolas": activite(13623, 5157, 28721) },
    comparateur: { activite: "e-nicolas", meilleur: "SASU" }
  },
  "salarie-et-micro": {
    // Charges non déductibles de la micro (CFE 150 €, assurance 240 €, banque 60 €) : 450 € de moins sur le net.
    totalNetApresImpots: 30940,
    foyers: [foyer(["p-lucas"], 2133, 0, 12050, 30940)],
    activites: { "m-lucas": activite(2477, 0) },
    comparateur: { activite: "m-lucas", meilleur: "micro-vfl" }
  },
  "micro-et-sasu-du-conjoint": {
    // Charges non déductibles de la micro (CFE 250 €, assurance 300 €, banque 120 €) : 670 € de moins sur le net.
    // Charges déductibles de la SASU (expert-comptable 2 040 €, CFE 400 €, assurance 360 €, banque 240 €) : 3 040 € de
    // bénéfice et 456 € d'impôt sur les sociétés en moins ; les dividendes passent de 25 000 à 23 000 € pour rester sous
    // le bénéfice distribuable (261 € conservés), d'où 118 € d'impôt et 372 € de prélèvements sociaux en moins.
    totalNetApresImpots: 60879,
    foyers: [foyer(["p-claire", "p-marc"], 3433, 4278, 37150, 60879)],
    activites: { "m-claire": activite(7740, 0), "s-marc": activite(17594, 4105, 261) },
    comparateur: { activite: "m-claire", meilleur: "micro-vfl" }
  },
  "conjoint-salarie-sasu": {
    totalNetApresImpots: 62909,
    foyers: [foyer(["p-paul", "p-julie"], 3511, 5580, 38103, 62909)],
    activites: { "s-paul": activite(18805, 5468, 988) },
    comparateur: { activite: "s-paul", meilleur: "EI" }
  },
  "couple-union-libre": {
    // Charges non déductibles de la micro d'Emma (CFE 200 €, assurance 240 €, banque 60 €) : 500 € de moins sur son net.
    totalNetApresImpots: 45960,
    foyers: [foyer(["p-hugo"], 4444, 0, 16444, 37556), foyer(["p-emma"], 0, 0, 3096, 8404)],
    activites: { "m-emma": activite(3096, 0) },
    comparateur: { activite: "m-emma", meilleur: "micro" }
  }
}

function simulerLeMontage(montage: MontageType) {
  const session = sessionDUnMontage(montage)
  const [{ report, erreur }] = simulerLesAnnees(session).annees
  if (!report) throw new Error(`${montage.id} : ${erreur}`)
  const reglages = reglagesDeLActiviteComparee(vueDeLAnnee(session, ANNEE_DES_MONTAGES), session.comparateur)
  if (!reglages) throw new Error(`${montage.id} : aucune activité à comparer`)
  return { report, activite: reglages.activite.id, comparaison: comparerStatutsDeLAnnee(session, reglages.options, ANNEE_DES_MONTAGES) }
}

casDeReference("Montages types : chiffres de référence", () => {
  it("chaque montage a ses chiffres de référence", () => {
    expect(Object.keys(ATTENDUS).sort()).toEqual(MONTAGES_TYPES.map(m => m.id).sort())
  })

  describe.each(MONTAGES_TYPES.map(montage => [montage.id, montage] as const))("%s", (id, montage) => {
    const attendus = ATTENDUS[id]
    const { report, activite: activiteComparee, comparaison } = simulerLeMontage(montage)

    it("net du foyer, impôt et prélèvements", () => {
      expect(report.totalNetApresImpots).toBe(attendus.totalNetApresImpots)
      expect(report.foyers.map(f => ({ personIds: f.personIds, impotSurLeRevenu: f.impotSurLeRevenu, prelevementsSociaux: f.prelevementsSociaux, totalPrelevements: f.totalPrelevements, netApresImpots: f.netApresImpots }))).toEqual(attendus.foyers)
      verifierIdentiteDuBilan(report)
    })

    it("cotisations et impôt sur les sociétés des activités", () => {
      const activites = Object.fromEntries(report.activities.map(a => [a.entityId, activite(a.cotisationsSociales, a.impotSocietes, a.resultatConserve)]))
      expect(activites).toEqual(attendus.activites)
    })

    it("sans avertissement, et meilleur statut du comparateur", () => {
      expect([...report.avertissements, ...report.activities.flatMap(a => a.warnings), ...report.foyers.flatMap(f => f.warnings)]).toEqual([])
      expect({ activite: activiteComparee, meilleur: comparaison.meilleur }).toEqual(attendus.comparateur)
    })

    it("des charges saisies pour l'activité comparée : pas d'alerte « aucune charge » à l'ouverture du comparateur", () => {
      expect(comparaison.warnings).not.toContain(AUCUNE_CHARGE)
    })

    it("des charges saisies pour chaque activité : pas d'alerte « aucune charge » quand on la choisit dans le comparateur", () => {
      expect(activitesSansCharge(sessionDUnMontage(montage), ANNEE_DES_MONTAGES)).toEqual([])
    })
  })

  it("micro-entreprise seule : le versement libératoire s'applique, avec 24 000 € de revenu fiscal de référence saisis", () => {
    const { report } = simulerLeMontage(MONTAGES_TYPES.find(m => m.id === "micro-bnc-seule")!)
    expect(report.activities[0].versementLiberatoire).toMatchObject({ plafondRfr: 29315, rfrN2: 24000, eligible: true, applique: true })
  })

  // 827 € depuis que la colonne du statut actuel ne compte plus de frais de fonctionnement supposés : les deux points
  // comparés déduisaient 2 900 € de frais de leur bénéfice (828 €) ; sans eux, l'écart bouge d'un euro.
  it("SASU sans salaire : valider 4 trimestres coûte 827 € de net au foyer, pour 5 800 € nets de rémunération", () => {
    const { comparaison } = simulerLeMontage(MONTAGES_TYPES.find(m => m.id === "sasu-sans-salaire")!)
    const sasu = comparaison.scenarios.find(s => s.statut === "SASU")
    expect(sasu?.remunerationOptimale).toMatchObject({ remunerationNette: 5800, avecRetraite: true, coutDesQuatreTrimestres: 827 })
    expect(sasu?.protectionSociale.trimestres).toBe(4)
    // Désignée meilleure, la colonne fait moins bien que la situation saisie, tout en dividendes (47 960 €) : le verdict
    // l'explique par les 4 trimestres, sans désigner la situation saisie.
    expect(comparaison.meilleur).toBe("SASU")
    expect(comparaison.sousLaSituationSaisie).toMatchObject({ ecart: 756, raison: "trimestres" })
    expect(comparaison.sousLaSituationSaisie?.explication.replace(/\s/g, " ")).toBe("Valider 4 trimestres de retraite vous coûterait environ 756 € par rapport à votre situation telle que saisie.")
    // 84 000 € de chiffre d'affaires dépassent le plafond de la micro-entreprise : elle n'est jamais désignée meilleur choix.
    expect(comparaison.scenarios.find(s => s.statut === "micro-vfl")?.horsPlafond).toBe(true)
  })

  it("ostéopathe : taux de la CIPAV, 4 trimestres, versement libératoire possible, et SASU ou EURL jamais désignées", () => {
    const { report, comparaison } = simulerLeMontage(MONTAGES_TYPES.find(m => m.id === "osteopathe-micro")!)
    const [cabinet] = report.activities
    expect(cabinet.profession).toEqual({ id: "osteopathe", libelle: "Ostéopathe", caisse: "CIPAV", tauxMicro: 0.232 })
    expect(cabinet.versementLiberatoire).toMatchObject({ rfrN2: 22000, eligible: true, applique: false })
    expect(comparaison.scenarios.find(s => s.statut === "micro")?.protectionSociale.trimestres).toBe(4)
    // Le versement libératoire (2,2 % de 37 200 € = 818 € au lieu de 1 172 €) fait gagner 354 € ; l'EI au réel, qui
    // déduit le loyer mais supporte les cotisations du réel et des frais de gestion estimés, fait moins bien.
    expect(comparaison.scenarios.map(s => [s.statut, s.netApresImpots])).toEqual([["SASU", 19346], ["EURL", 21487], ["EI", 21623], ["micro", 21803], ["micro-vfl", 22157]])
    expect(comparaison.warnings).toContainEqual(expect.stringContaining("Ostéopathe : la SASU et l'EURL classiques ne sont pas désignées comme meilleur statut"))
  })

  it("kinésithérapeute : lignes de la CARPIMKO, prise en charge de l'Assurance maladie, déplacements, et pas de micro-entreprise", () => {
    const { report, comparaison } = simulerLeMontage(MONTAGES_TYPES.find(m => m.id === "kinesitherapeute-ei")!)
    const [cabinet] = report.activities
    const tns = cabinet.cotisationsTNS!
    const c = tns.cotisations
    expect([c.maladieMaternite, c.retraiteDeBase, c.retraiteComplementaire, c.invaliditeDeces, tns.caisse!.asv, tns.caisse!.curps, tns.caisse!.priseEnCharge.maladie, tns.caisse!.priseEnCharge.asv].map(Math.round)).toEqual([45, 4741, 3891, 1022, 296, 45, 2483, 554])
    // Une seule année : la complémentaire et l'ASV se calculent sur le revenu de 2026, ce que la carte signale.
    expect(tns.caisse!.baseDesCotisationsDeLAnneePrecedente).toMatchObject({ annee: 2026, anneePrecedenteConnue: false })
    expect(cabinet.fraisDeDeplacement).toEqual({ kilometres: 4000, montant: 2544, deductible: true })
    expect(comparaison.scenarios.map(s => [s.statut, s.netApresImpots])).toEqual([["SASU", 37867], ["EURL", 39506], ["EI", 38570]])
    // L'EURL fait mieux, mais n'est pas désignée : le kinésithérapeute exerce en principe en société d'exercice libéral.
    expect(comparaison.warnings).toContainEqual(expect.stringContaining("Micro-entreprise non proposée"))
    expect(comparaison.warnings).toContainEqual(expect.stringContaining("Masseur-kinésithérapeute : la SASU et l'EURL classiques ne sont pas désignées comme meilleur statut"))
  })

  it("SASU avec salaire : 12 000 € nets valident 4 trimestres", () => {
    const { report } = simulerLeMontage(MONTAGES_TYPES.find(m => m.id === "sasu-salaire-4-trimestres")!)
    // 4 trimestres en 2026 : 4 x 1 803 € de revenu cotisé au moins.
    expect(report.activities[0].cotisationsPresident?.brut).toBeGreaterThan(4 * 1803)
  })

  it("couple en union libre : marié ou pacsé, il paierait 2 115 € d'impôt au lieu de 4 444 €", () => {
    const { comparaison } = simulerLeMontage(MONTAGES_TYPES.find(m => m.id === "couple-union-libre")!)
    expect(comparaison.couples).toEqual([{ personIds: ["p-hugo", "p-emma"], netApresImpotsActuel: 45960, impotSurLeRevenuActuel: 4444, netApresImpotsMaries: 48289, impotSurLeRevenuMaries: 2115 }])
  })
})
