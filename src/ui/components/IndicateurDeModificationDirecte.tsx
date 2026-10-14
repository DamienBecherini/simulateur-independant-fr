// src/ui/components/IndicateurDeModificationDirecte.tsx
// Tant que l'utilisateur laisse l'IA modifier directement la simulation (voir l'ADR 011, addendum du 2026-10-14), une
// pastille reste visible en bas de la page, avec la case qui y met fin : les propositions de l'IA repassent alors par
// la fenêtre de relecture. Ce choix est une préférence enregistrée : la pastille revient à l'ouverture suivante.

import { useId } from "react"
import { Bot } from "lucide-react"
import { ANCRES } from "@/lib/ancres"

interface IndicateurDeModificationDirecteProps {
  /** Revient aux propositions : les suivantes repassent par la fenêtre de relecture. */
  onCouper: () => void
}

export function IndicateurDeModificationDirecte({ onCouper }: IndicateurDeModificationDirecteProps) {
  const id = useId()
  const couper = () => {
    onCouper()
    // La pastille disparaît avec sa case : le focus revient au contenu de la page, sans la faire défiler.
    document.getElementById(ANCRES.contenu)?.focus({ preventScroll: true })
  }
  return (
    <section
      aria-label="Modification directe de la simulation par l'IA"
      className="fixed bottom-3 left-3 z-50 max-w-[calc(100vw-1.5rem)] rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm text-violet-950 shadow-md dark:border-violet-700 dark:bg-violet-950 dark:text-violet-50 print:hidden"
    >
      <div className="flex min-h-11 items-center gap-2">
        <Bot aria-hidden="true" className="size-5 shrink-0" />
        <input id={id} type="checkbox" checked onChange={couper} aria-describedby={`${id}-aide`} className="size-5 shrink-0 cursor-pointer accent-violet-700 pointer-coarse:size-6 dark:accent-violet-300" />
        <div>
          <label htmlFor={id} className="cursor-pointer font-semibold">
            L'IA modifie directement la simulation
          </label>
          <p id={`${id}-aide`} className="text-xs">
            Décochez pour revenir aux propositions à relire.
          </p>
        </div>
      </div>
    </section>
  )
}
