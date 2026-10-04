// src/ui/hooks/useTriAccessible.ts
// Réglages communs des listes triables par glisser-déposer : souris, toucher et clavier (Espace ou Entrée sur la
// poignée, puis les flèches), avec les consignes et les annonces en français pour les lecteurs d'écran.

import { useMemo } from "react"
import { KeyboardSensor, PointerSensor, useSensor, useSensors, type DndContextProps } from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { annoncesDeTri, consignesDeTri } from "@/lib/glisser-deposer"

export function useTriAccessible(elements: ReadonlyArray<{ id: string; nom: string }>): Pick<DndContextProps, "sensors" | "accessibility"> {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const accessibility = useMemo(() => ({ announcements: annoncesDeTri(elements), screenReaderInstructions: consignesDeTri }), [elements])
  return { sensors, accessibility }
}

/** Classes d'une poignée de glisser-déposer : atteignable au clavier, focus visible, zone de 24 px (44 px au doigt). */
export const POIGNEE_DE_TRI = "flex shrink-0 cursor-grab touch-none items-center justify-center rounded-md min-h-6 min-w-6 pointer-coarse:min-h-11 pointer-coarse:min-w-11 text-slate-500 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-slate-400 dark:hover:bg-gray-700"
