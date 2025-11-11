// src/ui/components/EditFlowModal.tsx

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Entity, FinancialFlow } from "@/types"
// 1. IMPORTATION DES ICÔNES
// On importe les icônes de chevrons nécessaires depuis la bibliothèque lucide-react.
import { ChevronUp, ChevronDown } from "lucide-react"

/**
 * Interface définissant les props du composant EditFlowModal.
 * Ce composant est une "modale" qui sert à la fois à créer un nouveau flux financier
 * et à modifier un flux existant.
 */
interface EditFlowModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (flow: FinancialFlow, isEditing: boolean) => void // Callback pour sauvegarder le flux
  context: { entityId: string; monthIndex: number } | null // Contexte (entité/mois) de l'opération
  flowToEdit?: FinancialFlow | null // Le flux à modifier (si en mode édition)
  allEntities: Entity[]
}

// Constante pour les noms complets des mois, utilisés dans la description de la modale.
const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

// Fonction utilitaire pour obtenir l'état initial (vide) du formulaire.
const getInitialState = () => ({
  type: "" as FinancialFlow["type"] | "",
  label: "",
  amount: 0
})

/**
 * Dictionnaire central pour les libellés des types de flux.
 * ROADMAP 5.5.1: Les libellés ont été clarifiés pour être non-ambigus pour l'utilisateur.
 * - 'deductible_expense' est devenu "Charge déductible" (concerne les sociétés IS).
 * - 'expense' est devenu "Dépense (non déductible)" (concerne les personnes et les micro-entreprises).
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

// 2. LISTE DES TYPES DE FLUX CONSIDÉRÉS COMME DES DÉPENSES
// On crée un tableau constant qui liste tous les types de flux considérés comme des sorties d'argent.
// Cela simplifie la logique pour déterminer quelle icône (chevron haut ou bas) et quelle couleur afficher.
const expenseTypes: ReadonlyArray<FinancialFlow["type"]> = ["deductible_expense", "expense", "dividends_payment", "director_remuneration"]

export function EditFlowModal({ isOpen, onClose, onSave, context, flowToEdit, allEntities }: EditFlowModalProps) {
  // État local pour gérer les données du formulaire (type, libellé, montant).
  const [formData, setFormData] = useState(getInitialState())

  // Récupère l'objet Entité complet à partir de son ID via une mémoïsation pour optimiser les performances.
  const entity = useMemo(() => allEntities.find(e => e.id === context?.entityId), [allEntities, context])

  // Effet qui se déclenche à l'ouverture de la modale.
  useEffect(() => {
    if (isOpen) {
      if (flowToEdit) {
        // Mode "Édition" : on pré-remplit le formulaire avec les données du flux existant.
        setFormData({
          type: flowToEdit.type,
          label: flowToEdit.label,
          amount: flowToEdit.amount
        })
      } else {
        // Mode "Création" : on réinitialise le formulaire à son état initial vide.
        setFormData(getInitialState())
      }
    }
  }, [isOpen, flowToEdit])

  /**
   * Calcule la liste des types de flux disponibles en fonction du statut juridique de l'entité.
   * C'est ici que la logique principale de la ROADMAP 5.5.1 est implémentée.
   * @returns Un tableau de types de flux autorisés.
   */
  const availableFlowTypes = useMemo((): FinancialFlow["type"][] => {
    if (!entity) return []
    switch (entity.type) {
      // Pour une personne, on autorise les revenus classiques ET les dépenses non déductibles.
      case "person":
        return ["are", "salary", "other_taxable_income", "expense"]

      // Pour une société (SASU/EURL), les dépenses sont des "charges déductibles".
      case "company":
        return ["ca_services", "ca_vente", "deductible_expense", "director_remuneration", "dividends_payment"]

      // Pour une micro-entreprise (régime forfaitaire), les dépenses ne sont pas déductibles.
      case "micro-entreprise":
        return ["ca_micro_services_bic", "ca_micro_services_bnc", "ca_micro_vente", "expense"]

      default:
        return []
    }
  }, [entity])

  // Gère la sauvegarde du flux.
  const handleSave = () => {
    if (!context || !entity || !formData.type) return

    const isEditing = !!flowToEdit
    const savedFlow: FinancialFlow = {
      id: isEditing ? flowToEdit.id : `flow-${Date.now()}`, // Conserve l'ID si édition, sinon en crée un nouveau.
      entityId: entity.id,
      label: formData.label || flowTypeLabels[formData.type as FinancialFlow["type"]], // Utilise le libellé par défaut si non fourni.
      amount: Number(formData.amount) || 0,
      type: formData.type as FinancialFlow["type"]
    }
    // Appelle la fonction de sauvegarde passée en props.
    onSave(savedFlow, isEditing)
  }

  // Si la modale ne doit pas être affichée, on ne rend rien.
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
          {/* Sélecteur pour le type de flux */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="flow-type" className="text-right">
              Type
            </Label>
            <Select value={formData.type} onValueChange={value => setFormData(prev => ({ ...prev, type: value as FinancialFlow["type"] }))}>
              {/* Bouton cliquable qui affiche la valeur sélectionnée */}
              <SelectTrigger className="col-span-3">
                <div className="flex items-center gap-2">
                  <SelectValue placeholder="Choisir un type de flux..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                {/* 4. MISE À JOUR DES `SelectItem` (les options dans la liste déroulante) */}
                {availableFlowTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {/*
                     * Chaque option dans la liste est maintenant un conteneur flex pour aligner
                     * joliment l'icône et le libellé.
                     */}
                    <div className="flex items-center gap-2">
                      {expenseTypes.includes(type) ? <ChevronDown className="h-4 w-4 text-red-500 stroke-[3px] flex-shrink-0" /> : <ChevronUp className="h-4 w-4 text-green-500 stroke-[3px] flex-shrink-0" />}
                      <span>{flowTypeLabels[type] || type}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Champ pour le libellé personnalisé (reste inchangé) */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="flow-label" className="text-right">
              Libellé
            </Label>
            <Input id="flow-label" className="col-span-3" placeholder="Optionnel (ex: Facture client A)" value={formData.label} onChange={e => setFormData(prev => ({ ...prev, label: e.target.value }))} />
          </div>
          {/* Champ pour le montant (reste inchangé) */}
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
