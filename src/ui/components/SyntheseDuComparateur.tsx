// src/ui/components/SyntheseDuComparateur.tsx
// Lecture rapide du comparateur de statuts : le verdict en une phrase et, sur téléphone, une carte par statut
// (affichage « Résumé ») ; la mention des frais de fonctionnement supposés (tous les affichages).

import { ChevronRight } from "lucide-react"
import { phraseDuVerdict } from "@/lib/resume"
import { ecartSigne, euros } from "@/backend/logic/format"
import { cn } from "@/lib/utils"
import type { ComparaisonResult, ScenarioStatut } from "@/types"
import { useAffichageResume } from "../hooks/useAffichage"

/** Couleur d'un écart avec le statut actuel : vert s'il est favorable, rouge sinon. */
const couleurDeLEcart = (ecart: number) => (ecart > 0 ? "text-emerald-700 dark:text-emerald-400" : ecart < 0 ? "text-rose-700 dark:text-rose-400" : undefined)

/** Affichage « Résumé » : le verdict en tête du comparateur, cible du lien « Meilleur statut » de la barre de résumé. */
export function VerdictDuComparateur({ result, activite }: { result: ComparaisonResult | null; activite: string | undefined }) {
  const resume = useAffichageResume()
  const phrase = result && activite ? phraseDuVerdict(result, activite) : null
  if (!resume || !phrase) return null
  return (
    <p id="comparateur-verdict" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950 sm:text-base dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50">
      {phrase}
    </p>
  )
}

/**
 * Le net du statut actuel, dans le comparateur, compte les frais de fonctionnement supposés : il diffère du « Net dans
 * la poche » des résultats du foyer, qui ne les connaît pas. La phrase le dit, avec le montant en cause.
 */
export function NoteDesFraisSupposes({ result }: { result: ComparaisonResult }) {
  const actuel = result.scenarios.find(s => s.actuel)
  if (!actuel || actuel.fraisFonctionnement <= 0) return null
  return (
    <p className="text-sm text-slate-600 dark:text-slate-400">
      Les nets du comparateur comptent les frais de fonctionnement supposés de chaque statut. Pour le statut actuel, {actuel.libelle}, ces {euros(actuel.fraisFonctionnement)} de frais ne figurent pas dans les résultats du foyer : son net de {euros(actuel.netApresImpots)} peut donc différer du « Net dans la poche » affiché plus haut. Ces frais se règlent dans le tableau des frais de fonctionnement, plus haut.
    </p>
  )
}

function CarteDeStatut({ scenario, actuel, meilleur }: { scenario: ScenarioStatut; actuel: ScenarioStatut | undefined; meilleur: boolean }) {
  const ecart = actuel && !scenario.actuel ? scenario.netApresImpots - actuel.netApresImpots : null
  const plafond = scenario.regimeMicroFerme ? "plus accessible" : scenario.horsPlafond ? "hors plafond" : null
  const mentions = [scenario.actuel ? "actuel" : null, meilleur ? "meilleur net" : null, plafond].filter(Boolean).join(" · ")
  return (
    <li className={cn("flex items-center justify-between gap-3 rounded-lg border px-3 py-2", meilleur ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-700")}>
      <div className="min-w-0">
        <p className="font-medium text-slate-800 dark:text-slate-100">{scenario.libelle}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {mentions ? `${mentions} · ` : ""}
          <span aria-hidden="true" className="tracking-wider text-amber-600 dark:text-amber-400">
            {"★".repeat(scenario.protectionSociale.etoiles) + "☆".repeat(5 - scenario.protectionSociale.etoiles)}
          </span>
          <span className="sr-only">protection sociale {scenario.protectionSociale.etoiles} sur 5</span>
        </p>
      </div>
      <p className="shrink-0 text-right tabular-nums">
        <span className="block font-semibold">{euros(scenario.netApresImpots)}</span>
        {ecart !== null ? <span className={cn("block text-xs", couleurDeLEcart(ecart))}>{ecartSigne(ecart)}</span> : null}
      </p>
    </li>
  )
}

/** Affiche ou masque les lignes du tableau au-delà du net, de l'écart et de la protection (sur téléphone, tout le tableau). */
export function BoutonDuDetail({ ouvert, onClick }: { ouvert: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-expanded={ouvert} aria-controls="comparateur-lignes-detail" onClick={onClick} className="flex min-h-6 items-center gap-1.5 rounded-md text-sm font-medium text-blue-700 underline-offset-2 hover:underline pointer-coarse:min-h-11 dark:text-blue-400 print:hidden">
      <ChevronRight aria-hidden className={cn("h-4 w-4 transition-transform", ouvert && "rotate-90")} />
      {ouvert ? "Masquer le détail" : "Voir le détail : taux, frais, cotisations, impôts"}
    </button>
  )
}

/** Sur téléphone, une carte par statut, triées par net : le tableau n'a plus à défiler en largeur. */
export function CartesDesStatuts({ result, className }: { result: ComparaisonResult; className?: string }) {
  const actuel = result.scenarios.find(s => s.actuel)
  const tries = [...result.scenarios].sort((a, b) => b.netApresImpots - a.netApresImpots)
  return (
    <ul aria-label="Net dans la poche selon le statut" className={cn("space-y-2", className)}>
      {tries.map(s => (
        <CarteDeStatut key={s.statut} scenario={s} actuel={actuel} meilleur={s.statut === result.meilleur} />
      ))}
    </ul>
  )
}
