// src/ui/components/ConditionsDuPortage.tsx
// Conditions de la société de portage de la colonne « Portage salarial » du comparateur (voir l'ADR 016) : une section
// repliée des réglages du comparateur. Chaque condition non réglée prend sa valeur typique, dite comme telle ; seules
// celles que l'utilisateur change sont enregistrées avec les autres réglages (ADR 009). Les bornes sont celles du
// fichier (ConditionsPortageSchema).

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { conditionsPortageRetenues, plancherAuDessusDuPlafond } from "@/backend/logic/options-du-comparateur"
import type { ConditionsPortage, ConditionsPortageRetenues, EffectifPortage } from "@/types"
import { ChampNumerique } from "./ChampNumerique"
import { Depliable } from "./Depliable"

type Cle = keyof ConditionsPortageRetenues

const LIBELLES_DES_EFFECTIFS: Record<EffectifPortage, string> = { moinsDe11: "Moins de 11 salariés", de11a49: "De 11 à 49 salariés", "50EtPlus": "50 salariés et plus" }

const aide = "text-xs text-slate-600 dark:text-slate-400"

/** Un nombre saisi, ramené entre ses bornes ; `undefined` s'il est vide ou invalide. */
function nombreSaisi(texte: string, max: number): number | undefined {
  const nombre = Number.parseFloat(texte)
  return Number.isFinite(nombre) ? Math.min(max, Math.max(0, nombre)) : undefined
}

/** Arrondi d'un taux saisi en pourcentage, pour ne pas garder 0,07000000000000001. */
const enTaux = (pourcentage: number) => Math.round(pourcentage * 100) / 10000

interface ChampProps {
  cle: Cle
  libelle: string
  /** Valeur affichée : celle saisie ou la valeur typique ; `null` laisse le champ vide (« aucun »). */
  valeur: number | null
  max: number
  step: string
  typique: boolean
  /** Ce qu'on dit sous le champ quand il est à sa valeur typique. */
  noteTypique: string
  onChange: (valeur: number | undefined) => void
}

/** Un champ numérique d'une condition, avec la mention de sa valeur typique. */
function ChampDeCondition({ cle, libelle, valeur, max, step, typique, noteTypique, onChange }: ChampProps) {
  const id = `portage-${cle}`
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{libelle}</Label>
      <ChampNumerique id={id} className="w-40" classNameChamp="h-8 bg-background text-right" min="0" max={max} step={step} quoi={`« ${libelle} »`} aria-describedby={typique ? `${id}-typique` : undefined} value={valeur ?? ""} onChange={e => onChange(nombreSaisi(e.target.value, max))} />
      {typique ? (
        <p id={`${id}-typique`} className={aide}>
          {noteTypique}
        </p>
      ) : null}
    </div>
  )
}

interface ConditionsDuPortageProps {
  /** Conditions réglées dans le comparateur : seules celles que l'utilisateur a changées. */
  conditions: ConditionsPortage | undefined
  onChange: (conditions: ConditionsPortage | undefined) => void
}

/**
 * Les conditions de la société de portage, repliées sous une section : frais de gestion (taux, plancher, plafond, frais
 * fixes), contrat, effectif, versement mobilité, réduction générale reversée, mutuelle.
 */
export function ConditionsDuPortage({ conditions, onChange }: ConditionsDuPortageProps) {
  const { conditions: retenues, valeursTypiques } = conditionsPortageRetenues(conditions)
  const typique = (cle: Cle) => valeursTypiques.includes(cle)
  // Une condition vidée reprend sa valeur typique : elle n'est plus enregistrée.
  const regler = (cle: Cle, valeur: ConditionsPortage[Cle]) => onChange(Object.fromEntries(Object.entries({ ...conditions, [cle]: valeur }).filter(([, v]) => v !== undefined)) as ConditionsPortage)
  const pourcent = (taux: number) => Math.round(taux * 10000) / 100
  return (
    <Depliable titre="Conditions de la société de portage" id="comparateur-conditions-portage" className="text-sm">
      <div className="mt-3 space-y-3 text-slate-700 dark:text-slate-200">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Pour la colonne « Portage salarial ». Les valeurs par défaut sont typiques, sans source officielle : frais de gestion de 7 % du chiffre d'affaires (souvent de 5 à 10 %), CDI, société de 50 salariés et plus, réduction générale des cotisations gardée par la société, sans mutuelle. Remplacez-les par celles de votre société de portage. La loi et la convention de branche (indemnité d'apport d'affaires, réserve, cotisations) ne se règlent pas.
        </p>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <ChampDeCondition cle="tauxFraisDeGestion" libelle="Frais de gestion (% du chiffre d'affaires HT)" valeur={pourcent(retenues.tauxFraisDeGestion)} max={30} step="0.5" typique={typique("tauxFraisDeGestion")} noteTypique="valeur typique" onChange={v => regler("tauxFraisDeGestion", v === undefined ? undefined : enTaux(v))} />
          <ChampDeCondition cle="plancherMensuel" libelle="Plancher mensuel des frais de gestion (€)" valeur={retenues.plancherMensuel} max={5000} step="10" typique={typique("plancherMensuel")} noteTypique="aucun" onChange={v => regler("plancherMensuel", v)} />
          <ChampDeCondition cle="plafondMensuel" libelle="Plafond mensuel des frais de gestion (€)" valeur={retenues.plafondMensuel} max={50000} step="50" typique={typique("plafondMensuel")} noteTypique="aucun" onChange={v => regler("plafondMensuel", v)} />
          <ChampDeCondition cle="fraisFixesMensuels" libelle="Frais fixes par mois (€)" valeur={retenues.fraisFixesMensuels} max={2000} step="5" typique={typique("fraisFixesMensuels")} noteTypique="valeur typique : 0 €" onChange={v => regler("fraisFixesMensuels", v)} />
          <div className="space-y-1">
            <Label htmlFor="portage-contrat">Contrat</Label>
            <Select value={retenues.contrat} onValueChange={(contrat: ConditionsPortageRetenues["contrat"]) => regler("contrat", contrat)}>
              <SelectTrigger id="portage-contrat" className="h-8 w-40 bg-background" aria-describedby="portage-contrat-aide">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CDI">CDI</SelectItem>
                <SelectItem value="CDD">CDD</SelectItem>
              </SelectContent>
            </Select>
            <p id="portage-contrat-aide" className={aide}>
              {retenues.contrat === "CDI" ? "réserve de 10 % gardée sur le compte d'activité" : "indemnité de précarité de 10 % versée"}
              {typique("contrat") ? " · valeur typique" : ""}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="portage-effectif">Effectif de la société de portage</Label>
            <Select value={retenues.effectif} onValueChange={(effectif: EffectifPortage) => regler("effectif", effectif)}>
              <SelectTrigger id="portage-effectif" className="h-8 w-52 max-w-full bg-background" aria-describedby={typique("effectif") ? "portage-effectif-typique" : undefined}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LIBELLES_DES_EFFECTIFS) as EffectifPortage[]).map(effectif => (
                  <SelectItem key={effectif} value={effectif}>
                    {LIBELLES_DES_EFFECTIFS[effectif]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {typique("effectif") ? (
              <p id="portage-effectif-typique" className={aide}>
                valeur typique
              </p>
            ) : null}
          </div>
          <ChampDeCondition cle="tauxVersementMobilite" libelle="Versement mobilité (% du brut)" valeur={pourcent(retenues.tauxVersementMobilite)} max={3.2} step="0.05" typique={typique("tauxVersementMobilite")} noteTypique="selon la commune, 3,2 % à Paris ; dû à partir de 11 salariés" onChange={v => regler("tauxVersementMobilite", v === undefined ? undefined : enTaux(v))} />
          <ChampDeCondition cle="mutuelleMensuelle" libelle="Mutuelle, part du salarié (€ par mois)" valeur={retenues.mutuelleMensuelle} max={1000} step="5" typique={typique("mutuelleMensuelle")} noteTypique="valeur typique : aucune" onChange={v => regler("mutuelleMensuelle", v)} />
          <label className="flex min-h-9 items-center gap-2 self-end text-sm font-medium pointer-coarse:min-h-11">
            <input type="checkbox" className="size-4 accent-slate-700 dark:accent-slate-300" checked={retenues.reductionGeneraleReversee} onChange={e => regler("reductionGeneraleReversee", e.target.checked)} />
            La société reverse la réduction générale des cotisations
          </label>
        </div>
        {plancherAuDessusDuPlafond({ plancherMensuel: conditions?.plancherMensuel ?? null, plafondMensuel: conditions?.plafondMensuel ?? null }) ? (
          <p role="note" className="text-sm text-amber-800 dark:text-amber-200/90">
            Le plancher dépasse le plafond : ni l'un ni l'autre n'est retenu.
          </p>
        ) : null}
        {conditions && Object.keys(conditions).length > 0 ? (
          <button type="button" onClick={() => onChange(undefined)} className="text-sm font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-400 print:hidden">
            Revenir aux valeurs typiques
          </button>
        ) : null}
      </div>
    </Depliable>
  )
}
