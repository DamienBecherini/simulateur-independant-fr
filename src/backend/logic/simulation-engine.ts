// src/backend/logic/simulation-engine.ts

import config from "../config.json" with { type: "json" }
import type { Entity, MicroEntreprise, Person, Relationship, SessionState, SimulationReport, EntityResult, FoyerFiscalResult, SimulationInputs, SimulationResult } from "../../types.js"
import type { FinancialFlow } from "../../types.js"
import { calculerIR } from "./calculsIR.js"
import { simulerSASU } from "./calculsSASU.js"
import { simulerEURL } from "./calculsEURL.js"
import { simulerMicroEntreprise } from "./calculsAE.js"

const BOARD_RELATIONS: Relationship["type"][] = ["Président", "Gérant"]
const COUPLE_RELATIONS: Relationship["type"][] = ["Marié(e)", "PACSé(e)"]

type FlowTotals = Partial<Record<FinancialFlow["type"], number>>

function aggregateAnnualFlowsByEntity(session: SessionState): Map<string, FlowTotals> {
  const map = new Map<string, FlowTotals>()
  for (const month of session.monthlyData) {
    for (const flow of month.flows) {
      const prev = map.get(flow.entityId) ?? {}
      const t = flow.type
      prev[t] = (prev[t] ?? 0) + flow.amount
      map.set(flow.entityId, prev)
    }
  }
  return map
}

function getEntity(session: SessionState, id: string): Entity | undefined {
  return session.entities.find(e => e.id === id)
}

function neighborId(rel: Relationship, entityId: string): string {
  return rel.fromId === entityId ? rel.toId : rel.fromId
}

function isPersonEntity(e: Entity | undefined): e is Person {
  return e?.type === "person"
}

/** Personnes liées à la société par Président / Gérant (relation symétrique). */
function getBoardLinkedPersonIds(session: SessionState, companyId: string): string[] {
  const ids: string[] = []
  for (const rel of session.relationships) {
    if (!BOARD_RELATIONS.includes(rel.type)) continue
    if (rel.fromId !== companyId && rel.toId !== companyId) continue
    const other = neighborId(rel, companyId)
    const ent = getEntity(session, other)
    if (isPersonEntity(ent)) ids.push(other)
  }
  return ids
}

function getTitulairePersonId(session: SessionState, microId: string): string | undefined {
  for (const rel of session.relationships) {
    if (rel.type !== "Titulaire") continue
    if (rel.fromId !== microId && rel.toId !== microId) continue
    const other = neighborId(rel, microId)
    const ent = getEntity(session, other)
    if (isPersonEntity(ent)) return other
  }
  return undefined
}

function directTaxableAnnualPerson(flows: FlowTotals | undefined): number {
  if (!flows) return 0
  return (flows.salary ?? 0) + (flows.are ?? 0) + (flows.other_taxable_income ?? 0)
}

function microRevenuImposableAnnuel(micro: MicroEntreprise, totals: FlowTotals | undefined): number {
  if (!totals || micro.opteVFL) return 0
  const ca_vente = totals.ca_micro_vente ?? 0
  const ca_services_bic = totals.ca_micro_services_bic ?? 0
  const ca_services_bnc = totals.ca_micro_services_bnc ?? 0
  const totalCA = ca_vente + ca_services_bic + ca_services_bnc
  const plafond = ca_vente > ca_services_bic + ca_services_bnc ? config.microEntreprise.plafonds.vente : config.microEntreprise.plafonds.services
  if (totalCA > plafond) return 0

  const ca_imposable_vente = ca_vente * (1 - config.microEntreprise.abattement.vente_bic)
  const ca_imposable_services_bic = ca_services_bic * (1 - config.microEntreprise.abattement.services_bic)
  const ca_imposable_services_bnc = ca_services_bnc * (1 - config.microEntreprise.abattement.services_bnc)
  return Math.max(
    ca_imposable_vente + ca_imposable_services_bic + ca_imposable_services_bnc,
    totalCA > 0 ? config.microEntreprise.abattement.minimum : 0
  )
}

class UnionFind {
  private parent = new Map<string, string>()
  constructor(ids: string[]) {
    for (const id of ids) this.parent.set(id, id)
  }
  find(a: string): string {
    let p = this.parent.get(a) ?? a
    if (p !== a) {
      p = this.find(p)
      this.parent.set(a, p)
    }
    return p
  }
  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
}

function buildFoyers(session: SessionState): { personIds: string[]; totalParts: number }[] {
  const persons = session.entities.filter((e): e is Person => e.type === "person")
  const personIds = persons.map(p => p.id)
  if (personIds.length === 0) return []

  const uf = new UnionFind(personIds)
  for (const rel of session.relationships) {
    if (!COUPLE_RELATIONS.includes(rel.type)) continue
    const a = getEntity(session, rel.fromId)
    const b = getEntity(session, rel.toId)
    if (isPersonEntity(a) && isPersonEntity(b)) uf.union(rel.fromId, rel.toId)
  }

  const clusters = new Map<string, string[]>()
  for (const id of personIds) {
    const r = uf.find(id)
    if (!clusters.has(r)) clusters.set(r, [])
    clusters.get(r)!.push(id)
  }

  const foyers: { personIds: string[]; totalParts: number }[] = []
  for (const memberIds of clusters.values()) {
    const memberSet = new Set(memberIds)
    let parts = 0
    for (const id of memberIds) {
      const p = getEntity(session, id) as Person | undefined
      if (p) parts += p.fiscalParts
    }

    const childIds = new Set<string>()
    for (const rel of session.relationships) {
      if (rel.type !== "Enfant") continue
      const otherFromMember = memberSet.has(rel.fromId) ? rel.toId : memberSet.has(rel.toId) ? rel.fromId : null
      if (otherFromMember === null) continue
      const otherEnt = getEntity(session, otherFromMember)
      if (isPersonEntity(otherEnt) && !memberSet.has(otherFromMember)) childIds.add(otherFromMember)
    }
    parts += childIds.size * 0.5

    foyers.push({ personIds: [...memberIds].sort(), totalParts: parts })
  }
  return foyers
}

function foyerForPerson(foyers: { personIds: string[]; totalParts: number }[], personId: string): { personIds: string[]; totalParts: number } | undefined {
  return foyers.find(f => f.personIds.includes(personId))
}

export function runMetaSimulation(session: SessionState): SimulationReport {
  const aggregates = aggregateAnnualFlowsByEntity(session)
  const foyers = buildFoyers(session)

  const routedRemuneration = new Map<string, number>()
  const entityWarnings = new Map<string, string[]>()

  function addWarning(entityId: string, msg: string) {
    const arr = entityWarnings.get(entityId) ?? []
    arr.push(msg)
    entityWarnings.set(entityId, arr)
  }

  for (const ent of session.entities) {
    if (ent.type !== "company") continue
    const totals = aggregates.get(ent.id)
    const rem = totals?.director_remuneration ?? 0
    const divPay = totals?.dividends_payment ?? 0
    if (divPay > 0) {
      addWarning(ent.id, "Le flux « versement de dividendes » saisi sur la grille n'est pas encore pris en compte par le moteur (dividendes dérivés du bénéfice).")
    }
    if (rem <= 0) continue
    const board = getBoardLinkedPersonIds(session, ent.id)
    if (board.length === 0) {
      addWarning(ent.id, "Rémunération dirigeant saisie sans relation Président/Gérant vers une personne : non routée vers un foyer.")
      continue
    }
    if (board.length > 1) {
      addWarning(ent.id, "Plusieurs dirigeants liés : la rémunération est attribuée au premier pour le routage fiscal simplifié.")
    }
    const target = board[0]!
    routedRemuneration.set(target, (routedRemuneration.get(target) ?? 0) + rem)
  }

  const entities: EntityResult[] = []

  for (const ent of session.entities) {
    const warnings = [...(entityWarnings.get(ent.id) ?? [])]
    const totals = aggregates.get(ent.id)

    if (ent.type === "person") {
      const flows = totals
      const netApprox = directTaxableAnnualPerson(flows)
      const remunerationTransferee = routedRemuneration.get(ent.id) ?? 0
      entities.push({
        entityId: ent.id,
        name: ent.name,
        type: "person",
        chiffreAffaires: 0,
        netDansLaPoche: Math.round(netApprox + remunerationTransferee),
        impotsEtCotisations: 0,
        warnings
      })
      continue
    }

    if (ent.type === "company") {
      const ca = (totals?.ca_services ?? 0) + (totals?.ca_vente ?? 0)
      const charges = totals?.deductible_expense ?? 0
      const rem = totals?.director_remuneration ?? 0
      const board = getBoardLinkedPersonIds(session, ent.id)
      const linkPerson = board[0]
      const foyer = linkPerson ? foyerForPerson(foyers, linkPerson) : undefined
      const partsFiscales = foyer?.totalParts ?? 1
      const autres = linkPerson ? directTaxableAnnualPerson(aggregates.get(linkPerson)) : 0

      const inputs: SimulationInputs = {
        chiffreAffaires: ca,
        chargesDeductibles: charges,
        remunerationNetteVisee: rem,
        capitalSocial: 0,
        autresRevenusImposablesFoyer: autres,
        partsFiscales
      }

      const raw = ent.legalStatus === "SASU" ? simulerSASU(inputs) : simulerEURL(inputs)
      const impotsEtCotisations = Math.max(0, ca - raw.netDansLaPoche)
      const sim = raw as SimulationResult
      if (sim.warning) warnings.push(sim.warning)
      entities.push({
        entityId: ent.id,
        name: ent.name,
        type: "company",
        chiffreAffaires: raw.chiffreAffaires,
        netDansLaPoche: raw.netDansLaPoche,
        impotsEtCotisations: Math.round(impotsEtCotisations),
        warnings
      })
      continue
    }

    if (ent.type === "micro-entreprise") {
      const titulaire = getTitulairePersonId(session, ent.id)
      const foyer = titulaire ? foyerForPerson(foyers, titulaire) : undefined
      const partsFiscales = foyer?.totalParts ?? 1
      const autres = titulaire ? directTaxableAnnualPerson(aggregates.get(titulaire)) : 0

      const inputs: SimulationInputs = {
        ca_services_bic: totals?.ca_micro_services_bic ?? 0,
        ca_services_bnc: totals?.ca_micro_services_bnc ?? 0,
        ca_vente: totals?.ca_micro_vente ?? 0,
        chargesDeductibles: totals?.deductible_expense ?? 0,
        autresRevenusImposablesFoyer: autres,
        partsFiscales,
        beneficieACRE: ent.beneficieACRE,
        opteVFL: ent.opteVFL
      }

      const raw = simulerMicroEntreprise(inputs) as SimulationResult
      const impotsEtCotisations = Math.max(0, raw.chiffreAffaires - raw.netDansLaPoche)
      if (raw.warning) warnings.push(raw.warning)
      if (!titulaire) {
        warnings.push("Aucune relation « Titulaire » vers une personne : parts fiscales par défaut (1).")
      }
      entities.push({
        entityId: ent.id,
        name: ent.name,
        type: "micro-entreprise",
        chiffreAffaires: raw.chiffreAffaires,
        netDansLaPoche: raw.netDansLaPoche,
        impotsEtCotisations: Math.round(impotsEtCotisations),
        warnings
      })
    }
  }

  const foyerResults: FoyerFiscalResult[] = foyers.map(f => {
    let revenu = 0
    for (const pid of f.personIds) {
      revenu += directTaxableAnnualPerson(aggregates.get(pid))
      revenu += routedRemuneration.get(pid) ?? 0
    }
    for (const ent of session.entities) {
      if (ent.type !== "micro-entreprise") continue
      const tid = getTitulairePersonId(session, ent.id)
      if (!tid || !f.personIds.includes(tid)) continue
      revenu += microRevenuImposableAnnuel(ent, aggregates.get(ent.id))
    }
    const impotSurLeRevenu = calculerIR({ revenuNetGlobalImposable: revenu, partsFiscales: f.totalParts })
    return {
      personIds: f.personIds,
      totalParts: f.totalParts,
      revenuImposableGlobal: Math.round(revenu),
      impotSurLeRevenu
    }
  })

  const globalNet = entities.filter(e => e.type === "company" || e.type === "micro-entreprise").reduce((s, e) => s + e.netDansLaPoche, 0)

  return { entities, foyers: foyerResults, globalNet }
}
