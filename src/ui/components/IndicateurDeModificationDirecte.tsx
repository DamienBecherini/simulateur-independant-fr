// src/ui/components/IndicateurDeModificationDirecte.tsx
// Tant que l'utilisateur laisse l'IA modifier directement la simulation (voir l'ADR 011, addendum du 2026-10-14), une
// petite pastille « IA en direct » reste dans la barre d'outils, près d'« Annuler », avec la case qui y met fin : les
// propositions de l'IA repassent alors par la fenêtre de relecture. L'explication complète est dans l'info-bulle et
// dans la description accessible de la case. Ce choix est une préférence enregistrée : la pastille revient à
// l'ouverture suivante.

import { useId } from "react"
import { Bot } from "lucide-react"
import { ANCRES } from "@/lib/ancres"

interface IndicateurDeModificationDirecteProps {
  /** Revient aux propositions : les suivantes repassent par la fenêtre de relecture. */
  onCouper: () => void
}

const EXPLICATION = "L'IA modifie directement la simulation, sans proposition à relire ; chaque modification reste annulable (Ctrl+Z). Décochez pour revenir aux propositions."

export function IndicateurDeModificationDirecte({ onCouper }: IndicateurDeModificationDirecteProps) {
  const id = useId()
  const couper = () => {
    onCouper()
    // La pastille disparaît avec sa case : le focus revient au contenu de la page, sans la faire défiler.
    document.getElementById(ANCRES.contenu)?.focus({ preventScroll: true })
  }
  return (
    <>
      <label
        title={EXPLICATION}
        className="ml-1 inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-violet-300 bg-violet-50 px-2 text-xs font-semibold whitespace-nowrap text-violet-900 pointer-coarse:h-11 sm:ml-2 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100"
      >
        <input type="checkbox" checked onChange={couper} aria-describedby={id} className="size-4 shrink-0 cursor-pointer accent-violet-700 pointer-coarse:size-5 dark:accent-violet-300" />
        <Bot aria-hidden="true" className="size-4 shrink-0" />
        IA en direct
      </label>
      {/* Hors de l'étiquette : sinon l'explication entrerait dans le nom de la case. */}
      <span id={id} className="sr-only">
        {EXPLICATION}
      </span>
    </>
  )
}
