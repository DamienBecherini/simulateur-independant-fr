// src/ui/components/EncartDesQuestions.tsx
// « Que voulez-vous savoir ? » : au-dessus d'une simulation vide ou de l'exemple du premier lancement, les questions
// avec lesquelles on arrive. Chacune charge sa situation type, avec la même confirmation que la fenêtre des situations
// types, ou mène à la section qui y répond ; « Partir de zéro » donne une simulation vierge et porte le focus sur
// l'ajout d'une personne. L'encart se ferme, et ne revient plus (préférence de l'utilisateur).
//
// Sur un téléphone, les questions tiennent sur deux colonnes, sans leur précision (toujours lue comme description).

import { useId, useRef, useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { lienVers, type Ancre } from "@/lib/ancres"
import type { MontageType } from "@/lib/montages/montages"
import { ID_DE_L_AJOUT_D_UNE_PERSONNE, QUESTIONS_DE_DEPART, type QuestionDeDepart } from "@/lib/questions-de-depart"
import { ConfirmationDeRemplacement } from "./ConfirmationDeRemplacement"
import { ConfirmationDuMontage } from "./MontagesTypes"

const TITRE_DE_L_ENCART = "Que voulez-vous savoir ?"

interface EncartDesQuestionsProps {
  /** Charge une situation type (la confirmation a déjà eu lieu si elle était nécessaire). */
  onCharger: (montage: MontageType) => void
  /** Remplace la simulation par une simulation vierge et affiche la saisie ; le focus est porté ensuite sur l'ajout d'une personne. */
  onPartirDeZero: () => void
  /** Ferme l'encart pour de bon. */
  onFermer: () => void
  /** La simulation en cours serait perdue : charger une situation ou partir de zéro demande d'abord une confirmation. */
  confirmationNecessaire: boolean
  nomDeLaSession: string
}

const CHOIX = "flex h-full min-h-11 w-full flex-col items-start justify-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-800 dark:hover:bg-slate-800"

/** Le texte d'un choix : la question, et sa précision, cachée sur un téléphone mais toujours lue comme description. */
function TexteDuChoix({ id, question, precision }: { id: string; question: string; precision: string }) {
  return (
    <>
      <span id={`${id}-question`} className="font-medium text-slate-900 dark:text-slate-50">
        {question}
      </span>
      <span id={`${id}-precision`} className="text-xs text-slate-600 max-sm:hidden dark:text-slate-300">
        {precision}
      </span>
    </>
  )
}

/** Un choix de l'encart : un bouton qui agit, ou un lien vers la section qui répond. */
function Choix({ question, precision, action }: { question: string; precision: string; action: ((declencheur: HTMLElement) => void) | Ancre }) {
  const id = useId()
  const texte: ReactNode = <TexteDuChoix id={id} question={question} precision={precision} />
  const noms = { "aria-labelledby": `${id}-question`, "aria-describedby": `${id}-precision` }
  if (typeof action === "string") {
    return (
      <a href={lienVers(action)} className={CHOIX} {...noms}>
        {texte}
      </a>
    )
  }
  return (
    <button type="button" className={CHOIX} onClick={e => action(e.currentTarget)} {...noms}>
      {texte}
    </button>
  )
}

/** Porte le focus sur l'ajout d'une personne, une fois la saisie affichée. */
function allerALaSaisie() {
  requestAnimationFrame(() => document.getElementById(ID_DE_L_AJOUT_D_UNE_PERSONNE)?.focus())
}

export function EncartDesQuestions({ onCharger, onPartirDeZero, onFermer, confirmationNecessaire, nomDeLaSession }: EncartDesQuestionsProps) {
  const titre = useId()
  const [montageAConfirmer, setMontageAConfirmer] = useState<MontageType | null>(null)
  const [zeroAConfirmer, setZeroAConfirmer] = useState(false)
  // Le choix qui a demandé la confirmation : « Annuler » y ramène le focus.
  const declencheur = useRef<HTMLElement | null>(null)

  const charger = (montage: MontageType) => {
    setMontageAConfirmer(null)
    onCharger(montage)
  }
  const demanderLeChargement = (montage: MontageType, bouton: HTMLElement) => {
    if (!confirmationNecessaire) return charger(montage)
    declencheur.current = bouton
    setMontageAConfirmer(montage)
  }
  const demanderLaSimulationVierge = (bouton: HTMLElement) => {
    if (!confirmationNecessaire) {
      onPartirDeZero()
      return allerALaSaisie()
    }
    declencheur.current = bouton
    setZeroAConfirmer(true)
  }
  const partirDeZero = () => {
    setZeroAConfirmer(false)
    onPartirDeZero()
    // La confirmation, en se fermant, rend le focus à son déclencheur : ce sera l'ajout d'une personne.
    declencheur.current = document.getElementById(ID_DE_L_AJOUT_D_UNE_PERSONNE)
  }

  const actionDeLaQuestion = (question: QuestionDeDepart) => ("ancre" in question ? question.ancre : (bouton: HTMLElement) => demanderLeChargement(question.montage, bouton))

  return (
    <section id="que-voulez-vous-savoir" aria-labelledby={titre} className="print:hidden mx-auto mb-6 w-full max-w-4xl rounded-lg border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id={titre} className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            {TITRE_DE_L_ENCART}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">Choisissez votre question : une situation type proche se charge, à adapter ensuite à vos chiffres.</p>
        </div>
        <Button variant="ghost" size="icon" aria-label={`Fermer « ${TITRE_DE_L_ENCART} »`} title="Fermer : l'encart ne reviendra pas" onClick={onFermer} className="-mt-1 -mr-1 shrink-0 pointer-coarse:size-11">
          <X />
        </Button>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
        {QUESTIONS_DE_DEPART.map(question => (
          <li key={question.question}>
            <Choix question={question.question} precision={question.precision} action={actionDeLaQuestion(question)} />
          </li>
        ))}
        <li>
          <Choix question="Partir de zéro" precision="Une simulation vierge : vos personnes, vos activités, vos montants." action={demanderLaSimulationVierge} />
        </li>
      </ul>

      <ConfirmationDuMontage montage={montageAConfirmer} nomDeLaSession={nomDeLaSession} onAnnuler={() => setMontageAConfirmer(null)} onConfirmer={charger} declencheur={declencheur} />
      <ConfirmationDeRemplacement open={zeroAConfirmer} onAnnuler={() => setZeroAConfirmer(false)} onConfirmer={partirDeZero} titre="Remplacer la simulation en cours ?" libelleDeConfirmation="Remplacer" declencheur={declencheur}>
        « {nomDeLaSession} » n'est pas enregistrée dans une sauvegarde. Une simulation vierge la remplacera ; le bouton « Annuler » de la barre d'outils la rétablira.
      </ConfirmationDeRemplacement>
    </section>
  )
}
