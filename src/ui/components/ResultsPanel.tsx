// src/ui/components/ResultsPanel.tsx

import type { ActivityResult, FoyerFiscalResult, PersonResult, SimulationReport } from "@/types"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

type ResultsPanelProps = {
  report: SimulationReport | null
  error: string | null
}

function formatMoney(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €"
}

/** Part de ce que l'activité verse aux personnes par rapport à son chiffre d'affaires (ex. « 62 % du CA »). */
function shareOfRevenue(activity: ActivityResult): string | null {
  if (activity.chiffreAffaires <= 0) return null
  const share = activity.revenuVerse / activity.chiffreAffaires
  return `${share.toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 0 })} du CA`
}

/** Les destinations de l'argent, dans l'ordre de la barre de répartition. */
const bilanShares = [
  { key: "net", label: "Net dans la poche", color: "bg-emerald-500" },
  { key: "conserve", label: "Conservé dans les sociétés", color: "bg-sky-500" },
  { key: "prelevements", label: "Prélèvements", color: "bg-rose-500" },
  { key: "nonRattache", label: "Non rattaché à une personne", color: "bg-slate-400" }
] as const

/**
 * Bilan de la simulation : part des revenus qui part en cotisations et impôts, part conservée
 * dans les sociétés, part qui reste dans la poche. C'est le repère à comparer d'un scénario à l'autre.
 */
function BilanCard({ report }: { report: SimulationReport }) {
  const { bilan } = report
  const base = bilan.revenusAvantPrelevements
  const percent = (amount: number) => (base > 0 ? (amount / base).toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 1 }) : null)
  const amounts = { net: report.totalNetApresImpots, conserve: bilan.resultatConserve, prelevements: bilan.totalPrelevements, nonRattache: bilan.nonRattache }
  const origin = [`chiffre d'affaires ${formatMoney(bilan.chiffreAffaires)}`, bilan.charges > 0 ? `charges ${formatMoney(bilan.charges)}` : null, bilan.revenusDirects > 0 ? `salaires et autres revenus ${formatMoney(bilan.revenusDirects + bilan.cotisationsSalariales)}` : null].filter(Boolean).join(" · ")

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Net dans la poche</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {formatMoney(amounts.net)}
            {percent(amounts.net) ? <span className="ml-2 text-base font-semibold text-emerald-700 dark:text-emerald-400">{percent(amounts.net)} des revenus</span> : null}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Taux global de prélèvement</p>
          <p className="text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-400">{percent(amounts.prelevements) ?? "—"}</p>
        </div>
      </div>

      {base > 0 ? (
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="img" aria-label="Répartition des revenus avant prélèvements">
          {bilanShares.map(share => (amounts[share.key] > 0 ? <div key={share.key} className={share.color} style={{ width: `${(amounts[share.key] / base) * 100}%` }} title={`${share.label} : ${percent(amounts[share.key])}`} /> : null))}
        </div>
      ) : null}

      <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
        <div className="space-y-1">
          <Row label="Revenus avant prélèvements" value={formatMoney(base)} hint={origin} />
          <Row label="Cotisations sociales des activités" value={`− ${formatMoney(bilan.cotisationsSociales)}`} />
          {bilan.cotisationsSalariales > 0 ? <Row label="Cotisations salariales" value={`− ${formatMoney(bilan.cotisationsSalariales)}`} /> : null}
          {bilan.impotSocietes > 0 ? <Row label="Impôt sur les sociétés" value={`− ${formatMoney(bilan.impotSocietes)}`} /> : null}
          <Row label="Impôt sur le revenu" value={`− ${formatMoney(bilan.impotSurLeRevenu)}`} />
          {bilan.prelevementsSociaux > 0 ? <Row label="Prélèvements sociaux sur dividendes" value={`− ${formatMoney(bilan.prelevementsSociaux)}`} /> : null}
        </div>
        <div className="space-y-1">
          {bilanShares.map(share =>
            amounts[share.key] !== 0 || share.key === "net" || share.key === "prelevements" ? (
              <div key={share.key} className="flex items-start gap-2">
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", share.color)} />
                <div className="flex-grow">
                  <Row label={share.key === "conserve" && amounts.conserve < 0 ? "Déficit des sociétés" : share.label} value={formatMoney(amounts[share.key])} hint={percent(amounts[share.key])} strong={share.key === "net"} />
                </div>
              </div>
            ) : null
          )}
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Les revenus avant prélèvements sont le chiffre d'affaires moins les charges, plus les salaires et autres revenus saisis sur les personnes. Les cotisations d'un salaire ne sont comptées que si son brut est saisi, et seulement pour leur part salariale.</p>
      {bilan.resultatConserve > 0 ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Le bénéfice conservé dans une société a payé l'impôt sur les sociétés, mais pas encore l'impôt personnel : il sera imposé le jour où il sera versé (dividendes, vente ou liquidation). Le taux de prélèvement affiché est donc provisoire pour cette part, et un scénario qui conserve davantage paraît moins taxé sans que cet argent soit disponible.
        </p>
      ) : null}
    </div>
  )
}

const dividendOptionLabels: Record<NonNullable<FoyerFiscalResult["optionDividendes"]>, string> = {
  pfu: "Dividendes imposés au prélèvement forfaitaire, plus favorable ici que le barème.",
  bareme: "Dividendes imposés au barème après abattement, plus favorable ici que le prélèvement forfaitaire."
}

/** Une ligne « libellé — montant » d'une carte de résultats. */
function Row({ label, value, hint, strong = false }: { label: string; value: string; hint?: string | null; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className={strong ? "font-medium text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}>{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? "font-semibold text-emerald-700 dark:text-emerald-400" : "font-medium"}`}>
        {value}
        {hint ? <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{hint}</span> : null}
      </dd>
    </div>
  )
}

function Card({ title, subtitle, warnings, children }: { title: string; subtitle: string; warnings: string[]; children: ReactNode }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <header className="mb-2 border-b border-slate-100 pb-2 dark:border-slate-800">
        <p className="font-semibold text-slate-900 dark:text-slate-50">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </header>
      {children}
      {warnings.length > 0 ? (
        <ul className="mt-3 list-inside list-disc text-xs text-amber-800 dark:text-amber-200/90">
          {warnings.map((warning, i) => (
            <li key={i}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

const incomeLabels: Record<keyof PersonResult["detail"], string> = {
  salaires: "Salaires",
  allocationsChomage: "Allocations chômage",
  autresRevenus: "Autres revenus",
  remunerationsDirigeant: "Rémunération de dirigeant",
  dividendes: "Dividendes",
  benefices: "Bénéfices d'activité"
}

/** Revenus d'un membre du foyer, ventilés par nature ; seules les lignes non nulles sont affichées. */
function PersonIncome({ person, showName }: { person: PersonResult; showName: boolean }) {
  const lines = (Object.keys(incomeLabels) as (keyof PersonResult["detail"])[]).filter(key => person.detail[key] !== 0)
  if (lines.length === 0) return showName ? <p className="text-sm text-slate-500 dark:text-slate-400">{person.name} : aucun revenu</p> : null

  return (
    <div>
      {showName ? <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{person.name}</p> : null}
      <dl className="space-y-1 text-sm">
        {lines.map(key => (
          <Row key={key} label={incomeLabels[key]} value={formatMoney(person.detail[key])} />
        ))}
      </dl>
    </div>
  )
}

/** Taux de prélèvement et part nette d'un foyer : affichés quand la simulation compte plusieurs foyers. */
function FoyerRates({ foyer }: { foyer: FoyerFiscalResult }) {
  const base = foyer.revenusAvantPrelevements
  if (base <= 0) return null
  const percent = (amount: number) => (amount / base).toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 1 })

  return (
    <dl className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-sm dark:border-slate-800">
      <Row label="Revenus avant prélèvements" value={formatMoney(base)} />
      <Row label="Prélèvements du foyer" value={formatMoney(foyer.totalPrelevements)} hint={percent(foyer.totalPrelevements)} />
      {foyer.resultatConserve !== 0 ? <Row label="Sa part conservée en société" value={formatMoney(foyer.resultatConserve)} hint={percent(foyer.resultatConserve)} /> : null}
      <Row label="Net dans la poche" value={formatMoney(foyer.netApresImpots)} hint={percent(foyer.netApresImpots)} strong />
    </dl>
  )
}

function FoyerCard({ foyer, persons, showRates }: { foyer: FoyerFiscalResult; persons: PersonResult[]; showRates: boolean }) {
  const members = foyer.personIds.map(id => persons.find(p => p.entityId === id)).filter((p): p is PersonResult => p !== undefined)
  const parts = foyer.totalParts.toLocaleString("fr-FR")

  return (
    <Card title={members.map(p => p.name).join(", ")} subtitle={`Foyer fiscal · ${parts} ${foyer.totalParts > 1 ? "parts" : "part"}`} warnings={foyer.warnings}>
      <div className="mb-2 space-y-2 border-b border-slate-100 pb-2 empty:hidden dark:border-slate-800">
        {members.map(person => (
          <PersonIncome key={person.entityId} person={person} showName={members.length > 1} />
        ))}
      </div>
      <dl className="space-y-1 text-sm">
        <Row label="Total encaissé" value={formatMoney(foyer.revenusEncaisses)} />
        <Row label="Impôt sur le revenu" value={`− ${formatMoney(foyer.impotSurLeRevenu)}`} hint={`sur ${formatMoney(foyer.revenuImposableGlobal)} imposables au barème`} />
        {foyer.prelevementsSociaux > 0 ? <Row label="Prélèvements sociaux sur dividendes" value={`− ${formatMoney(foyer.prelevementsSociaux)}`} /> : null}
        <Row label="Net après impôts" value={formatMoney(foyer.netApresImpots)} strong />
        {foyer.depenses > 0 ? <Row label="Reste après dépenses saisies" value={formatMoney(foyer.netApresImpots - foyer.depenses)} hint={`${formatMoney(foyer.depenses)} de dépenses`} /> : null}
      </dl>
      {showRates ? <FoyerRates foyer={foyer} /> : null}
      {foyer.optionDividendes ? <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{dividendOptionLabels[foyer.optionDividendes]}</p> : null}
    </Card>
  )
}

function ActivityCard({ activity }: { activity: ActivityResult }) {
  const isMicro = activity.type === "micro-entreprise"

  return (
    <Card title={activity.name} subtitle={activity.statut} warnings={activity.warnings}>
      <dl className="space-y-1 text-sm">
        <Row label="Chiffre d'affaires" value={formatMoney(activity.chiffreAffaires)} />
        {activity.charges > 0 ? <Row label={isMicro ? "Dépenses (non déductibles)" : "Charges déductibles"} value={`− ${formatMoney(activity.charges)}`} /> : null}
        <Row label="Cotisations sociales" value={`− ${formatMoney(activity.cotisationsSociales)}`} />
        {activity.impotSocietes > 0 ? <Row label="Impôt sur les sociétés" value={`− ${formatMoney(activity.impotSocietes)}`} /> : null}
        {activity.resultatConserve !== 0 ? <Row label={activity.resultatConserve > 0 ? "Conservé dans la société" : "Déficit de la société"} value={formatMoney(activity.resultatConserve)} /> : null}
        <Row label="Versé avant impôt sur le revenu" value={formatMoney(activity.revenuVerse)} hint={shareOfRevenue(activity)} strong />
      </dl>
    </Card>
  )
}

export function ResultsPanel({ report, error }: ResultsPanelProps) {
  // Sociétés dont les revenus se partagent entre plusieurs personnes : seule situation où la répartition à parts égales s'applique.
  const sharedCompanies = report?.activities.filter(a => a.type === "company" && a.beneficiaireIds.length > 1) ?? []

  return (
    <section className="mt-12 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Résultats de simulation</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Recalculés à chaque modification{report ? `, avec les règles fiscales ${report.annee}` : ""}. Estimations simplifiées, non validées par un expert-comptable.
        </p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p> : null}

      {report && report.foyers.length + report.activities.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Ajoutez une personne ou une activité pour voir les résultats.</p> : null}

      {report && report.foyers.length + report.activities.length > 0 ? <BilanCard report={report} /> : null}

      {report && report.foyers.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100">Par foyer fiscal</h3>
          {sharedCompanies.length > 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {sharedCompanies.map(a => `« ${a.name} »`).join(", ")} : l'impôt sur les sociétés et le bénéfice conservé sont partagés à parts égales entre les associés, comme les dividendes. La répartition réelle du capital n'est pas encore modélisée.
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {report.foyers.map(foyer => (
              <FoyerCard key={foyer.personIds.join("-")} foyer={foyer} persons={report.persons} showRates={report.foyers.length > 1} />
            ))}
          </div>
        </div>
      ) : null}

      {report && report.activities.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100">Par activité</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {report.activities.map(activity => (
              <ActivityCard key={activity.entityId} activity={activity} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
