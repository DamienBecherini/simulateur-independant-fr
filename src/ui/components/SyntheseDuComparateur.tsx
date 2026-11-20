// src/ui/components/SyntheseDuComparateur.tsx
// Lecture rapide du comparateur de statuts : le verdict en une phrase et, sur téléphone, une carte par statut
// (affichage « Résumé ») ; dans tous les affichages, l'invitation à saisir un chiffre d'affaires, la situation saisie
// de référence, l'écart de frais de gestion de chaque colonne, les colonnes non retenues et le rappel des frais réels.

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { ANCRES } from "@/lib/ancres"
import { ecartDeRepartition } from "@/lib/ecart-de-repartition"
import { ecartAvecLaSituationSaisie, phraseDuVerdict, raisonDeNonRetenue } from "@/lib/resume"
import { phraseDeLEcartDeFrais, posteFraisLabels } from "@/lib/comparateur-options"
import { AUCUNE_CHARGE, SANS_CHIFFRE_D_AFFAIRES } from "@/backend/logic/options-du-comparateur"
import { ecartSigne, euros } from "@/backend/logic/format"
import { cn } from "@/lib/utils"
import type { ComparaisonResult, PosteFrais, ScenarioStatut, StatutCompare } from "@/types"
import { useAffichageResume } from "../hooks/useAffichage"
import { Depliable } from "./Depliable"

/** Couleur d'un écart avec le statut actuel : vert s'il est favorable, rouge sinon. */
const couleurDeLEcart = (ecart: number) => (ecart > 0 ? "text-emerald-700 dark:text-emerald-400" : ecart < 0 ? "text-rose-700 dark:text-rose-400" : undefined)

/**
 * En tête du comparateur, cible du lien « Meilleur statut » de la barre de résumé : sans chiffre d'affaires, dans tous
 * les affichages, l'invitation à en saisir un (aucun statut n'est désigné) ; sinon, en affichage « Résumé », le verdict.
 */
export function VerdictDuComparateur({ result, activite }: { result: ComparaisonResult | null; activite: string | undefined }) {
  const resume = useAffichageResume()
  if (result?.sansChiffreDAffaires) {
    return (
      <p id={ANCRES.verdictDuComparateur} role="status" className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 sm:text-base dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100">
        {SANS_CHIFFRE_D_AFFAIRES}
      </p>
    )
  }
  const phrase = result && activite ? phraseDuVerdict(result, activite) : null
  if (!resume || !phrase) return null
  return (
    <p id={ANCRES.verdictDuComparateur} className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950 sm:text-base dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50">
      {phrase}
    </p>
  )
}

/**
 * Sous le tableau : les frais réels sont ceux de la grille, le comparateur n'ajoute aux autres statuts que l'écart de
 * frais de gestion supposés avec le statut actuel. Sans aucune charge saisie pour l'activité, le rappel devient une
 * alerte, à la même place.
 */
export function RappelDesFrais({ result }: { result: ComparaisonResult }) {
  if (result.scenarios.length === 0) return null
  if (result.warnings.includes(AUCUNE_CHARGE)) {
    return (
      <p role="note" className="text-sm text-amber-800 dark:text-amber-200/90">
        {AUCUNE_CHARGE} Cette économie se règle dans « Frais de fonctionnement », plus haut.
      </p>
    )
  }
  return (
    <p className="text-sm text-slate-600 dark:text-slate-400">
      Vos frais réels sont ceux que vous avez saisis dans la grille : pensez à la CFE, à l'assurance, à la banque. Le comparateur n'ajoute aux autres statuts que l'écart de frais de gestion estimé avec votre statut actuel (réglable dans « Frais de fonctionnement », plus haut) ; les frais communs à tous les statuts ne changent pas le classement.
    </p>
  )
}

/**
 * Une société simulée avec un autre partage que la grille n'est plus la situation saisie : son net de référence, celui
 * des résultats, est rappelé au-dessus du tableau. Rien quand une colonne est déjà cette situation.
 */
export function SituationTelleQueSaisie({ result }: { result: ComparaisonResult }) {
  const saisie = result.situationSaisie
  if (!saisie || result.scenarios.length === 0 || result.scenarios.some(s => s.telleQueSaisie)) return null
  return (
    <p className="text-sm text-slate-700 dark:text-slate-200">
      Votre situation telle que saisie ({saisie.libelle}) : <span className="font-semibold tabular-nums">{euros(saisie.netApresImpots)}</span> de net, comme dans les résultats. Les écarts du tableau se mesurent à partir de ce montant.
    </p>
  )
}

/** Sous le net d'une colonne, l'écart de frais de gestion avec le statut actuel, et le détail par poste à déplier. */
export function EcartDeFraisDeLaColonne({ scenario, actuel }: { scenario: ScenarioStatut; actuel: StatutCompare | undefined }) {
  const phrase = actuel ? phraseDeLEcartDeFrais(scenario.ecartDeFrais.total, actuel, scenario.statut) : null
  if (!phrase) return null
  const postes = Object.entries(scenario.ecartDeFrais.postes) as [PosteFrais, number][]
  return (
    <Depliable titre={phrase} className="mt-1 text-left text-xs font-normal text-slate-600 dark:text-slate-400">
      <ul className="mt-1 space-y-0.5">
        {postes.map(([poste, montant]) => (
          <li key={poste}>
            {posteFraisLabels[poste]} : <span className="whitespace-nowrap tabular-nums">{ecartSigne(montant)}</span>
          </li>
        ))}
      </ul>
    </Depliable>
  )
}

/**
 * Sous l'écart de la colonne du statut actuel, quand une société y est simulée avec un autre partage que la grille : ce
 * qui la distingue de la situation saisie (« avec 5 800 € de rémunération nette au lieu de 0 € ») et, à déplier, chaque
 * poste du net du foyer dans l'une et dans l'autre. Sans cela, « +1 200 € » se lit comme un gain de statut.
 */
export function EcartDeRepartitionDeLaColonne({ result, scenario }: { result: ComparaisonResult; scenario: ScenarioStatut }) {
  const ecart = ecartDeRepartition(result, scenario)
  if (!ecart) return null
  const montant = "whitespace-nowrap tabular-nums"
  return (
    <Depliable titre={ecart.resume} className="mt-1 text-left text-xs font-normal text-slate-600 dark:text-slate-400">
      <p className="mt-1">Même statut, autre partage du bénéfice. Ce qui change pour le net du foyer :</p>
      <ul className="mt-1 space-y-0.5">
        {ecart.postes.map(poste => (
          <li key={poste.libelle}>
            {poste.libelle} : <span className={montant}>{euros(poste.colonne)}</span> au lieu de <span className={montant}>{euros(poste.saisie)}</span>, soit <span className={cn(montant, "font-medium", couleurDeLEcart(poste.effet))}>{ecartSigne(poste.effet)}</span>
          </li>
        ))}
        {ecart.autres === undefined ? null : (
          <li>
            Autres écarts (cotisations, arrondis) : <span className={cn(montant, "font-medium", couleurDeLEcart(ecart.autres))}>{ecartSigne(ecart.autres)}</span>
          </li>
        )}
      </ul>
      {ecart.conserve ? (
        <p className="mt-1">
          Bénéfice laissé dans la société : <span className={montant}>{euros(ecart.conserve.colonne)}</span> au lieu de <span className={montant}>{euros(ecart.conserve.saisie)}</span>.
        </p>
      ) : null}
    </Depliable>
  )
}

function CarteDeStatut({ scenario, result, meilleur }: { scenario: ScenarioStatut; result: ComparaisonResult; meilleur: boolean }) {
  const repartition = ecartDeRepartition(result, scenario)
  const ecart = ecartAvecLaSituationSaisie(result, scenario)
  const nonRetenue = raisonDeNonRetenue(scenario)
  const mentions = [scenario.telleQueSaisie ? "actuel" : null, meilleur ? "meilleur net" : null, nonRetenue].filter(Boolean).join(" · ")
  const frais = result.situationSaisie ? phraseDeLEcartDeFrais(scenario.ecartDeFrais.total, result.situationSaisie.statut, scenario.statut) : null
  return (
    <li className={cn("flex items-center justify-between gap-3 rounded-lg border px-3 py-2", meilleur ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-700", nonRetenue && "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400")}>
      <div className="min-w-0">
        <p className="font-medium text-slate-800 dark:text-slate-100">{scenario.libelle}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {mentions ? `${mentions} · ` : ""}
          <span aria-hidden="true" className="tracking-wider text-amber-600 dark:text-amber-400">
            {"★".repeat(scenario.protectionSociale.etoiles) + "☆".repeat(5 - scenario.protectionSociale.etoiles)}
          </span>
          <span className="sr-only">protection sociale {scenario.protectionSociale.etoiles} sur 5</span>
        </p>
        {frais ? <p className="text-xs text-slate-600 dark:text-slate-400">{frais}</p> : null}
        {repartition ? <p className="text-xs text-slate-600 dark:text-slate-400">{repartition.resume}</p> : null}
      </div>
      <p className="shrink-0 text-right tabular-nums">
        <span className="block font-semibold">{euros(scenario.netApresImpots)}</span>
        {ecart !== null ? <span className={cn("block text-xs", !nonRetenue && couleurDeLEcart(ecart))}>{ecartSigne(ecart)}</span> : null}
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
  const tries = [...result.scenarios].sort((a, b) => b.netApresImpots - a.netApresImpots)
  return (
    <ul aria-label="Net dans la poche selon le statut" className={cn("space-y-2", className)}>
      {tries.map(s => (
        <CarteDeStatut key={s.statut} scenario={s} result={result} meilleur={s.statut === result.meilleur} />
      ))}
    </ul>
  )
}

/** Vrai si une case du tableau porte une précision à déplier : écart de frais de gestion, autre partage du bénéfice. */
function aDesPrecisions(result: ComparaisonResult): boolean {
  const actuel = result.situationSaisie?.statut
  return result.scenarios.some(s => (actuel !== undefined && phraseDeLEcartDeFrais(s.ecartDeFrais.total, actuel, s.statut) !== null) || ecartDeRepartition(result, s) !== null)
}

/**
 * Dans le coin du tableau : déplie ou replie d'un geste toutes les précisions de ses cases, au lieu d'un clic par case.
 * Chacune reste une section repliable à part entière, que l'on peut encore ouvrir ou fermer seule.
 */
export function BoutonDesPrecisions({ result }: { result: ComparaisonResult }) {
  const [ouvertes, setOuvertes] = useState(false)
  if (!aDesPrecisions(result)) return null
  const basculer = (bouton: HTMLButtonElement) => {
    for (const precision of bouton.closest("table")?.querySelectorAll("details") ?? []) precision.open = !ouvertes
    setOuvertes(!ouvertes)
  }
  return (
    <button type="button" aria-pressed={ouvertes} className="inline-flex min-h-6 cursor-pointer items-center rounded-sm text-left text-xs font-normal text-blue-700 underline-offset-2 hover:underline pointer-coarse:min-h-11 dark:text-blue-400 print:hidden" onClick={evenement => basculer(evenement.currentTarget)}>
      {ouvertes ? "Masquer tous les détails" : "Afficher tous les détails"}
    </button>
  )
}
