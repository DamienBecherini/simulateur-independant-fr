// src/backend/logic/dispositifs.test.ts

import { describe, expect, it } from "vitest"
import { grilleVide } from "../../types.js"
import { calculerMicro } from "./calculsAE.js"
import {
  acreDeLAnnee,
  beneficeExonereEnZone,
  ecrireMois,
  exonerationDeZoneDeLAnnee,
  joursDActivite,
  libelleDuMois,
  lireMois,
  moisCouverts,
  noteACRE,
  noteCFE,
  partDeCFEDue,
  periodeACRE,
  prorataDesPlafonds,
  regimeDeZone,
  regimesMicroDesAnnees
} from "./dispositifs.js"
import { evaluerProtectionSociale } from "./protection-sociale.js"
import { reglesPubliees } from "./regles.js"

const regles2025 = reglesPubliees(2025)
const regles2026 = reglesPubliees(2026)

describe("mois de création", () => {
  it("lit et écrit « AAAA-MM »", () => {
    expect(lireMois("2026-09")).toEqual({ annee: 2026, mois: 9 })
    expect(ecrireMois({ annee: 2026, mois: 9 })).toBe("2026-09")
    expect(libelleDuMois({ annee: 2027, mois: 6 })).toBe("juin 2027")
    expect(libelleDuMois({ annee: 2027, mois: 6 }, false)).toBe("juin")
  })

  it("écarte une valeur absente ou mal formée", () => {
    for (const valeur of [undefined, "", "2026-13", "2026-00", "2026-9", "septembre 2026"]) expect(lireMois(valeur), String(valeur)).toBeNull()
  })
})

describe("prorata des plafonds l'année de création", () => {
  it("compte les jours du 1er du mois de création au 31 décembre", () => {
    expect(joursDActivite({ annee: 2026, mois: 9 })).toBe(122)
    expect(joursDActivite({ annee: 2026, mois: 1 })).toBe(365)
    expect(joursDActivite({ annee: 2028, mois: 1 })).toBe(366)
  })

  it("ne réduit que l'année de création, jamais au-delà de l'année entière", () => {
    expect(prorataDesPlafonds({ annee: 2026, mois: 9 }, 2026)).toBeCloseTo(122 / 365, 10)
    expect(prorataDesPlafonds({ annee: 2026, mois: 9 }, 2027)).toBe(1)
    expect(prorataDesPlafonds({ annee: 2028, mois: 1 }, 2028)).toBe(1)
    expect(prorataDesPlafonds(null, 2026)).toBe(1)
  })
})

describe("période de l'ACRE d'une micro-entreprise", () => {
  it("court jusqu'à la fin du 3e trimestre civil qui suit celui du début d'activité (exemple de F11677)", () => {
    // Début le 3 septembre 2026 (3e trimestre) : fin le 30 juin 2027. Début en juillet : même fin, sur 12 mois.
    expect(periodeACRE({ annee: 2026, mois: 9 }, regles2026)).toEqual({ debut: { annee: 2026, mois: 9 }, fin: { annee: 2027, mois: 6 }, reduction: 0.25 })
    expect(periodeACRE({ annee: 2026, mois: 7 }, regles2026).fin).toEqual({ annee: 2027, mois: 6 })
    expect(periodeACRE({ annee: 2026, mois: 12 }, regles2026).fin).toEqual({ annee: 2027, mois: 9 })
    expect(periodeACRE({ annee: 2026, mois: 1 }, regles2026).fin).toEqual({ annee: 2026, mois: 12 })
  })

  it("réduit de 50 % pour une création jusqu'en juin 2026, de 25 % à partir de juillet 2026", () => {
    expect(periodeACRE({ annee: 2026, mois: 6 }, regles2026).reduction).toBe(0.5)
    expect(periodeACRE({ annee: 2026, mois: 7 }, regles2026).reduction).toBe(0.25)
    expect(periodeACRE({ annee: 2025, mois: 3 }, regles2025).reduction).toBe(0.5)
    // Avant les taux connus (création d'avant 2020), la réduction de l'année.
    expect(periodeACRE({ annee: 2019, mois: 3 }, regles2026).reduction).toBe(regles2026.microEntreprise.reductionACRE)
  })

  it("donne les mois couverts de chaque année", () => {
    const periode = periodeACRE({ annee: 2026, mois: 9 }, regles2026)
    expect(moisCouverts(periode, 2025)).toEqual([])
    expect(moisCouverts(periode, 2026)).toEqual([8, 9, 10, 11])
    expect(moisCouverts(periode, 2027)).toEqual([0, 1, 2, 3, 4, 5])
    expect(moisCouverts(periode, 2028)).toEqual([])
  })

  it("ne s'applique qu'avec l'ACRE et une date de création", () => {
    const grille = grilleVide()
    expect(acreDeLAnnee({ id: "m1", beneficieACRE: false, dateDeCreation: "2026-09" }, 2026, grille, regles2026)).toBeNull()
    expect(acreDeLAnnee({ id: "m1", beneficieACRE: true }, 2026, grille, regles2026)).toBeNull()
    expect(acreDeLAnnee({ id: "m1", beneficieACRE: true, dateDeCreation: "2026-09" }, 2026, grille, regles2026)?.mois).toEqual([8, 9, 10, 11])
  })

  it("n'écrit pas de note une année que l'aide ne couvre pas, et dit « en » pour un seul mois", () => {
    const acre = acreDeLAnnee({ id: "m1", beneficieACRE: true, dateDeCreation: "2026-12" }, 2028, grilleVide(), regles2026)!
    expect(noteACRE(acre, 2028, 0)).toBeNull()
    const decembre = acreDeLAnnee({ id: "m1", beneficieACRE: true, dateDeCreation: "2026-12" }, 2026, grilleVide(), regles2026)!
    expect(noteACRE(decembre, 2026, 0)).toMatch(/sur le chiffre d'affaires en décembre 2026,/)
  })
})

describe("cotisations d'une micro-entreprise avec l'ACRE sur une partie de l'année", () => {
  const entrees = { caVente: 0, caServicesBic: 0, caServicesBnc: 40000, beneficieACRE: true, opteVFL: false }

  it("ne réduit que le chiffre d'affaires des mois couverts, sans l'avertissement d'une année entière", () => {
    // 40 000 x 25,6 % = 10 240 € ; réduction 10 000 x 25,6 % x 25 % = 640 € ; dû : 9 600 €, plus 0,2 % de formation
    // professionnelle que l'ACRE ne réduit pas (80 €).
    const resultat = calculerMicro({ ...entrees, caSousACRE: { caVente: 0, caServicesBic: 0, caServicesBnc: 10000 }, reductionACRE: 0.25 }, regles2026)
    expect(resultat.cotisationsSociales).toBeCloseTo(9600 + 80, 6)
    expect(resultat.warnings.some(w => w.startsWith("ACRE"))).toBe(false)
  })

  it("sans mois couverts, à plein taux", () => {
    expect(calculerMicro({ ...entrees, caSousACRE: { caVente: 0, caServicesBic: 0, caServicesBnc: 0 }, reductionACRE: 0.25 }, regles2026).cotisationsSociales).toBeCloseTo(10240 + 80, 6)
  })

  it("compte les droits à la retraite sur les cotisations réduites des seuls mois couverts", () => {
    const chiffreAffairesMicro = { caVente: 0, caServicesBic: 0, caServicesBnc: 40000 }
    const toute = evaluerProtectionSociale("micro", { remunerationBrute: 0, assietteTNS: 0, chiffreAffairesMicro, beneficieACRE: true }, regles2026)
    const partielle = evaluerProtectionSociale("micro", { remunerationBrute: 0, assietteTNS: 0, chiffreAffairesMicro, beneficieACRE: true, acre: { reduction: 0.25, chiffreAffaires: { caVente: 0, caServicesBic: 0, caServicesBnc: 10000 } } }, regles2026)
    const terminee = evaluerProtectionSociale("micro", { remunerationBrute: 0, assietteTNS: 0, chiffreAffairesMicro, beneficieACRE: true, acre: { reduction: 0.25, chiffreAffaires: { caVente: 0, caServicesBic: 0, caServicesBnc: 0 } } }, regles2026)
    expect(partielle.trimestres).toBeGreaterThanOrEqual(toute.trimestres)
    expect(partielle.resume).toMatch(/ACRE/)
    expect(terminee.resume).not.toMatch(/ACRE/)
  })
})

describe("CFE d'une activité créée récemment", () => {
  const mars2026 = { annee: 2026, mois: 3 }

  it("rien l'année de création (ni avant), la moitié l'année suivante, tout ensuite", () => {
    expect([2025, 2026, 2027, 2028].map(annee => partDeCFEDue(mars2026, annee, regles2026))).toEqual([0, 0, 0.5, 1])
    expect(partDeCFEDue(null, 2026, regles2026)).toBe(1)
  })

  it("le dit, sauf quand elle est due en entier", () => {
    expect(noteCFE(mars2026, 2025, regles2026)).toBe("CFE non comptée en 2025 : l'activité n'est créée qu'en mars 2026.")
    expect(noteCFE(mars2026, 2028, regles2026)).toBeNull()
    expect(noteCFE(null, 2026, regles2026)).toBeNull()
  })
})

describe("régime des micro-entreprises d'une session", () => {
  const avecCA = (montant: number) => {
    const grille = grilleVide()
    grille[0].flows.push({ id: `ca-${montant}`, label: "CA", amount: montant, entityId: "m1", type: "ca_micro_services_bnc" })
    return grille
  }

  it("ignore une année sans règles connues et les années avant la création", () => {
    const session = {
      entities: [{ id: "m1", type: "micro-entreprise", dateDeCreation: "2026-01" }],
      annees: [2023, 2024, 2025, 2026, 2027].map(annee => ({ annee, monthlyData: avecCA(200000) }))
    }
    const regimes = regimesMicroDesAnnees(session)
    expect(regimes.get(2023)).toEqual({ sorties: {}, annonces: {}, retours: [] })
    // Créée en 2026 : 2024 et 2025 ne comptent pas, malgré leur chiffre d'affaires ; 2026 et 2027 au-delà : sortie en 2028.
    expect(regimes.get(2026)?.sorties).toEqual({})
    expect(regimes.get(2027)?.annonces).toEqual({ m1: { depuis: 2028, depassements: [2026, 2027] } })
  })

  it("réunit les micro-entreprises d'un même titulaire : elles sortent du régime ensemble, sur leur chiffre d'affaires total", () => {
    // Deux micro-entreprises à 50 000 € de prestations chacune : aucune ne dépasse seule, leur total dépasse.
    const grille = () => {
      const g = grilleVide()
      for (const id of ["m1", "m2"]) g[0].flows.push({ id: `ca-${id}`, label: "CA", amount: 50000, entityId: id, type: "ca_micro_services_bnc" })
      return g
    }
    const micros = [
      { id: "m1", type: "micro-entreprise" },
      { id: "m2", type: "micro-entreprise" }
    ]
    const annees = [2025, 2026, 2027].map(annee => ({ annee, monthlyData: grille() }))
    const titulaire = (personne: string, microId: string) => ({ fromId: personne, toId: microId, type: "Titulaire" as const })

    const memeTitulaire = regimesMicroDesAnnees({ entities: [{ id: "alice", type: "person" }, ...micros], relationships: [titulaire("alice", "m1"), titulaire("alice", "m2")], annees })
    const sortie = { depuis: 2027, depassements: [2025, 2026] }
    expect(memeTitulaire.get(2026)?.annonces).toEqual({ m1: sortie, m2: sortie })
    expect(memeTitulaire.get(2027)?.sorties).toEqual({ m1: sortie, m2: sortie })

    // Deux titulaires : deux entreprises, chacune sous ses plafonds.
    const deuxTitulaires = regimesMicroDesAnnees({ entities: [{ id: "alice", type: "person" }, { id: "bob", type: "person" }, ...micros], relationships: [titulaire("alice", "m1"), titulaire("bob", "m2")], annees })
    expect(deuxTitulaires.get(2027)).toEqual({ sorties: {}, annonces: {}, retours: [] })
    // Sans relations connues, rien n'est réuni.
    expect(regimesMicroDesAnnees({ entities: micros, annees }).get(2027)?.sorties).toEqual({})
  })

  it("ne concerne que les micro-entreprises", () => {
    const session = { entities: [{ id: "m1", type: "company" }], annees: [2026, 2027, 2028].map(annee => ({ annee, monthlyData: avecCA(200000) })) }
    expect(regimesMicroDesAnnees(session).get(2028)?.sorties).toEqual({})
  })
})

describe("exonération d'impôt sur les bénéfices en zone (ADR 017)", () => {
  const exoneration = (creation: string, annee: number) => exonerationDeZoneDeLAnnee(lireMois(creation)!, annee, regles2026)

  it("le régime est celui de la date de création : ZFU-TE jusqu'en décembre 2025, QPV de janvier 2026 à décembre 2030", () => {
    const regime = (creation: string) => regimeDeZone(lireMois(creation)!, regles2026)?.id ?? null
    expect(["2015-01", "2024-03", "2025-12"].map(regime)).toEqual(["zfuTe", "zfuTe", "zfuTe"])
    expect(["2026-01", "2028-07", "2030-12"].map(regime)).toEqual(["qpv", "qpv", "qpv"])
    // Avant 2015 (régimes plus anciens, tous terminés) ou après 2030 : aucun régime.
    expect(["2014-12", "2031-01"].map(regime)).toEqual([null, null])
    expect(exoneration("2014-12", 2026)).toBeNull()
  })

  it("le régime ne dépend pas de l'année simulée : une ZFU-TE de 2025 le reste dans les règles de 2025 comme de 2026", () => {
    expect(regimeDeZone({ annee: 2025, mois: 6 }, regles2025)?.id).toBe("zfuTe")
    expect(regimeDeZone({ annee: 2025, mois: 6 }, regles2026)?.id).toBe("zfuTe")
  })

  it("soixante mois d'exonération totale à partir du mois de création, puis 60 %, 40 % et 20 % par périodes de douze mois", () => {
    // Créée en janvier 2024 : les périodes suivent les années civiles.
    expect([2024, 2025, 2026, 2027, 2028].map(annee => exoneration("2024-01", annee)?.partExoneree)).toEqual([1, 1, 1, 1, 1])
    expect([2029, 2030, 2031, 2032, 2033].map(annee => exoneration("2024-01", annee)?.partExoneree)).toEqual([0.6, 0.4, 0.2, 0, 0])
    expect(exoneration("2024-01", 2026)).toMatchObject({ moisDActivite: 12, finExonerationTotale: { annee: 2028, mois: 12 }, fin: { annee: 2031, mois: 12 } })
  })

  it("une année à cheval sur deux taux prend la moyenne de ses mois", () => {
    // Créée en mars 2021 : exonération totale jusqu'en février 2026, puis 60 % de mars 2026 à février 2027.
    const en2026 = exoneration("2021-03", 2026)!
    expect(en2026.finExonerationTotale).toEqual({ annee: 2026, mois: 2 })
    expect(en2026.partExoneree).toBeCloseTo((2 * 1 + 10 * 0.6) / 12, 10)
    expect(exoneration("2021-03", 2027)!.partExoneree).toBeCloseTo((2 * 0.6 + 10 * 0.4) / 12, 10)
    // Dernière année : deux mois à 20 %, puis plus rien.
    expect(exoneration("2021-03", 2029)!.partExoneree).toBeCloseTo((2 * 0.2) / 12, 10)
    expect(exoneration("2021-03", 2029)!.fin).toEqual({ annee: 2029, mois: 2 })
    expect(exoneration("2021-03", 2030)!.partExoneree).toBe(0)
  })

  it("l'année de création ne compte que ses mois d'activité, et le plafond de la ZFU-TE suit au prorata", () => {
    // Créée en octobre 2025 : trois mois d'activité, tous exonérés ; plafond de 50 000 € x 3 / 12.
    expect(exoneration("2025-10", 2025)).toMatchObject({ moisDActivite: 3, partExoneree: 1, plafond: 12500 })
    expect(exoneration("2025-10", 2026)).toMatchObject({ moisDActivite: 12, partExoneree: 1, plafond: 50000 })
    // Avant la création : aucun mois d'activité, rien d'exonéré.
    expect(exoneration("2025-10", 2024)).toMatchObject({ moisDActivite: 0, partExoneree: 0, plafond: 0 })
  })

  it("le régime QPV n'a pas de plafond annuel", () => {
    expect(exoneration("2026-07", 2026)).toMatchObject({ moisDActivite: 6, partExoneree: 1, plafond: null })
    expect(exoneration("2026-07", 2031)!.partExoneree).toBeCloseTo((6 * 1 + 6 * 0.6) / 12, 10)
  })

  it("bénéfice exonéré : part dans la zone, taux de l'année, puis plafond", () => {
    const totale = { partExoneree: 1, plafond: 50000 }
    expect(beneficeExonereEnZone(30000, 1, totale)).toBe(30000)
    expect(beneficeExonereEnZone(80000, 1, totale)).toBe(50000)
    // 60 % du chiffre d'affaires dans la zone : 48 000 € exonérables, sous le plafond.
    expect(beneficeExonereEnZone(80000, 0.6, totale)).toBe(48000)
    // Le plafond joue après le taux dégressif : 120 000 € x 60 % = 72 000 €, ramenés à 50 000 €.
    expect(beneficeExonereEnZone(120000, 1, { partExoneree: 0.6, plafond: 50000 })).toBe(50000)
    expect(beneficeExonereEnZone(120000, 1, { partExoneree: 0.6, plafond: null })).toBe(72000)
  })

  it("une perte n'exonère rien, et une part hors limites est ramenée entre 0 et 1", () => {
    const totale = { partExoneree: 1, plafond: null }
    expect(beneficeExonereEnZone(-5000, 1, totale)).toBe(0)
    expect(beneficeExonereEnZone(0, 1, totale)).toBe(0)
    expect(beneficeExonereEnZone(10000, 1.5, totale)).toBe(10000)
    expect(beneficeExonereEnZone(10000, -0.2, totale)).toBe(0)
  })
})
