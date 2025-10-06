// src/ui/components/MonthlyGrid.tsx

import { useMemo } from "react"
import type { Entity, MonthlyGridData, FinancialFlow } from "@/types"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"

interface MonthlyGridProps {
  entities: Entity[]
  monthlyData: MonthlyGridData
  setMonthlyData: (data: MonthlyGridData) => void
}

const months = ["Janv", "Févr", "Mars", "Avril", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"]

function MonthlyGrid({ entities, monthlyData, setMonthlyData }: MonthlyGridProps) {
  // TODO: Créer et brancher la modale d'ajout/édition de flux
  const handleAddFlow = (entityId: string, monthIndex: number) => {
    // Cette fonction ouvrira la modale
    console.log(`Ajouter un flux pour ${entityId} en ${months[monthIndex]}`)
    // Pour tester, ajoutons un flux directement
    const newFlow: FinancialFlow = {
      id: `flow-${Date.now()}`,
      label: "Nouveau Revenu",
      amount: 1000,
      type: "income",
      entityId: entityId
    }

    const newData = monthlyData.map((monthData, index) => {
      if (index === monthIndex) {
        return {
          ...monthData,
          flows: [...monthData.flows, newFlow]
        }
      }
      return monthData
    })
    setMonthlyData(newData)
  }

  // Utilisation de useMemo pour ne recalculer les totaux que si les données changent
  const totalsByEntityAndMonth = useMemo(() => {
    const totals: Record<string, number[]> = {}
    entities.forEach(entity => {
      totals[entity.id] = Array(12).fill(0)
      monthlyData.forEach((monthData, monthIndex) => {
        const totalForMonth = monthData.flows
          .filter(flow => flow.entityId === entity.id)
          .reduce((sum, flow) => {
            if (flow.type === "income" || flow.type === "salary") return sum + flow.amount
            if (flow.type === "expense") return sum - flow.amount
            return sum
          }, 0)
        totals[entity.id][monthIndex] = totalForMonth
      })
    })
    return totals
  }, [monthlyData, entities])

  return (
    <div className="p-6 bg-slate-50 dark:bg-gray-950 rounded-lg shadow-md mt-8">
      <h2 className="text-2xl font-semibold mb-4">Grille de Saisie Annuelle</h2>
      {entities.length === 0 ? (
        <p className="text-slate-500">Veuillez d'abord ajouter une entité (personne ou société) pour commencer la saisie.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid gap-px" style={{ gridTemplateColumns: "minmax(200px, 1.5fr) repeat(12, minmax(100px, 1fr))" }}>
            {/* En-têtes */}
            <div className="font-bold sticky left-0 bg-slate-50 dark:bg-gray-950 z-10 p-2">Entités / Flux</div>
            {months.map(month => (
              <div key={month} className="font-bold text-center p-2">
                {month}
              </div>
            ))}

            {/* Contenu par entité */}
            {entities.map(entity => (
              <div key={entity.id} className="contents">
                <div className="font-bold col-span-1 sticky left-0 bg-slate-100 dark:bg-gray-800 p-2 flex items-center">{entity.name}</div>
                {Array.from({ length: 12 }).map((_, monthIndex) => (
                  <div key={monthIndex} className="bg-slate-100 dark:bg-gray-800 p-2 text-right">
                    <span className="font-mono">{totalsByEntityAndMonth[entity.id]?.[monthIndex]?.toLocaleString("fr-FR") ?? 0} €</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 opacity-20 hover:opacity-100" onClick={() => handleAddFlow(entity.id, monthIndex)}>
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default MonthlyGrid
