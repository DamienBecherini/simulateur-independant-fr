// src/ui/components/FlowItem.tsx

import type { FinancialFlow } from "@/types"
import { Button } from "@/components/ui/button"
// L'icône 'Edit' n'est plus nécessaire car le bouton est supprimé.
import { Trash2 } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

/**
 * Dictionnaire de libellés pour l'affichage.
 * ROADMAP 5.5.1: Ce dictionnaire est aligné avec celui de la modale d'édition pour
 * garantir une cohérence parfaite dans l'interface utilisateur.
 */
const flowTypeLabels: Record<FinancialFlow["type"], string> = {
  are: "Allocation chômage (ARE)",
  salary: "Salaire (emploi tiers)",
  other_taxable_income: "Autre revenu imposable",
  ca_services: "CA - Prestation de services",
  ca_vente: "CA - Vente de marchandises",
  deductible_expense: "Charge déductible",
  director_remuneration: "Rémunération de dirigeant",
  dividends_payment: "Versement de dividendes",
  ca_micro_services_bic: "CA Micro - Services (BIC)",
  ca_micro_services_bnc: "CA Micro - Services (BNC)",
  ca_micro_vente: "CA Micro - Vente",
  income: "Revenu (Test)",
  expense: "Dépense (non déductible)"
}

/**
 * Interface pour les props du composant FlowItem.
 * Ce composant représente une seule ligne de flux dans la modale `MonthlyFlowsModal`.
 */
interface FlowItemProps {
  flow: FinancialFlow
  onEdit: (flow: FinancialFlow) => void
  onDelete: (flowId: string) => void
}

export function FlowItem({ flow, onEdit, onDelete }: FlowItemProps) {
  // Hook de la bibliothèque dnd-kit pour rendre l'élément "triable" (sortable).
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: flow.id })

  // Style CSS dynamique pour animer le déplacement de l'élément pendant le glisser-déposer.
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  // MODIFICATION 1 : Le conteneur principal devient cliquable pour l'édition.
  // - Ajout de `onClick={() => onEdit(flow)}`
  // - Ajout de `cursor-pointer` pour indiquer visuellement l'interactivité.
  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 rounded-md border bg-slate-50 dark:bg-gray-800 touch-none cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors" onClick={() => onEdit(flow)}>
      <div className="flex items-center gap-2 flex-grow min-w-0">
        {/* Poignée de Drag & Drop : les `listeners` et `attributes` de dnd-kit sont appliqués ici. */}
        <div {...attributes} {...listeners} className="cursor-grab p-2 -ml-2 text-slate-400">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M5.5 4.625C5.01421 4.625 4.625 5.01421 4.625 5.5C4.625 5.98579 5.01421 6.375 5.5 6.375C5.98579 6.375 6.375 5.98579 6.375 5.5C6.375 5.01421 5.98579 4.625 5.5 4.625ZM9.5 4.625C9.01421 4.625 8.625 5.01421 8.625 5.5C8.625 5.98579 9.01421 6.375 9.5 6.375C9.98579 6.375 10.375 5.98579 10.375 5.5C10.375 5.01421 9.98579 4.625 9.5 4.625ZM6.375 9.5C6.375 9.01421 5.98579 8.625 5.5 8.625C5.01421 8.625 4.625 9.01421 4.625 9.5C4.625 9.98579 5.01421 10.375 5.5 10.375C5.98579 10.375 6.375 9.98579 6.375 9.5ZM9.5 8.625C9.01421 8.625 8.625 9.01421 8.625 9.5C8.625 9.98579 9.01421 10.375 9.5 10.375C9.98579 10.375 10.375 9.98579 10.375 9.5C10.375 9.01421 9.98579 8.625 9.5 8.625Z" fill="currentColor"></path>
          </svg>
        </div>
        {/* Affiche le libellé personnalisé ou le libellé par défaut du type de flux. */}
        <div>
          <p className="font-semibold">{flow.label || flowTypeLabels[flow.type]}</p>
          <p className="text-sm text-slate-500">{flowTypeLabels[flow.type]}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Affiche le montant formaté avec un signe + ou - et une couleur appropriée. */}
        <span className={`font-mono text-lg ${flow.type.includes("expense") ? "text-red-500" : "text-green-600"}`}>
          {flow.type.includes("expense") ? "-" : "+"} {flow.amount.toLocaleString("fr-FR")} €
        </span>

        {/* MODIFICATION 2 : Le bouton d'édition est supprimé. */}

        {/* MODIFICATION 3 : Le bouton de suppression est plus grand et stoppe la propagation du clic. */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-destructive hover:text-destructive" // Zone de clic plus grande
          onClick={e => {
            e.stopPropagation() // Empêche le clic de remonter au conteneur parent
            onDelete(flow.id)
          }}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
