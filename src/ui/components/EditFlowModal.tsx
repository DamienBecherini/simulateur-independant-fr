// src/ui/components/EditFlowModal.tsx

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Entity, FinancialFlow } from "@/types"

interface EditFlowModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (flow: FinancialFlow, isEditing: boolean) => void // Mis à jour pour gérer l'édition
  context: { entityId: string; monthIndex: number } | null
  flowToEdit?: FinancialFlow | null // Nouvelle prop pour la modification
  allEntities: Entity[]
}

const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

const getInitialState = () => ({
  type: "" as FinancialFlow["type"] | "",
  label: "",
  amount: 0
})

const flowTypeLabels: Record<FinancialFlow["type"], string> = {
  are: "Allocation chômage (ARE)",
  salary: "Salaire (emploi tiers)",
  other_taxable_income: "Autre revenu imposable",
  ca_services: "CA - Prestation de services",
  ca_vente: "CA - Vente de marchandises",
  deductible_expense: "Dépense déductible",
  director_remuneration: "Rémunération de dirigeant",
  dividends_payment: "Versement de dividendes",
  ca_micro_services_bic: "CA Micro - Services (BIC)",
  ca_micro_services_bnc: "CA Micro - Services (BNC)",
  ca_micro_vente: "CA Micro - Vente",
  income: "Revenu (Test)",
  expense: "Dépense (Test)"
}

export function EditFlowModal({ isOpen, onClose, onSave, context, flowToEdit, allEntities }: EditFlowModalProps) {
  const [formData, setFormData] = useState(getInitialState())

  const entity = useMemo(() => allEntities.find(e => e.id === context?.entityId), [allEntities, context])

  useEffect(() => {
    if (isOpen) {
      if (flowToEdit) {
        // Mode édition : on remplit le formulaire avec les données du flux existant
        setFormData({
          type: flowToEdit.type,
          label: flowToEdit.label,
          amount: flowToEdit.amount
        })
      } else {
        // Mode création : on réinitialise le formulaire
        setFormData(getInitialState())
      }
    }
  }, [isOpen, flowToEdit])

  const availableFlowTypes = useMemo((): FinancialFlow["type"][] => {
    if (!entity) return []
    switch (entity.type) {
      case "person":
        return ["are", "salary", "other_taxable_income"]
      case "company":
        return ["ca_services", "ca_vente", "deductible_expense", "director_remuneration", "dividends_payment"]
      case "micro-entreprise":
        return ["ca_micro_services_bic", "ca_micro_services_bnc", "ca_micro_vente"]
      default:
        return []
    }
  }, [entity])

  const handleSave = () => {
    if (!context || !entity || !formData.type) return

    const isEditing = !!flowToEdit
    const savedFlow: FinancialFlow = {
      // Si on édite, on garde l'ID existant, sinon on en crée un nouveau
      id: isEditing ? flowToEdit.id : `flow-${Date.now()}`,
      entityId: entity.id,
      label: formData.label || flowTypeLabels[formData.type as FinancialFlow["type"]],
      amount: Number(formData.amount) || 0,
      type: formData.type as FinancialFlow["type"]
    }
    onSave(savedFlow, isEditing)
  }

  if (!isOpen || !context || !entity) {
    return null
  }

  const monthName = months[context.monthIndex]
  const modalTitle = flowToEdit ? `Modifier un flux pour "${entity.name}"` : `Ajouter un flux pour "${entity.name}"`

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogDescription>Opération financière pour le mois de {monthName}.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="flow-type" className="text-right">
              Type
            </Label>
            <Select value={formData.type} onValueChange={value => setFormData(prev => ({ ...prev, type: value as FinancialFlow["type"] }))}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Choisir un type de flux..." />
              </SelectTrigger>
              <SelectContent>
                {availableFlowTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {flowTypeLabels[type] || type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="flow-label" className="text-right">
              Libellé
            </Label>
            <Input id="flow-label" className="col-span-3" placeholder="Optionnel (ex: Facture client A)" value={formData.label} onChange={e => setFormData(prev => ({ ...prev, label: e.target.value }))} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="flow-amount" className="text-right">
              Montant
            </Label>
            <Input id="flow-amount" type="number" className="col-span-3" value={formData.amount} onChange={e => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!formData.type || formData.amount === 0}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
