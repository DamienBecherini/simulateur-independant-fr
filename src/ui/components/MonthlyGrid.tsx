// src/ui/components/MonthlyGrid.tsx

import React, { useState, useMemo, Dispatch, SetStateAction } from "react"
import type { Entity, MonthlyGridData, FinancialFlow, UserPreferences } from "@/types"
import { EditFlowModal } from "./EditFlowModal"
import { MonthlyFlowsModal } from "./MonthlyFlowsModal"
import { CellChartDisplay, FlowSegment } from "./CellChartDisplay"
import { DEFAULT_FLOW_COLORS } from "@/lib/color-constants"
import { AvatarDisplay } from "./AvatarDisplay"
import { ScrollableGridContainer } from "./ScrollableGridContainer"

interface MonthlyGridProps {
  entities: Entity[]
  monthlyData: MonthlyGridData
  setMonthlyData: Dispatch<SetStateAction<MonthlyGridData>>
  preferences: UserPreferences
  flowTypeToNumberMap: Map<string, number>
  onEditEntity: (entity: Entity) => void
}

const months = ["Janv", "Févr", "Mars", "Avril", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"]
const fullMonths = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

function MonthlyGrid({ entities, monthlyData, setMonthlyData, preferences, flowTypeToNumberMap, onEditEntity }: MonthlyGridProps) {
  const [isListModalOpen, setListModalOpen] = useState(false)
  const [isEditModalOpen, setEditModalOpen] = useState(false)
  const [context, setContext] = useState<{ entityId: string; monthIndex: number } | null>(null)
  const [flowToEdit, setFlowToEdit] = useState<FinancialFlow | null>(null)

  const openFlowsList = (entityId: string, monthIndex: number) => {
    setContext({ entityId, monthIndex })
    setListModalOpen(true)
  }
  const handleAddFlow = () => {
    setFlowToEdit(null)
    setListModalOpen(false)
    setEditModalOpen(true)
  }
  const handleEditFlow = (flow: FinancialFlow) => {
    setFlowToEdit(flow)
    setListModalOpen(false)
    setEditModalOpen(true)
  }
  const handleDeleteFlow = (flowId: string) => {
    if (!context) return
    const { monthIndex } = context
    setMonthlyData(prevData =>
      prevData.map((monthData, index) => {
        if (index === monthIndex) {
          return { ...monthData, flows: monthData.flows.filter(f => f.id !== flowId) }
        }
        return monthData
      })
    )
  }
  const handleSaveFlow = (savedFlow: FinancialFlow, isEditing: boolean) => {
    if (!context) return
    const { monthIndex } = context
    setMonthlyData(prevData =>
      prevData.map((monthData, index) => {
        if (index === monthIndex) {
          if (isEditing) {
            return { ...monthData, flows: monthData.flows.map(f => (f.id === savedFlow.id ? savedFlow : f)) }
          } else {
            return { ...monthData, flows: [...monthData.flows, savedFlow] }
          }
        }
        return monthData
      })
    )
    setEditModalOpen(false)
    setListModalOpen(true)
  }
  const handleReorderFlows = (reorderedFlows: FinancialFlow[]) => {
    if (!context) return
    const { monthIndex, entityId } = context
    setMonthlyData(prevData =>
      prevData.map((monthData, index) => {
        if (index === monthIndex) {
          const otherEntityFlows = monthData.flows.filter(f => f.entityId !== entityId)
          return { ...monthData, flows: [...otherEntityFlows, ...reorderedFlows] }
        }
        return monthData
      })
    )
  }

  const gridData = useMemo(() => {
    const finalColors = { ...DEFAULT_FLOW_COLORS, ...preferences.flowTypeColors }

    return entities.map(entity => {
      let maxMonthlyTotal = 0
      monthlyData.forEach(month => {
        const relevantFlows = month.flows.filter(flow => flow.entityId === entity.id)
        const monthlyGains = relevantFlows.filter(flow => !["deductible_expense", "expense"].includes(flow.type)).reduce((sum, flow) => sum + flow.amount, 0)
        const monthlyExpenses = relevantFlows.filter(flow => ["deductible_expense", "expense"].includes(flow.type)).reduce((sum, flow) => sum + flow.amount, 0)
        maxMonthlyTotal = Math.max(maxMonthlyTotal, monthlyGains, monthlyExpenses)
      })
      const monthlyScale = maxMonthlyTotal > 0 ? maxMonthlyTotal * 1.1 : 1

      const monthlyCellData = Array.from({ length: 12 }).map((_, monthIndex) => {
        const relevantFlows = monthlyData[monthIndex].flows.filter(flow => flow.entityId === entity.id)
        const aggregatedFlows = new Map<FinancialFlow["type"], number>()
        relevantFlows.forEach(flow => {
          aggregatedFlows.set(flow.type, (aggregatedFlows.get(flow.type) || 0) + flow.amount)
        })

        const gains: FlowSegment[] = [],
          expenses: FlowSegment[] = []
        let totalGains = 0,
          totalExpenses = 0

        aggregatedFlows.forEach((amount, type) => {
          const segment: FlowSegment = { amount, color: finalColors[type] || "#cccccc", number: flowTypeToNumberMap.get(type) || 0 }
          if (["deductible_expense", "expense"].includes(type)) {
            expenses.push(segment)
            totalExpenses += amount
          } else {
            gains.push(segment)
            totalGains += amount
          }
        })
        return { gains, expenses, totalGains, totalExpenses, flowCount: relevantFlows.length }
      })

      const totalAnnualFlows = new Map<FinancialFlow["type"], number>()
      monthlyData.forEach(month => {
        month.flows
          .filter(flow => flow.entityId === entity.id)
          .forEach(flow => {
            totalAnnualFlows.set(flow.type, (totalAnnualFlows.get(flow.type) || 0) + flow.amount)
          })
      })

      const annualGains: FlowSegment[] = [],
        annualExpenses: FlowSegment[] = []
      let totalAnnualGains = 0,
        totalAnnualExpenses = 0

      totalAnnualFlows.forEach((amount, type) => {
        const segment: FlowSegment = { amount, color: finalColors[type] || "#cccccc", number: flowTypeToNumberMap.get(type) || 0 }
        if (["deductible_expense", "expense"].includes(type)) {
          annualExpenses.push(segment)
          totalAnnualExpenses += amount
        } else {
          annualGains.push(segment)
          totalAnnualGains += amount
        }
      })

      const maxAnnualSegmentValue = Math.max(...annualGains.map(s => s.amount), ...annualExpenses.map(s => s.amount), 1)

      const annualFlowCount = monthlyData.reduce((acc, month) => acc + month.flows.filter(f => f.entityId === entity.id).length, 0)

      const annualCellData = {
        gains: annualGains,
        expenses: annualExpenses,
        totalGains: totalAnnualGains,
        totalExpenses: totalAnnualExpenses,
        flowCount: annualFlowCount
      }

      return { entity, monthlyScale, monthlyCellData, annualCellData, annualScale: maxAnnualSegmentValue * 1.1 }
    })
  }, [monthlyData, entities, preferences, flowTypeToNumberMap])

  return (
    <>
      <div className="p-6 bg-slate-50 dark:bg-gray-950 rounded-lg shadow-md mt-8 dark:shadow-[0_0_24px_2px_rgba(100,100,100,0.14)]">
        <h2 className="text-2xl font-semibold mb-4">Grille de Saisie Annuelle</h2>
        {entities.length === 0 ? (
          <p className="text-slate-500">Veuillez d'abord ajouter une entité pour commencer la saisie.</p>
        ) : (
          <ScrollableGridContainer className="grid gap-px" style={{ gridTemplateColumns: "auto repeat(12, 160px) 160px" }}>
            <div className="font-bold sticky left-0 bg-slate-50 dark:bg-gray-950 z-10 p-2 whitespace-nowrap">Entités / Flux</div>

            {months.map(month => (
              <div key={month} className="font-bold text-center p-2">
                {month}
              </div>
            ))}

            <div className="font-bold text-center p-2 sticky right-0 bg-slate-50 dark:bg-gray-950 z-10">Total Annuel</div>

            {gridData.map(({ entity, monthlyScale, monthlyCellData, annualCellData, annualScale }) => (
              <React.Fragment key={entity.id}>
                <div className="font-bold col-span-1 sticky left-0 bg-slate-100 dark:bg-gray-800 z-10 p-2 flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors" onClick={() => onEditEntity(entity)}>
                  <div className="flex flex-col items-center gap-2 pt-1 pb-1 ml-3 mr-3">
                    <AvatarDisplay avatar={entity.avatar} size="md" />
                    <span className="text-center">{entity.name}</span>
                  </div>
                </div>

                {monthlyCellData.map((cellData, monthIndex) => (
                  <div key={monthIndex} className="bg-slate-100 dark:bg-gray-800 p-2 group transition-colors min-h-[80px] cursor-pointer hover:bg-slate-200 dark:hover:bg-gray-700 flex flex-col justify-start" onClick={() => openFlowsList(entity.id, monthIndex)}>
                    <CellChartDisplay gains={cellData.gains} expenses={cellData.expenses} totalGains={cellData.totalGains} totalExpenses={cellData.totalExpenses} absoluteMaxValue={monthlyScale} flowCount={cellData.flowCount} />
                  </div>
                ))}

                <div className="bg-slate-200 dark:bg-gray-700 p-2 flex flex-col justify-start sticky right-0 z-10">
                  <CellChartDisplay gains={annualCellData.gains} expenses={annualCellData.expenses} totalGains={annualCellData.totalGains} totalExpenses={annualCellData.totalExpenses} absoluteMaxValue={annualScale} flowCount={annualCellData.flowCount} />
                </div>
              </React.Fragment>
            ))}
          </ScrollableGridContainer>
        )}
      </div>

      <MonthlyFlowsModal isOpen={isListModalOpen} onClose={() => setListModalOpen(false)} flows={context ? monthlyData[context.monthIndex].flows.filter(f => f.entityId === context.entityId) : []} entity={context ? entities.find(e => e.id === context.entityId) : undefined} monthName={context ? fullMonths[context.monthIndex] : ""} onAdd={handleAddFlow} onEdit={handleEditFlow} onDelete={handleDeleteFlow} onReorder={handleReorderFlows} />
      <EditFlowModal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} onSave={handleSaveFlow} context={context} flowToEdit={flowToEdit} allEntities={entities} />
    </>
  )
}

export default MonthlyGrid
