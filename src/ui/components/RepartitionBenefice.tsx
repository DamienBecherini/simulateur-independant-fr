// src/ui/components/RepartitionBenefice.tsx
// Partage du bénéfice d'une société dans le comparateur : choix du mode (rémunération saisie et dividendes, tout en
// rémunération, répartition personnalisée, dividendes de la grille) et barre empilée du bénéfice avant rémunération,
// avec deux poignées à faire glisser (rémunération, part distribuée) et des répartitions toutes faites.

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { Button } from "@/components/ui/button"
import { avecRemuneration, libellesRepartition } from "@/lib/comparateur-options"
import { apercuDuPartage, auPas, coutRemuneration, dividendesVerses, libellesPostes, PAS_PART, PAS_REMUNERATION, partDistribueeDe, POSTES, postesArrondis, remunerationPourUnCout, valeurAuClavier, type PosteDuPartage } from "@/lib/repartition-benefice"
import { cn } from "@/lib/utils"
import type { ComparaisonOptions, ModeRepartition, OptimisationRemuneration, PartageDuBenefice, ScenarioStatut, StatutSociete } from "@/types"
import { ChoixDuStatut } from "./RemunerationOptimizer"

const euros = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`
const pourcentage = (part: number) => `${Math.round(part * 100)} %`

const MODES = Object.keys(libellesRepartition) as ModeRepartition[]

/** Choix du partage du bénéfice des colonnes SASU et EURL : des boutons radio présentés comme un sélecteur segmenté. */
export function ChoixDeLaRepartition({ mode, onChange }: { mode: ModeRepartition; onChange: (mode: ModeRepartition) => void }) {
  return (
    <fieldset className="basis-full space-y-1">
      <legend className="mb-1 text-sm font-medium leading-none">Bénéfice de la société (SASU, EURL)</legend>
      <div className="flex w-fit max-w-full flex-wrap gap-0.5 rounded-md border border-slate-300 bg-background p-0.5 dark:border-slate-600">
        {MODES.map(m => (
          <label key={m} className={cn("flex min-h-9 items-center rounded px-3 text-sm font-medium pointer-coarse:min-h-11 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)]", m === mode ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 print:hidden")}>
            <input type="radio" name="comparateur-repartition" value={m} checked={m === mode} onChange={() => onChange(m)} className="sr-only" />
            {libellesRepartition[m]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Couleurs des postes : la palette catégorielle validée (daltonisme, contraste, clair et sombre), dans un ordre dont
 * chaque paire voisine se distingue. Le texte n'en porte jamais : montants et libellés restent à l'encre du texte.
 */
const COULEURS: Record<PosteDuPartage, string> = {
  remunerationNette: "bg-[#2a78d6] dark:bg-[#3987e5]",
  cotisationsRemuneration: "bg-[#eb6834] dark:bg-[#d95926]",
  impotSocietes: "bg-[#1baf7a] dark:bg-[#199e70]",
  dividendesNets: "bg-[#eda100] dark:bg-[#c98500]",
  cotisationsSurDividendes: "bg-[#e87ba4] dark:bg-[#d55181]",
  resultatConserve: "bg-[#4a3aa7] dark:bg-[#9085e9]"
}

/** Largeur approximative d'un montant en texte de 12 px, pour ne l'écrire sous un segment que s'il y tient. */
const largeurDuTexte = (texte: string) => texte.length * 7 + 8

type Poignee = "remuneration" | "part"

interface Glissement {
  poignee: Poignee
  valeur: number
}

/** Largeur de la barre, mesurée pour placer les montants sous les segments assez larges. */
function useLargeurDeLaBarre() {
  const ref = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return
    // Une largeur nulle est celle d'une vue masquée (affichage « Trois vues ») : la barre garde sa dernière largeur.
    const observateur = new ResizeObserver(([entree]) => entree.contentRect.width > 0 && setLargeur(entree.contentRect.width))
    observateur.observe(element)
    return () => observateur.disconnect()
  }, [])
  return { ref, largeur }
}

interface PoigneeProps {
  nom: Poignee
  position: number
  libelle: string
  valeur: number
  max: number
  texte: string
  onClavier: (e: KeyboardEvent<HTMLDivElement>) => void
}

/** Poignée de la barre : un curseur (role="slider") qu'on fait glisser ou qu'on règle au clavier. */
function PoigneeDeLaBarre({ nom, position, libelle, valeur, max, texte, onClavier }: PoigneeProps) {
  return (
    <div
      role="slider"
      tabIndex={0}
      data-poignee={nom}
      aria-label={libelle}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={valeur}
      aria-valuetext={texte}
      onKeyDown={onClavier}
      style={{ left: `${position * 100}%` }}
      className="absolute top-1/2 z-10 flex h-11 w-6 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-md active:cursor-grabbing pointer-coarse:w-11 print:hidden"
    >
      <span aria-hidden="true" className="h-10 w-2 rounded-full bg-slate-900 ring-2 ring-white dark:bg-slate-50 dark:ring-gray-950" />
    </div>
  )
}

interface BarreProps {
  partage: PartageDuBenefice
  /** Bornes de la poignée de rémunération ; sans elles (ou hors répartition personnalisée), pas de poignées. */
  remunerationMaximale: number | null
  remuneration: number
  part: number
  glissement: Glissement | null
  onGlisser: (glissement: Glissement | null) => void
  onValider: (glissement: Glissement) => void
}

/** Montants sous les segments, quand ils y tiennent ; la légende les donne tous. */
function Montants({ affiche, echelle, largeur }: { affiche: Record<PosteDuPartage, number>; echelle: number; largeur: number }) {
  let debut = 0
  return (
    <div aria-hidden="true" className="relative h-5 text-xs tabular-nums text-slate-700 dark:text-slate-200">
      {POSTES.map(poste => {
        const montant = Math.max(0, affiche[poste])
        const gauche = debut
        debut += montant
        const texte = euros(montant)
        if (montant <= 0 || (montant / echelle) * largeur < largeurDuTexte(texte)) return null
        return (
          <span key={poste} className="absolute top-0.5 -translate-x-1/2 whitespace-nowrap" style={{ left: `${((gauche + montant / 2) / echelle) * 100}%` }}>
            {texte}
          </span>
        )
      })}
    </div>
  )
}

/** Barre empilée du bénéfice avant rémunération, segment par segment, avec ses deux poignées. */
function Barre({ partage, remunerationMaximale, remuneration, part, glissement, onGlisser, onValider }: BarreProps) {
  const { ref, largeur } = useLargeurDeLaBarre()
  const affiche = postesArrondis(partage)
  const echelle = Math.max(1, partage.beneficeAvantRemuneration, coutRemuneration(partage))
  const cout = coutRemuneration(partage)
  const avantDividendes = cout + partage.impotSocietes
  const distribuable = Math.max(0, partage.beneficeAvantRemuneration - avantDividendes)
  const modifiable = remunerationMaximale !== null

  const valeurAuPointeur = (poignee: Poignee, clientX: number): number => {
    const cadre = ref.current!.getBoundingClientRect()
    const montant = ((clientX - cadre.left) / Math.max(1, cadre.width)) * echelle
    if (poignee === "remuneration") return auPas(remunerationPourUnCout(partage, remunerationMaximale ?? 0, montant), PAS_REMUNERATION, 0, remunerationMaximale ?? 0)
    return distribuable > 0 ? auPas((montant - avantDividendes) / distribuable, PAS_PART, 0, 1) : part
  }
  /** La poignée saisie, ou la plus proche du point cliqué sur la barre. */
  const poigneeVisee = (e: PointerEvent<HTMLDivElement>): Poignee => {
    const saisie = (e.target as HTMLElement).closest<HTMLElement>("[data-poignee]")?.dataset.poignee
    if (saisie === "remuneration" || saisie === "part") return saisie
    const cadre = ref.current!.getBoundingClientRect()
    const montant = ((e.clientX - cadre.left) / Math.max(1, cadre.width)) * echelle
    return distribuable > 0 && Math.abs(montant - (avantDividendes + dividendesVerses(partage))) < Math.abs(montant - cout) ? "part" : "remuneration"
  }

  const surAppui = (e: PointerEvent<HTMLDivElement>) => {
    if (!modifiable || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const poignee = poigneeVisee(e)
    ;(e.currentTarget.querySelector<HTMLElement>(`[data-poignee="${poignee}"]`) ?? e.currentTarget).focus()
    onGlisser({ poignee, valeur: valeurAuPointeur(poignee, e.clientX) })
  }
  const surDeplacement = (e: PointerEvent<HTMLDivElement>) => {
    if (glissement) onGlisser({ poignee: glissement.poignee, valeur: valeurAuPointeur(glissement.poignee, e.clientX) })
  }
  const surRelache = () => {
    if (glissement) onValider(glissement)
    onGlisser(null)
  }
  const auClavier = (poignee: Poignee) => (e: KeyboardEvent<HTMLDivElement>) => {
    const bornes = poignee === "remuneration" ? { min: 0, max: remunerationMaximale ?? 0, pas: PAS_REMUNERATION, grandPas: 1000 } : { min: 0, max: 1, pas: PAS_PART, grandPas: 0.25 }
    const valeur = valeurAuClavier(e.key, poignee === "remuneration" ? remuneration : part, bornes)
    if (valeur === null) return
    e.preventDefault()
    onValider({ poignee, valeur })
  }

  let debut = 0
  return (
    <div>
      <div ref={ref} className={cn("relative py-2.5", modifiable && "cursor-pointer touch-none")} onPointerDown={surAppui} onPointerMove={surDeplacement} onPointerUp={surRelache} onPointerCancel={() => onGlisser(null)}>
        <div className="relative h-6">
          {POSTES.map(poste => {
            const montant = Math.max(0, partage[poste])
            const gauche = debut
            debut += montant
            if (montant <= 0) return null
            // Un espace de 2 px, couleur du fond, sépare les segments voisins.
            return <div key={poste} data-poste={poste} aria-hidden="true" title={`${libellesPostes[poste]} : ${euros(affiche[poste])}`} className={cn("absolute inset-y-0 rounded-[3px]", COULEURS[poste])} style={{ left: `calc(${(gauche / echelle) * 100}% + 1px)`, width: `max(0px, calc(${(montant / echelle) * 100}% - 2px))` }} />
          })}
        </div>
        {modifiable ? (
          <>
            <PoigneeDeLaBarre nom="remuneration" position={cout / echelle} libelle="Rémunération nette du dirigeant" valeur={remuneration} max={remunerationMaximale ?? 0}texte={`${euros(remuneration)} de rémunération nette`} onClavier={auClavier("remuneration")} />
            {distribuable > 0 ? <PoigneeDeLaBarre nom="part" position={(avantDividendes + part * distribuable) / echelle} libelle="Part du bénéfice distribuable versée en dividendes" valeur={Math.round(part * 100)} max={100} texte={`${pourcentage(part)} du bénéfice distribuable en dividendes, ${pourcentage(1 - part)} conservés`} onClavier={auClavier("part")} /> : null}
          </>
        ) : null}
      </div>
      <Montants affiche={affiche} echelle={echelle} largeur={largeur} />
    </div>
  )
}

/** Légende de la barre, qui en est aussi le tableau des valeurs : poste, montant et part du bénéfice. */
function Legende({ partage, statut, estimation }: { partage: PartageDuBenefice; statut: StatutSociete; estimation: boolean }) {
  const arrondis = postesArrondis(partage)
  const total = Object.values(arrondis).reduce((a, b) => a + b, 0)
  const postes = POSTES.filter(poste => poste !== "cotisationsSurDividendes" || arrondis[poste] !== 0)
  return (
    <table className="w-full max-w-xl text-sm tabular-nums" aria-label={`Partage du bénéfice en ${statut}${estimation ? ", estimation en attendant le calcul" : ""}`}>
      <thead className="sr-only">
        <tr>
          <th scope="col">Poste</th>
          <th scope="col">Montant</th>
          <th scope="col">Part du bénéfice</th>
        </tr>
      </thead>
      <tbody>
        {postes.map(poste => (
          <tr key={poste} className="border-t border-slate-100 first:border-t-0 dark:border-slate-800">
            <th scope="row" className="py-1 pr-3 text-left font-normal text-slate-700 dark:text-slate-200">
              <span aria-hidden="true" className={cn("mr-2 inline-block size-3 rounded-[3px] align-[-1px]", COULEURS[poste])} />
              {libellesPostes[poste]}
            </th>
            <td className="whitespace-nowrap py-1 pr-3 text-right">{estimation ? "≈ " : ""}{euros(arrondis[poste])}</td>
            <td className="whitespace-nowrap py-1 text-right text-slate-600 dark:text-slate-300">{total > 0 ? pourcentage(arrondis[poste] / total) : "—"}</td>
          </tr>
        ))}
        <tr className="border-t border-slate-300 font-medium dark:border-slate-600">
          <th scope="row" className="py-1 pr-3 text-left">
            Bénéfice avant rémunération
          </th>
          <td className="whitespace-nowrap py-1 pr-3 text-right">{euros(total)}</td>
          <td className="whitespace-nowrap py-1 text-right">100 %</td>
        </tr>
      </tbody>
    </table>
  )
}

interface RepartitionProps {
  activityName: string
  statut: StatutSociete
  onStatut: (statut: StatutSociete) => void
  /** Colonne du comparateur dans ce statut. */
  scenario: ScenarioStatut | undefined
  /** Arbitrage rémunération / dividendes de ce statut : rémunération maximale et meilleurs nets. */
  optimisation: OptimisationRemuneration | null
  options: ComparaisonOptions
  onChange: (options: ComparaisonOptions) => void
}

/** Répartitions toutes faites, reprises de l'arbitrage rémunération / dividendes. */
function Raccourcis({ optimisation, options, onChange }: { optimisation: OptimisationRemuneration; options: ComparaisonOptions; onChange: (options: ComparaisonOptions) => void }) {
  const personnalisee = (remunerationNette: number, partDistribuee: number) => onChange({ ...options, remunerationNette, repartition: { mode: "personnalisee", partDistribuee } })
  const { meilleur, meilleurAvecRetraite, remunerationMaximale } = optimisation
  const raccourcis: [string, (() => void) | null][] = [
    ["Tout en dividendes", () => personnalisee(0, 1)],
    ["Tout en rémunération", () => personnalisee(remunerationMaximale, 0)],
    ["Meilleur net", meilleur ? () => onChange(avecRemuneration(options, meilleur.remunerationNette)) : null],
    ["Meilleur net avec 4 trimestres", meilleurAvecRetraite ? () => onChange(avecRemuneration(options, meilleurAvecRetraite.remunerationNette)) : null]
  ]
  return (
    <div className="flex flex-wrap gap-2 print:hidden" role="group" aria-label="Répartitions toutes faites">
      {raccourcis.map(([libelle, action]) => (
        <Button key={libelle} variant="outline" size="sm" className="min-h-9 pointer-coarse:min-h-11" disabled={!action} onClick={action ?? undefined}>
          {libelle}
        </Button>
      ))}
    </div>
  )
}

/** Ce que montre la barre, en une phrase : rémunération et part distribuée, en direct pendant qu'on fait glisser. */
function Lecture({ partage, part, personnalisee }: { partage: PartageDuBenefice; part: number; personnalisee: boolean }) {
  return (
    <p className="text-sm text-slate-700 dark:text-slate-200" aria-live="polite">
      <span className="font-medium">{euros(partage.remunerationNette)}</span> de rémunération nette,{" "}
      {personnalisee ? (
        <>
          <span className="font-medium">{pourcentage(part)}</span> du bénéfice distribuable en dividendes ({euros(dividendesVerses(partage))}), {euros(Math.max(0, partage.resultatConserve))} conservés.
        </>
      ) : (
        <>{euros(dividendesVerses(partage))} de dividendes, {euros(Math.max(0, partage.resultatConserve))} conservés.</>
      )}
    </p>
  )
}

/**
 * Partage du bénéfice de l'activité dans un statut de société. En répartition personnalisée, la barre se règle :
 * l'aperçu suit le pointeur, et le comparateur recalcule au relâchement.
 */
/** Le partage simulé diffère-t-il des réglages demandés (le moteur n'a pas encore recalculé) ? */
function differe(partage: PartageDuBenefice, remuneration: number, part: number): boolean {
  if (Math.abs(partage.remunerationNette - remuneration) >= 1) return true
  return dividendesVerses(partage) + partage.resultatConserve > 0 && Math.abs(partDistribueeDe(partage) - part) > 0.001
}

/**
 * Réglages affichés par la barre : ceux d'un glissement en cours, sinon ceux du comparateur. En répartition
 * personnalisée, la barre montre ces réglages, estimés tant que le moteur n'a pas recalculé.
 */
function useApercu(partage: PartageDuBenefice | undefined, options: ComparaisonOptions, remunerationMaximale: number | null) {
  const [glissement, setGlissement] = useState<Glissement | null>(null)
  const remuneration = glissement?.poignee === "remuneration" ? glissement.valeur : options.remunerationNette
  const part = glissement?.poignee === "part" ? glissement.valeur : options.repartition.partDistribuee
  if (!partage || remunerationMaximale === null) return { glissement, setGlissement, remuneration, part, affiche: partage, estimation: false }
  return { glissement, setGlissement, remuneration, part, affiche: apercuDuPartage(partage, remunerationMaximale, remuneration, part), estimation: differe(partage, remuneration, part) }
}

export function RepartitionDuBenefice({ activityName, statut, onStatut, scenario, optimisation, options, onChange }: RepartitionProps) {
  const personnalisee = options.repartition.mode === "personnalisee"
  const optimisationAJour = optimisation?.statut === statut ? optimisation : null
  const remunerationMaximale = personnalisee && optimisationAJour ? optimisationAJour.remunerationMaximale : null
  const { glissement, setGlissement, remuneration, part, affiche, estimation } = useApercu(scenario?.partage, options, remunerationMaximale)

  const valider = ({ poignee, valeur }: Glissement) => onChange(poignee === "remuneration" ? { ...options, remunerationNette: valeur } : { ...options, repartition: { mode: "personnalisee", partDistribuee: valeur } })

  return (
    <section aria-labelledby="repartition-titre" className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="repartition-titre" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Partage du bénéfice en {statut}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {libellesRepartition[options.repartition.mode]}{options.repartition.mode === "meilleurNet" ? ` : la rémunération optimale en ${statut}, tout le reste en dividendes` : ""}. Le bénéfice de « {activityName} » avant rémunération (chiffre d'affaires moins charges et frais), partagé exactement entre ces postes ; l'impôt sur le revenu et les prélèvements sociaux du foyer viennent ensuite.
          </p>
        </div>
        <ChoixDuStatut statut={statut} onChange={onStatut} />
      </div>

      {affiche && affiche.beneficeAvantRemuneration > 0 ? (
        <>
          <Lecture partage={affiche} part={part} personnalisee={personnalisee} />
          {personnalisee ? <p className="text-sm text-slate-600 dark:text-slate-300 print:hidden">Faites glisser les poignées, ou réglez-les au clavier : la première fixe la rémunération nette, la seconde la part du bénéfice distribuable versée en dividendes, le reste étant conservé.</p> : null}
          <Barre partage={affiche} remunerationMaximale={remunerationMaximale} remuneration={remuneration} part={part} glissement={glissement} onGlisser={setGlissement} onValider={valider} />
          <Deficit partage={affiche} />
          {personnalisee && optimisationAJour ? <Raccourcis optimisation={optimisationAJour} options={options} onChange={onChange} /> : null}
          <Legende partage={affiche} statut={statut} estimation={estimation} />
        </>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">{affiche ? `Sans rémunération, l'activité ne dégage aucun bénéfice en ${statut} : il n'y a rien à partager.` : "Calcul en cours…"}</p>
      )}
    </section>
  )
}

function Deficit({ partage }: { partage: PartageDuBenefice }) {
  if (partage.resultatConserve >= -0.5) return null
  return <p className="text-sm text-amber-800 dark:text-amber-200">La rémunération, cotisations comprises, dépasse le bénéfice de {euros(-partage.resultatConserve)} : la société est déficitaire.</p>
}
