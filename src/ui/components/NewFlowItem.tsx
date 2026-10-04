// src/ui/components/NewFlowItem.tsx

import { useRef, useState, type KeyboardEvent, type RefObject } from "react"
import type { FinancialFlow } from "@/types"
import { Input } from "@/components/ui/input"
import { parseAmount } from "@/lib/amount-utils"
import { flowTypeLabels, type FlowType } from "@/lib/flow-constants"
import { Plus } from "lucide-react"
import { FlowTypeSelect } from "./FlowTypeSelect"

/** Valeurs saisies pour un nouveau flux. */
export type NewFlowValues = Pick<FinancialFlow, "type" | "label" | "amount">

/**
 * Interface pour les props du composant NewFlowItem.
 * Ce composant est la ligne vide, toujours présente en bas de `MonthlyFlowsModal`,
 * qui sert à ajouter un flux : il est créé dès que la ligne est validée avec un montant.
 */
interface NewFlowItemProps {
  type: FlowType
  allowedTypes: ReadonlyArray<FlowType>
  onTypeChange: (type: FlowType) => void
  onCreate: (values: NewFlowValues) => void
  labelInputRef: RefObject<HTMLInputElement | null>
}

export function NewFlowItem({ type, allowedTypes, onTypeChange, onCreate, labelInputRef }: NewFlowItemProps) {
  const [label, setLabel] = useState("")
  const [amount, setAmount] = useState("")
  const [isAmountInvalid, setAmountInvalid] = useState(false)
  const amountInputRef = useRef<HTMLInputElement>(null)

  // Seul point de création du flux : la perte de focus du champ montant.
  const handleAmountBlur = () => {
    if (amount.trim() === "") return
    const parsedAmount = parseAmount(amount)
    if (parsedAmount === null) {
      setAmountInvalid(true)
      return
    }
    onCreate({ type, label: label.trim() || flowTypeLabels[type], amount: parsedAmount })
    // La ligne redevient vide ; le type est conservé pour la saisie suivante.
    setLabel("")
    setAmount("")
  }

  const handleAmountKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      if (parseAmount(amount) === null) {
        setAmountInvalid(amount.trim() !== "")
        return
      }
      // Déplacer le focus fait perdre le focus au montant, ce qui crée le flux (une seule fois),
      // et place le curseur sur la nouvelle ligne vide pour enchaîner les saisies.
      labelInputRef.current?.focus()
    } else if (event.key === "Escape") {
      setAmount("")
      setAmountInvalid(false)
    }
  }

  const handleLabelKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      // Entrée passe au montant, comme Tab.
      event.preventDefault()
      amountInputRef.current?.focus()
    } else if (event.key === "Escape") {
      setLabel("")
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed p-2">
      <Plus className="h-4 w-4 shrink-0 text-slate-400" />

      <FlowTypeSelect value={type} options={allowedTypes} onChange={onTypeChange} />

      <Input ref={labelInputRef} className="min-w-0 flex-1 bg-background" aria-label="Libellé du nouveau flux" placeholder="Libellé (optionnel)" value={label} data-editing={label !== ""} onChange={e => setLabel(e.target.value)} onKeyDown={handleLabelKeyDown} />

      <Input
        ref={amountInputRef}
        className="w-28 shrink-0 bg-background text-right font-mono"
        aria-label="Montant du nouveau flux"
        aria-invalid={isAmountInvalid}
        inputMode="decimal"
        placeholder="Montant"
        value={amount}
        data-editing={amount !== ""}
        onChange={e => {
          setAmount(e.target.value)
          setAmountInvalid(false)
        }}
        onBlur={handleAmountBlur}
        onKeyDown={handleAmountKeyDown}
      />
      <span className="text-sm text-slate-500">€</span>

      {/* Réserve la largeur du bouton de suppression pour aligner les colonnes sur les lignes existantes. */}
      <div className="h-9 w-9 shrink-0" />
    </div>
  )
}
