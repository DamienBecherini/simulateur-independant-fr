// src/ui/components/BibliothequeDuDepart.tsx
// « Par où commencer ? » : la bibliothèque des situations types, par ses deux entrées. L'onglet « Questions » liste les
// questions auxquelles répond chaque situation (src/lib/montages/montages.ts) ; l'onglet « Situations types », les
// situations en cartes. La recherche et les filtres (statut, foyer : src/lib/montages/filtres.ts) valent pour les deux
// onglets. Une question montre sa situation : un clic sur son nom passe à l'onglet des situations, où sa carte est mise
// en avant. « Charger » charge la situation, puis mène à la zone de la page qui répond à la question.
//
// Partagée par la fenêtre (MontagesTypes.tsx) et par le bloc affiché dans la page au premier lancement
// (ParOuCommencer.tsx). Dans la démo web, chaque carte donne aussi le lien qui ouvre la situation (#situation=…).

import { useId, useState, type KeyboardEvent } from "react"
import { Check, ChevronLeft, Link, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Ancre } from "@/lib/ancres"
import { AUCUN_CRITERE, criteresActifs, filtrerLesMontages, filtrerLesQuestions, FILTRES_DE_FOYER, FILTRES_DE_STATUT, questionsDesMontages, type CriteresDesMontages, type QuestionTrouvee } from "@/lib/montages/filtres"
import { MONTAGES_TYPES, type MontageType } from "@/lib/montages/montages"
import type { EtatDeLaBibliotheque, OngletDuDepart } from "../depart"
import { usePlateforme } from "../plateforme"

const NOMBRE_DE_QUESTIONS = questionsDesMontages(MONTAGES_TYPES).length

const ONGLETS: { valeur: OngletDuDepart; libelle: string; nombre: number }[] = [
  { valeur: "questions", libelle: "Questions", nombre: NOMBRE_DE_QUESTIONS },
  { valeur: "situations", libelle: "Situations types", nombre: MONTAGES_TYPES.length }
]

export function Etiquettes({ etiquettes }: { etiquettes: string[] }) {
  return (
    <ul aria-label="Mots-clés" className="flex flex-wrap gap-1.5">
      {etiquettes.map(etiquette => (
        <li key={etiquette} className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-100">
          {etiquette}
        </li>
      ))}
    </ul>
  )
}

interface CarteDuMontageProps {
  montage: MontageType
  onDetails: () => void
  onCharger: () => void
  /** Retour du détail de cette situation : le focus revient sur « Détails ». */
  focusSurLesDetails: boolean
  /** La situation d'une question suivie : la carte est mise en avant, et le focus est sur « Charger ». */
  miseEnAvant: boolean
  /** Copie le lien de la situation ; absent sans lien à partager (application de bureau). */
  onCopierLeLien?: () => void
  /** Le lien de cette situation vient d'être copié. */
  lienCopie: boolean
}

function CarteDuMontage({ montage, onDetails, onCharger, focusSurLesDetails, miseEnAvant, onCopierLeLien, lienCopie }: CarteDuMontageProps) {
  return (
    <li className={cn("flex flex-col gap-3 rounded-lg border bg-slate-50 p-4 dark:bg-gray-900", miseEnAvant && "border-2 border-blue-500 ring-4 ring-blue-500/20 dark:border-blue-400")}>
      <h3 className="font-semibold">{montage.titre}</h3>
      <p className="text-sm text-slate-700 dark:text-slate-300">{montage.resume}</p>
      <Etiquettes etiquettes={montage.etiquettes} />
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onDetails} autoFocus={focusSurLesDetails} aria-label={`Détails de la situation « ${montage.titre} »`}>
          Détails
        </Button>
        <Button size="sm" onClick={onCharger} autoFocus={miseEnAvant} aria-label={`Charger la situation « ${montage.titre} »`}>
          Charger
        </Button>
        {onCopierLeLien ? (
          <Button variant="ghost" size="sm" onClick={onCopierLeLien} aria-label={`Copier le lien de la situation « ${montage.titre} »`}>
            {lienCopie ? <Check aria-hidden /> : <Link aria-hidden />}
            {lienCopie ? "Lien copié" : "Copier le lien"}
          </Button>
        ) : null}
      </div>
    </li>
  )
}

/** Résultat de la dernière copie d'un lien, lu par les lecteurs d'écran. */
type EtatDeLaCopie = { identifiant: string; message: string; erreur: boolean } | null

/** La copie du lien d'une situation ; `copier` est absent sans lien à partager (application de bureau). */
function useCopieDuLien() {
  const { lienVersUneSituation } = usePlateforme()
  const [etat, setEtat] = useState<EtatDeLaCopie>(null)
  const copierLeLien = async (montage: MontageType, lien: string) => {
    try {
      await navigator.clipboard.writeText(lien)
      setEtat({ identifiant: montage.id, message: `Lien de « ${montage.titre} » copié : ${lien}`, erreur: false })
    } catch {
      setEtat({ identifiant: montage.id, message: `La copie a échoué : sélectionnez le lien pour le copier, ${lien}`, erreur: true })
    }
  }
  const copier = lienVersUneSituation ? (montage: MontageType) => void copierLeLien(montage, lienVersUneSituation(montage.id)) : undefined
  return { etat, copier }
}

const PUCE = "inline-flex h-8 cursor-pointer items-center rounded-full border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
const PUCE_COCHEE = "border-slate-900 bg-slate-900 text-white hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
const LIEN = "cursor-pointer rounded-sm text-blue-700 underline underline-offset-2 hover:no-underline dark:text-blue-300"

/** Un axe de filtres à cocher : plusieurs choix s'ajoutent, aucun ne filtre pas. */
function PucesDeFiltre<T extends string>({ titre, choix, coches, onChange }: { titre: string; choix: { valeur: T; libelle: string }[]; coches: T[]; onChange: (coches: T[]) => void }) {
  return (
    <div role="group" aria-label={titre} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-sm text-slate-600 dark:text-slate-400">{titre}</span>
      {choix.map(({ valeur, libelle }) => {
        const coche = coches.includes(valeur)
        return (
          <button key={valeur} type="button" aria-pressed={coche} className={cn(PUCE, coche && PUCE_COCHEE)} onClick={() => onChange(coche ? coches.filter(c => c !== valeur) : [...coches, valeur])}>
            {libelle}
          </button>
        )
      })}
    </div>
  )
}

/** Le nombre trouvé, dit avec son unité : « 12 questions sur 36 », « Aucune situation ne correspond. » */
function nombreTrouve(onglet: OngletDuDepart, trouvees: number): string {
  const [unite, total, aucune] = onglet === "questions" ? ["question", NOMBRE_DE_QUESTIONS, "Aucune question ne correspond."] : ["situation", MONTAGES_TYPES.length, "Aucune situation ne correspond."]
  return trouvees === 0 ? aucune : `${trouvees} ${unite}${trouvees > 1 ? "s" : ""} sur ${total}`
}

/** La recherche et les filtres, communs aux deux onglets, puis le nombre trouvé tant qu'un critère restreint la liste. */
function Filtres({ onglet, criteres, onChange, trouvees }: { onglet: OngletDuDepart; criteres: CriteresDesMontages; onChange: (criteres: CriteresDesMontages) => void; trouvees: number }) {
  const questions = onglet === "questions"
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
        <Input
          type="search"
          aria-label={questions ? "Rechercher une question" : "Rechercher une situation"}
          placeholder="Rechercher : dividendes, retraite, kiné…"
          title={questions ? "Rechercher dans les questions et le nom de leur situation" : "Rechercher dans les titres, les résumés et les mots-clés"}
          className="pl-9"
          value={criteres.recherche}
          onChange={evenement => onChange({ ...criteres, recherche: evenement.target.value })}
        />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <PucesDeFiltre titre="Statut" choix={FILTRES_DE_STATUT} coches={criteres.statuts} onChange={statuts => onChange({ ...criteres, statuts })} />
        <PucesDeFiltre titre="Foyer" choix={FILTRES_DE_FOYER} coches={criteres.foyers} onChange={foyers => onChange({ ...criteres, foyers })} />
      </div>
      {/* Annoncé aux lecteurs d'écran à chaque changement ; vide sans critère, pour ne rien ajouter. */}
      <p aria-live="polite" className="flex min-h-6 flex-wrap items-center gap-x-3 text-sm text-slate-700 dark:text-slate-300">
        {criteresActifs(criteres) ? (
          <>
            <span>{nombreTrouve(onglet, trouvees)}</span>
            <button type="button" className={cn(LIEN, "inline-flex min-h-6 items-center pointer-coarse:min-h-11")} onClick={() => onChange(AUCUN_CRITERE)}>
              Tout afficher
            </button>
          </>
        ) : null}
      </p>
    </div>
  )
}

/** Les deux onglets, au motif « onglets » des WAI-ARIA : flèches, Début et Fin, un seul onglet dans l'ordre de tabulation. */
function Onglets({ id, onglet, onChoisir }: { id: string; onglet: OngletDuDepart; onChoisir: (onglet: OngletDuDepart) => void }) {
  const auClavier = (e: KeyboardEvent<HTMLButtonElement>) => {
    const rang = ONGLETS.findIndex(o => o.valeur === onglet)
    const cible = { ArrowRight: rang + 1, ArrowLeft: rang - 1, Home: 0, End: ONGLETS.length - 1 }[e.key]
    if (cible === undefined) return
    e.preventDefault()
    const suivant = ONGLETS[(cible + ONGLETS.length) % ONGLETS.length].valeur
    onChoisir(suivant)
    document.getElementById(`${id}-onglet-${suivant}`)?.focus()
  }
  return (
    <div role="tablist" aria-label="Par où commencer" className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
      {ONGLETS.map(({ valeur, libelle, nombre }) => {
        const choisi = valeur === onglet
        return (
          <button
            key={valeur}
            type="button"
            role="tab"
            id={`${id}-onglet-${valeur}`}
            aria-selected={choisi}
            aria-controls={`${id}-panneau`}
            tabIndex={choisi ? 0 : -1}
            onClick={() => onChoisir(valeur)}
            onKeyDown={auClavier}
            className={cn(
              "-mb-px min-h-10 cursor-pointer border-b-2 px-3 text-sm font-medium pointer-coarse:min-h-11",
              choisi ? "border-blue-600 text-slate-950 dark:border-blue-400 dark:text-white" : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            )}
          >
            {libelle} <span className="font-normal text-slate-600 dark:text-slate-400">{nombre}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Une question : son texte, le nom de sa situation (qui mène à sa carte), et « Charger ». */
function QuestionDeLaListe({ trouvee, onVoirLaSituation, onCharger }: { trouvee: QuestionTrouvee; onVoirLaSituation: () => void; onCharger: () => void }) {
  const { question, montage } = trouvee
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-slate-50 px-3.5 py-2.5 dark:bg-slate-950">
      <div className="min-w-0 flex-[1_1_18rem]">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{question.texte}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Situation type :{" "}
          <button type="button" className={cn(LIEN, "inline-flex min-h-6 items-center text-left pointer-coarse:min-h-11")} onClick={onVoirLaSituation} aria-label={`Voir la situation « ${montage.titre} »`}>
            {montage.titre}
          </button>
        </p>
      </div>
      <Button size="sm" onClick={onCharger} aria-label={`Charger la situation qui répond à « ${question.texte} »`}>
        Charger
      </Button>
    </li>
  )
}

interface BibliothequeDuDepartProps {
  etat: EtatDeLaBibliotheque
  onEtat: (etat: EtatDeLaBibliotheque) => void
  /** Charge la situation ; `reponse` : la zone de la page qui répond à la question dont elle vient. */
  onCharger: (montage: MontageType, reponse?: Ancre) => void
  onDetails: (montage: MontageType) => void
  /** Dans la page : la liste a une hauteur limitée et défile (la fenêtre défile déjà toute entière). */
  listeBornee?: boolean
}

export function BibliothequeDuDepart({ etat, onEtat, onCharger, onDetails, listeBornee = false }: BibliothequeDuDepartProps) {
  const id = useId()
  const { onglet, criteres, questionSuivie, montageVu } = etat
  const { etat: copie, copier } = useCopieDuLien()
  const questions = filtrerLesQuestions(MONTAGES_TYPES, criteres)
  const montages = filtrerLesMontages(MONTAGES_TYPES, criteres)
  const choisir = (suivant: OngletDuDepart) => onEtat({ ...etat, onglet: suivant, questionSuivie: suivant === "questions" ? null : questionSuivie })
  const borne = listeBornee ? "max-h-80 overflow-y-auto pr-1" : undefined
  return (
    <div className="space-y-3">
      <Onglets id={id} onglet={onglet} onChoisir={choisir} />
      <Filtres onglet={onglet} criteres={criteres} onChange={suivants => onEtat({ ...etat, criteres: suivants })} trouvees={onglet === "questions" ? questions.length : montages.length} />
      <div role="tabpanel" id={`${id}-panneau`} aria-labelledby={`${id}-onglet-${onglet}`} className="space-y-3">
        {onglet === "questions" ? (
          <ul aria-label="Questions" className={cn("space-y-1.5", borne)}>
            {questions.map(trouvee => (
              <QuestionDeLaListe
                key={`${trouvee.montage.id}:${trouvee.question.texte}`}
                trouvee={trouvee}
                onVoirLaSituation={() => onEtat({ ...etat, onglet: "situations", questionSuivie: trouvee })}
                onCharger={() => onCharger(trouvee.montage, trouvee.question.reponse)}
              />
            ))}
          </ul>
        ) : (
          <>
            {questionSuivie ? (
              <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-slate-700 dark:text-slate-300">
                <button type="button" className={cn(LIEN, "inline-flex min-h-6 items-center gap-0.5 pointer-coarse:min-h-11")} onClick={() => choisir("questions")}>
                  <ChevronLeft aria-hidden className="size-4" />
                  Retour aux questions
                </button>
                <span>· La situation qui répond à « {questionSuivie.question.texte} »</span>
              </p>
            ) : null}
            <ul aria-label="Situations types" className={cn("grid gap-3 sm:grid-cols-2", borne)}>
              {montages.map(montage => {
                const suivie = questionSuivie?.montage.id === montage.id
                return (
                  <CarteDuMontage
                    key={montage.id}
                    montage={montage}
                    onDetails={() => onDetails(montage)}
                    onCharger={() => onCharger(montage, suivie ? questionSuivie?.question.reponse : undefined)}
                    focusSurLesDetails={montage.id === montageVu}
                    miseEnAvant={suivie}
                    onCopierLeLien={copier && (() => copier(montage))}
                    lienCopie={copie?.identifiant === montage.id && !copie.erreur}
                  />
                )
              })}
            </ul>
            {copier ? (
              <p role="status" className={cn("min-h-5 text-sm break-all", copie?.erreur ? "text-red-700 dark:text-red-400" : "text-emerald-800 dark:text-emerald-300")}>
                {copie?.message}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
