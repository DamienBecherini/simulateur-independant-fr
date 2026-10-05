// src/ui/components/SelecteurAffichage.tsx

import { LayoutTemplate } from "lucide-react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AFFICHAGES, libelleDeLAffichage } from "@/lib/affichage"
import type { Affichage } from "@/types"

interface SelecteurAffichageProps {
  affichage: Affichage
  onChange: (affichage: Affichage) => void
}

/**
 * Choix de l'affichage de la page pendant la bêta, dans la barre d'outils. Les affichages pas encore réalisés sont
 * proposés grisés, avec la mention « bientôt » : on sait ainsi qu'il y en aura quatre à essayer. Sur un téléphone,
 * le bouton se réduit à son icône ; son nom accessible garde l'affichage en cours.
 */
export function SelecteurAffichage({ affichage, onChange }: SelecteurAffichageProps) {
  return (
    <Select value={affichage} onValueChange={valeur => onChange(valeur as Affichage)}>
      <SelectTrigger size="sm" aria-label={`Affichage : ${libelleDeLAffichage(affichage)}`} title="Affichage de la page (bêta)" className="h-8 gap-1.5 px-2 pointer-coarse:min-w-11 sm:px-3 [&>svg:last-child]:max-sm:hidden">
        <LayoutTemplate aria-hidden className="text-slate-600 dark:text-slate-400" />
        <span className="hidden text-slate-600 lg:inline dark:text-slate-400">Affichage :</span>
        <span className="max-sm:hidden">
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          <SelectLabel className="max-w-64">Bêta : dites-nous quel affichage vous préférez.</SelectLabel>
          {AFFICHAGES.map(a => (
            <SelectItem key={a.valeur} value={a.valeur} disabled={!a.disponible} title={a.description} className="pointer-coarse:min-h-11">
              {a.disponible ? a.libelle : `${a.libelle} (bientôt)`}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
