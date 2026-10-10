// src/ui/components/ColorSettingsModal.tsx

import { useState } from "react"
import type { UserPreferences, FinancialFlow } from "@/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { DEFAULT_FLOW_COLORS } from "@/lib/color-constants"
import { flowTypeShortLabels } from "@/lib/flow-constants"
import { RotateCcw } from "lucide-react"

/**
 * Interface pour les props du composant ColorSettingsModal.
 * Ce composant permet à l'utilisateur de personnaliser la couleur
 * associée à chaque type de flux financier.
 */
interface ColorSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  preferences: UserPreferences
  onSave: (newPreferences: UserPreferences) => void
}

// Récupère la liste de tous les types de flux possibles depuis les couleurs par défaut.
const allFlowTypes = Object.keys(DEFAULT_FLOW_COLORS) as FinancialFlow["type"][]

export function ColorSettingsModal({ isOpen, onClose, preferences, onSave }: ColorSettingsModalProps) {
  // État local pour les couleurs. Permet de modifier les couleurs sans affecter l'état global
  // avant de cliquer sur "Enregistrer". L'utilisateur peut ainsi annuler ses changements.
  const [localColors, setLocalColors] = useState<Record<string, string>>({})

  // À l'ouverture, on initialise l'état local avec les couleurs actuelles (défaut + personnalisations), pendant le rendu
  // plutôt que dans un effet : `depart` retient les préférences d'où viennent les couleurs locales, `null` fenêtre fermée.
  const [depart, setDepart] = useState<UserPreferences | null>(null)
  const attendu = isOpen ? preferences : null
  if (depart !== attendu) {
    setDepart(attendu)
    if (attendu) setLocalColors({ ...DEFAULT_FLOW_COLORS, ...attendu.flowTypeColors })
  }

  // Met à jour une couleur dans l'état local lorsqu'elle est modifiée par l'utilisateur.
  const handleColorChange = (flowType: string, color: string) => {
    setLocalColors(prev => ({ ...prev, [flowType]: color }))
  }

  // Sauvegarde les modifications en propageant l'état local à l'état global via la callback `onSave`.
  const handleSave = () => {
    onSave({ ...preferences, flowTypeColors: localColors })
    onClose()
  }

  // Réinitialise les couleurs à leurs valeurs par défaut.
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
        {/* Conteneur scrollable pour la liste des couleurs */}
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-4 space-y-3">
          {/* Itère sur tous les types de flux possibles pour afficher un sélecteur de couleur pour chacun. */}
          {allFlowTypes.map(type => (
            <div key={type} className="grid grid-cols-[1fr_auto] items-center gap-4">
              <label htmlFor={`color-${type}`} className="text-sm font-medium">
                {flowTypeShortLabels[type] || type}
              </label>
              <div className="flex items-center gap-2">
                {/* Aperçu de la couleur */}
                <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: localColors[type] }} />
                {/* Sélecteur de couleur natif du navigateur */}
                <input id={`color-${type}`} type="color" value={localColors[type] || "#ffffff"} onChange={e => handleColorChange(type, e.target.value)} className="p-0 h-10 w-12 border-none bg-transparent cursor-pointer pointer-coarse:h-11" title="Choisir une couleur" />
              </div>
            </div>
          ))}
        </div>
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
