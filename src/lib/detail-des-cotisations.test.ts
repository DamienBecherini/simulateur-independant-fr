// src/lib/detail-des-cotisations.test.ts

import { describe, expect, it } from "vitest"
import { ANNEE_COURANTE } from "@/backend/logic/regles"
import { simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { grilleVide, type ActivityResult, type Company, type FinancialFlow, type MicroEntreprise, type Relationship, type SessionState } from "@/types"
import { makeCompany, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { arrondiesAuTotal, detailDesCotisations, lignesAvantArrondi, precisionDesCotisations } from "./detail-des-cotisations"

const somme = (lignes: { montant: number }[]) => lignes.reduce((total, l) => total + l.montant, 0)

/** Une situation : l'activité « a1 », son dirigeant « p1 », un salarié facultatif « p2 », les flux annuels saisis en janvier. */
interface Situation {
  nom: string
  activite: Company | MicroEntreprise
  relation: Relationship["type"]
  flux: { type: FinancialFlow["type"]; montant: number; surLaPersonne?: string }[]
  salarie?: number
  annees?: number[]
}

function sessionDe({ activite, relation, flux, salarie, annees = [ANNEE_COURANTE] }: Situation): SessionState {
  const personnes = [makePerson({ id: "p1", name: "Camille" }), ...(salarie ? [makePerson({ id: "p2", name: "Dominique" })] : [])]
  const relations: Relationship[] = [{ id: "r1", fromId: "p1", toId: "a1", type: relation }, ...(salarie ? [{ id: "r2", fromId: "p2", toId: "a1", type: "Salarié" as const }] : [])]
  const tous = [...flux.map(f => ({ ...f, entite: f.surLaPersonne ?? "a1" })), ...(salarie ? [{ type: "salary" as const, montant: salarie, entite: "p2" }] : [])]
  return {
    name: "Détail des cotisations",
    entities: [...personnes, activite],
    relationships: relations,
    annees: annees.map(annee => {
      const monthlyData = grilleVide()
      tous.forEach((f, i) => monthlyData[0].flows.push({ id: `f-${annee}-${i}`, label: f.type, amount: f.montant, entityId: f.entite, type: f.type }))
      return { annee, monthlyData }
    })
  }
}

/** L'activité « a1 » de la dernière année simulée. */
function activiteSimulee(situation: Situation): ActivityResult {
  const { annees } = simulerLesAnnees(sessionDe(situation))
  const report = annees[annees.length - 1].report
  const activite = report?.activities.find(a => a.entityId === "a1")
  if (!activite) throw new Error(`${situation.nom} : activité non simulée (${annees[annees.length - 1].erreur ?? "sans erreur"})`)
  return activite
}

const ei = (profession?: string, partConventionnee?: number) => makeCompany({ id: "a1", name: "Cabinet", legalStatus: "EI", ...(profession ? { profession } : {}), ...(partConventionnee === undefined ? {} : { partConventionnee }) })
const eurl = (profession?: string) => makeCompany({ id: "a1", name: "Société", legalStatus: "EURL", capitalSocial: 1000, ...(profession ? { profession } : {}) })
const sasu = () => makeCompany({ id: "a1", name: "Société", legalStatus: "SASU", capitalSocial: 1000 })
const micro = (options: Partial<MicroEntreprise> = {}) => makeMicro({ id: "a1", name: "Atelier", ...options })

/** Chaque statut, chaque caisse calculée, et des revenus de part et d'autre des seuils (assiettes minimales, allocations familiales, plafonds). */
const SITUATIONS: Situation[] = [
  ...[0, 3000, 54000, 70000, 300000].map(ca => ({ nom: `EI non réglementée, ${ca} €`, activite: ei(), relation: "Titulaire" as const, flux: [{ type: "ca_services" as const, montant: ca }] })),
  ...[0, 54000, 180000].map(ca => ({ nom: `EI ostéopathe (CIPAV), ${ca} €`, activite: ei("osteopathe"), relation: "Titulaire" as const, flux: [{ type: "ca_services" as const, montant: ca }] })),
  { nom: "EI masseur-kinésithérapeute (CARPIMKO), conventionné à 80 %, deux années", activite: ei("masseur-kinesitherapeute", 0.8), relation: "Titulaire", flux: [{ type: "ca_services", montant: 60000 }], annees: [ANNEE_COURANTE - 1, ANNEE_COURANTE] },
  { nom: "EI infirmier (CARPIMKO), une année", activite: ei("infirmier"), relation: "Titulaire", flux: [{ type: "ca_services", montant: 45000 }] },
  { nom: "EI avec un salarié", activite: ei(), relation: "Titulaire", flux: [{ type: "ca_services", montant: 90000 }], salarie: 24000 },
  { nom: "EURL, rémunération et dividendes au-delà de 10 % du capital", activite: eurl(), relation: "Gérant", flux: [{ type: "ca_services", montant: 90000 }, { type: "director_remuneration", montant: 30000 }, { type: "dividends_payment", montant: 15000 }] },
  { nom: "EURL d'un ostéopathe (CIPAV)", activite: eurl("osteopathe"), relation: "Gérant", flux: [{ type: "ca_services", montant: 80000 }, { type: "director_remuneration", montant: 40000 }] },
  { nom: "EURL sans rémunération", activite: eurl(), relation: "Gérant", flux: [{ type: "ca_services", montant: 20000 }] },
  { nom: "SASU, rémunération du président et dividendes", activite: sasu(), relation: "Président", flux: [{ type: "ca_services", montant: 90000 }, { type: "director_remuneration", montant: 36000 }, { type: "dividends_payment", montant: 10000 }] },
  { nom: "SASU avec un salarié", activite: sasu(), relation: "Président", flux: [{ type: "ca_services", montant: 120000 }, { type: "director_remuneration", montant: 30000 }], salarie: 21000 },
  { nom: "Micro-entreprise BNC", activite: micro(), relation: "Titulaire", flux: [{ type: "ca_micro_services_bnc", montant: 36000 }] },
  { nom: "Micro-entreprise de vente et de services BIC", activite: micro(), relation: "Titulaire", flux: [{ type: "ca_micro_vente", montant: 30000 }, { type: "ca_micro_services_bic", montant: 20000 }] },
  { nom: "Micro-entreprise d'un ostéopathe (CIPAV)", activite: micro({ profession: "osteopathe" }), relation: "Titulaire", flux: [{ type: "ca_micro_services_bnc", montant: 36000 }] },
  { nom: "Micro-entreprise à l'ACRE, créée en mars", activite: micro({ beneficieACRE: true, dateDeCreation: `${ANNEE_COURANTE}-03` }), relation: "Titulaire", flux: [{ type: "ca_micro_services_bic", montant: 30000 }] },
  { nom: "Micro-entreprise à l'ACRE sans date de création", activite: micro({ beneficieACRE: true }), relation: "Titulaire", flux: [{ type: "ca_micro_services_bnc", montant: 30000 }] },
  { nom: "Micro-entreprise avec un salarié", activite: micro(), relation: "Titulaire", flux: [{ type: "ca_micro_vente", montant: 70000 }], salarie: 12000 }
]

/** La situation dont le nom commence par `motif` (expression régulière). */
function situation(motif: string): Situation {
  const trouvee = SITUATIONS.find(s => new RegExp(`^${motif}`).test(s.nom))
  if (!trouvee) throw new Error(`Aucune situation « ${motif} »`)
  return trouvee
}

describe("detailDesCotisations : le détail somme exactement au total", () => {
  it.each(SITUATIONS.map(s => [s.nom, s] as const))("%s", (_, situation) => {
    const activite = activiteSimulee(situation)
    // Avant arrondi : toutes les lignes que le moteur calcule, rien d'oublié (le total est arrondi à l'euro).
    expect(Math.abs(somme(lignesAvantArrondi(activite)) - activite.cotisationsSociales)).toBeLessThanOrEqual(0.5 + 1e-9)
    // Affiché : des euros entiers, dont la somme est le total affiché.
    const detail = detailDesCotisations(activite)
    if (activite.cotisationsSociales > 0) expect(detail.length).toBeGreaterThan(1)
    if (detail.length > 0) expect(somme(detail)).toBe(activite.cotisationsSociales)
    for (const ligne of detail) expect(Number.isInteger(ligne.montant)).toBe(true)
  })

  it("travailleur non salarié : une ligne par cotisation du moteur, CSG-CRDS, indemnités journalières et formation comprises", () => {
    const activite = activiteSimulee(situation("EI non réglementée, 54000"))
    const libelles = detailDesCotisations(activite).map(l => l.libelle)
    expect(libelles).toEqual(["dont maladie-maternité", "dont indemnités journalières", "dont retraite de base", "dont retraite complémentaire", "dont invalidité-décès", "dont CSG déductible", "dont CSG non déductible et CRDS", "dont formation professionnelle"])
    expect(detailDesCotisations(activite).find(l => l.libelle === "dont CSG déductible")?.precision).toMatch(/^[\d,]+ % de l'assiette$/)
    expect(detailDesCotisations(activite).at(-1)?.precision).toBe("forfait annuel, dû même sans revenu")
    expect(precisionDesCotisations(activite)).toMatch(/^assiette de [\d\s]+ € \(54\s000 € de revenu avant cotisations, après l'abattement forfaitaire\) ; montant définitif de l'année, que l'Urssaf appelle d'abord en acomptes provisionnels puis régularise$/)
  })

  it("au-delà du seuil des allocations familiales, la ligne apparaît", () => {
    expect(detailDesCotisations(activiteSimulee(situation("EI non réglementée, 300000"))).map(l => l.libelle)).toContain("dont allocations familiales")
  })

  it("profession libérale réglementée : les libellés de la caisse remplacent ceux du bloc commun, l'ASV et la CURPS s'ajoutent", () => {
    const libelles = detailDesCotisations(activiteSimulee(situation("EI masseur"))).map(l => l.libelle)
    expect(libelles).toEqual(expect.arrayContaining(["dont maladie (Urssaf)", "dont indemnités journalières", "dont retraite de base (CNAVPL)", "dont retraite complémentaire (CARPIMKO)", "dont invalidité-décès (CARPIMKO)", "dont CSG déductible", "dont avantage social vieillesse (ASV)", "dont CURPS"]))
    expect(libelles).not.toContain("dont maladie-maternité")
  })

  it("président de SASU : les cotisations par groupe, parts salariale et patronale ; pas de précision pour un autre statut", () => {
    const activite = activiteSimulee(situation("SASU, rémunération"))
    const detail = detailDesCotisations(activite)
    expect(detail.map(l => l.libelle)).toEqual(["dont maladie", "dont retraite de base", "dont retraite complémentaire (Agirc-Arrco)", "dont allocations familiales", "dont CSG et CRDS", "dont autres contributions"])
    expect(detail[0].precision).toMatch(/^[\d\s]+ € salariales, [\d\s]+ € patronales$/)
    expect(precisionDesCotisations(activite)).toBeNull()
  })

  it("salariés : leurs cotisations patronales, réduction générale déduite", () => {
    const ligne = detailDesCotisations(activiteSimulee(situation("EI avec un salarié"))).at(-1)
    expect(ligne?.libelle).toBe("dont cotisations patronales du salarié")
    expect(ligne?.precision).toMatch(/^après [\d\s]+ € de réduction générale$/)
  })

  it("micro-entreprise : cotisations au taux de la caisse, puis formation professionnelle ; l'ACRE est rappelée", () => {
    expect(detailDesCotisations(activiteSimulee(situation("Micro-entreprise d.un ostéopathe")))[0].precision).toMatch(/^[\d,]+ % du chiffre d'affaires \(CIPAV\)$/)
    const acre = detailDesCotisations(activiteSimulee(situation("Micro-entreprise à l.ACRE, créée")))
    expect(acre.map(l => l.libelle)).toEqual(["dont cotisations sociales", "dont formation professionnelle"])
    expect(acre[0].precision).toMatch(/^pourcentage du chiffre d'affaires de chaque nature d'activité ; après [\d\s]+ € de réduction ACRE$/)
  })
})

describe("arrondiesAuTotal", () => {
  it("donne l'écart d'arrondi aux plus fortes parties décimales", () => {
    expect(arrondiesAuTotal([{ montant: 1.4 }, { montant: 1.4 }, { montant: 1.2 }], 4).map(l => l.montant)).toEqual([2, 1, 1])
    expect(arrondiesAuTotal([{ montant: 0.5 }, { montant: 0.5 }], 1).map(l => l.montant)).toEqual([1, 0])
  })

  it("retire aux plus faibles parties décimales quand les lignes dépassent le total", () => {
    expect(arrondiesAuTotal([{ montant: 2.9 }, { montant: 3.1 }], 5).map(l => l.montant)).toEqual([2, 3])
    expect(arrondiesAuTotal([{ montant: 2 }, { montant: 3 }], 4).map(l => l.montant)).toEqual([2, 2])
  })

  it("garde les montants entiers et les autres champs ; rien sans lignes", () => {
    expect(arrondiesAuTotal([{ montant: 10, libelle: "a" }, { montant: -3, libelle: "b" }], 7)).toEqual([{ montant: 10, libelle: "a" }, { montant: -3, libelle: "b" }])
    expect(arrondiesAuTotal([], 12)).toEqual([])
  })
})
