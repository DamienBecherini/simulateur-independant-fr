// src/ui/hooks/useModificationsDeLIA.tsx
// Mode « IA en direct » : ce que l'IA change dans ce qui était déjà saisi (montant d'une série, acteur, réglage du
// comparateur) s'applique sans relecture, comme un ajout. Pour que cela ne passe pas inaperçu (un document piégé
// pourrait faire changer des chiffres), ces modifications sont réunies dans une seule notification, qui reste à
// l'écran jusqu'au clic sur « Vu » et se complète à chaque nouvelle modification. Les ajouts gardent leur notification
// brève ; les suppressions, elles, attendent toujours le clic de l'utilisateur.

import { useCallback, useRef } from "react"
import { TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { DetailDesModificationsDeLIA } from "../components/DetailDesModificationsDeLIA"

/** Identifiant de la notification : la même est mise à jour tant qu'elle n'a pas été lue. */
const ID_DES_MODIFICATIONS_DE_L_IA = "modifications-de-l-ia"

/** Titre de la notification : combien d'éléments déjà saisis l'IA a modifiés depuis le dernier « Vu ». */
function titreDesModifications(nombre: number): string {
  return nombre > 1 ? `L'IA a modifié ${nombre} éléments déjà saisis` : "L'IA a modifié un élément déjà saisi"
}

/** Rend `signaler`, qui ajoute des lignes à la notification des modifications de l'IA et l'affiche. */
export function useModificationsDeLIA() {
  const lignes = useRef<string[]>([])
  const oublier = useCallback(() => {
    lignes.current = []
  }, [])
  const signaler = useCallback(
    (nouvelles: readonly string[]) => {
      if (nouvelles.length === 0) return
      lignes.current = [...lignes.current, ...nouvelles]
      // Une notification neutre, bordée d'ambre : les couleurs « avertissement » de sonner (texte orange sur crème)
      // n'atteignent pas le contraste de 4,5:1.
      toast(titreDesModifications(lignes.current.length), {
        id: ID_DES_MODIFICATIONS_DE_L_IA,
        icon: <TriangleAlert aria-hidden="true" className="size-4 text-amber-700" />,
        className: "border-2! border-amber-600!",
        description: <DetailDesModificationsDeLIA lignes={lignes.current} />,
        duration: Infinity,
        action: {
          label: "Vu",
          onClick: () => {
            oublier()
            toast.dismiss(ID_DES_MODIFICATIONS_DE_L_IA)
          }
        },
        onDismiss: oublier
      })
    },
    [oublier]
  )
  return signaler
}
