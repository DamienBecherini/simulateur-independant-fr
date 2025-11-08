// src/ui/components/MonthlyGrid.tsx

import { useState, useMemo, Dispatch, SetStateAction } from "react"
import type { Entity, MonthlyGridData, FinancialFlow, UserPreferences } from "@/types"
import { EditFlowModal } from "./EditFlowModal"
import { MonthlyFlowsModal } from "./MonthlyFlowsModal"
// import { cn } from "@/lib/utils"
// Importation du nouveau composant d'affichage pour les cellules
import { CellChartDisplay, FlowSegment } from "./CellChartDisplay"
// Importation des couleurs par défaut pour les types de flux
import { DEFAULT_FLOW_COLORS } from "@/lib/color-constants"

interface MonthlyGridProps {
  entities: Entity[]
  monthlyData: MonthlyGridData
  setMonthlyData: Dispatch<SetStateAction<MonthlyGridData>>
  preferences: UserPreferences
  flowTypeToNumberMap: Map<string, number>
}

// Constantes pour les labels des mois, en version courte et longue
const months = ["Janv", "Févr", "Mars", "Avril", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"]
const fullMonths = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

function MonthlyGrid({ entities, monthlyData, setMonthlyData, preferences, flowTypeToNumberMap }: MonthlyGridProps) {
  // --- GESTION DE L'ÉTAT DES MODALES ---

  // Gère l'ouverture de la modale qui liste les flux d'un mois pour une entité
  const [isListModalOpen, setListModalOpen] = useState(false)
  // Gère l'ouverture de la modale d'ajout/édition d'un flux
  const [isEditModalOpen, setEditModalOpen] = useState(false)

  // Stocke le contexte de la cellule cliquée (quelle entité, quel mois)
  const [context, setContext] = useState<{ entityId: string; monthIndex: number } | null>(null)
  // Stocke le flux à éditer. Si null, la modale d'édition est en mode "création".
  const [flowToEdit, setFlowToEdit] = useState<FinancialFlow | null>(null)

  // --- HANDLERS POUR LES ACTIONS UTILISATEUR ---

  /** Ouvre la modale listant les flux pour une cellule spécifique */
  const openFlowsList = (entityId: string, monthIndex: number) => {
    setContext({ entityId, monthIndex })
    setListModalOpen(true)
  }

  /** Gère le clic sur le bouton "Ajouter un flux" depuis la liste */
  const handleAddFlow = () => {
    setFlowToEdit(null) // S'assure qu'on est en mode création
    setListModalOpen(false) // Ferme la modale de liste
    setEditModalOpen(true) // Ouvre la modale d'édition
  }

  /** Gère le clic sur le bouton "Modifier" d'un flux existant */
  const handleEditFlow = (flow: FinancialFlow) => {
    setFlowToEdit(flow) // Passe le flux à éditer
    setListModalOpen(false)
    setEditModalOpen(true)
  }

  /** Supprime un flux financier de la grille */
  const handleDeleteFlow = (flowId: string) => {
    if (!context) return
    const { monthIndex } = context

    // Mise à jour de l'état de manière immuable : on crée un nouveau tableau.
    setMonthlyData(prevData =>
      prevData.map((monthData, index) => {
        if (index === monthIndex) {
          // Pour le mois concerné, on retourne un nouvel objet avec les flux filtrés
          return { ...monthData, flows: monthData.flows.filter(f => f.id !== flowId) }
        }
        return monthData // Les autres mois restent inchangés
      })
    )
  }

  /** Sauvegarde un flux (création ou modification) */
  const handleSaveFlow = (savedFlow: FinancialFlow, isEditing: boolean) => {
    if (!context) return
    const { monthIndex } = context

    setMonthlyData(prevData =>
      prevData.map((monthData, index) => {
        if (index === monthIndex) {
          if (isEditing) {
            // En mode édition, on remplace le flux existant
            return { ...monthData, flows: monthData.flows.map(f => (f.id === savedFlow.id ? savedFlow : f)) }
          } else {
            // En mode création, on ajoute le nouveau flux à la fin
            return { ...monthData, flows: [...monthData.flows, savedFlow] }
          }
        }
        return monthData
      })
    )

    setEditModalOpen(false) // On ferme la modale d'édition
    setListModalOpen(true) // On rouvre la liste pour voir le résultat
  }

  /** Gère la réorganisation des flux par glisser-déposer */
  const handleReorderFlows = (reorderedFlows: FinancialFlow[]) => {
    if (!context) return
    const { monthIndex, entityId } = context

    setMonthlyData(prevData =>
      prevData.map((monthData, index) => {
        if (index === monthIndex) {
          // On reconstruit la liste des flux pour ce mois :
          // 1. On garde les flux des autres entités qui ne doivent pas bouger
          const otherEntityFlows = monthData.flows.filter(f => f.entityId !== entityId)
          // 2. On ajoute la nouvelle liste réorganisée
          return { ...monthData, flows: [...otherEntityFlows, ...reorderedFlows] }
        }
        return monthData
      })
    )
  }

  // --- LOGIQUE DE CALCUL MÉMORISÉE ---

  const gridData = useMemo(() => {
    const finalColors = { ...DEFAULT_FLOW_COLORS, ...preferences.flowTypeColors }

    // ÉTAPE 1: Calculer une échelle de hauteur unifiée pour chaque LIGNE d'entité.
    const entitiesWithScale = entities.map(entity => {
      // MODIFICATION : On cherche maintenant la plus grande valeur d'UN SEUL flux sur toute l'année.
      let maxMonthlyTotal = 0
      monthlyData.forEach(month => {
        const relevantFlows = month.flows.filter(flow => flow.entityId === entity.id)

        const monthlyGains = relevantFlows.filter(flow => !["deductible_expense", "expense"].includes(flow.type)).reduce((sum, flow) => sum + flow.amount, 0)

        const monthlyExpenses = relevantFlows.filter(flow => ["deductible_expense", "expense"].includes(flow.type)).reduce((sum, flow) => sum + flow.amount, 0)

        maxMonthlyTotal = Math.max(maxMonthlyTotal, monthlyGains, monthlyExpenses)
      })

      // L'échelle est maintenant basée sur le total mensuel maximum, avec une petite marge.
      return { ...entity, absoluteMaxValue: maxMonthlyTotal > 0 ? maxMonthlyTotal * 1.1 : 1 }
    })

    // ÉTAPE 2: Préparer les données spécifiques à chaque CELLULE de la grille.
    return entitiesWithScale.map(entity => {
      const monthlyCellData = Array.from({ length: 12 }).map((_, monthIndex) => {
        const relevantFlows = monthlyData[monthIndex].flows.filter(flow => flow.entityId === entity.id)

        const gains: FlowSegment[] = []
        const expenses: FlowSegment[] = []
        let totalGains = 0
        let totalExpenses = 0

        relevantFlows.forEach(flow => {
          const segment: FlowSegment = {
            amount: flow.amount,
            color: finalColors[flow.type as keyof typeof finalColors] || "#cccccc",
            number: flowTypeToNumberMap.get(flow.type) || 0
          }
          if (["deductible_expense", "expense"].includes(flow.type)) {
            expenses.push(segment)
            totalExpenses += flow.amount
          } else {
            gains.push(segment)
            totalGains += flow.amount
          }
        })

        return { gains, expenses, totalGains, totalExpenses, flowCount: relevantFlows.length }
      })
      return { entity, monthlyCellData }
    })
  }, [monthlyData, entities, preferences, flowTypeToNumberMap])

  // --- RENDU JSX DU COMPOSANT ---

  return (
    <>
      <div className="p-6 bg-slate-50 dark:bg-gray-950 rounded-lg shadow-md mt-8">
        <h2 className="text-2xl font-semibold mb-4">Grille de Saisie Annuelle</h2>
        {entities.length === 0 ? (
          <p className="text-slate-500">Veuillez d'abord ajouter une entité pour commencer la saisie.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid gap-px" style={{ gridTemplateColumns: "minmax(200px, 1.5fr) repeat(12, minmax(140px, auto))" }}>
              {/* En-tête de la grille */}
              <div className="font-bold sticky left-0 bg-slate-50 dark:bg-gray-950 z-10 p-2">Entités / Flux</div>
              {months.map(month => (
                <div key={month} className="font-bold text-center p-2">
                  {month}
                </div>
              ))}

              {/* Corps de la grille, généré à partir des données calculées */}
              {gridData.map(({ entity, monthlyCellData }) => (
                <div key={entity.id} className="contents">
                  {/* Colonne du nom de l'entité (sticky pour rester visible au scroll horizontal) */}
                  <div className="font-bold col-span-1 sticky left-0 bg-slate-100 dark:bg-gray-800 p-2 flex items-center">{entity.name}</div>

                  {/* Génération des 12 cellules de données pour cette entité */}
                  {monthlyCellData.map((cellData, monthIndex) => (
                    <div key={monthIndex} className="bg-slate-100 dark:bg-gray-800 p-2 group transition-colors min-h-[80px] cursor-pointer hover:bg-slate-200 dark:hover:bg-gray-700" onClick={() => openFlowsList(entity.id, monthIndex)}>
                      <CellChartDisplay
                        gains={cellData.gains}
                        expenses={cellData.expenses}
                        totalGains={cellData.totalGains}
                        totalExpenses={cellData.totalExpenses}
                        absoluteMaxValue={entity.absoluteMaxValue} // On passe la NOUVELLE échelle de la ligne
                        flowCount={cellData.flowCount}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Rendu des modales (elles ne sont visibles que si leur état `isOpen` est true) */}
      <MonthlyFlowsModal isOpen={isListModalOpen} onClose={() => setListModalOpen(false)} flows={context ? monthlyData[context.monthIndex].flows.filter(f => f.entityId === context.entityId) : []} entity={context ? entities.find(e => e.id === context.entityId) : undefined} monthName={context ? fullMonths[context.monthIndex] : ""} onAdd={handleAddFlow} onEdit={handleEditFlow} onDelete={handleDeleteFlow} onReorder={handleReorderFlows} />

      <EditFlowModal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} onSave={handleSaveFlow} context={context} flowToEdit={flowToEdit} allEntities={entities} />
    </>
  )
}

export default MonthlyGrid
