// src/ui/components/ReglagesDuComparateur.tsx
// Réglages du comparateur de statuts, visibles dans tous les affichages : l'activité comparée et le partage du
// bénéfice des sociétés sur une ligne, la phrase du mode choisi, puis selon le mode la case des 4 trimestres de
// retraite ou la rémunération saisie (champ et curseur). Les frais de fonctionnement, et la part BNC quand elle
// sert, sont repliés sous une seule section.

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { avecLeMode, avecRemunerationSaisie, defaultFraisFonctionnement, descriptionDuMode, libellesCourtsRepartition, posteFraisLabels, statutsFrais } from "@/lib/comparateur-options"
import { coutsDesQuatreTrimestres, ecartSigne } from "@/lib/resume"
import { cn } from "@/lib/utils"
import type { ComparaisonOptions, ComparaisonResult, Company, FraisFonctionnement, MicroEntreprise, ModeRepartition, PosteFrais, StatutFrais, StatutSociete } from "@/types"
import { CurseurDeRemuneration } from "./Curseur"
import { Depliable } from "./Depliable"
import { useSectionOuverte } from "../hooks/useSectionOuverte"

function formatMoney(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €"
}

const statutFraisLabels: Record<StatutFrais, string> = { SASU: "SASU", EURL: "EURL", EI: "EI au réel", micro: "Micro-entreprise" }

const MODES = Object.keys(libellesCourtsRepartition) as ModeRepartition[]

/**
 * Choix du partage du bénéfice des colonnes SASU et EURL : des boutons radio aux libellés courts, présentés comme un
 * sélecteur segmenté qui passe à la ligne sur téléphone. La phrase de chaque mode le décrit (aria-describedby) et
 * s'affiche au survol ; celle du mode choisi est écrite sous les boutons.
 */
export function ChoixDeLaRepartition({ mode, avecRetraite, onChange }: { mode: ModeRepartition; avecRetraite: boolean; onChange: (mode: ModeRepartition) => void }) {
  return (
    <fieldset className="min-w-0 max-w-full space-y-1">
      <legend className="mb-1 text-sm font-medium leading-none">Bénéfice de la société (SASU, EURL)</legend>
      <div className="flex w-fit max-w-full flex-wrap gap-0.5 rounded-md border border-slate-300 bg-background p-0.5 dark:border-slate-600">
        {MODES.map(m => (
          <label key={m} title={descriptionDuMode(m, avecRetraite)} className={cn("flex min-h-8 flex-auto cursor-pointer items-center justify-center whitespace-nowrap rounded px-2 py-1 text-xs font-medium leading-tight sm:px-3 sm:text-sm pointer-coarse:min-h-11 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)]", m === mode ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 print:hidden")}>
            <input type="radio" name="comparateur-repartition" value={m} checked={m === mode} aria-describedby={`comparateur-mode-${m}`} onChange={() => onChange(m)} className="sr-only" />
            {libellesCourtsRepartition[m]}
          </label>
        ))}
      </div>
      {MODES.map(m => (
        <span key={m} id={`comparateur-mode-${m}`} hidden>
          {descriptionDuMode(m, avecRetraite)}
        </span>
      ))}
    </fieldset>
  )
}

/**
 * Au meilleur net : ne retenir, dans chaque statut de société, que les rémunérations qui valident 4 trimestres de
 * retraite. Cochée d'office ; ce que coûtent les 4 trimestres en net, colonne par colonne, est dit à côté.
 */
function AvecRetraite({ options, couts, onChange }: { options: ComparaisonOptions; couts: { libelle: string; cout: number }[]; onChange: (changes: Partial<ComparaisonOptions>) => void }) {
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-0.5 pointer-coarse:min-h-11">
      <label className="flex min-h-9 items-center gap-2 text-sm font-medium pointer-coarse:min-h-11">
        <input type="checkbox" className="size-4 accent-slate-700 dark:accent-slate-300" aria-describedby={couts.length > 0 ? "comparateur-cout-retraite" : undefined} checked={options.repartition.avecRetraite === true} onChange={e => onChange({ repartition: { ...options.repartition, avecRetraite: e.target.checked } })} />
        Avec 4 trimestres de retraite
      </label>
      {couts.length > 0 ? (
        <span id="comparateur-cout-retraite" className="text-xs text-slate-600 dark:text-slate-400">
          coût en net : {couts.map(c => `${c.libelle} ${ecartSigne(-c.cout)}`).join(", ")}
        </span>
      ) : null}
    </div>
  )
}

interface RemunerationSaisieProps {
  remunerationNette: number
  /** Statut étudié dans « Rémunération ou dividendes ? », dont la rémunération maximale borne le curseur. */
  statut: StatutSociete
  /** Plus haute rémunération possible sans déficit dans ce statut ; `null` tant qu'elle n'est pas calculée. */
  plafond: number | null
  onChange: (remunerationNette: number) => void
}

/**
 * Rémunération saisie (SASU, EURL) : un champ, et à côté un curseur de 0 à la plus haute rémunération que la société
 * peut verser sans déficit. Les deux se suivent ; une rémunération saisie au-delà reste acceptée (le comparateur
 * signale alors le déficit), la poignée restant en bout de piste. Sans bénéfice, pas de curseur.
 */
function RemunerationSaisie({ remunerationNette, statut, plafond, onChange }: RemunerationSaisieProps) {
  // Pendant un glissement, le champ montre la valeur de la poignée ; le comparateur ne recalcule qu'au relâchement.
  const [apercu, setApercu] = useState<number | null>(null)
  const note = plafond === null ? undefined : "comparateur-remuneration-plafond"
  const classeDeLaNote = "text-xs text-slate-600 dark:text-slate-400"
  return (
    <div className="space-y-1">
      <Label htmlFor="comparateur-remuneration">Rémunération nette annuelle (SASU, EURL)</Label>
      {/* Le champ, et le curseur avec son plafond dessous ; sur téléphone, le curseur passe sous le champ. */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <Input id="comparateur-remuneration" className="mt-1 w-40 bg-background text-right" type="number" min="0" step="1000" aria-describedby={note} value={apercu ?? remunerationNette} onChange={e => onChange(Math.max(0, parseFloat(e.target.value) || 0))} />
        {plafond !== null && plafond > 0 ? (
          <div className="w-full max-w-xs sm:w-72">
            <CurseurDeRemuneration valeur={remunerationNette} max={plafond} libelle="Régler la rémunération nette annuelle" decritPar={note} onApercu={setApercu} onValider={onChange} />
            <p id={note} className={cn(classeDeLaNote, "-mt-1")}>
              jusqu'à {formatMoney(plafond)} en {statut} sans déficit
            </p>
          </div>
        ) : null}
      </div>
      {plafond === 0 ? (
        <p id={note} className={classeDeLaNote}>
          En {statut}, l'activité ne dégage pas de bénéfice : aucune rémunération possible sans déficit.
        </p>
      ) : null}
    </div>
  )
}

/**
 * Détail des frais de fonctionnement annuels par statut, modifiables : ils sont ajoutés aux charges de l'activité
 * dans chaque colonne du comparateur, y compris celle du statut actuel.
 */
function FraisFonctionnementTable({ frais, onChange }: { frais: FraisFonctionnement; onChange: (frais: FraisFonctionnement) => void }) {
  const postes = Object.keys(posteFraisLabels) as PosteFrais[]
  const total = (statut: StatutFrais) => postes.reduce((somme, poste) => somme + frais[statut][poste], 0)
  const update = (statut: StatutFrais, poste: PosteFrais, value: string) => onChange({ ...frais, [statut]: { ...frais[statut], [poste]: Math.max(0, parseFloat(value) || 0) } })

  return (
    <div className="text-slate-700 dark:text-slate-200">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Frais annuels par statut : des ordres de grandeur, à ajuster à votre situation. Ils s'ajoutent aux charges de l'activité dans chaque colonne, statut actuel compris : si vous les avez déjà saisis dans la grille, mettez-les à 0. Déductibles en société et en EI, ils ne réduisent ni cotisations ni impôt en micro. La CFE varie selon la commune et n'est pas due l'année de création.
      </p>
      <div className="relative mt-3 overflow-x-auto print:overflow-visible">
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
    </div>
  )
}

/**
 * Frais de fonctionnement et, quand elle sert, part BNC : une seule section repliée, dans tous les affichages. Son
 * état est retenu sous l'identifiant de l'ancienne section « Plus de réglages » ; tant qu'il ne l'est pas, elle
 * reprend celui de l'ancien tableau des frais, qui était replié à l'intérieur.
 */
function FraisEtPartBnc({ options, bncUtile, onChange }: { options: ComparaisonOptions; bncUtile: boolean; onChange: (changes: Partial<ComparaisonOptions>) => void }) {
  const [ancienTableauOuvert] = useSectionOuverte("comparateur-frais")
  return (
    <Depliable titre={bncUtile ? "Frais de fonctionnement et part BNC" : "Frais de fonctionnement"} id="comparateur-plus-de-reglages" ouverteParDefaut={ancienTableauOuvert} className="text-sm">
      <div className="mt-3 space-y-3">
        {bncUtile ? (
          <div className="space-y-1">
            <Label htmlFor="comparateur-bnc">En micro, prestations en BNC : {Math.round(options.partBncPrestations * 100)} % (le reste en BIC)</Label>
            <input id="comparateur-bnc" className="block w-56 max-w-full accent-slate-700 print:hidden" type="range" min="0" max="100" step="10" value={Math.round(options.partBncPrestations * 100)} onChange={e => onChange({ partBncPrestations: Number(e.target.value) / 100 })} />
          </div>
        ) : null}
        <FraisFonctionnementTable frais={options.fraisFonctionnement ?? defaultFraisFonctionnement()} onChange={fraisFonctionnement => onChange({ fraisFonctionnement })} />
      </div>
    </Depliable>
  )
}

export interface ReglagesDuComparateurProps {
  activities: (Company | MicroEntreprise)[]
  selected: Company | MicroEntreprise
  options: ComparaisonOptions
  /** Comparaison en cours : au meilleur net, elle dit ce que coûtent les 4 trimestres de retraite dans chaque colonne. */
  result: ComparaisonResult | null
  /** Statut de société étudié, et la plus haute rémunération qu'il permet sans déficit (`null` en attendant). */
  statut: StatutSociete
  plafond: number | null
  /** La part BNC sert-elle pour l'activité comparée ? */
  bncUtile: boolean
  onSelect: (activityId: string) => void
  onChange: (changes: Partial<ComparaisonOptions>) => void
}

/**
 * Réglages essentiels de la comparaison, visibles dans tous les affichages : l'activité et le partage du bénéfice
 * sur une ligne (qui passe à la ligne au besoin), la phrase du mode choisi, puis la case des 4 trimestres (au
 * meilleur net) ou la rémunération saisie. Frais de fonctionnement et part BNC sont repliés en une seule section.
 */
export function ReglagesDuComparateur({ activities, selected, options, result, statut, plafond, bncUtile, onSelect, onChange }: ReglagesDuComparateurProps) {
  const { mode } = options.repartition
  const avecRetraite = options.repartition.avecRetraite === true
  return (
    <div data-impression="bloc" className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:p-4 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-full space-y-1">
            <Label htmlFor="comparateur-activite">Activité comparée</Label>
            <Select value={selected.id} onValueChange={onSelect}>
              <SelectTrigger id="comparateur-activite" className="w-64 max-w-full bg-background">
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
          <ChoixDeLaRepartition mode={mode} avecRetraite={avecRetraite} onChange={nouveau => onChange({ repartition: avecLeMode(options.repartition, nouveau) })} />
        </div>
        <p id="comparateur-mode-choisi" className="text-sm text-slate-600 dark:text-slate-400">
          {descriptionDuMode(mode, avecRetraite)}
        </p>
      </div>

      {mode === "meilleurNet" ? <AvecRetraite options={options} couts={coutsDesQuatreTrimestres(result?.scenarios ?? [])} onChange={onChange} /> : null}
      {avecRemunerationSaisie(mode) ? <RemunerationSaisie remunerationNette={options.remunerationNette} statut={statut} plafond={plafond} onChange={remunerationNette => onChange({ remunerationNette })} /> : null}

      <FraisEtPartBnc options={options} bncUtile={bncUtile} onChange={onChange} />
    </div>
  )
}
