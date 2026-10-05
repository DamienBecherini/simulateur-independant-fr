// src/ui/hooks/useReglagesSurPlace.ts

import { useState, type FocusEvent, type KeyboardEvent } from "react"
import { updatePersonAvatar } from "@/lib/avatar-utils"
import type { Entity } from "@/types"

/** Champ où l'on tape (texte, nombre) : sa saisie attend la validation ; un interrupteur ou un choix s'applique aussitôt. */
function estUneSaisie(element: EventTarget | Element | null): element is HTMLInputElement {
  return element instanceof HTMLInputElement && !["checkbox", "radio", "range", "button", "submit"].includes(element.type)
}

/** L'acteur tel qu'enregistré : un nom vide garde l'ancien, les initiales d'une personne suivent son nom. */
function finaliser(modifie: Entity, actuel: Entity): Entity {
  const name = modifie.name.trim() || actuel.name
  if (modifie.type === "person") return { ...modifie, name, avatar: updatePersonAvatar(modifie.avatar, name) }
  return { ...modifie, name }
}

/**
 * Réglages d'un acteur appliqués à mesure (panneau de l'affichage « Panneaux »), avec le même historique que la fenêtre
 * « Modifier » : une étape d'annulation par modification validée. Un interrupteur, un choix dans une liste, une couleur
 * s'appliquent aussitôt ; la saisie d'un champ reste un brouillon jusqu'à ce qu'on le quitte ou qu'on appuie sur
 * Entrée, et Échap l'annule. `conteneur` est à donner à l'élément qui entoure les champs.
 */
export function useReglagesSurPlace(entity: Entity, valider: (entity: Entity) => void) {
  const [brouillon, setBrouillon] = useState<Entity | null>(null)

  const appliquer = (modifie: Entity) => {
    setBrouillon(null)
    const final = finaliser(modifie, entity)
    if (JSON.stringify(final) !== JSON.stringify(entity)) valider(final)
  }

  return {
    entity: brouillon ?? entity,
    onChange: (modifie: Entity) => (estUneSaisie(document.activeElement) ? setBrouillon(modifie) : appliquer(modifie)),
    conteneur: {
      onBlur: (event: FocusEvent<HTMLElement>) => {
        if (brouillon && estUneSaisie(event.target)) appliquer(brouillon)
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (!brouillon || !estUneSaisie(event.target)) return
        if (event.key === "Enter") {
          event.preventDefault()
          appliquer(brouillon)
        } else if (event.key === "Escape") {
          // Échap annule la saisie ; il ne ferme pas le panneau.
          event.preventDefault()
          setBrouillon(null)
        }
      }
    }
  }
}
