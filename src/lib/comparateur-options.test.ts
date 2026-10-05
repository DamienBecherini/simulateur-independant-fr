// src/lib/comparateur-options.test.ts

import { describe, expect, it } from "vitest"
import { activiteComparee, appliquerRemuneration, avecLaRetraiteParDefaut, avecLeMode, avecActiviteComparee, avecRemuneration, avecRemunerationSaisie, avecReglagesDeLActivite, comparableActivities, defaultComparisonOptions, defaultFraisFonctionnement, descriptionDuMode, libellesCourtsRepartition, libellesRepartition, optionsDuComparateur, partBncUtile, plafondDeRemuneration, reglagesDeLActiviteComparee, retenirLesReglages } from "@/lib/comparateur-options"
import { createCompany, createMicroEntreprise, createPerson } from "@/lib/entity-factory"
import type { ComparaisonOptions, FinancialFlow, DonneesDeLAnnee, OptimisationRemuneration, PointRemuneration } from "@/types"

function session(flows: Omit<FinancialFlow, "id" | "label">[] = []): DonneesDeLAnnee {
  const monthlyData = Array.from({ length: 12 }, (_, month) => ({ month, flows: [] as FinancialFlow[] }))
  flows.forEach((flow, i) => monthlyData[i % 12].flows.push({ id: `f${i}`, label: flow.type, ...flow }))
  return { entities: [], relationships: [], monthlyData }
}

describe("comparableActivities", () => {
  it("ne retient que les activités, dans l'ordre de la session", () => {
    const sasu = createCompany("SASU")
    const micro = createMicroEntreprise()

    expect(comparableActivities({ ...session(), entities: [createPerson(), sasu, micro] })).toEqual([sasu, micro])
  })
})

describe("defaultFraisFonctionnement", () => {
  it("prévoit des frais pour chaque statut, expert-comptable compris en société", () => {
    const frais = defaultFraisFonctionnement()

    expect(Object.keys(frais)).toEqual(["SASU", "EURL", "EI", "micro"])
    expect(frais.SASU.expertComptable).toBeGreaterThan(frais.EI.expertComptable)
    expect(frais.micro.expertComptable).toBe(0)
    expect(frais.micro.assurance).toBeGreaterThan(0)
  })

  it("renvoie une copie à chaque appel", () => {
    const frais = defaultFraisFonctionnement()
    frais.SASU.expertComptable = 0

    expect(defaultFraisFonctionnement().SASU.expertComptable).toBeGreaterThan(0)
  })
})

describe("defaultComparisonOptions", () => {
  it("reprend la rémunération annuelle saisie et garde les dividendes saisis", () => {
    const donnees = session([
      { entityId: "s1", type: "director_remuneration", amount: 2000 },
      { entityId: "s1", type: "director_remuneration", amount: 2000 },
      { entityId: "s1", type: "dividends_payment", amount: 5000 },
      { entityId: "autre", type: "director_remuneration", amount: 9000 }
    ])

    expect(defaultComparisonOptions(donnees, "s1")).toEqual({ activityId: "s1", remunerationNette: 4000, repartition: { mode: "grille", partDistribuee: 1 }, partBncPrestations: 1, fraisFonctionnement: defaultFraisFonctionnement() })
  })

  it("sans dividende saisi, se place au meilleur net, en exigeant 4 trimestres de retraite", () => {
    expect(defaultComparisonOptions(session([{ entityId: "m1", type: "ca_micro_vente", amount: 1000 }]), "m1")).toEqual({ activityId: "m1", remunerationNette: 0, repartition: { mode: "meilleurNet", partDistribuee: 1, avecRetraite: true }, partBncPrestations: 1, fraisFonctionnement: defaultFraisFonctionnement() })
  })

  it("au meilleur net, garde la rémunération saisie pour les autres modes", () => {
    const options = defaultComparisonOptions(session([{ entityId: "s1", type: "director_remuneration", amount: 2500 }]), "s1")

    expect(options).toMatchObject({ remunerationNette: 2500, repartition: { mode: "meilleurNet" } })
  })
})

describe("avecRemuneration", () => {
  const options = (mode: ComparaisonOptions["repartition"]["mode"]): ComparaisonOptions => ({ activityId: "s1", remunerationNette: 0, repartition: { mode, partDistribuee: 0.4 }, partBncPrestations: 1 })

  it("reste en répartition personnalisée, en distribuant tout le reste", () => {
    expect(avecRemuneration(options("personnalisee"), 12000)).toMatchObject({ remunerationNette: 12000, repartition: { mode: "personnalisee", partDistribuee: 1 } })
  })

  it("passe sinon à « le reste en dividendes »", () => {
    for (const mode of ["meilleurNet", "dividendes", "remuneration", "grille"] as const) expect(avecRemuneration(options(mode), 8000)).toMatchObject({ remunerationNette: 8000, repartition: { mode: "dividendes", partDistribuee: 1 } })
  })
})

describe("appliquerRemuneration", () => {
  const point = (remunerationNette: number, trimestres: number): PointRemuneration => ({ remunerationNette, dividendes: 0, netApresImpots: 0, cotisationsSociales: 0, impotSocietes: 0, impotSurLeRevenu: 0, prelevementsSociaux: 0, trimestres })
  const optimisation: OptimisationRemuneration = { statut: "SASU", remunerationMaximale: 30000, points: [], meilleur: point(0, 0), meilleurAvecRetraite: point(5800, 4), warnings: [] }
  const options = (mode: ComparaisonOptions["repartition"]["mode"], avecRetraite?: boolean): ComparaisonOptions => ({ activityId: "s1", remunerationNette: 1000, repartition: { mode, partDistribuee: 1, ...(avecRetraite === undefined ? {} : { avecRetraite }) }, partBncPrestations: 1 })

  it("au meilleur net, coche « 4 trimestres » pour le meilleur point qui les valide, et la décoche pour le meilleur", () => {
    expect(appliquerRemuneration(options("meilleurNet"), 5800, optimisation)).toEqual(options("meilleurNet", true))
    expect(appliquerRemuneration(options("meilleurNet", true), 0, optimisation)).toEqual(options("meilleurNet", false))
  })

  it("reporte toute autre rémunération, et hors du meilleur net, la rémunération telle quelle", () => {
    expect(appliquerRemuneration(options("meilleurNet"), 12000, optimisation)).toMatchObject({ remunerationNette: 12000, repartition: { mode: "dividendes" } })
    expect(appliquerRemuneration(options("grille"), 5800, optimisation)).toMatchObject({ remunerationNette: 5800, repartition: { mode: "dividendes" } })
    expect(appliquerRemuneration(options("meilleurNet"), 5800, null)).toMatchObject({ remunerationNette: 5800, repartition: { mode: "dividendes" } })
  })
})

describe("réglages enregistrés du comparateur", () => {
  const sasu = { ...createCompany("SASU"), id: "sasu" }
  const micro = { ...createMicroEntreprise(), id: "micro" }
  /** L'année 2026 : la SASU verse 20 000 € de rémunération et des dividendes. */
  const vue = { ...session([{ entityId: "sasu", type: "director_remuneration", amount: 20000 }, { entityId: "sasu", type: "dividends_payment", amount: 5000 }]), entities: [createPerson(), sasu, micro], name: "Test", annee: 2026 }

  it("compare l'activité choisie, ou la première si elle a disparu ou si rien n'est choisi", () => {
    expect(activiteComparee(vue, { activiteComparee: "micro", reglagesParActivite: {} })).toBe(micro)
    expect(activiteComparee(vue, { activiteComparee: "supprimee", reglagesParActivite: {} })).toBe(sasu)
    expect(activiteComparee(vue, undefined)).toBe(sasu)
    expect(reglagesDeLActiviteComparee({ ...vue, entities: [] }, undefined)).toBeNull()
  })

  it("sans réglage enregistré, propose les réglages tirés de la grille de l'année", () => {
    expect(optionsDuComparateur(vue, "sasu", undefined)).toEqual(defaultComparisonOptions(vue, "sasu"))
    expect(optionsDuComparateur(vue, "sasu", {})).toEqual(defaultComparisonOptions(vue, "sasu"))
  })

  it("applique les réglages choisis ; la rémunération saisie ne vaut que pour son année", () => {
    const frais = { ...defaultFraisFonctionnement(), micro: { expertComptable: 0, banque: 0, logiciel: 0, assurance: 0, cfe: 0 } }
    const reglages = { repartition: { mode: "personnalisee" as const, partDistribuee: 0.5 }, remunerationParAnnee: { "2025": 9000 }, partBncPrestations: 0.2, fraisFonctionnement: frais }

    expect(optionsDuComparateur(vue, "sasu", reglages)).toEqual({ activityId: "sasu", remunerationNette: 20000, repartition: { mode: "personnalisee", partDistribuee: 0.5 }, partBncPrestations: 0.2, fraisFonctionnement: frais })
    expect(optionsDuComparateur({ ...vue, annee: 2025 }, "sasu", reglages).remunerationNette).toBe(9000)
    expect(reglagesDeLActiviteComparee(vue, { reglagesParActivite: { sasu: reglages } })?.options.partBncPrestations).toBe(0.2)
  })

  it("au meilleur net, exige 4 trimestres de retraite tant que la case n'a pas été décochée, y compris dans les réglages enregistrés sans elle", () => {
    const sansDividendes = { ...vue, monthlyData: session([]).monthlyData }
    expect(optionsDuComparateur(sansDividendes, "sasu", undefined).repartition).toEqual({ mode: "meilleurNet", partDistribuee: 1, avecRetraite: true })
    // Réglages d'une sauvegarde antérieure à ce défaut : le meilleur net choisi, sans la case.
    expect(optionsDuComparateur(vue, "sasu", { repartition: { mode: "meilleurNet", partDistribuee: 1 } }).repartition.avecRetraite).toBe(true)
    // Une case décochée reste décochée.
    expect(optionsDuComparateur(vue, "sasu", { repartition: { mode: "meilleurNet", partDistribuee: 1, avecRetraite: false } }).repartition.avecRetraite).toBe(false)
    // Hors du meilleur net, la case n'a pas de sens : rien n'est ajouté.
    expect(avecLaRetraiteParDefaut({ mode: "grille", partDistribuee: 1 })).toEqual({ mode: "grille", partDistribuee: 1 })
  })

  it("en changeant de mode, ne garde la case des 4 trimestres que décochée", () => {
    expect(avecLeMode({ mode: "meilleurNet", partDistribuee: 1, avecRetraite: true }, "dividendes")).toEqual({ mode: "dividendes", partDistribuee: 1 })
    expect(avecLeMode({ mode: "meilleurNet", partDistribuee: 1, avecRetraite: false }, "dividendes")).toEqual({ mode: "dividendes", partDistribuee: 1, avecRetraite: false })
    expect(avecLaRetraiteParDefaut(avecLeMode({ mode: "dividendes", partDistribuee: 1 }, "meilleurNet"))).toEqual({ mode: "meilleurNet", partDistribuee: 1, avecRetraite: true })
  })

  it("une case décochée est enregistrée, et le reste après rechargement des réglages", () => {
    const sansDividendes = { ...vue, monthlyData: session([]).monthlyData }
    const avant = optionsDuComparateur(sansDividendes, "sasu", undefined)
    const reglages = retenirLesReglages(undefined, avant, { ...avant, repartition: { ...avant.repartition, avecRetraite: false } }, 2026)
    // Réglages enregistrés puis relus, comme après un rechargement de la page.
    const relus = JSON.parse(JSON.stringify(reglages))
    expect(optionsDuComparateur(sansDividendes, "sasu", relus).repartition).toEqual({ mode: "meilleurNet", partDistribuee: 1, avecRetraite: false })
  })

  it("ne retient que les réglages changés, en gardant ceux déjà choisis", () => {
    const avant = defaultComparisonOptions(vue, "sasu")
    const dejaChoisis = { partBncPrestations: 0.4, remunerationParAnnee: { "2025": 9000 } }

    expect(retenirLesReglages(undefined, avant, avant, 2026)).toEqual({})
    expect(retenirLesReglages(dejaChoisis, avant, { ...avant, remunerationNette: 12000 }, 2026)).toEqual({ partBncPrestations: 0.4, remunerationParAnnee: { "2025": 9000, "2026": 12000 } })
    expect(retenirLesReglages(undefined, avant, { ...avant, repartition: { ...avant.repartition, avecRetraite: true } }, 2026)).toEqual({ repartition: { mode: "grille", partDistribuee: 1, avecRetraite: true } })
    expect(retenirLesReglages(undefined, avant, { ...avant, repartition: { ...avant.repartition, avecRetraite: false } }, 2026)).toEqual({})
    // Au meilleur net, les 4 trimestres sont exigés d'office : seule la case décochée est un choix à retenir.
    const auMeilleurNet = { ...avant, repartition: avecLaRetraiteParDefaut({ mode: "meilleurNet", partDistribuee: 1 }) }
    expect(retenirLesReglages(undefined, auMeilleurNet, { ...auMeilleurNet, repartition: { mode: "meilleurNet", partDistribuee: 1 } }, 2026)).toEqual({})
    expect(retenirLesReglages(undefined, auMeilleurNet, { ...auMeilleurNet, repartition: { mode: "meilleurNet", partDistribuee: 1, avecRetraite: false } }, 2026)).toEqual({ repartition: { mode: "meilleurNet", partDistribuee: 1, avecRetraite: false } })
    const frais = { ...defaultFraisFonctionnement(), EI: { ...defaultFraisFonctionnement().EI, cfe: 0 } }
    expect(retenirLesReglages(undefined, avant, { ...avant, partBncPrestations: 0.7, fraisFonctionnement: frais }, 2026)).toEqual({ partBncPrestations: 0.7, fraisFonctionnement: frais })
  })

  it("range les réglages par activité, et retient l'activité comparée", () => {
    const comparateur = avecReglagesDeLActivite(undefined, "sasu", { partBncPrestations: 0.5 })
    expect(comparateur).toEqual({ activiteComparee: "sasu", reglagesParActivite: { sasu: { partBncPrestations: 0.5 } } })
    expect(avecReglagesDeLActivite(comparateur, "micro", {})).toEqual({ activiteComparee: "micro", reglagesParActivite: { sasu: { partBncPrestations: 0.5 }, micro: {} } })
    expect(avecActiviteComparee(comparateur, "micro")).toEqual({ activiteComparee: "micro", reglagesParActivite: { sasu: { partBncPrestations: 0.5 } } })
    expect(avecActiviteComparee(undefined, "micro")).toEqual({ activiteComparee: "micro", reglagesParActivite: {} })
  })
})

describe("modes de partage du bénéfice", () => {
  it("donne aux boutons des libellés courts, dans l'ordre des libellés explicites des exports", () => {
    expect(Object.keys(libellesCourtsRepartition)).toEqual(Object.keys(libellesRepartition))
    expect(Object.values(libellesCourtsRepartition)).toEqual(["Meilleur net", "Ma rémunération", "Tout en rémunération", "Sur mesure", "Selon la grille"])
    expect(libellesRepartition.dividendes).toBe("Rémunération saisie, le reste en dividendes")
  })

  it("décrit chaque mode en une phrase, les 4 trimestres au meilleur net quand ils sont exigés", () => {
    expect(descriptionDuMode("meilleurNet")).toBe("Chaque société verse la rémunération qui donne le meilleur net, le reste en dividendes.")
    expect(descriptionDuMode("meilleurNet", true)).toBe("Chaque société verse la rémunération qui donne le meilleur net parmi celles qui valident 4 trimestres de retraite, le reste en dividendes.")
    expect(descriptionDuMode("dividendes")).toBe("La rémunération que vous saisissez, tout le reste du bénéfice en dividendes.")
    expect(descriptionDuMode("remuneration")).toBe("La rémunération la plus haute que la société peut verser, sans dividendes.")
    expect(descriptionDuMode("personnalisee", true)).toBe("Vous réglez la rémunération et la part du bénéfice distribuée ; le reste reste dans la société.")
    expect(descriptionDuMode("grille")).toBe("Les rémunérations et dividendes saisis dans la grille.")
  })

  it("ne fait saisir la rémunération qu'avec « Ma rémunération » et « Sur mesure »", () => {
    expect((Object.keys(libellesRepartition) as (keyof typeof libellesRepartition)[]).filter(avecRemunerationSaisie)).toEqual(["dividendes", "personnalisee"])
  })
})

describe("plafondDeRemuneration", () => {
  const optimisation = (statut: "SASU" | "EURL", remunerationMaximale: number): OptimisationRemuneration => ({ statut, remunerationMaximale, points: [], meilleur: null, meilleurAvecRetraite: null, warnings: [] })

  it("reprend la rémunération maximale sans déficit du statut étudié", () => {
    expect(plafondDeRemuneration(optimisation("SASU", 41300), "SASU")).toBe(41300)
    expect(plafondDeRemuneration(optimisation("EURL", 52800), "EURL")).toBe(52800)
  })

  it("attend l'arbitrage du statut étudié, et vaut 0 sans bénéfice", () => {
    expect(plafondDeRemuneration(optimisation("EURL", 52800), "SASU")).toBeNull()
    expect(plafondDeRemuneration(null, "SASU")).toBeNull()
    expect(plafondDeRemuneration(optimisation("SASU", 0), "SASU")).toBe(0)
  })
})

describe("partBncUtile", () => {
  const sasu = { ...createCompany("SASU"), id: "sasu" }

  it("ne sert qu'à une société ou une EI qui facture des prestations", () => {
    expect(partBncUtile(session([{ entityId: "sasu", type: "ca_services", amount: 5000 }]), sasu)).toBe(true)
    expect(partBncUtile(session([{ entityId: "sasu", type: "ca_vente", amount: 5000 }]), sasu)).toBe(false)
    expect(partBncUtile(session([{ entityId: "autre", type: "ca_services", amount: 5000 }]), sasu)).toBe(false)
    expect(partBncUtile(session([{ entityId: "sasu", type: "ca_services", amount: 0 }]), sasu)).toBe(false)
  })

  it("ne sert pas à une micro-entreprise, dont les prestations sont déjà en BNC ou en BIC", () => {
    const micro = { ...createMicroEntreprise(), id: "micro" }
    expect(partBncUtile(session([{ entityId: "micro", type: "ca_micro_services_bnc", amount: 5000 }]), micro)).toBe(false)
  })
})
