// src/ui/components/SelectEntityTypeModal.tsx

// import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Briefcase, Building, Store } from "lucide-react"

// On définit un type pour les choix possibles, qui correspond à nos types d'entités "business"
export type BusinessEntityType = "MicroEntreprise" | "SASU" | "EURL"

interface SelectEntityTypeModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (type: BusinessEntityType) => void
}

const entityOptions = [
  { type: "MicroEntreprise" as BusinessEntityType, label: "Micro-Entreprise", description: "Entreprise individuelle au régime simplifié.", icon: <Store className="h-8 w-8 text-blue-500" /> },
  { type: "SASU" as BusinessEntityType, label: "SASU (à l'IS)", description: "Société par actions, dirigeant assimilé-salarié.", icon: <Briefcase className="h-8 w-8 text-red-500" /> },
  { type: "EURL" as BusinessEntityType, label: "EURL (à l'IS)", description: "Société à responsabilité limitée, gérant TNS.", icon: <Building className="h-8 w-8 text-green-500" /> }
]

export function SelectEntityTypeModal({ isOpen, onClose, onSelect }: SelectEntityTypeModalProps) {
  const handleSelect = (type: BusinessEntityType) => {
    onSelect(type)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une activité</DialogTitle>
          <DialogDescription>Choisissez le statut juridique de l'activité que vous souhaitez simuler.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col space-y-3 pt-4">
          {entityOptions.map(option => (
            <button key={option.type} onClick={() => handleSelect(option.type)} className="flex items-center space-x-4 p-4 border rounded-lg text-left hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
              {option.icon}
              <div>
                <p className="font-semibold">{option.label}</p>
                <p className="text-sm text-slate-500">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
