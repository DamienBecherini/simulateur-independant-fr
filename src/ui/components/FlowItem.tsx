// src/ui/components/FlowItem.tsx

import { useState, type KeyboardEvent } from "react"
import type { FinancialFlow } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatAmount, parseAmount } from "@/lib/amount-utils"
import { flowTypeLabels, isOutgoingFlowType, type FlowType } from "@/lib/flow-constants"
import { DEFAULT_NET_RATIO, formatPercent, grossFromNet, netFromGross, netRatio, parsePercent } from "@/lib/salary-utils"
import { cn } from "@/lib/utils"
import { GripVertical, Trash2 } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { FlowTypeSelect, RetourALaLigneSurTelephone } from "./FlowTypeSelect"
import { POIGNEE_DE_TRI } from "../hooks/useTriAccessible"

/** Champs d'un flux modifiables depuis la liste. */
export type FlowChanges = Partial<Pick<FinancialFlow, "type" | "label" | "amount" | "grossAmount">>

/**
 * Interface pour les props du composant FlowItem.
 * Ce composant représente une ligne de flux, éditable sur place, dans `MonthlyFlowsModal`.
 */
interface FlowItemProps {
  flow: FinancialFlow
  allowedTypes: ReadonlyArray<FlowType>
  onUpdate: (flowId: string, changes: FlowChanges) => void
  onDelete: (flowId: string) => void
  onTypeUsed: (type: FlowType) => void
}

export function FlowItem({ flow, allowedTypes, onUpdate, onDelete, onTypeUsed }: FlowItemProps) {
  // Hook de la bibliothèque dnd-kit pour rendre l'élément "triable" (sortable).
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: flow.id })

  // Saisies en cours : `null` tant que le champ n'est pas modifié, il affiche alors la valeur du flux.
  // La session n'est écrite qu'à la validation : une seule entrée d'historique par modification, jamais une par frappe.
  const [labelDraft, setLabelDraft] = useState<string | null>(null)
  const [amountDraft, setAmountDraft] = useState<string | null>(null)
  const [grossDraft, setGrossDraft] = useState<string | null>(null)
  const [ratioDraft, setRatioDraft] = useState<string | null>(null)

  // Style CSS dynamique pour animer le déplacement de l'élément pendant le glisser-déposer.
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  // Un flux dont le type n'est plus proposé pour cette entité (ancienne sauvegarde) reste affichable.
  const typeOptions = allowedTypes.includes(flow.type) ? allowedTypes : [flow.type, ...allowedTypes]

  // Un libellé identique à celui du type est le libellé par défaut : le champ reste vide.
  const hasDefaultLabel = flow.label === flowTypeLabels[flow.type]

  // Un salaire peut préciser son brut : l'écart avec le net compte alors comme cotisations salariales.
  const isSalary = flow.type === "salary"
  const ratio = netRatio(flow.amount, flow.grossAmount)

  const handleTypeChange = (type: FlowType) => {
    if (type === flow.type) return
    // Le libellé par défaut suit le type ; un libellé personnalisé est conservé. Le brut n'a de sens que pour un salaire.
    onUpdate(flow.id, { type, ...(hasDefaultLabel ? { label: flowTypeLabels[type] } : {}), ...(flow.grossAmount !== undefined ? { grossAmount: undefined } : {}) })
    onTypeUsed(type)
  }

  const commitLabel = () => {
    if (labelDraft === null) return
    setLabelDraft(null)
    const label = labelDraft.trim() || flowTypeLabels[flow.type]
    if (label !== flow.label) onUpdate(flow.id, { label })
  }

  const commitAmount = () => {
    if (amountDraft === null) return
    setAmountDraft(null)
    // Saisie vide ou invalide : l'ancienne valeur est restaurée.
    const amount = parseAmount(amountDraft)
    if (amount === null || amount === flow.amount) return
    // Un net supérieur au brut rend ce dernier incohérent : il est effacé.
    onUpdate(flow.id, flow.grossAmount !== undefined && amount > flow.grossAmount ? { amount, grossAmount: undefined } : { amount })
  }

  // Brut saisi : avec un net déjà renseigné, le pourcentage en découle ; sans net, celui-ci est calculé au ratio par défaut.
  const commitGross = () => {
    if (grossDraft === null) return
    setGrossDraft(null)
    if (grossDraft.trim() === "") {
      if (flow.grossAmount !== undefined) onUpdate(flow.id, { grossAmount: undefined })
      return
    }
    const gross = parseAmount(grossDraft)
    if (gross === null || gross === flow.grossAmount) return
    if (flow.amount === 0) onUpdate(flow.id, { grossAmount: gross, amount: netFromGross(gross, DEFAULT_NET_RATIO) })
    else if (gross >= flow.amount) onUpdate(flow.id, { grossAmount: gross })
  }

  // Pourcentage saisi : il complète le montant manquant, le brut à partir du net, sinon le net à partir du brut.
  const commitRatio = () => {
    if (ratioDraft === null) return
    setRatioDraft(null)
    const newRatio = parsePercent(ratioDraft)
    if (newRatio === null) return
    if (flow.amount > 0) onUpdate(flow.id, { grossAmount: grossFromNet(flow.amount, newRatio) })
    else if (flow.grossAmount !== undefined) onUpdate(flow.id, { amount: netFromGross(flow.grossAmount, newRatio) })
  }

  // Entrée valide la saisie en cours, Échap l'annule.
  const handleKeyDown = (commit: () => void, cancel: () => void) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      commit()
    } else if (event.key === "Escape") {
      cancel()
    }
  }

  return (
    <div ref={setNodeRef} style={style} className={cn("flex flex-wrap items-center gap-2 rounded-md border bg-slate-50 p-2 sm:flex-nowrap dark:bg-gray-800", isDragging && "relative z-10 shadow-md")}>
      {/* Poignée de glisser-déposer : au clavier, Espace la saisit et les flèches déplacent le flux. */}
      <div {...attributes} {...listeners} aria-label="Réordonner le flux" className={POIGNEE_DE_TRI}>
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </div>

      <FlowTypeSelect value={flow.type} options={typeOptions} onChange={handleTypeChange} />
      <RetourALaLigneSurTelephone />

      <Input
        className="min-w-32 flex-1 bg-background sm:min-w-0"
        aria-label="Libellé"
        placeholder="Libellé (optionnel)"
        value={labelDraft ?? (hasDefaultLabel ? "" : flow.label)}
        data-editing={labelDraft !== null}
        onChange={e => setLabelDraft(e.target.value)}
        onBlur={commitLabel}
        onKeyDown={handleKeyDown(commitLabel, () => setLabelDraft(null))}
      />

      {isSalary && (
        <>
          <Input
            className="w-24 shrink-0 bg-background text-right font-mono"
            aria-label="Salaire brut"
            title="Salaire brut (optionnel) : l'écart avec le net compte comme cotisations salariales."
            placeholder="Brut"
            inputMode="decimal"
            value={grossDraft ?? (flow.grossAmount !== undefined ? formatAmount(flow.grossAmount) : "")}
            data-editing={grossDraft !== null}
            onFocus={e => e.target.select()}
            onChange={e => setGrossDraft(e.target.value)}
            onBlur={commitGross}
            onKeyDown={handleKeyDown(commitGross, () => setGrossDraft(null))}
          />
          <Input
            className="w-16 shrink-0 bg-background text-right font-mono"
            aria-label="Part du net dans le brut, en pourcentage"
            title="Part du net dans le brut. Saisir un pourcentage calcule le montant manquant."
            placeholder={`${formatPercent(DEFAULT_NET_RATIO)} %`}
            inputMode="decimal"
            value={ratioDraft ?? (ratio !== null ? `${formatPercent(ratio)} %` : "")}
            data-editing={ratioDraft !== null}
            onFocus={e => e.target.select()}
            onChange={e => setRatioDraft(e.target.value)}
            onBlur={commitRatio}
            onKeyDown={handleKeyDown(commitRatio, () => setRatioDraft(null))}
          />
        </>
      )}

      <Input
        className={cn("w-28 shrink-0 bg-background text-right font-mono", isOutgoingFlowType(flow.type) ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400")}
        aria-label={isSalary ? "Salaire net" : "Montant"}
        title={isSalary ? "Salaire net" : undefined}
        inputMode="decimal"
        value={amountDraft ?? formatAmount(flow.amount)}
        data-editing={amountDraft !== null}
        onFocus={e => e.target.select()}
        onChange={e => setAmountDraft(e.target.value)}
        onBlur={commitAmount}
        onKeyDown={handleKeyDown(commitAmount, () => setAmountDraft(null))}
      />
      <span className="text-sm text-slate-600 dark:text-slate-400">€</span>

      <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive dark:text-red-400 dark:hover:text-red-400" aria-label="Supprimer le flux" onClick={() => onDelete(flow.id)}>
        <Trash2 />
      </Button>
    </div>
  )
}
