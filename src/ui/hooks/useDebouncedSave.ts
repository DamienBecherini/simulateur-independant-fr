import { useEffect, useRef } from "react"

/**
 * Un hook personnalisé qui exécute une fonction après un certain délai d'inactivité.
 * @param data Les données à passer à la fonction de rappel.
 * @param delay Le délai en millisecondes.
 * @param saveCallback La fonction à appeler avec les données après le délai.
 */
export function useDebouncedSave<T>(data: T, delay: number, saveCallback: (data: T) => void) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialMount = useRef(true) // Ajout d'une ref pour suivre le premier rendu

  useEffect(() => {
    // Au premier montage, on ne fait rien.
    // Cela évite de sauvegarder un état initial potentiellement vide avant le chargement.
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      saveCallback(data)
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [data, delay, saveCallback]) // On ajoute saveCallback aux dépendances
}
