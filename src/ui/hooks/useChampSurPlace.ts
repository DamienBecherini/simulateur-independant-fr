// src/ui/hooks/useChampSurPlace.ts

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react"
import { updatePersonAvatar } from "@/lib/avatar-utils"
import type { Entity } from "@/types"

/**
 * Champ modifié sur place : la saisie reste un brouillon jusqu'à la validation (perte du focus ou Entrée), pour ne
 * créer qu'une étape d'historique par modification ; Échap l'annule. Renvoie les propriétés à donner au champ.
 */
export function useChampSurPlace(valeur: string, valider: (saisie: string) => void) {
  // `null` tant que le champ n'est pas modifié.
  const [brouillon, setBrouillon] = useState<string | null>(null)
  // Échap retire le focus pour annuler : la perte de focus qui suit ne doit pas valider le brouillon,
  // encore visible dans la fermeture du gestionnaire.
  const annulation = useRef(false)

  return {
    value: brouillon ?? valeur,
    onChange: (event: ChangeEvent<HTMLInputElement>) => setBrouillon(event.target.value),
    onBlur: () => {
      if (brouillon === null || annulation.current) return
      setBrouillon(null)
      valider(brouillon)
    },
    /** Entrée valide la saisie en cours en quittant le champ, Échap l'annule. */
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.currentTarget.blur()
      } else if (event.key === "Escape") {
        setBrouillon(null)
        annulation.current = true
        event.currentTarget.blur()
        annulation.current = false
      }
    }
  }
}

/** Nom d'un acteur modifié sur place ; les initiales de l'avatar d'une personne suivent son nom. */
export function useNomSurPlace(entity: Entity, onUpdate: (entity: Entity) => void) {
  return useChampSurPlace(entity.name, saisie => {
    const name = saisie.trim()
    if (!name || name === entity.name) return
    onUpdate(entity.type === "person" ? { ...entity, name, avatar: updatePersonAvatar(entity.avatar, name) } : { ...entity, name })
  })
}
