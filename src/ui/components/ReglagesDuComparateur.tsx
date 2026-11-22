// src/ui/components/ReglagesDuComparateur.tsx
// Réglages du comparateur de statuts, visibles dans tous les affichages, en deux étapes de l'onglet :
// - ce qui est comparé (étape 1) : l'activité, et repliés les frais de fonctionnement (avec la part BNC quand elle
//   sert) et les conditions de la société de portage ;
// - la société (étape 3) : le partage du bénéfice des colonnes SASU et EURL, la phrase du mode choisi, puis selon le
//   mode la case des 4 trimestres de retraite ou la rémunération saisie (champ et curseur).

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { avecLaRetraiteEn, avecLeMode, avecRemunerationSaisie, defaultFraisFonctionnement, descriptionDuMode, libellesCourtsRepartition, posteFraisLabels, statutsFrais } from "@/lib/comparateur-options"
import { trimestresExiges } from "@/backend/logic/options-du-comparateur"
import { ecartSigne, euros, pourcentDeNombre } from "@/backend/logic/format"
import { cn } from "@/lib/utils"
import { STATUTS_SOCIETE, type ComparaisonOptions, type ComparaisonResult, type Company, type FraisFonctionnement, type MicroEntreprise, type ModeRepartition, type PosteFrais, type ScenarioStatut, type StatutFrais, type StatutSociete } from "@/types"
import { CurseurDeRemuneration } from "./Curseur"
import { Depliable } from "./Depliable"
import { useSectionOuverte } from "../hooks/useSectionOuverte"
import { APPARITION, HauteurAnimee } from "./HauteurAnimee"
import { ChampNumerique } from "./ChampNumerique"
import { ConditionsDuPortage } from "./ConditionsDuPortage"
import { ColonnesTouchees } from "./EtapeDuComparateur"
import { ZoneDefilante } from "./ZoneDefilante"

const statutFraisLabels: Record<StatutFrais, string> = { SASU: "SASU", EURL: "EURL", EI: "EI au réel", micro: "Micro-entreprise" }

const MODES = Object.keys(libellesCourtsRepartition) as ModeRepartition[]

/**
 * Choix du partage du bénéfice des colonnes SASU et EURL : des boutons radio aux libellés courts, présentés comme un
 * sélecteur segmenté qui passe à la ligne sur téléphone. De 352 à 640 px de large, une grille de deux lignes (trois
 * boutons, puis deux) dont les libellés vont à la ligne au besoin : elle tient aussi avec une police large. La phrase de chaque mode le décrit (aria-describedby) et
 * s'affiche au survol ; celle du mode choisi est écrite sous les boutons.
 */
function ChoixDeLaRepartition({ mode, exiges, onChange }: { mode: ModeRepartition; exiges: Record<StatutSociete, boolean>; onChange: (mode: ModeRepartition) => void }) {
  return (
    <fieldset className="min-w-0 max-w-full space-y-1">
      <legend className="mb-1 text-sm font-medium leading-none">Bénéfice de la société (SASU, EURL)</legend>
      <div className="flex w-fit max-w-full flex-wrap gap-0.5 rounded-md border border-slate-300 bg-background p-0.5 min-[22rem]:max-sm:grid min-[22rem]:max-sm:w-full min-[22rem]:max-sm:grid-cols-6 dark:border-slate-600">
        {MODES.map((m, i) => (
          <label key={m} title={descriptionDuMode(m, exiges)} className={cn("flex min-h-8 flex-auto cursor-pointer items-center justify-center whitespace-nowrap rounded px-2 py-1 text-center text-xs font-medium leading-tight sm:px-3 sm:text-sm pointer-coarse:min-h-11 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)] min-[22rem]:max-sm:whitespace-normal min-[22rem]:max-sm:px-1", i < 3 ? "min-[22rem]:max-sm:col-span-2" : "min-[22rem]:max-sm:col-span-3", m === mode ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 print:hidden")}>
            <input type="radio" name="comparateur-repartition" value={m} checked={m === mode} aria-describedby={`comparateur-mode-${m}`} onChange={() => onChange(m)} className="sr-only" />
            {libellesCourtsRepartition[m]}
          </label>
        ))}
      </div>
      {MODES.map(m => (
        <span key={m} id={`comparateur-mode-${m}`} hidden>
          {descriptionDuMode(m, exiges)}
        </span>
      ))}
    </fieldset>
  )
}

/**
 * Ce que coûtent les 4 trimestres de retraite dans une colonne de société au meilleur net : le net perdu, rien s'ils
 * sont déjà validés au meilleur net, ou hors d'atteinte quand aucune rémunération ne les valide. Rien tant que la
 * colonne n'est pas calculée.
 */
function coutDeLaColonne(scenario: ScenarioStatut | undefined, exige: boolean): string | null {
  const retenue = scenario?.remunerationOptimale
  if (!scenario || !retenue) return null
  if (retenue.coutDesQuatreTrimestres) return `coût : ${ecartSigne(-retenue.coutDesQuatreTrimestres)} de net`
  if ((exige && retenue.retraiteHorsDAtteinte) || scenario.protectionSociale.trimestres < 4) return "hors d'atteinte : aucune rémunération ne les valide"
  return "sans coût : le meilleur net les valide déjà"
}

/**
 * Au meilleur net : dans chaque colonne de société, ne retenir que les rémunérations qui valident 4 trimestres de
 * retraite. Une case par colonne, cochée d'office : on peut comparer la SASU avec 4 trimestres à l'EURL au meilleur net.
 * Ce que coûtent les 4 trimestres en net est dit à côté de chaque case.
 */
function RetraiteParColonne({ options, scenarios, onChange }: { options: ComparaisonOptions; scenarios: ScenarioStatut[]; onChange: (changes: Partial<ComparaisonOptions>) => void }) {
  const exiges = trimestresExiges(options.repartition)
  return (
    <fieldset className="min-w-0 space-y-0.5">
      <legend className="mb-1 text-sm font-medium">Exiger 4 trimestres de retraite</legend>
      {STATUTS_SOCIETE.map(statut => {
        const cout = coutDeLaColonne(scenarios.find(s => s.statut === statut), exiges[statut])
        const idDuCout = `comparateur-cout-retraite-${statut}`
        return (
          <div key={statut} className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-0.5 pointer-coarse:min-h-11">
            <label className="flex min-h-9 items-center gap-2 text-sm pointer-coarse:min-h-11">
              <input type="checkbox" className="size-4 accent-slate-700 dark:accent-slate-300" aria-describedby={cout ? idDuCout : undefined} checked={exiges[statut]} onChange={e => onChange({ repartition: avecLaRetraiteEn(options.repartition, statut, e.target.checked) })} />
              en {statut}
            </label>
            {cout ? (
              <span id={idDuCout} className={cn("text-xs text-slate-600 dark:text-slate-400", APPARITION)}>
                {cout}
              </span>
            ) : null}
          </div>
        )
      })}
    </fieldset>
  )
}

/** Plus haute rémunération possible sans déficit dans chaque société ; `null` tant qu'elle n'est pas calculée. */
export type PlafondsDeRemuneration = Record<StatutSociete, number | null>

interface RemunerationSaisieProps {
  remunerationNette: number
  plafonds: PlafondsDeRemuneration
  onChange: (remunerationNette: number) => void
}

/**
 * Rémunération saisie (SASU, EURL) : un champ, et à côté un curseur de 0 à la plus haute rémunération que la société
 * peut verser sans déficit. Les deux se suivent. Une rémunération saisie au-delà n'est pas versée : chaque colonne
 * retient au plus ce que sa société peut verser, et une phrase le dit sous le champ, la poignée restant en bout de
 * piste. Sans bénéfice, pas de curseur.
 */
/**
 * Les plafonds connus de chaque société : pendant le calcul de l'un d'eux (`null`), le dernier connu. Le curseur et sa
 * note ne disparaissent pas un instant, ce qui ferait sauter la page.
 */
function useDerniersPlafonds(plafonds: PlafondsDeRemuneration): { statut: StatutSociete; plafond: number }[] {
  const [connus, setConnus] = useState(plafonds)
  const fusion = Object.fromEntries(STATUTS_SOCIETE.map(statut => [statut, plafonds[statut] ?? connus[statut]])) as PlafondsDeRemuneration
  if (STATUTS_SOCIETE.some(statut => fusion[statut] !== connus[statut])) setConnus(fusion)
  return STATUTS_SOCIETE.flatMap(statut => (fusion[statut] === null ? [] : [{ statut, plafond: fusion[statut] as number }]))
}

/**
 * Ce que le comparateur retient quand la rémunération saisie dépasse ce qu'une société peut verser : une phrase pour
 * toutes les sociétés concernées ; rien sinon.
 */
function phraseDesDepassements(remunerationNette: number, plafonds: { statut: StatutSociete; plafond: number }[]): string | null {
  const depasses = plafonds.filter(p => remunerationNette > p.plafond)
  if (depasses.length === 0) return null
  const parties = depasses.map(({ statut, plafond }) => (plafond > 0 ? `en ${statut}, le comparateur retient ${euros(plafond)}, le plus qu'elle peut verser` : `en ${statut}, le comparateur ne retient aucune rémunération`))
  return `Une société ne verse pas plus qu'elle ne gagne : ${parties.join(" ; ")}.`
}

/**
 * Rémunération saisie (SASU, EURL) : un champ, et à côté un curseur de 0 à la plus haute rémunération que l'une des
 * deux sociétés peut verser sans déficit ; la note dessous donne le plafond de chacune, sans dépendre de la société
 * étudiée plus bas. Au-delà du plafond d'une société, sa colonne retient ce plafond, et une phrase le dit.
 */
function RemunerationSaisie({ remunerationNette, plafonds: demandes, onChange }: RemunerationSaisieProps) {
  // Pendant un glissement, le champ montre la valeur de la poignée ; le comparateur ne recalcule qu'au relâchement.
  const [apercu, setApercu] = useState<number | null>(null)
  const plafonds = useDerniersPlafonds(demandes)
  const maximum = plafonds.length > 0 ? Math.max(...plafonds.map(p => p.plafond)) : null
  const note = maximum === null ? undefined : "comparateur-remuneration-plafond"
  const classeDeLaNote = "text-xs text-slate-600 dark:text-slate-400"
  const depassements = phraseDesDepassements(remunerationNette, plafonds)
  return (
    <div className="space-y-1">
      <Label htmlFor="comparateur-remuneration">Rémunération nette annuelle (SASU, EURL)</Label>
      {/* Le champ, et le curseur avec ses plafonds dessous ; sur téléphone, le curseur passe sous le champ. */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <ChampNumerique id="comparateur-remuneration" className="mt-1 w-40" classNameChamp="bg-background text-right" min="0" step="1000" quoi="la rémunération" aria-describedby={note} value={apercu ?? remunerationNette} onChange={e => onChange(Math.max(0, Number.parseFloat(e.target.value) || 0))} />
        {maximum !== null && maximum > 0 ? (
          <div className={cn("w-full max-w-xs sm:w-80", APPARITION)}>
            <CurseurDeRemuneration valeur={remunerationNette} max={maximum} libelle="Régler la rémunération nette annuelle" decritPar={note} onApercu={setApercu} onValider={onChange} />
            <p id={note} className={cn(classeDeLaNote, "-mt-1")}>
              jusqu'à {plafonds.map(p => `${euros(p.plafond)} en ${p.statut}`).join(", ")} sans déficit
            </p>
          </div>
        ) : null}
      </div>
      {maximum === 0 ? (
        <p id={note} className={classeDeLaNote}>
          En {plafonds.map(p => p.statut).join(" et en ")}, l'activité ne dégage pas de bénéfice : aucune rémunération possible sans déficit.
        </p>
      ) : null}
      {depassements ? (
        <p role="status" className="text-sm text-amber-800 dark:text-amber-200">
          {depassements}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Détail des frais de fonctionnement annuels supposés par statut, modifiables : ils servent à estimer l'écart de frais
 * entre chaque statut et le statut actuel, seul ajouté aux charges d'une colonne (rien pour le statut actuel).
 */
function FraisFonctionnementTable({ frais, cfe, onChange }: { frais: FraisFonctionnement; cfe?: CFEDeLAnnee; onChange: (frais: FraisFonctionnement) => void }) {
  const postes = Object.keys(posteFraisLabels) as PosteFrais[]
  const total = (statut: StatutFrais) => postes.reduce((somme, poste) => somme + frais[statut][poste], 0)
  const update = (statut: StatutFrais, poste: PosteFrais, value: string) => onChange({ ...frais, [statut]: { ...frais[statut], [poste]: Math.max(0, Number.parseFloat(value) || 0) } })

  return (
    <div className="text-slate-700 dark:text-slate-200">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Frais annuels supposés par statut : des ordres de grandeur, à ajuster à votre situation. Ils servent à estimer l'écart de frais entre statuts : vos frais réels sont ceux saisis dans la grille, et chaque autre colonne n'ajoute que la différence entre ses frais et ceux de votre statut actuel (en moins, s'il en coûte moins). Déductibles en société et en EI, ils ne réduisent ni cotisations ni impôt en micro. La CFE varie selon la commune ; avec la date de création de l'activité, elle est exonérée l'année de création et réduite de moitié l'année suivante.
      </p>
      <ZoneDefilante libelle="Tableau des frais de fonctionnement" className="mt-3">
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
                  {poste === "cfe" && cfe ? <span className="block text-xs text-blue-800 dark:text-blue-300">{cfe.part === 0 ? "non comptée cette année" : `comptée pour ${pourcentDeNombre(Math.round(cfe.part * 100))} cette année`}</span> : null}
                </th>
                {statutsFrais.map(statut => (
                  <td key={statut} className="px-2 py-1">
                    {/* Calé à droite comme l'en-tête et le total de sa colonne : une marge automatique ne suffit pas sur un
                        champ de saisie, que certains navigateurs (Firefox) affichent en ligne. */}
                    <div className="flex justify-end">
                      <ChampNumerique className="w-32" classNameChamp="h-8 bg-background text-right" min="0" step="50" aria-label={`${posteFraisLabels[poste]}, ${statutFraisLabels[statut]}`} value={frais[statut][poste]} onChange={e => update(statut, poste, e.target.value)} />
                    </div>
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
                  {euros(total(statut))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </ZoneDefilante>
      {cfe ? <p className="mt-2 text-sm text-blue-900 dark:text-blue-200">{cfe.note}</p> : null}
    </div>
  )
}

/** CFE de l'année exonérée ou réduite d'après la date de création de l'activité comparée (voir dispositifs.ts). */
interface CFEDeLAnnee {
  part: number
  note: string
}

/** La CFE de l'année d'après la comparaison, quand elle n'est pas due en entier. */
function cfeDeLaComparaison(result: ComparaisonResult | null): CFEDeLAnnee | undefined {
  return result?.noteCFE !== undefined && result.partCFE !== undefined ? { part: result.partCFE, note: result.noteCFE } : undefined
}

/**
 * Frais de fonctionnement et, quand elle sert, part BNC : une seule section repliée, dans tous les affichages. Son
 * état est retenu sous l'identifiant de l'ancienne section « Plus de réglages » ; tant qu'il ne l'est pas, elle
 * reprend celui de l'ancien tableau des frais, qui était replié à l'intérieur.
 */
function FraisEtPartBnc({ options, bncUtile, cfe, onChange }: { options: ComparaisonOptions; bncUtile: boolean; cfe?: CFEDeLAnnee; onChange: (changes: Partial<ComparaisonOptions>) => void }) {
  const [ancienTableauOuvert] = useSectionOuverte("comparateur-frais")
  return (
    <Depliable
      titre={
        <>
          {bncUtile ? "Frais de fonctionnement et part BNC" : "Frais de fonctionnement"} <ColonnesTouchees>toutes les colonnes</ColonnesTouchees>
        </>
      }
      id="comparateur-plus-de-reglages"
      ouverteParDefaut={ancienTableauOuvert}
      className="text-sm"
    >
      <div className="mt-3 space-y-3">
        {bncUtile ? (
          <div className="space-y-1">
            <Label htmlFor="comparateur-bnc">En micro, prestations en BNC : {pourcentDeNombre(Math.round(options.partBncPrestations * 100))} (le reste en BIC)</Label>
            <input id="comparateur-bnc" className="block w-56 max-w-full accent-slate-700 print:hidden" type="range" min="0" max="100" step="10" value={Math.round(options.partBncPrestations * 100)} onChange={e => onChange({ partBncPrestations: Number(e.target.value) / 100 })} />
          </div>
        ) : null}
        <FraisFonctionnementTable frais={options.fraisFonctionnement ?? defaultFraisFonctionnement()} cfe={cfe} onChange={fraisFonctionnement => onChange({ fraisFonctionnement })} />
      </div>
    </Depliable>
  )
}

/** Identifiant de la liste des activités : le rappel de l'étape 2 y ramène. */
export const ID_DU_CHOIX_DE_L_ACTIVITE = "comparateur-activite"

/**
 * La liste des activités, dans le titre de l'étape 1 : le réglage qui change tout le tableau, plus grand que les autres
 * champs, au trait bleu (le vert est celui du meilleur net). Le titre de l'étape lui sert de libellé visible.
 */
export function ChoixDeLActivite({ activities, selected, onSelect }: { activities: (Company | MicroEntreprise)[]; selected: Company | MicroEntreprise; onSelect: (activityId: string) => void }) {
  return (
    <Select value={selected.id} onValueChange={onSelect}>
      <SelectTrigger id={ID_DU_CHOIX_DE_L_ACTIVITE} aria-label="Activité comparée" aria-describedby="comparateur-activite-aide" className="w-72 max-w-full border-2 border-blue-600 bg-background text-base font-semibold shadow-[0_0_0_4px_rgb(37_99_235/0.15)] data-[size=default]:h-11 dark:border-blue-400 dark:bg-background dark:hover:bg-background print:shadow-none">
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
  )
}

export interface ReglagesCommunsProps {
  options: ComparaisonOptions
  /** Comparaison en cours : elle dit si la CFE de l'année est exonérée ou réduite. */
  result: ComparaisonResult | null
  /** La part BNC sert-elle pour l'activité comparée ? */
  bncUtile: boolean
  onChange: (changes: Partial<ComparaisonOptions>) => void
}

/**
 * Étape 1, sous la liste des activités : ce qu'elle fait, puis, repliées, les hypothèses du calcul (frais de
 * fonctionnement et part BNC, conditions de la société de portage), chacune avec la puce des colonnes qu'elle change.
 */
export function ReglagesCommuns({ options, result, bncUtile, onChange }: ReglagesCommunsProps) {
  // Pas un bloc insécable à l'impression : plus haut qu'une demi-page (tableau des frais, conditions du portage), il
  // partait d'un bloc à la page suivante et laissait le titre de l'étape seul sur une page presque vide.
  return (
    <div className="space-y-3">
      <p id="comparateur-activite-aide" className="max-w-prose text-sm text-slate-600 dark:text-slate-400">
        Simulée dans chaque statut du tableau ; le reste de votre simulation ne change pas.
      </p>
      <FraisEtPartBnc options={options} bncUtile={bncUtile} cfe={cfeDeLaComparaison(result)} onChange={onChange} />
      <ConditionsDuPortage conditions={options.portage} onChange={portage => onChange({ portage })} />
    </div>
  )
}

export interface ReglagesDeLaSocieteProps {
  options: ComparaisonOptions
  /** Comparaison en cours : au meilleur net, elle dit ce que coûtent les 4 trimestres de retraite dans chaque colonne. */
  result: ComparaisonResult | null
  /** Plus haute rémunération possible sans déficit dans chaque société (`null` en attendant). */
  plafonds: PlafondsDeRemuneration
  onChange: (changes: Partial<ComparaisonOptions>) => void
}

/**
 * Étape 3, la société : le partage du bénéfice des colonnes SASU et EURL, la phrase du mode choisi, puis la case des
 * 4 trimestres (au meilleur net) ou la rémunération saisie.
 */
export function ReglagesDeLaSociete({ options, result, plafonds, onChange }: ReglagesDeLaSocieteProps) {
  const { mode } = options.repartition
  const exiges = trimestresExiges(options.repartition)
  // Chaque mode a sa hauteur, et une partie arrive après son calcul (le curseur, les coûts) : la partie qui dépend du
  // mode suit sa hauteur en douceur, le contenu dessous glisse.
  return (
    <div data-impression="bloc" className="space-y-1.5">
      <ChoixDeLaRepartition mode={mode} exiges={exiges} onChange={nouveau => onChange({ repartition: avecLeMode(options.repartition, nouveau) })} />
      <HauteurAnimee className="space-y-3">
        <p id="comparateur-mode-choisi" className="text-sm text-slate-600 dark:text-slate-400">
          {descriptionDuMode(mode, exiges)}
        </p>
        {mode === "meilleurNet" ? <RetraiteParColonne options={options} scenarios={result?.scenarios ?? []} onChange={onChange} /> : null}
        {avecRemunerationSaisie(mode) ? <RemunerationSaisie remunerationNette={options.remunerationNette} plafonds={plafonds} onChange={remunerationNette => onChange({ remunerationNette })} /> : null}
      </HauteurAnimee>
    </div>
  )
}
