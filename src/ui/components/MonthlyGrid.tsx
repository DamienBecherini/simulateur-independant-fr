// src/ui/components/MonthlyGrid.tsx

// 1. Importer Dispatch et SetStateAction depuis React
import { useState, useMemo, Dispatch, SetStateAction } from "react"
import type { Entity, MonthlyGridData, FinancialFlow } from "@/types"
import { EditFlowModal } from "./EditFlowModal"
import { MonthlyFlowsModal } from "./MonthlyFlowsModal"
import { cn } from "@/lib/utils"

interface MonthlyGridProps {
  entities: Entity[]
  monthlyData: MonthlyGridData
  // 2. Mettre à jour la signature pour correspondre à ce que App.tsx envoie
  setMonthlyData: Dispatch<SetStateAction<MonthlyGridData>>
}

const months = ["Janv", "Févr", "Mars", "Avril", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"]
const fullMonths = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

function MonthlyGrid({ entities, monthlyData, setMonthlyData }: MonthlyGridProps) {
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

    // On utilise maintenant la forme fonctionnelle pour mettre à jour l'état
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
    return entities.map(entity => {
      const monthlyTotals = Array(12).fill(0)
      const monthlyFlowCounts = Array(12).fill(0)

      monthlyData.forEach((month, monthIndex) => {
        const relevantFlows = month.flows.filter(flow => flow.entityId === entity.id)
        monthlyFlowCounts[monthIndex] = relevantFlows.length
        monthlyTotals[monthIndex] = relevantFlows.reduce((sum, flow) => {
          if (["deductible_expense", "expense"].includes(flow.type)) return sum - flow.amount
          return sum + flow.amount
        }, 0)
      })

      return { entity, monthlyTotals, monthlyFlowCounts }
    })
  }, [monthlyData, entities])

  return (
    <>
      <div className="p-6 bg-slate-50 dark:bg-gray-950 rounded-lg shadow-md mt-8">
        <h2 className="text-2xl font-semibold mb-4">Grille de Saisie Annuelle</h2>
        {entities.length === 0 ? (
          <p className="text-slate-500">Veuillez d'abord ajouter une entité pour commencer la saisie.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid gap-px" style={{ gridTemplateColumns: "minmax(200px, 1.5fr) repeat(12, minmax(120px, 1fr))" }}>
              <div className="font-bold sticky left-0 bg-slate-50 dark:bg-gray-950 z-10 p-2">Entités / Flux</div>
              {months.map(month => (
                <div key={month} className="font-bold text-center p-2">
                  {month}
                </div>
              ))}

              {gridData.map(({ entity, monthlyTotals, monthlyFlowCounts }) => (
                <div key={entity.id} className="contents">
                  <div className="font-bold col-span-1 sticky left-0 bg-slate-100 dark:bg-gray-800 p-2 flex items-center">{entity.name}</div>
                  {Array.from({ length: 12 }).map((_, monthIndex) => {
                    const hasFlows = monthlyFlowCounts[monthIndex] > 0
                    return (
                      <div key={monthIndex} className={cn("bg-slate-100 dark:bg-gray-800 p-2 text-right group transition-colors", "cursor-pointer hover:bg-slate-200 dark:hover:bg-gray-700")} onClick={() => openFlowsList(entity.id, monthIndex)}>
                        {hasFlows ? (
                          <>
                            <div className="text-xs text-slate-500">({monthlyFlowCounts[monthIndex]} flux)</div>
                            <div className="font-mono font-semibold">{monthlyTotals[monthIndex].toLocaleString("fr-FR")} €</div>
                          </>
                        ) : (
                          <div className="text-slate-400 group-hover:text-slate-600 transition-colors py-3">+ Ajouter</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <MonthlyFlowsModal isOpen={isListModalOpen} onClose={() => setListModalOpen(false)} flows={context ? monthlyData[context.monthIndex].flows.filter(f => f.entityId === context.entityId) : []} entity={context ? entities.find(e => e.id === context.entityId) : undefined} monthName={context ? fullMonths[context.monthIndex] : ""} onAdd={handleAddFlow} onEdit={handleEditFlow} onDelete={handleDeleteFlow} onReorder={handleReorderFlows} />

      <EditFlowModal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} onSave={handleSaveFlow} context={context} flowToEdit={flowToEdit} allEntities={entities} />
    </>
  )
}

export default MonthlyGrid
