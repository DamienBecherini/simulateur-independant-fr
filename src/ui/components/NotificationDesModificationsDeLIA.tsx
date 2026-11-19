// src/ui/components/NotificationDesModificationsDeLIA.tsx
// La notification des modifications de l'IA (voir useModificationsDeLIA), dessinée entièrement ici : un en-tête figé
// (triangle et nombre d'éléments), la liste de toutes les modifications, la plus récente en haut, qui défile quand
// elle ne tient pas dans la fenêtre, et un pied figé (rappel de Ctrl+Z et bouton « Vu »).

import { TriangleAlert } from "lucide-react"

/** Titre de la notification : combien d'éléments déjà saisis l'IA a modifiés depuis le dernier « Vu ». */
function titreDesModifications(nombre: number): string {
  return nombre > 1 ? `L'IA a modifié ${nombre} éléments déjà saisis` : "L'IA a modifié un élément déjà saisi"
}

interface Props {
  /** Résumés des modifications, de la plus ancienne à la plus récente. */
  lignes: readonly string[]
  /** Clic sur « Vu » : la notification se ferme et le compte repart de zéro. */
  onVu: () => void
}

export function NotificationDesModificationsDeLIA({ lignes, onVu }: Props) {
  const plusRecenteDAbord = [...lignes].reverse()
  return (
    // La hauteur suit celle que la pile de notifications donne à l'élément (h-full), sans dépasser la fenêtre : la
    // pile de sonner est à 24 px du haut (16 px sur un téléphone) ; la hauteur de l'écran est ramenée au zoom de
    // l'interface (voir useZoom).
    <div
      data-notification-ia=""
      className="flex h-full max-h-[calc(100dvh/var(--zoom,1)_-_3rem)] w-(--width) flex-col overflow-hidden rounded-lg border-2 border-amber-600 bg-white text-[13px] text-neutral-900 shadow-lg dark:bg-black dark:text-neutral-100 max-[600px]:w-full"
    >
      <div className="flex items-start gap-2 border-b border-neutral-100 px-3.5 pt-3.5 pb-2 dark:border-neutral-800">
        <TriangleAlert aria-hidden="true" className="mt-px size-4 shrink-0 text-amber-700 dark:text-amber-400" />
        <p className="font-semibold">{titreDesModifications(lignes.length)}</p>
      </div>
      {/* Défilable au clavier : la liste reçoit le focus quand elle dépasse. */}
      <ul tabIndex={0} aria-label="Modifications de l'IA, la plus récente en premier" className="min-h-0 flex-1 list-disc space-y-0.5 overflow-y-auto py-2 pr-3.5 pl-8 leading-snug">
        {plusRecenteDAbord.map((ligne, rang) => (
          <li key={lignes.length - rang} className={rang === 0 ? "font-semibold" : undefined}>
            {ligne}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 border-t border-neutral-100 px-3.5 pt-2.5 pb-3 text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
        <p className="flex-1 text-xs leading-snug">
          {lignes.length > 1 ? "Vérifiez-les ; « Annuler » dans la barre d'outils (Ctrl+Z) les défait une à une." : "Vérifiez-la ; « Annuler » dans la barre d'outils (Ctrl+Z) la défait."}
        </p>
        <button type="button" onClick={onVu} className="h-7 shrink-0 cursor-pointer rounded px-3.5 text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:bg-neutral-100 dark:text-black dark:hover:bg-neutral-300">
          Vu
        </button>
      </div>
    </div>
  )
}
