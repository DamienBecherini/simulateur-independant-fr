// src/ui/components/NewFlowItem.tsx

import { useRef, useState, type KeyboardEvent, type RefObject } from "react"
import type { Entity, FinancialFlow } from "@/types"
import { Input } from "@/components/ui/input"
import { formatAmount, parseAmount } from "@/lib/amount-utils"
import { libelleDuType, type FlowType } from "@/lib/flow-constants"
import { brutCalcule, grossFromNet, netCalcule, netFromGross, parsePercent } from "@/lib/salary-utils"
import type { ReglesFiscales } from "@/backend/logic/regles"
import { Plus } from "lucide-react"
import { FlowTypeSelect, RetourALaLigneSurTelephone } from "./FlowTypeSelect"

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
  /** Acteur qui porte le flux, pour les libellés qui en dépendent. */
  typeActeur?: Entity["type"]
  /** Règles de l'année affichée : leurs cotisations salariales donnent le brut ou le net d'un salaire sans pourcentage. */
  regles: ReglesFiscales
}

export function NewFlowItem({ type, allowedTypes, onTypeChange, onCreate, labelInputRef, typeActeur, regles }: NewFlowItemProps) {
  const [label, setLabel] = useState("")
  const [amount, setAmount] = useState("")
  const [isAmountInvalid, setAmountInvalid] = useState(false)
  const amountInputRef = useRef<HTMLInputElement>(null)

  // Pour un salaire, le brut et le pourcentage sont facultatifs. Tant que le net n'a pas été saisi à la main,
  // il est calculé à partir du brut : avec le pourcentage saisi, sinon avec les cotisations salariales de l'année.
  const isSalary = type === "salary"
  const [gross, setGross] = useState("")
  const [ratio, setRatio] = useState("")
  const [isNetComputed, setNetComputed] = useState(false)

  const computeNet = (grossText: string, ratioText: string) => {
    const grossAmount = parseAmount(grossText)
    if (grossAmount === null || (amount.trim() !== "" && !isNetComputed)) return
    const saisi = parsePercent(ratioText)
    setAmount(formatAmount(saisi === null ? netCalcule(grossAmount, regles) : netFromGross(grossAmount, saisi)))
    setNetComputed(true)
    setAmountInvalid(false)
  }

  /**
   * Brut à enregistrer avec le net : celui saisi, sinon celui déduit du pourcentage saisi, sinon celui calculé avec les
   * cotisations salariales de l'année, pour que les cotisations d'un salaire soient toujours comptées. Un brut
   * inférieur au net est ignoré.
   */
  const resolveGross = (net: number): number | undefined => {
    if (!isSalary) return undefined
    const saisi = parsePercent(ratio)
    const grossAmount = parseAmount(gross) ?? (saisi === null ? brutCalcule(net, regles) : grossFromNet(net, saisi))
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
    onCreate({ type, label: label.trim() || libelleDuType(type, typeActeur), amount: parsedAmount, ...(grossAmount !== undefined ? { grossAmount } : {}) })
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
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2 sm:flex-nowrap">
      <Plus className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />

      <FlowTypeSelect value={type} options={allowedTypes} onChange={onTypeChange} typeActeur={typeActeur} />
      <RetourALaLigneSurTelephone />

      <Input ref={labelInputRef} className="min-w-32 flex-1 bg-background sm:min-w-0" aria-label="Libellé du nouveau flux" placeholder="Libellé (optionnel)" value={label} data-editing={label !== ""} onChange={e => setLabel(e.target.value)} onKeyDown={handleOptionalFieldKeyDown(() => setLabel(""))} />

      {isSalary && (
        <>
          <Input
            className="w-24 shrink-0 bg-background text-right font-mono"
            aria-label="Salaire brut du nouveau flux"
            title="Salaire brut : laissé vide, il est calculé à partir du net, avec le pourcentage s'il est saisi."
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
            title={`Part du net dans le brut : si vous ne la précisez pas, le brut est calculé avec les cotisations salariales de ${regles.annee}.`}
            placeholder="auto"
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
      <div className="h-9 w-9 shrink-0 pointer-coarse:w-11" />
    </div>
  )
}
