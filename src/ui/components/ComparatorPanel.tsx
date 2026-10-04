// src/ui/components/ComparatorPanel.tsx

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { comparableActivities, defaultComparisonOptions, defaultFraisFonctionnement, posteFraisLabels, statutsFrais } from "@/lib/comparateur-options"
import { cn } from "@/lib/utils"
import { Depliable } from "./Depliable"
import { RemunerationOptimizer } from "./RemunerationOptimizer"
import { ZoneDefilante } from "./ZoneDefilante"
import type { ComparaisonCouple, ComparaisonOptions, ComparaisonResult, Company, FraisFonctionnement, MicroEntreprise, PosteFrais, ScenarioStatut, SessionState, StatutFrais } from "@/types"

interface ComparatorPanelProps {
  session: SessionState
}

/** Sans activité, on compare tout de même les couples en union libre. */
const NO_ACTIVITY: ComparaisonOptions = { activityId: "", remunerationNette: 0, distribuerToutLeBenefice: true, partBncPrestations: 1 }

function formatMoney(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €"
}

function formatSignedMoney(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatMoney(Math.abs(n))}`
}

/** Couleur d'un écart : vert s'il est favorable, rouge sinon. */
function deltaClass(delta: number): string | undefined {
  if (delta > 0) return "text-emerald-700 dark:text-emerald-400"
  if (delta < 0) return "text-rose-700 dark:text-rose-400"
  return undefined
}

function rate(scenario: ScenarioStatut): string {
  if (scenario.revenusAvantPrelevements <= 0) return "—"
  return (scenario.totalPrelevements / scenario.revenusAvantPrelevements).toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 1 })
}

/** Lignes du tableau : libellé et valeur d'une colonne. Seule la dernière porte sur l'activité comparée. */
const rows = (activityName: string): { label: string; value: (s: ScenarioStatut) => string; strong?: boolean }[] => [
  { label: "Net dans la poche", value: s => formatMoney(s.netApresImpots), strong: true },
  { label: "Taux global de prélèvement", value: rate },
  { label: "Frais de fonctionnement", value: s => formatMoney(s.fraisFonctionnement) },
  { label: "Cotisations sociales", value: s => formatMoney(s.cotisationsSociales) },
  { label: "Impôt sur les sociétés", value: s => formatMoney(s.impotSocietes) },
  { label: "Impôt sur le revenu", value: s => formatMoney(s.impotSurLeRevenu) },
  { label: "Prélèvements sociaux", value: s => formatMoney(s.prelevementsSociaux) },
  { label: `Conservé dans « ${activityName} »`, value: s => formatMoney(s.resultatConserveActivite) }
]

/** Étoiles pleines et vides, sur 5. */
function stars(count: number): string {
  return "★".repeat(count) + "☆".repeat(5 - count)
}

const statutFraisLabels: Record<StatutFrais, string> = { SASU: "SASU", EURL: "EURL", EI: "EI au réel", micro: "Micro-entreprise" }

/**
 * Détail des frais de fonctionnement annuels par statut, modifiables : ils sont ajoutés aux charges de l'activité
 * dans chaque colonne du comparateur, y compris celle du statut actuel.
 */
function FraisFonctionnementTable({ frais, onChange }: { frais: FraisFonctionnement; onChange: (frais: FraisFonctionnement) => void }) {
  const postes = Object.keys(posteFraisLabels) as PosteFrais[]
  const total = (statut: StatutFrais) => postes.reduce((somme, poste) => somme + frais[statut][poste], 0)
  const update = (statut: StatutFrais, poste: PosteFrais, value: string) => onChange({ ...frais, [statut]: { ...frais[statut], [poste]: Math.max(0, parseFloat(value) || 0) } })

  return (
    <Depliable titre="Frais de fonctionnement annuels par statut" className="rounded-lg border border-slate-200 p-4 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Ordres de grandeur, à ajuster à votre situation. Ils s'ajoutent aux charges de l'activité dans chaque colonne, statut actuel compris : si vous les avez déjà saisis dans la grille, mettez-les à 0. Déductibles en société et en EI, ils ne réduisent ni cotisations ni impôt en micro. La CFE varie selon la commune et n'est pas due l'année de création.
      </p>
      <div className="relative mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm" aria-label="Frais de fonctionnement annuels">
          <thead>
            <tr>
              <th scope="col" className="py-1 text-left font-medium text-slate-600 dark:text-slate-300">
                Poste
              </th>
              {statutsFrais.map(statut => (
                <th key={statut} scope="col" className="px-2 py-1 text-right font-medium text-slate-600 dark:text-slate-300">
                  {statutFraisLabels[statut]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {postes.map(poste => (
              <tr key={poste} className="border-t border-slate-100 dark:border-slate-800">
                <th scope="row" className="py-1 text-left font-normal text-slate-600 dark:text-slate-300">
                  {posteFraisLabels[poste]}
                </th>
                {statutsFrais.map(statut => (
                  <td key={statut} className="px-2 py-1">
                    <Input className="h-8 w-28 ml-auto bg-background text-right" type="number" min="0" step="50" aria-label={`${posteFraisLabels[poste]}, ${statutFraisLabels[statut]}`} value={frais[statut][poste]} onChange={e => update(statut, poste, e.target.value)} />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-slate-200 font-medium dark:border-slate-700">
              <th scope="row" className="py-1 text-left">
                Total annuel
              </th>
              {statutsFrais.map(statut => (
                <td key={statut} className="px-2 py-1 text-right tabular-nums">
                  {formatMoney(total(statut))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Depliable>
  )
}

interface ControlsProps {
  activities: (Company | MicroEntreprise)[]
  selected: Company | MicroEntreprise
  options: ComparaisonOptions
  onSelect: (activityId: string) => void
  onChange: (changes: Partial<ComparaisonOptions>) => void
}

function ComparatorControls({ activities, selected, options, onSelect, onChange }: ControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="space-y-1">
        <Label htmlFor="comparateur-activite">Activité comparée</Label>
        <Select value={selected.id} onValueChange={onSelect}>
          <SelectTrigger id="comparateur-activite" className="w-64 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {activities.map(activity => (
              <SelectItem key={activity.id} value={activity.id}>
                {activity.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="comparateur-remuneration">Rémunération nette annuelle (SASU, EURL)</Label>
        <Input id="comparateur-remuneration" className="w-40 bg-background text-right" type="number" min="0" step="1000" value={options.remunerationNette} onChange={e => onChange({ remunerationNette: Math.max(0, parseFloat(e.target.value) || 0) })} />
      </div>

      <label className="flex items-center gap-2 pb-2 text-sm pointer-coarse:min-h-11">
        <Switch checked={options.distribuerToutLeBenefice} onCheckedChange={distribuerToutLeBenefice => onChange({ distribuerToutLeBenefice })} />
        Verser tout le bénéfice disponible en dividendes
      </label>

      {selected.type !== "micro-entreprise" && (
        <div className="space-y-1">
          <Label htmlFor="comparateur-bnc">En micro, prestations en BNC : {Math.round(options.partBncPrestations * 100)} % (le reste en BIC)</Label>
          <input id="comparateur-bnc" className="block w-56 accent-slate-700" type="range" min="0" max="100" step="10" value={Math.round(options.partBncPrestations * 100)} onChange={e => onChange({ partBncPrestations: Number(e.target.value) / 100 })} />
        </div>
      )}
    </div>
  )
}

function ComparisonTable({ result, activityName }: { result: ComparaisonResult; activityName: string }) {
  if (result.scenarios.length === 0) return null
  const current = result.scenarios.find(s => s.actuel)
  const best = (s: ScenarioStatut) => s.statut === result.meilleur

  return (
    <ZoneDefilante libelle="Tableau de comparaison" className="rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full min-w-[48rem] text-sm" aria-label="Comparaison des statuts">
        <thead className="bg-slate-100 dark:bg-slate-800/80">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">
              <span className="sr-only">Indicateur</span>
            </th>
            {result.scenarios.map(s => (
              <th key={s.statut} scope="col" className={cn("px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-200", best(s) && "bg-emerald-100 dark:bg-emerald-900/40")}>
                {s.libelle}
                <span className="block text-xs font-normal text-slate-600 dark:text-slate-400">{[s.actuel ? "actuel" : null, best(s) ? "meilleur net" : null].filter(Boolean).join(" · ") || " "}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows(activityName).map(row => (
            <tr key={row.label} className="border-t border-slate-200 dark:border-slate-700">
              <th scope="row" className="px-3 py-2 text-left font-normal text-slate-600 dark:text-slate-300">
                {row.label}
              </th>
              {result.scenarios.map(s => (
                <td key={s.statut} className={cn("px-3 py-2 text-right tabular-nums", row.strong && "font-semibold", best(s) && "bg-emerald-50 dark:bg-emerald-950/30")}>
                  {row.value(s)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-slate-200 dark:border-slate-700">
            <th scope="row" className="px-3 py-2 text-left font-normal text-slate-600 dark:text-slate-300">
              Protection sociale
            </th>
            {result.scenarios.map(s => (
              <td key={s.statut} className={cn("px-3 py-2 text-right", best(s) && "bg-emerald-50 dark:bg-emerald-950/30")} title={s.protectionSociale.resume}>
                <span aria-hidden="true" className="tracking-wider text-amber-500">
                  {stars(s.protectionSociale.etoiles)}
                </span>
                <span className="sr-only">{s.protectionSociale.etoiles} sur 5</span>
                <span className="block text-xs text-slate-600 dark:text-slate-400">{s.protectionSociale.trimestres} trim. retraite</span>
              </td>
            ))}
          </tr>
          {current ? (
            <tr className="border-t border-slate-200 dark:border-slate-700">
              <th scope="row" className="px-3 py-2 text-left font-normal text-slate-600 dark:text-slate-300">
                Écart avec le statut actuel
              </th>
              {result.scenarios.map(s => (
                <td key={s.statut} className={cn("px-3 py-2 text-right tabular-nums", deltaClass(s.netApresImpots - current.netApresImpots), best(s) && "bg-emerald-50 dark:bg-emerald-950/30")}>
                  {s.actuel ? "—" : formatSignedMoney(s.netApresImpots - current.netApresImpots)}
                </td>
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
    </ZoneDefilante>
  )
}

function WarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null
  return (
    <ul className="list-inside list-disc text-sm text-amber-800 dark:text-amber-200/90">
      {warnings.map((warning, i) => (
        <li key={i}>{warning}</li>
      ))}
    </ul>
  )
}

/** Ce que recouvre chaque note de protection sociale. */
function ProtectionDetails({ scenarios }: { scenarios: ScenarioStatut[] }) {
  if (scenarios.length === 0) return null
  return (
    <Depliable titre="Ce que recouvre la note de protection sociale" className="text-sm text-slate-600 dark:text-slate-300">
      <ul className="mt-2 space-y-1">
        {scenarios.map(s => (
          <li key={s.statut}>
            <span className="font-medium">
              {s.libelle} ({s.protectionSociale.etoiles}/5) :
            </span>{" "}
            {s.protectionSociale.resume}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-slate-600 dark:text-slate-400">Note indicative : la cinquième étoile correspond au salarié classique, seul à cotiser à l'assurance chômage.</p>
    </Depliable>
  )
}

function ScenarioWarnings({ scenarios, activityName }: { scenarios: ScenarioStatut[]; activityName: string }) {
  const withWarnings = scenarios.filter(s => s.warnings.length > 0)
  if (withWarnings.length === 0) return null
  return (
    <div className="space-y-1 text-sm text-amber-800 dark:text-amber-200/90">
      {withWarnings.map(s => (
        <p key={s.statut}>
          <span className="font-medium">
            « {activityName} » en {s.libelle} :
          </span>{" "}
          {s.warnings.join(" ")}
        </p>
      ))}
    </div>
  )
}

function CoupleComparison({ couples, personName }: { couples: ComparaisonCouple[]; personName: (id: string) => string }) {
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100">Et si vous étiez mariés ou pacsés ?</h3>
      {couples.map(couple => {
        const delta = couple.netApresImpotsMaries - couple.netApresImpotsActuel
        return (
          <p key={couple.personIds.join("-")} className="text-sm text-slate-600 dark:text-slate-300">
            {couple.personIds.map(personName).join(" et ")} : impôt sur le revenu de {formatMoney(couple.impotSurLeRevenuActuel)} en union libre, {formatMoney(couple.impotSurLeRevenuMaries)} avec une imposition commune, soit <span className={cn("font-semibold", deltaClass(delta))}>{formatSignedMoney(delta)}</span> sur le net après impôts.
          </p>
        )
      })}
    </div>
  )
}

function ComparisonResults({ result, activityName }: { result: ComparaisonResult; activityName: string }) {
  return (
    <>
      <ComparisonTable result={result} activityName={activityName} />
      <ProtectionDetails scenarios={result.scenarios} />
      <ScenarioWarnings scenarios={result.scenarios} activityName={activityName} />
    </>
  )
}

/** Recalcule la comparaison peu après chaque modification de la session ou des réglages. */
function useComparison(session: SessionState, options: ComparaisonOptions) {
  const [result, setResult] = useState<ComparaisonResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const comparison = await window.api.compareStatuts(session, options)
        if (cancelled) return
        setResult(comparison)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "La comparaison a échoué.")
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [session, options])

  return { result, error }
}

/** Arbitrage rémunération / dividendes de l'activité comparée, en SASU ou en EURL (son statut s'il en est un). */
function OptimiseurDeLActivite({ session, selected, options, onChange }: { session: SessionState; selected: Company | MicroEntreprise | undefined; options: ComparaisonOptions; onChange: (options: ComparaisonOptions) => void }) {
  if (!selected) return null
  return (
    <RemunerationOptimizer
      key={selected.id}
      session={session}
      options={options}
      activityName={selected.name}
      statutInitial={selected.type === "company" && selected.legalStatus === "EURL" ? "EURL" : "SASU"}
      onAppliquer={remunerationNette => onChange({ ...options, remunerationNette, distribuerToutLeBenefice: true })}
    />
  )
}

/**
 * Comparateur de statuts : l'activité choisie est simulée en SASU, EURL, EI au réel et micro-entreprise
 * (avec et sans versement libératoire), le reste de la simulation restant identique. Les couples en union
 * libre sont aussi comparés avec une imposition commune.
 */
export function ComparatorPanel({ session }: ComparatorPanelProps) {
  const activities = comparableActivities(session)
  const [options, setOptions] = useState<ComparaisonOptions | null>(null)

  // L'activité comparée par défaut est la première ; si elle disparaît, on repart sur la première restante.
  const selected = activities.find(a => a.id === options?.activityId) ?? activities[0]
  const effectiveOptions = useMemo(() => {
    if (!selected) return NO_ACTIVITY
    return options?.activityId === selected.id ? options : defaultComparisonOptions(session, selected.id)
  }, [options, selected, session])

  const { result, error } = useComparison(session, effectiveOptions)
  const couples = result?.couples ?? []
  if (!selected && couples.length === 0) return null

  const personName = (id: string) => session.entities.find(e => e.id === id)?.name ?? id

  return (
    <section className="mt-12 space-y-4" aria-labelledby="comparateur-titre">
      <div>
        <h2 id="comparateur-titre" className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
          Comparateur de statuts
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">L'activité choisie est simulée dans chaque statut ; le reste de la simulation ne change pas. Les montants portent sur toute la simulation, sauf la dernière ligne, propre à l'activité comparée.</p>
      </div>

      {selected ? (
        <>
          <ComparatorControls activities={activities} selected={selected} options={effectiveOptions} onSelect={activityId => setOptions({ ...defaultComparisonOptions(session, activityId), fraisFonctionnement: effectiveOptions.fraisFonctionnement })} onChange={changes => setOptions({ ...effectiveOptions, ...changes })} />
          <FraisFonctionnementTable frais={effectiveOptions.fraisFonctionnement ?? defaultFraisFonctionnement()} onChange={fraisFonctionnement => setOptions({ ...effectiveOptions, fraisFonctionnement })} />
          <WarningList warnings={result?.warnings ?? []} />
        </>
      ) : null}

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p> : null}

      {result ? <ComparisonResults result={result} activityName={selected?.name ?? ""} /> : null}
      <OptimiseurDeLActivite session={session} selected={selected} options={effectiveOptions} onChange={setOptions} />
      {couples.length > 0 ? <CoupleComparison couples={couples} personName={personName} /> : null}
    </section>
  )
}
