// src/ui/components/SelectEntityTypeModal.tsx

// import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Briefcase, Building, Store, User } from "lucide-react"
import type { ReactNode } from "react"
import type { StatutJuridique } from "@/types"

/** Les activités qu'on peut ajouter : une micro-entreprise, ou une activité au réel dans l'un des statuts juridiques. */
export type BusinessEntityType = "MicroEntreprise" | StatutJuridique

interface SelectEntityTypeModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (type: BusinessEntityType) => void
}

interface OptionDActivite {
  label: string
  description: string
  icon: ReactNode
}

/** Le choix proposé pour chaque activité, dans l'ordre d'affichage. Un nouveau statut doit y avoir le sien. */
const OPTIONS_PAR_TYPE: Record<BusinessEntityType, OptionDActivite> = {
  MicroEntreprise: { label: "Micro-Entreprise", description: "Entreprise individuelle au régime simplifié, charges forfaitaires.", icon: <Store className="h-8 w-8 text-blue-500" /> },
  EI: { label: "Entreprise individuelle (au réel)", description: "Charges réelles déduites, bénéfice imposé à l'impôt sur le revenu.", icon: <User className="h-8 w-8 text-violet-500" /> },
  SASU: { label: "SASU (à l'IS)", description: "Société par actions, dirigeant assimilé-salarié.", icon: <Briefcase className="h-8 w-8 text-red-500" /> },
  EURL: { label: "EURL (à l'IS)", description: "Société à responsabilité limitée, gérant TNS.", icon: <Building className="h-8 w-8 text-green-500" /> }
}

const entityOptions = (Object.keys(OPTIONS_PAR_TYPE) as BusinessEntityType[]).map(type => ({ type, ...OPTIONS_PAR_TYPE[type] }))

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
                <p className="text-sm text-slate-600 dark:text-slate-400">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
