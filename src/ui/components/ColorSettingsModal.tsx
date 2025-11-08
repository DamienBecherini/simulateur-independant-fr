// src/ui/components/ColorSettingsModal.tsx

import { useState, useEffect } from "react"
import type { UserPreferences, FinancialFlow } from "@/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { DEFAULT_FLOW_COLORS } from "@/lib/color-constants"
import { RotateCcw } from "lucide-react" // 1. Import de la nouvelle icône

interface ColorSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  preferences: UserPreferences
  onSave: (newPreferences: UserPreferences) => void
}

// Dictionnaire complet de tous les types de flux et de leurs labels
const allFlowTypes = Object.keys(DEFAULT_FLOW_COLORS) as FinancialFlow["type"][]
const flowTypeLabels: Record<string, string> = {
  are: "ARE",
  salary: "Salaire",
  other_taxable_income: "Autre Revenu",
  ca_services: "CA Services",
  ca_vente: "CA Vente",
  deductible_expense: "Dépense Déductible",
  director_remuneration: "Rémunération Dirigeant",
  dividends_payment: "Dividendes",
  ca_micro_services_bic: "CA Micro (BIC)",
  ca_micro_services_bnc: "CA Micro (BNC)",
  ca_micro_vente: "CA Micro Vente",
  income: "Revenu (Test)",
  expense: "Dépense (Test)"
}

export function ColorSettingsModal({ isOpen, onClose, preferences, onSave }: ColorSettingsModalProps) {
  const [localColors, setLocalColors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen) {
      setLocalColors({ ...DEFAULT_FLOW_COLORS, ...preferences.flowTypeColors })
    }
  }, [isOpen, preferences])

  const handleColorChange = (flowType: string, color: string) => {
    setLocalColors(prev => ({ ...prev, [flowType]: color }))
  }

  const handleSave = () => {
    onSave({ ...preferences, flowTypeColors: localColors })
    onClose()
  }

  // 2. Nouvelle fonction pour réinitialiser l'état local aux valeurs par défaut
  const handleResetToDefaults = () => {
    setLocalColors(DEFAULT_FLOW_COLORS)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Personnaliser les couleurs des flux</DialogTitle>
          <DialogDescription>Choisissez une couleur pour chaque type de flux financier. Ces couleurs seront utilisées dans la grille visuelle.</DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-4 space-y-3">
          {allFlowTypes.map(type => (
            <div key={type} className="grid grid-cols-[1fr_auto] items-center gap-4">
              <label htmlFor={`color-${type}`} className="text-sm font-medium">
                {flowTypeLabels[type] || type}
              </label>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: localColors[type] }} />
                <input id={`color-${type}`} type="color" value={localColors[type] || "#ffffff"} onChange={e => handleColorChange(type, e.target.value)} className="p-0 h-10 w-12 border-none bg-transparent cursor-pointer" title="Choisir une couleur" />
              </div>
            </div>
          ))}
        </div>
        {/* 3. Le pied de page est mis à jour avec le nouveau bouton */}
        <DialogFooter>
          <Button variant="ghost" onClick={handleResetToDefaults} className="mr-auto">
            <RotateCcw className="mr-2 h-4 w-4" />
            Réinitialiser
          </Button>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave}>Enregistrer les modifications</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
