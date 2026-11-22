// src/ui/components/PartirDeZero.tsx
// « Partir de zéro », en tête de « Par où commencer ? » (fenêtre et bloc de la page) : une simulation vierge, confirmée
// quand la simulation en cours serait perdue, puis le focus sur l'ajout d'une personne. L'action vient de l'application
// (PartirDeZeroContext) : hors de l'application (tests de composants isolés), le bouton n'est pas proposé.

import { useContext, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ID_DE_L_AJOUT_D_UNE_PERSONNE } from "@/lib/questions-de-depart"
import { allerALaSaisie, PartirDeZeroContext } from "../depart"
import { ConfirmationDeRemplacement } from "./ConfirmationDeRemplacement"

interface BoutonPartirDeZeroProps {
  /** La simulation en cours serait perdue : une confirmation d'abord. */
  confirmationNecessaire: boolean
  nomDeLaSession: string
  /** Appelé une fois la simulation vierge en place (la fenêtre se ferme). */
  onFait?: () => void
}

export function BoutonPartirDeZero({ confirmationNecessaire, nomDeLaSession, onFait }: BoutonPartirDeZeroProps) {
  const partir = useContext(PartirDeZeroContext)
  const [aConfirmer, setAConfirmer] = useState(false)
  // Le bouton qui a demandé la confirmation : « Annuler » y ramène le focus ; après « Remplacer », l'ajout d'une personne.
  const declencheur = useRef<HTMLElement | null>(null)
  if (!partir) return null

  const partirDeZero = () => {
    setAConfirmer(false)
    partir()
    onFait?.()
    declencheur.current = document.getElementById(ID_DE_L_AJOUT_D_UNE_PERSONNE)
    allerALaSaisie()
  }
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 pointer-coarse:min-h-11"
        onClick={evenement => {
          if (!confirmationNecessaire) return partirDeZero()
          declencheur.current = evenement.currentTarget
          setAConfirmer(true)
        }}
      >
        <Plus aria-hidden /> Partir de zéro
      </Button>
      <ConfirmationDeRemplacement open={aConfirmer} onAnnuler={() => setAConfirmer(false)} onConfirmer={partirDeZero} titre="Remplacer la simulation en cours ?" libelleDeConfirmation="Remplacer" declencheur={declencheur}>
        « {nomDeLaSession} » n'est pas enregistrée dans une sauvegarde. Une simulation vierge la remplacera ; le bouton « Annuler » de la barre d'outils la rétablira.
      </ConfirmationDeRemplacement>
    </>
  )
}
