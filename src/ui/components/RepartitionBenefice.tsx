// src/ui/components/RepartitionBenefice.tsx
// Partage du bénéfice d'une société dans le comparateur : barre empilée du bénéfice avant rémunération, avec deux
// poignées à faire glisser (rémunération, part distribuée) et des répartitions toutes faites.

import { useEffect, useRef, useState, type PointerEvent } from "react"
import { Button } from "@/components/ui/button"
import { avecRemuneration, libellesRepartition } from "@/lib/comparateur-options"
import { apercuDuPartage, auPas, coutRemuneration, dividendesVerses, libellesPostes, PAS_PART, PAS_REMUNERATION, partDistribueeDe, POSTES, postesArrondis, remunerationPourUnCout, type PosteDuPartage, reglageDeLaBarre } from "@/lib/repartition-benefice"
import { cn } from "@/lib/utils"
import type { ComparaisonOptions, OptimisationRemuneration, PartageDuBenefice, ReservesDeLaSociete, ScenarioStatut, StatutSociete } from "@/types"
import { clavierDuCurseur, gestesDuCurseur, montantAuPointeur, type Glissement as GlissementDuCurseur } from "../curseur"
import { PoigneeDeCurseur } from "./Curseur"
import { ChoixDuStatut } from "./RemunerationOptimizer"
import { euros } from "@/backend/logic/format"

const pourcentage = (part: number) => `${Math.round(part * 100)} %`

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

type Glissement = GlissementDuCurseur<Poignee>

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
  // Des dividendes pris sur les réserves dépassent le bénéfice de l'année : la barre s'élargit pour les montrer.
  const echelle = Math.max(1, partage.beneficeAvantRemuneration, POSTES.reduce((somme, poste) => somme + Math.max(0, partage[poste]), 0))
  const cout = coutRemuneration(partage)
  const avantDividendes = cout + partage.impotSocietes
  const distribuable = Math.max(0, partage.beneficeAvantRemuneration - avantDividendes)
  const modifiable = remunerationMaximale !== null

  const valeurAuPointeur = (poignee: Poignee, clientX: number): number => {
    const montant = montantAuPointeur(ref.current!, clientX, echelle)
    if (poignee === "remuneration") return auPas(remunerationPourUnCout(partage, remunerationMaximale ?? 0, montant), PAS_REMUNERATION, 0, remunerationMaximale ?? 0)
    return distribuable > 0 ? auPas((montant - avantDividendes) / distribuable, PAS_PART, 0, 1) : part
  }
  /** La poignée saisie, ou la plus proche du point cliqué sur la barre. */
  const poigneeVisee = (e: PointerEvent<HTMLDivElement>): Poignee => {
    const saisie = (e.target as HTMLElement).closest<HTMLElement>("[data-poignee]")?.dataset.poignee
    if (saisie === "remuneration" || saisie === "part") return saisie
    const montant = montantAuPointeur(ref.current!, e.clientX, echelle)
    return distribuable > 0 && Math.abs(montant - (avantDividendes + dividendesVerses(partage))) < Math.abs(montant - cout) ? "part" : "remuneration"
  }

  const gestes = gestesDuCurseur<Poignee>({ actif: modifiable, glissement, onGlisser, onValider, poigneeVisee, valeurAuPointeur })
  const auClavier = (poignee: Poignee) =>
    poignee === "remuneration" ? clavierDuCurseur(remuneration, { min: 0, max: remunerationMaximale ?? 0, pas: PAS_REMUNERATION, grandPas: 1000 }, valeur => onValider({ poignee, valeur })) : clavierDuCurseur(part, { min: 0, max: 1, pas: PAS_PART, grandPas: 0.25 }, valeur => onValider({ poignee, valeur }))

  let debut = 0
  return (
    <div>
      <div ref={ref} className={cn("relative py-2.5", modifiable && "cursor-pointer touch-none")} {...gestes}>
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
            <PoigneeDeCurseur nom="remuneration" position={cout / echelle} libelle="Rémunération nette du dirigeant" valeur={remuneration} max={remunerationMaximale ?? 0} texte={`${euros(remuneration)} de rémunération nette`} onClavier={auClavier("remuneration")} />
            {distribuable > 0 ? <PoigneeDeCurseur nom="part" position={(avantDividendes + part * distribuable) / echelle} libelle="Part du bénéfice distribuable versée en dividendes" valeur={Math.round(part * 100)} max={100} texte={`${pourcentage(part)} du bénéfice distribuable en dividendes, ${pourcentage(1 - part)} ajoutés aux réserves`} onClavier={auClavier("part")} /> : null}
          </>
        ) : null}
      </div>
      <Montants affiche={affiche} echelle={echelle} largeur={largeur} />
    </div>
  )
}

/**
 * Libellé d'un poste dans la légende : une part négative des réserves dit d'où elle vient, dividendes pris sur les
 * réserves des années précédentes ou déficit de l'année.
 */
function libelleDuPoste(poste: PosteDuPartage, partage: PartageDuBenefice): string {
  if (poste !== "resultatConserve" || partage.resultatConserve >= 0) return libellesPostes[poste]
  return partage.resultatConserve + dividendesVerses(partage) >= 0 ? "Pris sur les réserves" : "Déficit de l'année"
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
              {libelleDuPoste(poste, partage)}
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
          <span className="font-medium">{pourcentage(part)}</span> du bénéfice distribuable en dividendes ({euros(dividendesVerses(partage))}), {euros(Math.max(0, partage.resultatConserve))} ajoutés aux réserves.
        </>
      ) : (
        <>{euros(dividendesVerses(partage))} de dividendes, {euros(Math.max(0, partage.resultatConserve))} ajoutés aux réserves.</>
      )}
    </p>
  )
}

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

/**
 * Partage du bénéfice de l'activité dans un statut de société. En répartition personnalisée, la barre se règle :
 * l'aperçu suit le pointeur, et le comparateur recalcule au relâchement.
 */
export function RepartitionDuBenefice({ activityName, statut, onStatut, scenario, optimisation, options, onChange }: RepartitionProps) {
  const { personnalisee, optimisationReglable, remunerationMaximale } = reglageDeLaBarre(options, optimisation, statut)
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
          {personnalisee ? <p className="text-sm text-slate-600 dark:text-slate-300 print:hidden">Faites glisser les poignées, ou réglez-les au clavier : la première fixe la rémunération nette, la seconde la part du bénéfice distribuable versée en dividendes, le reste étant ajouté aux réserves de la société.</p> : null}
          <Barre partage={affiche} remunerationMaximale={remunerationMaximale} remuneration={remuneration} part={part} glissement={glissement} onGlisser={setGlissement} onValider={valider} />
          <Deficit partage={affiche} />
          <Reserves reserves={scenario?.reserves} estimation={estimation} />
          {optimisationReglable ? <Raccourcis optimisation={optimisationReglable} options={options} onChange={onChange} /> : null}
          <Legende partage={affiche} statut={statut} estimation={estimation} />
        </>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">{affiche ? `Sans rémunération, l'activité ne dégage aucun bénéfice en ${statut} : il n'y a rien à partager.` : "Calcul en cours…"}</p>
      )}
    </section>
  )
}

function Deficit({ partage }: { partage: PartageDuBenefice }) {
  // Les dividendes pris sur les réserves des années précédentes ne rendent pas la société déficitaire.
  const resultat = partage.resultatConserve + dividendesVerses(partage)
  if (resultat >= -0.5) return null
  return <p className="text-sm text-amber-800 dark:text-amber-200">La rémunération, cotisations comprises, dépasse le bénéfice de {euros(-resultat)} : la société est déficitaire.</p>
}

/**
 * Les réserves de la société au 31 décembre, cumulées depuis le début de la simulation, et les dividendes de l'année
 * pris sur celles des années précédentes (voir l'ADR 014). Rien tant que le moteur n'a pas recalculé.
 */
function Reserves({ reserves, estimation }: { reserves: ReservesDeLaSociete | undefined; estimation: boolean }) {
  if (!reserves || estimation) return null
  const { aLaFin, auDebut, dividendesPrisSurLesReserves } = reserves
  if (Math.abs(aLaFin.reserves) < 0.5 && Math.abs(auDebut.reserves) < 0.5) return null
  const prises = dividendesPrisSurLesReserves >= 0.5 ? `, après ${euros(dividendesPrisSurLesReserves)} de dividendes pris sur les réserves des années précédentes` : ""
  const montant = aLaFin.reserves < 0 ? `des pertes de ${euros(-aLaFin.reserves)} à combler` : euros(aLaFin.reserves)
  return (
    <p className="text-sm text-slate-700 dark:text-slate-200">
      Réserves de la société au 31 décembre : <span className="font-medium">{montant}</span> (au 1er janvier : {euros(auDebut.reserves)}{prises}).
    </p>
  )
}
