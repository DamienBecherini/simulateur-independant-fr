// src/backend/logic/references/exoneration-de-zone.reference.test.ts

import { describe, expect, it } from "vitest"
import { grilleVide, type Company, type ComparaisonOptions, type Entity, type MicroEntreprise, type SessionState } from "../../../types.js"
import { comparerStatutsDeLAnnee, simulerLesAnnees } from "../simulation-pluriannuelle.js"
import { exercant, micro, personne, societe, type Flux } from "../testing/session-de-test.js"

/*
 * Cas de référence de l'exonération d'impôt sur les bénéfices en zone (voir l'ADR 017), avec les règles réelles de 2025
 * et de 2026 (reprises pour 2027 et au-delà tant que les règles suivantes ne sont pas connues). Chaque attendu chiffré
 * est dérivé à la main ; les cotisations des travailleurs indépendants, longues à dériver, sont comparées à celles de la
 * même activité hors zone : l'exonération ne doit pas les changer.
 *
 * Règles utilisées :
 * - ZFU-TE (article 44 octies A du CGI, BOI-BIC-CHAMP-80-10-30) : activités créées jusqu'au 31 décembre 2025 ; soixante
 *   mois d'exonération totale à partir du mois de création, puis 60 %, 40 % et 20 % exonérés par périodes de douze
 *   mois ; bénéfice exonéré plafonné à 50 000 € par période de douze mois, après le taux dégressif ;
 * - QPV (article 44 octies B du CGI, loi n° 2026-103) : créations de 2026 à 2030, même calendrier, sans plafond annuel ;
 * - le bénéfice exonéré s'entend après imputation des déficits antérieurs (BOI-BIC-CHAMP-80-10-20-40, § 100) ;
 * - versement libératoire : pas d'exonération (BOI-BIC-DECLA-10-40-20, § 140) ;
 * - revenu fiscal de référence : le bénéfice exonéré d'impôt sur le revenu s'y ajoute (article 1417, IV, 1°, b du CGI) ;
 * - IS : 15 % jusqu'à 42 500 € de bénéfice, 25 % au-delà ;
 * - barème pour une part : 0 % jusqu'à 11 600 €, 11 % jusqu'à 29 579 €, 30 % au-delà ;
 * - micro-entreprise, prestations BIC : abattement de 50 %, cotisations de 21,2 % et formation de 0,3 % du chiffre
 *   d'affaires, versement libératoire de 1,7 % ; prestations BNC : abattement de 34 %.
 *
 * Alice, célibataire (1 part), n'a pas d'autre revenu que son activité ; sans rémunération, le président de SASU ne
 * coûte aucune cotisation.
 */

const EN_ZONE = { implantationEnZone: {} }

function grille(flux: Flux[]) {
  const monthlyData = grilleVide()
  flux.forEach(([entityId, type, amount], i) => monthlyData[0].flows.push({ id: `flux-${i}`, label: type, amount, entityId, type }))
  return monthlyData
}

function session(activite: Company | MicroEntreprise, annees: Record<number, Flux[]>): SessionState {
  const statut = activite.type === "company" ? activite.legalStatus : "micro"
  const entities: Entity[] = [personne("alice"), activite]
  return { name: "Zone", entities, relationships: exercant("alice", activite.id, statut), annees: Object.entries(annees).map(([annee, flux]) => ({ annee: Number(annee), monthlyData: grille(flux) })) }
}

const rapportDe = (s: SessionState, annee = 2026) => simulerLesAnnees(s).annees.find(a => a.annee === annee)!.report!
const activiteDe = (s: SessionState, annee = 2026) => rapportDe(s, annee).activities[0]
/** Les montants sont écrits avec des espaces insécables : on les compare en espaces simples. */
const espaces = (textes: string[] | undefined) => textes?.map(texte => texte.replace(/\s/g, " "))

describe("SASU en ZFU-TE créée en janvier 2024", () => {
  const sasu: Company = { ...societe("a1"), dateDeCreation: "2024-01", ...EN_ZONE }
  const horsZone: Company = { ...societe("a1"), dateDeCreation: "2024-01" }

  it("30 000 € de bénéfice en 2026 : aucun impôt sur les sociétés", () => {
    // Hors zone : 30 000 x 15 % = 4 500 € d'IS. En zone, 2026 est la troisième année : tout le bénéfice est exonéré.
    expect(activiteDe(session(horsZone, { 2026: [["a1", "ca_services", 30000]] }))).toMatchObject({ impotSocietes: 4500, resultatConserve: 25500 })
    const resultat = activiteDe(session(sasu, { 2026: [["a1", "ca_services", 30000]] }))
    expect(resultat).toMatchObject({ impotSocietes: 0, resultatConserve: 30000 })
    expect(resultat.exonerationDeZone).toEqual({
      regime: "zfuTe",
      nom: "ZFU-TE",
      partExoneree: 1,
      partDansLaZone: 1,
      beneficeExonere: 30000,
      plafond: 50000,
      plafondAtteint: false,
      finExonerationTotale: "2028-12",
      fin: "2031-12",
      // Une société ne voit pas l'hypothèse qui ne concerne que les cotisations de l'entreprise individuelle.
      hypotheses: [expect.stringContaining("à cheval sur deux taux")] as string[],
      conditionsNonVerifiees: {
        resume: "Exonération ZFU-TE appliquée sans vérifier ses conditions",
        avertissement: resultat.warnings[0],
        source: "https://bofip.impots.gouv.fr/bofip/5903-PGP.html/identifiant=BOI-BIC-CHAMP-80-10-30-20250702"
      }
    })
    expect(espaces(resultat.dispositifs)).toEqual(["ZFU-TE : bénéfice exonéré d'impôt à 100 % en 2026, soit 30 000 €. Exonération totale jusqu'à fin décembre 2028, puis dégressive (60 %, 40 %, 20 %) jusqu'à fin décembre 2031."])
    // Un seul avertissement : les conditions que le simulateur ne vérifie pas, et le renvoi aux hypothèses.
    expect(resultat.warnings).toHaveLength(1)
    expect(resultat.warnings[0]).toMatch(/^Exonération ZFU-TE appliquée sans vérifier ses conditions : moins de 50 salariés.*Hypothèses du calcul dans la fiche de l'activité\.$/)
  })

  it("80 000 € de bénéfice : 50 000 € exonérés, le reste au taux réduit", () => {
    // Hors zone : 42 500 x 15 % + 37 500 x 25 % = 6 375 + 9 375 = 15 750 €. En zone : IS sur 30 000 €, soit 4 500 €.
    expect(activiteDe(session(horsZone, { 2026: [["a1", "ca_services", 80000]] })).impotSocietes).toBe(15750)
    const resultat = activiteDe(session(sasu, { 2026: [["a1", "ca_services", 80000]] }))
    expect(resultat).toMatchObject({ impotSocietes: 4500, resultatConserve: 75500 })
    expect(resultat.exonerationDeZone).toMatchObject({ beneficeExonere: 50000, plafond: 50000, plafondAtteint: true })
    expect(espaces(resultat.dispositifs)?.[0]).toMatch(/^ZFU-TE : bénéfice exonéré d'impôt à 100 % en 2026, soit 50 000 € : plafond de 50 000 € atteint\./)
  })

  it("le bénéfice distribué en dividendes profite de l'impôt sur les sociétés en moins", () => {
    // 80 000 € de bénéfice, 75 500 € distribuables (80 000 - 4 500 d'IS), tous distribués : prélèvement forfaitaire de
    // 12,8 % + 18,6 % ou barème, au choix le plus favorable. Hors zone, seuls 64 250 € sont distribuables.
    const tout = (activite: Company) => rapportDe(session(activite, { 2026: [["a1", "ca_services", 80000], ["a1", "dividends_payment", 80000]] }))
    const enZone = tout(sasu)
    const hors = tout(horsZone)
    expect(enZone.activities[0].partage?.dividendesNets).toBe(75500)
    expect(hors.activities[0].partage?.dividendesNets).toBe(64250)
    // Prélèvements sociaux : 18,6 % des dividendes versés.
    expect(enZone.foyers[0].prelevementsSociaux).toBe(Math.round(75500 * 0.186))
    expect(enZone.foyers[0].netApresImpots).toBeGreaterThan(hors.foyers[0].netApresImpots + 7000)
    // À l'impôt sur les sociétés, rien ne s'ajoute au revenu fiscal de référence du foyer.
    expect(enZone.foyers[0].beneficesExoneres).toBeUndefined()
  })

  it("60 % du chiffre d'affaires dans la zone : l'exonération suit", () => {
    // 80 000 € x 60 % = 48 000 € exonérés, sous le plafond ; IS sur 32 000 € : 4 800 €.
    const partielle: Company = { ...sasu, implantationEnZone: { partDuChiffreDAffaires: 0.6 } }
    const resultat = activiteDe(session(partielle, { 2026: [["a1", "ca_services", 80000]] }))
    expect(resultat.impotSocietes).toBe(4800)
    expect(resultat.exonerationDeZone).toMatchObject({ beneficeExonere: 48000, partDansLaZone: 0.6, plafondAtteint: false })
    expect(espaces(resultat.dispositifs)?.[0]).toMatch(/^ZFU-TE : bénéfice exonéré d'impôt à 100 % en 2026 \(60 % du chiffre d'affaires réalisé dans la zone\), soit 48 000 €\./)
  })

  it("le déficit de l'année précédente se déduit avant l'exonération", () => {
    // 2025 : perte de 20 000 €. 2026 : bénéfice de 50 000 €, 30 000 € après le déficit, entièrement exonérés.
    const s = session(sasu, { 2025: [["a1", "deductible_expense", 20000]], 2026: [["a1", "ca_services", 50000]] })
    const en2026 = activiteDe(s, 2026)
    expect(en2026.impotSocietes).toBe(0)
    expect(en2026.reserves?.deficitImpute).toBe(20000)
    expect(en2026.exonerationDeZone?.beneficeExonere).toBe(30000)
  })
})

describe("SASU en ZFU-TE créée en mars 2021 : la sortie progressive, d'une année à l'autre", () => {
  // Exonération totale jusqu'en février 2026, puis 60 % (mars 2026 à février 2027), 40 %, 20 % jusqu'en février 2029.
  const sasu: Company = { ...societe("a1"), dateDeCreation: "2021-03", ...EN_ZONE }
  const flux: Flux[] = [["a1", "ca_services", 60000]]
  const s = session(sasu, { 2026: flux, 2027: flux, 2028: flux, 2029: flux, 2030: flux })
  const horsZone = 42500 * 0.15 + 17500 * 0.25 // 10 750 €

  it("2026 : deux mois à 100 % et dix à 60 %, soit 66,7 % du bénéfice", () => {
    // 60 000 x 8 / 12 = 40 000 € exonérés ; IS sur 20 000 € : 3 000 €.
    const resultat = activiteDe(s, 2026)
    expect(resultat.impotSocietes).toBe(3000)
    expect(resultat.exonerationDeZone).toMatchObject({ beneficeExonere: 40000, finExonerationTotale: "2026-02", fin: "2029-02" })
    expect(resultat.exonerationDeZone?.partExoneree).toBeCloseTo(2 / 3, 10)
    expect(espaces(resultat.dispositifs)).toEqual(["ZFU-TE : bénéfice exonéré d'impôt à 66,7 % en 2026, soit 40 000 €. Exonération dégressive (60 %, 40 %, 20 % par périodes de douze mois) jusqu'à fin février 2029."])
  })

  it("2027 à 2029 : la part exonérée baisse, l'impôt sur les sociétés remonte", () => {
    // 2027 : (2 x 60 % + 10 x 40 %) / 12 = 43,33 %, soit 26 000 € exonérés ; IS sur 34 000 € : 5 100 €.
    expect(activiteDe(s, 2027)).toMatchObject({ impotSocietes: 5100, exonerationDeZone: { beneficeExonere: 26000 } })
    // 2028 : (2 x 40 % + 10 x 20 %) / 12 = 23,33 %, soit 14 000 € exonérés ; IS sur 46 000 € : 6 375 + 875 = 7 250 €.
    expect(activiteDe(s, 2028)).toMatchObject({ impotSocietes: 7250, exonerationDeZone: { beneficeExonere: 14000 } })
    // 2029 : deux mois à 20 %, soit 3,33 % : 2 000 € exonérés ; IS sur 58 000 € : 6 375 + 3 875 = 10 250 €.
    expect(activiteDe(s, 2029)).toMatchObject({ impotSocietes: 10250, exonerationDeZone: { beneficeExonere: 2000 } })
  })

  it("2030 : exonération terminée, l'impôt est celui d'une société hors zone, sans avertissement", () => {
    const resultat = activiteDe(s, 2030)
    expect(resultat.impotSocietes).toBe(horsZone)
    expect(resultat.exonerationDeZone).toMatchObject({ beneficeExonere: 0, sansExoneration: "terminee" })
    expect(resultat.dispositifs).toEqual(["ZFU-TE : exonération d'impôt terminée depuis fin février 2029."])
    expect(resultat.warnings).toEqual([])
  })
})

describe("SASU en QPV créée en juillet 2026", () => {
  const sasu: Company = { ...societe("a1"), dateDeCreation: "2026-07", ...EN_ZONE }

  it("exonération entière, sans plafond annuel", () => {
    // 120 000 € de bénéfice : hors zone, 6 375 + 77 500 x 25 % = 25 750 € d'IS ; en QPV, rien.
    const resultat = activiteDe(session(sasu, { 2026: [["a1", "ca_services", 120000]] }))
    expect(resultat.impotSocietes).toBe(0)
    expect(resultat.exonerationDeZone).toMatchObject({ regime: "qpv", nom: "QPV", beneficeExonere: 120000, plafondAtteint: false, finExonerationTotale: "2031-06", fin: "2034-06" })
    expect(resultat.exonerationDeZone).not.toHaveProperty("plafond")
    expect(resultat.exonerationDeZone?.hypotheses).toEqual([expect.stringContaining("à cheval sur deux taux"), expect.stringContaining("n'a pas encore publié son commentaire")])
    expect(resultat.warnings[0]).toMatch(/^Exonération QPV appliquée sans vérifier ses conditions : activité commerciale, artisanale ou profession de santé/)
    expect(resultat.exonerationDeZone?.conditionsNonVerifiees).toEqual({ resume: "Exonération QPV appliquée sans vérifier ses conditions", avertissement: resultat.warnings[0], source: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053521035" })
  })

  it("avec 60 % du chiffre d'affaires dans le quartier", () => {
    // 72 000 € exonérés ; IS sur 48 000 € : 6 375 + 5 500 x 25 % = 7 750 €.
    const partielle: Company = { ...sasu, implantationEnZone: { partDuChiffreDAffaires: 0.6 } }
    expect(activiteDe(session(partielle, { 2026: [["a1", "ca_services", 120000]] }))).toMatchObject({ impotSocietes: 7750, exonerationDeZone: { beneficeExonere: 72000 } })
  })
})

describe("entreprise individuelle au réel en ZFU-TE", () => {
  const ei: Company = { ...societe("a1", "EI", 0), dateDeCreation: "2024-01", ...EN_ZONE }
  const horsZone: Company = { ...societe("a1", "EI", 0), dateDeCreation: "2024-01" }
  const flux = (ca: number): Flux[] => [["a1", "ca_services", ca], ["a1", "deductible_expense", 10000]]

  it("bénéfice sous le plafond : plus d'impôt sur le revenu, cotisations et revenu fiscal de référence inchangés", () => {
    const hors = rapportDe(session(horsZone, { 2026: flux(60000) }))
    const enZone = rapportDe(session(ei, { 2026: flux(60000) }))
    expect(hors.foyers[0].impotSurLeRevenu).toBeGreaterThan(3000)
    expect(enZone.foyers[0].impotSurLeRevenu).toBe(0)
    // Les cotisations portent sur le bénéfice entier : l'exonération ne les change pas. Les exonérations fiscales ne
    // sont pas admises en déduction de leur assiette, et la notice Urssaf 2026 des indépendants cite l'article 44 octies A
    // parmi elles : ce n'est plus une hypothèse.
    expect(enZone.activities[0].cotisationsSociales).toBe(hors.activities[0].cotisationsSociales)
    expect(enZone.activities[0].exonerationDeZone?.hypotheses).toEqual([expect.stringContaining("à cheval sur deux taux")])
    expect(enZone.activities[0].revenuVerse).toBe(hors.activities[0].revenuVerse)
    // Tout le bénéfice imposable est exonéré : il quitte le barème et revient dans le revenu fiscal de référence.
    expect(enZone.foyers[0].revenuImposableGlobal).toBe(0)
    expect(enZone.foyers[0].beneficesExoneres).toBe(hors.foyers[0].revenuImposableGlobal)
    expect(enZone.foyers[0].revenuFiscalDeReference).toBe(hors.foyers[0].revenuFiscalDeReference)
    expect(enZone.activities[0].exonerationDeZone?.beneficeExonere).toBe(hors.foyers[0].revenuImposableGlobal)
    // Le net du foyer gagne exactement l'impôt économisé.
    expect(enZone.foyers[0].netApresImpots - hors.foyers[0].netApresImpots).toBe(hors.foyers[0].impotSurLeRevenu)
  })

  it("bénéfice au-delà du plafond : 50 000 € quittent le barème, pas plus", () => {
    const hors = rapportDe(session(horsZone, { 2026: flux(150000) }))
    const enZone = rapportDe(session(ei, { 2026: flux(150000) }))
    expect(hors.foyers[0].revenuImposableGlobal).toBeGreaterThan(50000)
    expect(enZone.foyers[0].revenuImposableGlobal).toBe(hors.foyers[0].revenuImposableGlobal - 50000)
    expect(enZone.foyers[0]).toMatchObject({ beneficesExoneres: 50000, revenuFiscalDeReference: hors.foyers[0].revenuFiscalDeReference })
    expect(enZone.activities[0].exonerationDeZone).toMatchObject({ beneficeExonere: 50000, plafondAtteint: true })
  })

  it("un déficit n'exonère rien et s'impute comme avant", () => {
    const pertes: Flux[] = [["a1", "ca_services", 5000], ["a1", "deductible_expense", 20000]]
    const enZone = activiteDe(session(ei, { 2026: pertes }))
    expect(enZone.exonerationDeZone).toMatchObject({ beneficeExonere: 0, partExoneree: 1 })
    expect(espaces(enZone.dispositifs)?.[0]).toMatch(/^ZFU-TE : exonération d'impôt à 100 % en 2026, sans bénéfice imposable à exonérer cette année\./)
    expect(rapportDe(session(ei, { 2026: pertes })).foyers[0].beneficesExoneres).toBeUndefined()
  })
})

describe("micro-entreprise en QPV créée en janvier 2026", () => {
  const boutique = (options: Partial<MicroEntreprise> = {}): MicroEntreprise => ({ ...micro("a1"), dateDeCreation: "2026-01", ...EN_ZONE, ...options })
  const prestations: Flux[] = [["a1", "ca_micro_services_bic", 60000]]

  it("sans versement libératoire : le bénéfice après abattement est exonéré, les cotisations restent dues", () => {
    // 60 000 € de prestations BIC : cotisations 60 000 x 21,2 % + 60 000 x 0,3 % = 12 900 € ; bénéfice après abattement
    // de 50 % : 30 000 €. Hors zone : impôt (29 579 - 11 600) x 11 % + 421 x 30 % = 1 977,69 + 126,30 = 2 104 €.
    const hors = rapportDe(session({ ...micro("a1"), dateDeCreation: "2026-01" }, { 2026: prestations }))
    expect(hors.foyers[0]).toMatchObject({ impotSurLeRevenu: 2104, revenuFiscalDeReference: 30000 })
    const enZone = rapportDe(session(boutique(), { 2026: prestations }))
    expect(enZone.activities[0]).toMatchObject({ cotisationsSociales: 12900, exonerationDeZone: { regime: "qpv", beneficeExonere: 30000 } })
    expect(enZone.foyers[0]).toMatchObject({ impotSurLeRevenu: 0, revenuImposableGlobal: 0, beneficesExoneres: 30000, revenuFiscalDeReference: 30000, netApresImpots: 47100 })
  })

  it("avec le versement libératoire : aucune exonération, et l'activité dit pourquoi", () => {
    // Versement libératoire : 60 000 x 1,7 % = 1 020 € ; l'exonération, calculée sur un bénéfice, ne joue pas.
    const enZone = rapportDe(session(boutique({ opteVFL: true, rfrN2: 0 }), { 2026: prestations }))
    expect(enZone.foyers[0]).toMatchObject({ impotSurLeRevenu: 1020, revenuFiscalDeReference: 30000 })
    expect(enZone.foyers[0].beneficesExoneres).toBeUndefined()
    const activite = enZone.activities[0]
    expect(activite.exonerationDeZone).toMatchObject({ regime: "qpv", beneficeExonere: 0, sansExoneration: "versementLiberatoire" })
    expect(activite.dispositifs).toBeUndefined()
    expect(activite.warnings).toContain(
      "QPV : aucune exonération d'impôt avec le versement libératoire, qui porte sur le chiffre d'affaires et non sur un bénéfice. Pour en bénéficier, renoncez au versement libératoire jusqu'à fin décembre 2033."
    )
    expect(activite.warnings.some(w => w.startsWith("Exonération QPV appliquée"))).toBe(false)
  })

  it("versement libératoire demandé mais fermé par le revenu fiscal de référence : l'impôt est au barème, donc exonéré", () => {
    const enZone = rapportDe(session(boutique({ opteVFL: true, rfrN2: 40000 }), { 2026: prestations }))
    expect(enZone.foyers[0]).toMatchObject({ impotSurLeRevenu: 0, beneficesExoneres: 30000 })
  })

  it("prestations libérales : l'exonération est calculée, avec le rappel que seules les professions de santé y ont droit", () => {
    // 40 000 € de prestations BNC : bénéfice après abattement de 34 % : 26 400 €, exonéré.
    const liberale = activiteDe(session(boutique(), { 2026: [["a1", "ca_micro_services_bnc", 40000]] }))
    expect(liberale.exonerationDeZone?.beneficeExonere).toBe(26400)
    expect(liberale.warnings).toContain("Recettes libérales en QPV : parmi les professions libérales, seules les professions de santé ont droit à cette exonération.")
    // Une infirmière (CARPIMKO) est une profession de santé : pas de rappel. En ZFU-TE, ouverte aux libéraux, non plus.
    const infirmiere = activiteDe(session(boutique({ profession: "infirmier" }), { 2026: [["a1", "ca_micro_services_bnc", 40000]] }))
    expect(infirmiere.warnings.some(w => w.startsWith("Recettes libérales"))).toBe(false)
    const enZfu = activiteDe(session(boutique({ dateDeCreation: "2025-06" }), { 2026: [["a1", "ca_micro_services_bnc", 40000]] }))
    expect(enZfu.exonerationDeZone?.regime).toBe("zfuTe")
    expect(enZfu.warnings.some(w => w.startsWith("Recettes libérales"))).toBe(false)
  })
})

describe("case cochée sans exonération possible", () => {
  const flux: Flux[] = [["a1", "ca_services", 30000]]

  it("sans date de création : rien n'est exonéré, et l'activité demande la date", () => {
    const resultat = activiteDe(session({ ...societe("a1"), ...EN_ZONE }, { 2026: flux }))
    expect(resultat.impotSocietes).toBe(4500)
    expect(resultat.exonerationDeZone).toEqual({ partExoneree: 0, partDansLaZone: 1, beneficeExonere: 0, plafondAtteint: false, sansExoneration: "sansDateDeCreation", hypotheses: [] })
    expect(resultat.dispositifs).toEqual(["Implantation en zone : indiquez le mois de création de l'activité dans sa fiche. Le régime et le taux d'exonération en dépendent ; rien n'est exonéré en attendant."])
    expect(resultat.warnings).toEqual([])
  })

  it("créée en 2014, avant les régimes modélisés : rien n'est exonéré", () => {
    const resultat = activiteDe(session({ ...societe("a1"), dateDeCreation: "2014-06", ...EN_ZONE }, { 2026: flux }))
    expect(resultat.impotSocietes).toBe(4500)
    expect(resultat.exonerationDeZone?.sansExoneration).toBe("sansRegime")
    expect(resultat.dispositifs).toEqual(["Implantation en zone : aucun régime d'exonération d'impôt pour une activité créée en juin 2014 (ZFU-TE : créations de janvier 2015 à décembre 2025 ; QPV : de janvier 2026 à décembre 2030)."])
  })

  it("case non cochée : aucun champ, aucune note, le calcul d'avant", () => {
    const resultat = activiteDe(session({ ...societe("a1"), dateDeCreation: "2024-01" }, { 2026: flux }))
    expect(resultat.impotSocietes).toBe(4500)
    expect(resultat).not.toHaveProperty("exonerationDeZone")
    expect(resultat).not.toHaveProperty("dispositifs")
  })
})

describe("comparateur : l'exonération suit l'activité d'un statut à l'autre", () => {
  // Une SASU en ZFU-TE, 70 000 € de prestations : chaque colonne au réel et la micro-entreprise en bénéficient ; la
  // micro-entreprise au versement libératoire et le portage salarial, non.
  const sasu: Company = { ...societe("a1"), dateDeCreation: "2024-01", ...EN_ZONE }
  const s = session(sasu, { 2026: [["a1", "ca_services", 70000]] })
  const options: ComparaisonOptions = { activityId: "a1", remunerationNette: 0, repartition: { mode: "dividendes", partDistribuee: 1 }, partBncPrestations: 0 }
  const { scenarios } = comparerStatutsDeLAnnee(s, options, 2026)
  const colonne = (statut: string) => scenarios.find(c => c.statut === statut)!
  const mentionne = (statut: string, debut: string) => espaces(colonne(statut).warnings)!.some(w => w.startsWith(debut))

  it("SASU, EURL, EI au réel et micro-entreprise : exonération appliquée et annoncée", () => {
    for (const statut of ["SASU", "EURL", "EI", "micro"]) {
      expect(mentionne(statut, "ZFU-TE : bénéfice exonéré d'impôt à 100 % en 2026"), statut).toBe(true)
      expect(mentionne(statut, "Exonération ZFU-TE appliquée sans vérifier ses conditions"), statut).toBe(true)
    }
  })

  it("micro-entreprise au versement libératoire et portage salarial : pas d'exonération, la colonne le dit", () => {
    expect(mentionne("micro-vfl", "ZFU-TE : aucune exonération d'impôt avec le versement libératoire")).toBe(true)
    expect(mentionne("micro-vfl", "ZFU-TE : bénéfice exonéré")).toBe(false)
    expect(mentionne("portage", "ZFU-TE : aucune exonération d'impôt en portage salarial")).toBe(true)
    expect(mentionne("portage", "ZFU-TE : bénéfice exonéré")).toBe(false)
  })

  it("la micro-entreprise exonérée d'impôt fait mieux que la même au versement libératoire", () => {
    expect(colonne("micro").netApresImpots).toBeGreaterThan(colonne("micro-vfl").netApresImpots)
  })
})
