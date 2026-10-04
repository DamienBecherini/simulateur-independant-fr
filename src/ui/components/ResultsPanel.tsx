// src/ui/components/ResultsPanel.tsx

import type { ActivityResult, FoyerFiscalResult, PersonResult, SimulationReport } from "@/types"
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

function FoyerCard({ foyer, persons }: { foyer: FoyerFiscalResult; persons: PersonResult[] }) {
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

      {report && report.foyers.length > 0 ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/50">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Net après impôts, tous foyers confondus</p>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{formatMoney(report.totalNetApresImpots)}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ce qu'il reste aux personnes sur l'année, une fois payés les cotisations, l'impôt sur les sociétés, l'impôt sur le revenu et les prélèvements sociaux.</p>
          </div>
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100">Par foyer fiscal</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {report.foyers.map(foyer => (
              <FoyerCard key={foyer.personIds.join("-")} foyer={foyer} persons={report.persons} />
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
