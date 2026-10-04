// src/ui/components/MonthlyGrid.tsx

import React, { useState, useMemo, Dispatch, SetStateAction } from "react"
import type { Entity, MonthlyGridData, FinancialFlow, UserPreferences } from "@/types"
import { MonthlyFlowsModal } from "./MonthlyFlowsModal"
import type { FlowChanges } from "./FlowItem"
import type { NewFlowValues } from "./NewFlowItem"
import { CellChartDisplay, FlowSegment } from "./CellChartDisplay"
import { DEFAULT_FLOW_COLORS } from "@/lib/color-constants"
import { isExpenseFlowType } from "@/lib/flow-constants"
import { createId } from "@/lib/id"
import { AvatarDisplay } from "./AvatarDisplay"

/**
 * Interface pour les props du composant MonthlyGrid.
 * Ce composant est le cœur de la visualisation des données, affichant une grille
 * interactive des flux financiers pour chaque entité, mois par mois, ainsi qu'un total annuel.
 */
interface MonthlyGridProps {
  entities: Entity[]
  monthlyData: MonthlyGridData
  setMonthlyData: Dispatch<SetStateAction<MonthlyGridData>>
  preferences: UserPreferences
  flowTypeToNumberMap: Map<string, number>
}

// Constantes pour les labels des mois
const months = ["Janv", "Févr", "Mars", "Avril", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"]
const fullMonths = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

function MonthlyGrid({ entities, monthlyData, setMonthlyData, preferences, flowTypeToNumberMap }: MonthlyGridProps) {
  // ===================================================================================
  // == ÉTAT DE LA FENÊTRE DES FLUX
  // ===================================================================================
  // Case (entité + mois) dont la fenêtre des flux est ouverte ; `null` quand elle est fermée.
  const [openCell, setOpenCell] = useState<{ entityId: string; monthIndex: number } | null>(null)
  const openCellEntity = openCell ? entities.find(e => e.id === openCell.entityId) : undefined

  // ===================================================================================
  // == HANDLERS POUR LES ACTIONS UTILISATEUR
  // ===================================================================================
  /**
   * Applique une transformation aux flux du mois ouvert.
   * Si la transformation renvoie la liste inchangée, les données gardent la même référence :
   * aucune entrée n'est alors ajoutée à l'historique undo/redo.
   */
  const updateOpenMonthFlows = (update: (flows: FinancialFlow[]) => FinancialFlow[]) => {
    if (!openCell) return
    const { monthIndex } = openCell
    setMonthlyData(prevData => {
      const flows = update(prevData[monthIndex].flows)
      if (flows === prevData[monthIndex].flows) return prevData
      return prevData.map((monthData, index) => (index === monthIndex ? { ...monthData, flows } : monthData))
    })
  }
  const handleCreateFlow = (values: NewFlowValues) => {
    if (!openCell) return
    // L'identifiant est généré hors de la fonction de mise à jour, qui doit rester pure.
    const newFlow: FinancialFlow = { id: createId("flow"), entityId: openCell.entityId, ...values }
    updateOpenMonthFlows(flows => [...flows, newFlow])
  }
  const handleUpdateFlow = (flowId: string, changes: FlowChanges) => {
    updateOpenMonthFlows(flows => {
      const current = flows.find(f => f.id === flowId)
      if (!current) return flows
      const updated = { ...current, ...changes }
      if (updated.type === current.type && updated.label === current.label && updated.amount === current.amount && updated.grossAmount === current.grossAmount) return flows
      return flows.map(f => (f.id === flowId ? updated : f))
    })
  }
  const handleDeleteFlow = (flowId: string) => {
    updateOpenMonthFlows(flows => (flows.some(f => f.id === flowId) ? flows.filter(f => f.id !== flowId) : flows))
  }
  const handleReorderFlows = (reorderedFlows: FinancialFlow[]) => {
    if (!openCell) return
    const { entityId } = openCell
    updateOpenMonthFlows(flows => [...flows.filter(f => f.entityId !== entityId), ...reorderedFlows])
  }

  // ===================================================================================
  // == LOGIQUE DE CALCUL MÉMORISÉE POUR LA GRILLE
  // ===================================================================================
  const gridData = useMemo(() => {
    const finalColors = { ...DEFAULT_FLOW_COLORS, ...preferences.flowTypeColors }

    return entities.map(entity => {
      // Logique pour le 'monthlyScale' des mois
      let maxMonthlyTotal = 0
      monthlyData.forEach(month => {
        const relevantFlows = month.flows.filter(flow => flow.entityId === entity.id)
        const monthlyGains = relevantFlows.filter(flow => !isExpenseFlowType(flow.type)).reduce((sum, flow) => sum + flow.amount, 0)
        const monthlyExpenses = relevantFlows.filter(flow => isExpenseFlowType(flow.type)).reduce((sum, flow) => sum + flow.amount, 0)
        maxMonthlyTotal = Math.max(maxMonthlyTotal, monthlyGains, monthlyExpenses)
      })
      const monthlyScale = maxMonthlyTotal > 0 ? maxMonthlyTotal * 1.1 : 1

      // Logique pour monthlyCellData
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
          if (isExpenseFlowType(type)) {
            expenses.push(segment)
            totalExpenses += amount
          } else {
            gains.push(segment)
            totalGains += amount
          }
        })
        return { gains, expenses, totalGains, totalExpenses, flowCount: relevantFlows.length }
      })

      // Logique pour calculer 'totalAnnualFlows' et 'annualGains'/'annualExpenses'
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
        if (isExpenseFlowType(type)) {
          annualExpenses.push(segment)
          totalAnnualExpenses += amount
        } else {
          annualGains.push(segment)
          totalAnnualGains += amount
        }
      })

      // --- LOGIQUE SPÉCIFIQUE POUR L'ÉCHELLE ANNUELLE ---
      // On trouve la valeur du plus grand segment individuel (gain ou dépense) sur toute l'année.
      const maxAnnualSegmentValue = Math.max(
        ...annualGains.map(s => s.amount),
        ...annualExpenses.map(s => s.amount),
        1 // On ajoute 1 pour éviter une division par zéro si tout est à 0
      )

      const annualFlowCount = monthlyData.reduce((acc, month) => acc + month.flows.filter(f => f.entityId === entity.id).length, 0)

      // On assemble les données annuelles
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

  // ===================================================================================
  // == RENDU JSX DU COMPOSANT
  // ===================================================================================
  return (
    <>
      <div className="p-6 bg-slate-50 dark:bg-gray-950 rounded-lg shadow-md mt-8">
        <h2 className="text-2xl font-semibold mb-4">Grille de Saisie Annuelle</h2>
        {entities.length === 0 ? (
          <p className="text-slate-500">Veuillez d'abord ajouter une entité pour commencer la saisie.</p>
        ) : (
          <div className="relative overflow-x-auto">
            {/* `w-max` : la grille doit être aussi large que son contenu, sinon la première colonne (sticky) cesse de rester visible une fois la largeur de la fenêtre dépassée. */}
            <div className="grid w-max min-w-full gap-px [grid-template-columns:minmax(5rem,6rem)_repeat(13,auto)] sm:[grid-template-columns:minmax(8rem,11rem)_repeat(13,auto)]">
              {/* En-tête de la grille */}
              <div className="font-bold sticky left-0 bg-slate-50 dark:bg-gray-950 z-10 p-2 text-sm sm:text-base sm:whitespace-nowrap">Entités / Flux</div>
              <div className="font-bold text-center p-2">Total Annuel</div>
              {months.map(month => (
                <div key={month} className="font-bold text-center p-2">
                  {month}
                </div>
              ))}
              {/* Corps de la grille */}
              {gridData.map(({ entity, monthlyScale, monthlyCellData, annualCellData, annualScale }) => (
                // L'utilisation de React.Fragment est cruciale pour que `position: sticky` fonctionne correctement.
                <React.Fragment key={entity.id}>
                  {/* Colonne 1 : Nom de l'entité + Avatar */}
                  <div className="font-bold col-span-1 sticky left-0 bg-slate-100 dark:bg-gray-800 z-10 p-2 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2 py-1 mx-0 text-sm sm:mx-3 sm:text-base">
                      <AvatarDisplay avatar={entity.avatar} size="md" />
                      {/* Un nom long passe à la ligne ; un mot plus large que la colonne est coupé. */}
                      <span className="text-center [overflow-wrap:anywhere]">{entity.name}</span>
                    </div>
                  </div>

                  {/* Colonne 2 : Total Annuel */}
                  <div className="bg-slate-200 dark:bg-gray-700 p-2 flex flex-col justify-start">
                    <CellChartDisplay
                      gains={annualCellData.gains}
                      expenses={annualCellData.expenses}
                      totalGains={annualCellData.totalGains}
                      totalExpenses={annualCellData.totalExpenses}
                      absoluteMaxValue={annualScale} // <-- Utilisation de la nouvelle échelle
                      flowCount={annualCellData.flowCount}
                      readOnly
                    />
                  </div>

                  {/* Colonnes 3 à 14 : Les 12 mois */}
                  {monthlyCellData.map((cellData, monthIndex) => (
                    <div
                      key={monthIndex}
                      className="bg-slate-100 dark:bg-gray-800 p-2 group transition-colors min-h-[80px] cursor-pointer hover:bg-slate-200 dark:hover:bg-gray-700 flex flex-col justify-start"
                      role="button"
                      tabIndex={0}
                      aria-label={`Flux de ${fullMonths[monthIndex].toLowerCase()} : ${entity.name}`}
                      onClick={() => setOpenCell({ entityId: entity.id, monthIndex })}
                      onKeyDown={event => {
                        // Une case s'ouvre aussi au clavier, comme un bouton.
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          setOpenCell({ entityId: entity.id, monthIndex })
                        }
                      }}
                    >
                      <CellChartDisplay gains={cellData.gains} expenses={cellData.expenses} totalGains={cellData.totalGains} totalExpenses={cellData.totalExpenses} absoluteMaxValue={monthlyScale} flowCount={cellData.flowCount} />
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {openCell && openCellEntity && (
        <MonthlyFlowsModal
          key={`${openCell.entityId}-${openCell.monthIndex}`}
          onClose={() => setOpenCell(null)}
          flows={monthlyData[openCell.monthIndex].flows.filter(f => f.entityId === openCell.entityId)}
          entity={openCellEntity}
          monthName={fullMonths[openCell.monthIndex]}
          onCreate={handleCreateFlow}
          onUpdate={handleUpdateFlow}
          onDelete={handleDeleteFlow}
          onReorder={handleReorderFlows}
        />
      )}
    </>
  )
}

export default MonthlyGrid
