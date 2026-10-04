// src/lib/glisser-deposer.ts
// Textes du glisser-déposer pour les lecteurs d'écran, en français : consignes au clavier et annonces
// pendant le déplacement d'un élément d'une liste triable (entités, flux d'un mois, sauvegardes).

import type { Announcements, ScreenReaderInstructions } from "@dnd-kit/core"

type Identifiant = string | number

export const consignesDeTri: ScreenReaderInstructions = {
  draggable: "Pour déplacer cet élément, appuyez sur Espace ou Entrée, déplacez-le avec les flèches haut et bas, puis appuyez de nouveau sur Espace ou Entrée pour le déposer, ou sur Échap pour annuler."
}

/** Annonces du déplacement d'un élément dans une liste, désigné par son nom et sa position (« 2 sur 5 »). */
export function annoncesDeTri(elements: ReadonlyArray<{ id: Identifiant; nom: string }>): Announcements {
  const nom = (id: Identifiant) => `« ${elements.find(e => e.id === id)?.nom ?? id} »`
  const position = (id: Identifiant) => `position ${elements.findIndex(e => e.id === id) + 1} sur ${elements.length}`

  return {
    onDragStart: ({ active }) => `${nom(active.id)} saisi, ${position(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${nom(active.id)} déplacé en ${position(over.id)}.` : `${nom(active.id)} n'est plus au-dessus de la liste.`),
    onDragEnd: ({ active, over }) => (over ? `${nom(active.id)} déposé en ${position(over.id)}.` : `${nom(active.id)} déposé à sa place.`),
    onDragCancel: ({ active }) => `Déplacement annulé : ${nom(active.id)} reste en ${position(active.id)}.`
  }
}
