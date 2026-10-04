// src/ui/components/NewFlowItem.tsx

import { useRef, useState, type KeyboardEvent, type RefObject } from "react"
import type { FinancialFlow } from "@/types"
import { Input } from "@/components/ui/input"
import { formatAmount, parseAmount } from "@/lib/amount-utils"
import { flowTypeLabels, type FlowType } from "@/lib/flow-constants"
import { DEFAULT_NET_RATIO, formatPercent, grossFromNet, netFromGross, parsePercent } from "@/lib/salary-utils"
import { Plus } from "lucide-react"
import { FlowTypeSelect } from "./FlowTypeSelect"

/** Valeurs saisies pour un nouveau flux. */
export type NewFlowValues = Pick<FinancialFlow, "type" | "label" | "amount" | "grossAmount">

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

  // Pour un salaire, le brut et le pourcentage sont facultatifs. Tant que le net n'a pas été saisi à la main,
  // il est calculé à partir du brut et du pourcentage (78 % par défaut).
  const isSalary = type === "salary"
  const [gross, setGross] = useState("")
  const [ratio, setRatio] = useState("")
  const [isNetComputed, setNetComputed] = useState(false)

  const computeNet = (grossText: string, ratioText: string) => {
    const grossAmount = parseAmount(grossText)
    if (grossAmount === null || (amount.trim() !== "" && !isNetComputed)) return
    setAmount(formatAmount(netFromGross(grossAmount, parsePercent(ratioText) ?? DEFAULT_NET_RATIO)))
    setNetComputed(true)
    setAmountInvalid(false)
  }

  /**
   * Brut à enregistrer avec le net : celui saisi, sinon celui déduit du pourcentage (78 % par défaut),
   * pour que les cotisations d'un salaire soient toujours comptées. Un brut inférieur au net est ignoré.
   */
  const resolveGross = (net: number): number | undefined => {
    if (!isSalary) return undefined
    const grossAmount = parseAmount(gross) ?? grossFromNet(net, parsePercent(ratio) ?? DEFAULT_NET_RATIO)
    return grossAmount >= net ? grossAmount : undefined
  }

  // Seul point de création du flux : la perte de focus du champ montant.
  const handleAmountBlur = () => {
    if (amount.trim() === "") return
    const parsedAmount = parseAmount(amount)
    if (parsedAmount === null) {
      setAmountInvalid(true)
      return
    }
    const grossAmount = resolveGross(parsedAmount)
    onCreate({ type, label: label.trim() || flowTypeLabels[type], amount: parsedAmount, ...(grossAmount !== undefined ? { grossAmount } : {}) })
    // La ligne redevient vide ; le type est conservé pour la saisie suivante.
    setLabel("")
    setAmount("")
    setGross("")
    setRatio("")
    setNetComputed(false)
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
      setNetComputed(false)
      setAmountInvalid(false)
    }
  }

  // Entrée passe au champ suivant, comme Tab ; Échap vide le champ.
  const handleOptionalFieldKeyDown = (clear: () => void) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      amountInputRef.current?.focus()
    } else if (event.key === "Escape") {
      clear()
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed p-2">
      <Plus className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />

      <FlowTypeSelect value={type} options={allowedTypes} onChange={onTypeChange} />

      <Input ref={labelInputRef} className="min-w-0 flex-1 bg-background" aria-label="Libellé du nouveau flux" placeholder="Libellé (optionnel)" value={label} data-editing={label !== ""} onChange={e => setLabel(e.target.value)} onKeyDown={handleOptionalFieldKeyDown(() => setLabel(""))} />

      {isSalary && (
        <>
          <Input
            className="w-24 shrink-0 bg-background text-right font-mono"
            aria-label="Salaire brut du nouveau flux"
            title="Salaire brut : laissé vide, il est calculé à partir du net et du pourcentage."
            placeholder="Brut"
            inputMode="decimal"
            value={gross}
            data-editing={gross !== ""}
            onChange={e => {
              setGross(e.target.value)
              computeNet(e.target.value, ratio)
            }}
            onKeyDown={handleOptionalFieldKeyDown(() => setGross(""))}
          />
          <Input
            className="w-16 shrink-0 bg-background text-right font-mono"
            aria-label="Part du net dans le brut du nouveau flux, en pourcentage"
            title="Part du net dans le brut : 78 % si vous ne la précisez pas."
            placeholder={`${formatPercent(DEFAULT_NET_RATIO)} %`}
            inputMode="decimal"
            value={ratio}
            data-editing={ratio !== ""}
            onChange={e => {
              setRatio(e.target.value)
              computeNet(gross, e.target.value)
            }}
            onKeyDown={handleOptionalFieldKeyDown(() => setRatio(""))}
          />
        </>
      )}

      <Input
        ref={amountInputRef}
        className="w-28 shrink-0 bg-background text-right font-mono"
        aria-label={isSalary ? "Salaire net du nouveau flux" : "Montant du nouveau flux"}
        aria-invalid={isAmountInvalid}
        inputMode="decimal"
        placeholder={isSalary ? "Net" : "Montant"}
        value={amount}
        data-editing={amount !== ""}
        onChange={e => {
          setAmount(e.target.value)
          setNetComputed(false)
          setAmountInvalid(false)
        }}
        onBlur={handleAmountBlur}
        onKeyDown={handleAmountKeyDown}
      />
      <span className="text-sm text-slate-600 dark:text-slate-400">€</span>

      {/* Réserve la largeur du bouton de suppression pour aligner les colonnes sur les lignes existantes. */}
      <div className="h-9 w-9 shrink-0" />
    </div>
  )
}
