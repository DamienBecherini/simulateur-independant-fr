// src/backend/logic/simulationOrchestrator.ts

import type { SessionState, SimulationOutput, Company, MicroEntreprise, Person, FinancialFlow, CompanyResult, PersonResult, HouseholdResult, SimulationInputs, CompanyISResult, IncomeFromCompany, Entity } from "@/types.js"
import { simulerMicroEntreprise } from "./calculsAE.js"
import { simulerEURL } from "./calculsEURL.js"
import { simulerSASU } from "./calculsSASU.js"
import { calculerIR } from "./calculsIR.js"
import config from "../config.json" with { type: "json" }

type AnnualTotals = Map<FinancialFlow["type"], number>

export async function runSimulation(session: SessionState): Promise<SimulationOutput> {
  const output: SimulationOutput = {
    companyResults: [],
    personResults: [],
    householdResults: [],
    errors: []
  }

  // --- ÉTAPE 1: AGRÉGATION DES FLUX ANNUELS PAR ENTITÉ ---
  const annualTotalsByEntity = new Map<string, AnnualTotals>()
  session.entities.forEach(e => annualTotalsByEntity.set(e.id, new Map()))
  session.monthlyData.forEach(month => {
    month.flows.forEach(flow => {
      const entityTotals = annualTotalsByEntity.get(flow.entityId)
      if (entityTotals) {
        entityTotals.set(flow.type, (entityTotals.get(flow.type) || 0) + flow.amount)
      }
    })
  })

  // --- ÉTAPE 2: CALCUL DES RÉSULTATS INDIVIDUELS POUR CHAQUE ACTIVITÉ ---
  const businessEntities = session.entities.filter(e => e.type !== "person") as (Company | MicroEntreprise)[]

  for (const entity of businessEntities) {
    const totals = annualTotalsByEntity.get(entity.id) || new Map()
    let result: CompanyResult | null = null

    if (entity.type === "micro-entreprise") {
      const inputs: SimulationInputs = {
        ca_services_bic: totals.get("ca_micro_services_bic") || 0,
        ca_services_bnc: totals.get("ca_micro_services_bnc") || 0,
        ca_vente: totals.get("ca_micro_vente") || 0,
        depensesReelles: totals.get("expense") || 0,
        beneficieACRE: entity.beneficieACRE,
        opteVFL: entity.opteVFL
      }
      const details = simulerMicroEntreprise(inputs)
      result = { id: entity.id, name: entity.name, type: "MicroEntreprise", details }
    } else {
      const inputs: SimulationInputs = {
        chiffreAffaires: (totals.get("ca_services") || 0) + (totals.get("ca_vente") || 0),
        chargesDeductibles: totals.get("deductible_expense") || 0,
        remunerationNetteVisee: totals.get("director_remuneration") || 0
      }
      let details: CompanyISResult
      if (entity.legalStatus === "SASU") {
        details = simulerSASU(inputs)
        result = { id: entity.id, name: entity.name, type: "SASU", details }
      } else {
        details = simulerEURL(inputs)
        result = { id: entity.id, name: entity.name, type: "EURL", details }
      }
    }
    if (result) output.companyResults.push(result)
  }

  // --- ÉTAPE 3: CALCUL DES REVENUS PAR PERSONNE ---
  const persons = session.entities.filter(e => e.type === "person") as Person[]
  for (const person of persons) {
    const totals = annualTotalsByEntity.get(person.id) || new Map()
    let taxableIncomeFromCompanies = 0
    const cashFromCompanies: IncomeFromCompany[] = []

    // Trouver les revenus issus des sociétés détenues
    session.relationships.forEach(rel => {
      if (rel.fromId === person.id || rel.toId === person.id) {
        const companyId = rel.fromId === person.id ? rel.toId : rel.fromId
        const companyResult = output.companyResults.find(cr => cr.id === companyId)
        const companyEntity = session.entities.find(e => e.id === companyId)
        if (!companyResult || !companyEntity) return

        let cashAmount = 0
        if (companyResult.type === "MicroEntreprise") {
          taxableIncomeFromCompanies += companyResult.details.taxableIncomeAfterAbattement
          cashAmount = companyResult.details.netCashFlow
        } else if (companyResult.type === "SASU" || companyResult.type === "EURL") {
          const companyTotals = annualTotalsByEntity.get(companyId)!
          const remuneration = companyTotals.get("director_remuneration") || 0
          const dividends = companyResult.details.netDividendsPaidToDirector
          taxableIncomeFromCompanies += remuneration
          cashAmount = remuneration + dividends
        }

        if (cashAmount > 0) {
          cashFromCompanies.push({
            companyId: companyId,
            companyName: companyEntity.name,
            avatar: companyEntity.avatar,
            amount: cashAmount
          })
        }
      }
    })

    const personSalaries = totals.get("salary") || 0
    const personARE = totals.get("are") || 0
    const personOtherIncome = totals.get("other_taxable_income") || 0
    const personExpenses = totals.get("expense") || 0

    const personResult: PersonResult = {
      id: person.id,
      name: person.name,
      cashInflows: {
        salaries: personSalaries,
        unemploymentBenefits: personARE,
        otherTaxableIncome: personOtherIncome,
        fromOwnedCompanies: cashFromCompanies
      },
      personalExpenses: personExpenses,
      totalTaxableIncome: personSalaries + personARE + personOtherIncome + taxableIncomeFromCompanies
    }
    output.personResults.push(personResult)
  }

  // --- ÉTAPE 4: IDENTIFICATION DES FOYERS FISCAUX ET CALCUL FINAL ---
  const processedPersonIds = new Set<string>()
  for (const person of persons) {
    if (processedPersonIds.has(person.id)) continue

    const household: Person[] = [person]
    processedPersonIds.add(person.id)
    const spouseRel = session.relationships.find(r => (r.type === "Marié(e)" || r.type === "PACSé(e)") && (r.fromId === person.id || r.toId === person.id))
    if (spouseRel) {
      const spouseId = spouseRel.fromId === person.id ? spouseRel.toId : spouseRel.fromId
      const spouse = persons.find(p => p.id === spouseId)
      if (spouse) {
        household.push(spouse)
        processedPersonIds.add(spouse.id)
      }
    }

    let householdTotalTaxableIncome = 0
    let householdTotalCashInflow = 0
    let householdTotalPersonalExpenses = 0
    let householdFiscalParts = 0
    const householdPersonIds = household.map(p => p.id)
    const householdPersonNames = household.map(p => p.name)

    output.personResults
      .filter(pr => householdPersonIds.includes(pr.id))
      .forEach(pr => {
        householdTotalTaxableIncome += pr.totalTaxableIncome

        // --- CORRECTION: Calcul explicite et plus sûr des flux de trésorerie ---
        const simpleInflows = pr.cashInflows.salaries + pr.cashInflows.unemploymentBenefits + pr.cashInflows.otherTaxableIncome
        const companyInflows = pr.cashInflows.fromOwnedCompanies.reduce((sum, c) => sum + c.amount, 0)
        householdTotalCashInflow += simpleInflows + companyInflows
        // --- FIN DE LA CORRECTION ---

        householdTotalPersonalExpenses += pr.personalExpenses
      })

    household.forEach(p => (householdFiscalParts += p.fiscalParts))

    const incomeTax = calculerIR({ revenuNetGlobalImposable: householdTotalTaxableIncome, partsFiscales: householdFiscalParts })

    let taxAlreadyPaid = 0
    output.companyResults
      .filter(cr => {
        const ownerRel = session.relationships.find(rel => rel.toId === cr.id || rel.fromId === cr.id)
        if (!ownerRel) return false
        return householdPersonIds.includes(ownerRel.fromId) || householdPersonIds.includes(ownerRel.toId)
      })
      .forEach(cr => {
        if (cr.type === "MicroEntreprise") {
          taxAlreadyPaid += cr.details.vflTax
        } else {
          taxAlreadyPaid += (cr.details.distributableDividends - cr.details.netDividendsPaidToDirector - cr.details.dividendsSocialContributions) * (config.SASU.dividendes.pru_taux_ir / (1 - config.SASU.dividendes.pru_taux_ps))
        }
      })

    const finalNetInPocket = householdTotalCashInflow - householdTotalPersonalExpenses - incomeTax - taxAlreadyPaid

    output.householdResults.push({
      id: `household-${person.id}`,
      personIds: householdPersonIds,
      personNames: householdPersonNames,
      totalTaxableIncome: householdTotalTaxableIncome,
      totalFiscalParts: householdFiscalParts,
      incomeTax: incomeTax + taxAlreadyPaid,
      finalNetInPocket: finalNetInPocket
    })
  }

  console.log("Résultat final de la simulation :", JSON.stringify(output, null, 2))
  return output
}