// src/ui/components/VersementsRecus.tsx
// Dans la fenêtre d'un mois d'une personne : ce que des sociétés lui versent ce mois-là (rémunération de dirigeant,
// dividendes). Ces montants se saisissent sur la ligne de la société, où ils sont une dépense : ici, ils se lisent
// seulement, hachurés comme dans la grille.

import { useId } from "react"
import { euros } from "@/backend/logic/format"
import { DEFAULT_FLOW_COLORS } from "@/lib/color-constants"
import { fondDuSegment, regrouperLesRecus, type VersementRecu } from "@/lib/grille-mensuelle"

const LIBELLES: Record<VersementRecu["type"], string> = {
  director_remuneration: "Rémunération nette de dirigeant",
  dividends_payment: "Dividendes bruts"
}

export function VersementsRecus({ recus, couleurs }: { recus: VersementRecu[]; couleurs?: Record<string, string> }) {
  const id = useId()
  if (recus.length === 0) return null
  const couleurDe = (type: VersementRecu["type"]) => couleurs?.[type] || DEFAULT_FLOW_COLORS[type] || "#cccccc"
  return (
    <section aria-labelledby={id} className="space-y-1 rounded-md border border-dashed border-slate-300 p-2 text-sm dark:border-slate-600">
      <h3 id={id} className="font-medium">
        Reçu de sociétés ce mois
      </h3>
      <ul className="space-y-0.5">
        {regrouperLesRecus(recus).map(recu => (
          <li key={`${recu.type}-${recu.societeId}`} className="flex flex-wrap items-center justify-between gap-x-3">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-sm" style={fondDuSegment({ amount: recu.amount, color: couleurDe(recu.type), number: 0, recuDe: [recu.societe] })} />
              {LIBELLES[recu.type]} · {recu.societe}
            </span>
            <span className="tabular-nums">{euros(recu.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-600 dark:text-slate-400">Saisis sur la ligne de la société, où ils sont une dépense : c'est là qu'ils se modifient.</p>
    </section>
  )
}
