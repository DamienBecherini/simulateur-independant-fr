// src/ui/components/NotesDuComparateur.tsx
// Les notes du tableau de comparaison : chaque avertissement d'un statut, numéroté (voir src/lib/notes.ts).
//
// Dans le tableau, l'en-tête d'une colonne porte les pastilles de ses notes. Un clic sur une pastille ouvre la note
// dans une bulle, à côté d'elle, sans quitter le tableau des yeux ; un clic ailleurs, Échap ou un second clic la ferme.
// La bulle est posée dans la page : elle défile avec elle, ce qui permet de lire une note plus longue que l'écran.
// C'est le même geste dans tous les affichages.
//
// Sous le tableau, l'affichage « Résumé » garde écrites les notes du statut actuel, qui parlent de la situation réelle
// (société déficitaire, conditions d'une exonération non vérifiées), et réduit celles des autres statuts à une ligne de
// pastilles : un clic en affiche la note, seule. « Tout afficher » rend la liste complète, et ce choix est retenu.
// L'affichage « Classique » montre toujours la liste complète, comme l'impression, qui n'a pas de clic.

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react"
import type { Note } from "@/lib/notes"
import { cn } from "@/lib/utils"
import { useAffichageResume } from "../hooks/useAffichage"
import { useSectionOuverte } from "../hooks/useSectionOuverte"
import { BULLE_AMBRE, BullePosee } from "./Bulle"

const PASTILLE = "inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100"
/** Pastille sur laquelle on clique (44 px au doigt) ; un contour marque celle dont la note est affichée. */
const PASTILLE_CLIQUABLE = cn(PASTILLE, "cursor-pointer hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 pointer-coarse:h-11 pointer-coarse:min-w-11 dark:hover:bg-amber-800 dark:focus-visible:outline-amber-300")
const PASTILLE_RETENUE = "ring-2 ring-amber-700 dark:ring-amber-300"
const LIEN = "inline-flex min-h-6 cursor-pointer items-center rounded-sm text-blue-700 underline underline-offset-2 hover:text-blue-900 pointer-coarse:min-h-11 dark:text-blue-400 dark:hover:text-blue-300"

/** Ce que dit une note : les colonnes concernées, puis son texte. */
function TexteDeLaNote({ note }: { note: Note }) {
  return (
    <>
      <span className="font-medium">{note.colonnes.join(", ")} :</span> {note.texte}
    </>
  )
}

/** Une note écrite : sa pastille, puis son texte. */
function NoteEcrite({ note }: { note: Note }) {
  return (
    <>
      <span aria-hidden="true" className={PASTILLE}>
        {note.numero}
      </span>
      <p>
        <span className="sr-only">Note {note.numero}. </span>
        <TexteDeLaNote note={note} />
      </p>
    </>
  )
}

// ===================================================================================
// == LA BULLE D'UNE PASTILLE DU TABLEAU
// ===================================================================================

interface BulleOuverte {
  /** La pastille qui a ouvert la bulle : une même note a une pastille par colonne concernée. */
  cle: string
  numero: number
  ancre: HTMLElement
}

interface Bulles {
  cleOuverte: string | null
  idDeLaBulle: string
  basculer: (bulle: BulleOuverte) => void
}

const BullesContext = createContext<Bulles | null>(null)

/** Porte la bulle ouverte, une seule à la fois, pour les pastilles du tableau qu'il entoure. */
export function BullesDesNotes({ notes, children }: { notes: Note[]; children: ReactNode }) {
  const [ouverte, setOuverte] = useState<BulleOuverte | null>(null)
  const idDeLaBulle = `${useId()}-note`
  const fermer = useCallback(() => setOuverte(null), [])
  const basculer = useCallback((bulle: BulleOuverte) => setOuverte(actuelle => (actuelle?.cle === bulle.cle ? null : bulle)), [])
  // Un nouveau calcul peut retirer la note, ou la colonne de sa pastille : la bulle disparaît avec elles.
  const note = ouverte?.ancre.isConnected ? notes.find(n => n.numero === ouverte.numero) : undefined
  const bulles = useMemo(() => ({ cleOuverte: note && ouverte ? ouverte.cle : null, idDeLaBulle, basculer }), [note, ouverte, idDeLaBulle, basculer])
  return (
    <BullesContext.Provider value={bulles}>
      {children}
      {/* Zone d'annonce, présente dès que le tableau a des notes : un lecteur d'écran y entend la note quand sa bulle s'ouvre. */}
      {notes.length > 0 ? (
        <p role="status" className="sr-only">
          {note ? `Note ${note.numero}. ${note.colonnes.join(", ")} : ${note.texte}` : ""}
        </p>
      ) : null}
      {note && ouverte ? (
        <BullePosee id={idDeLaBulle} ancre={ouverte.ancre} onFermer={fermer} teinte={BULLE_AMBRE} contenuCle={note}>
          <p>
            <span className="font-medium">Note {note.numero}.</span> <TexteDeLaNote note={note} />
          </p>
        </BullePosee>
      ) : null}
    </BullesContext.Provider>
  )
}

/** Les pastilles des notes d'une colonne, dans son en-tête : un clic ouvre la note dans une bulle. */
export function RenvoisAuxNotes({ colonne, renvois }: { colonne: string; renvois: number[] }) {
  const bulles = useContext(BullesContext)
  if (renvois.length === 0) return null
  return (
    <span className="mt-1 flex flex-wrap justify-end gap-1">
      {renvois.map(numero => {
        const cle = `${colonne}:${numero}`
        const ouverte = bulles?.cleOuverte === cle
        return (
          <button key={numero} type="button" aria-label={`Voir la note ${numero}`} aria-expanded={ouverte} aria-describedby={ouverte ? bulles.idDeLaBulle : undefined} className={cn(PASTILLE_CLIQUABLE, ouverte && PASTILLE_RETENUE)} onClick={evenement => bulles?.basculer({ cle, numero, ancre: evenement.currentTarget })}>
            {numero}
          </button>
        )
      })}
    </span>
  )
}

// ===================================================================================
// == SOUS LE TABLEAU
// ===================================================================================

/**
 * Une liste de notes écrites. `ancres` : chaque note porte son identifiant (« note-comparateur-3 ») ; faux pour une
 * liste partielle affichée à côté de la liste complète réservée à l'impression.
 */
function ListeDesNotes({ notes, ancres = true, className }: { notes: Note[]; ancres?: boolean; className?: string }) {
  return (
    <ol className={cn("space-y-2", className)}>
      {notes.map(note => (
        <li key={note.numero} id={ancres ? `note-comparateur-${note.numero}` : undefined} className="flex scroll-mt-24 items-start gap-2">
          <NoteEcrite note={note} />
        </li>
      ))}
    </ol>
  )
}

/**
 * Les notes réduites : celles du statut actuel restent écrites, les autres tiennent en une ligne de pastilles, et la
 * note choisie s'affiche seule dessous.
 */
function NotesReduites({ notes }: { notes: Note[] }) {
  const [choisie, setChoisie] = useState<number | null>(null)
  const duStatutActuel = notes.filter(n => n.duStatutActuel)
  const autres = notes.filter(n => !n.duStatutActuel)
  const note = autres.find(n => n.numero === choisie)
  const affichee = useRef<HTMLDivElement>(null)
  // La note choisie est amenée à l'écran si elle n'y est pas (bas de page, téléphone).
  useEffect(() => {
    if (choisie !== null) affichee.current?.scrollIntoView?.({ block: "nearest" })
  }, [choisie])
  return (
    <>
      {duStatutActuel.length > 0 ? <ListeDesNotes notes={duStatutActuel} ancres={false} className="print:hidden" /> : null}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 print:hidden">
        {duStatutActuel.length > 0 ? <span>Autres statuts :</span> : null}
        <div role="group" aria-label="Notes des autres statuts" className="flex flex-wrap gap-1.5">
          {autres.map(n => (
            <button key={n.numero} type="button" aria-label={`Note ${n.numero} : ${n.colonnes.join(", ")}`} aria-pressed={n.numero === choisie} className={cn(PASTILLE_CLIQUABLE, n.numero === choisie && PASTILLE_RETENUE)} onClick={() => setChoisie(n.numero === choisie ? null : n.numero)}>
              {n.numero}
            </button>
          ))}
        </div>
      </div>
      <div ref={affichee} aria-live="polite" className="scroll-mb-4 print:hidden">
        {note ? (
          <div className="flex items-start gap-2">
            <NoteEcrite note={note} />
          </div>
        ) : (
          <p className="text-slate-600 dark:text-slate-400">Un clic sur un numéro, ici ou dans le tableau, affiche la note.</p>
        )}
      </div>
      {/* Sur papier, pas de clic : toutes les notes. */}
      <ListeDesNotes notes={notes} className="hidden print:block" />
    </>
  )
}

/**
 * Les notes sous le tableau. Affichage « Résumé », quand au moins deux notes ne concernent que d'autres statuts : elles
 * sont réduites à une ligne de pastilles, sauf si l'utilisateur a demandé la liste complète (choix retenu). Sinon la
 * liste complète.
 */
export function NotesDuTableau({ notes, activityName }: { notes: Note[]; activityName: string }) {
  const resume = useAffichageResume()
  const [toutes, setToutes] = useSectionOuverte("comparateur-notes")
  if (notes.length === 0) return null
  const reductible = resume && notes.filter(n => !n.duStatutActuel).length > 1
  return (
    <div className="space-y-2 text-sm text-amber-900 dark:text-amber-100">
      <div className="flex flex-wrap items-center gap-x-3">
        <p className="font-medium">Notes sur « {activityName} »</p>
        {reductible ? (
          <button type="button" className={cn(LIEN, "print:hidden")} onClick={() => setToutes(!toutes)}>
            {toutes ? "Réduire les notes des autres statuts" : `Tout afficher (${notes.length})`}
          </button>
        ) : null}
      </div>
      {reductible && !toutes ? <NotesReduites notes={notes} /> : <ListeDesNotes notes={notes} />}
    </div>
  )
}
