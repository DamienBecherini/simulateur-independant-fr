// src/ui/hooks/useModificationsDeLIA.tsx
// Mode « IA en direct » : ce que l'IA change dans ce qui était déjà saisi (montant d'une série, acteur, réglage du
// comparateur) s'applique sans relecture, comme un ajout. Pour que cela ne passe pas inaperçu (un document piégé
// pourrait faire changer des chiffres), ces modifications sont réunies dans une seule notification, qui reste à
// l'écran jusqu'au clic sur « Vu » et se complète à chaque nouvelle modification. Les ajouts gardent leur notification
// brève ; les suppressions, elles, attendent toujours le clic de l'utilisateur.

import { useCallback, useRef } from "react"
import { toast } from "sonner"
import { NotificationDesModificationsDeLIA } from "../components/NotificationDesModificationsDeLIA"

/** Rend `signaler`, qui ajoute des lignes à la notification des modifications de l'IA et l'affiche. */
export function useModificationsDeLIA() {
  const lignes = useRef<string[]>([])
  // La notification affichée, et de quoi en numéroter une nouvelle.
  const affichee = useRef<string | null>(null)
  const numero = useRef(0)
  const signaler = useCallback((nouvelles: readonly string[]) => {
    if (nouvelles.length === 0) return
    lignes.current = [...lignes.current, ...nouvelles]
    const aAfficher = lignes.current
    // Mise à jour, une notification garderait sa place dans la pile, derrière les notifications brèves arrivées depuis :
    // la précédente est retirée et une nouvelle, complétée, passe devant.
    const precedente = affichee.current
    const id = `modifications-de-l-ia-${++numero.current}`
    affichee.current = id
    if (precedente) toast.dismiss(precedente)
    // Fermée par « Vu » (et non remplacée par la suivante) : le compte repart de zéro.
    const fermee = () => {
      if (affichee.current !== id) return
      affichee.current = null
      lignes.current = []
    }
    // Dessinée entièrement par l'application (en-tête et pied figés, liste défilante) : la mise en page de sonner ne
    // le permet pas. Pas de croix : « Vu » est la seule façon de la fermer.
    const vu = () => {
      fermee()
      toast.dismiss(id)
    }
    toast.custom(() => <NotificationDesModificationsDeLIA lignes={aAfficher} onVu={vu} />, { id, duration: Infinity, onDismiss: fermee })
  }, [])
  return signaler
}
