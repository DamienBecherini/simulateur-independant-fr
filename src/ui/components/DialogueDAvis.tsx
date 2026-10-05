// src/ui/components/DialogueDAvis.tsx
// Fenêtre « Donner mon avis » (phase 13 quater, étape 1) : une note, l'affichage préféré, le type de retour et un
// message, tous facultatifs, et un diagnostic sans aucune donnée de la simulation. Le retour part sans serveur, par un
// ticket GitHub ou un e-mail préremplis, ou se copie pour une messagerie en ligne. L'aperçu montre le texte envoyé.

import { useId, useRef, useState, type ReactNode } from "react"
import { Copy, Github, Mail, Star } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AFFICHAGES } from "@/lib/affichage"
import { ADRESSE_E_MAIL_DES_RETOURS } from "@/lib/adresses-des-retours"
import { adresseDeLEMail, adresseDuTicket, CONDITION_D_ENVOI, NOTES, retourEnvoyable, RETOUR_VIDE, texteACopier, texteDuRetour, TYPES_DE_RETOUR, type Diagnostic, type Retour } from "@/lib/retours"
import { cn } from "@/lib/utils"

interface DialogueDAvisProps {
  isOpen: boolean
  onClose: () => void
  diagnostic: Diagnostic
}

/** Taille des cibles : 24 px au moins, 44 px au doigt. */
const CIBLE = "min-h-6 pointer-coarse:min-h-11"
const PETIT_TEXTE = "text-sm text-slate-600 dark:text-slate-400"

interface ChoixUniqueProps<T extends string | number> {
  legende: string
  valeur: T | null
  options: readonly { valeur: T; libelle: ReactNode; nomAccessible?: string }[]
  onChange: (valeur: T | null) => void
  /** Nom du bouton qui retire le choix. */
  effacer: string
  className?: string
}

/** Choix d'une seule option (boutons radio), facultatif : rien n'est choisi d'office, et le choix s'efface. */
function ChoixUnique<T extends string | number>({ legende, valeur, options, onChange, effacer, className }: ChoixUniqueProps<T>) {
  const nom = useId()
  const groupe = useRef<HTMLFieldSetElement>(null)
  // Le bouton « Effacer » disparaît avec le choix : le focus revient à la première option du groupe.
  const effacerLeChoix = () => {
    onChange(null)
    groupe.current?.querySelector("input")?.focus()
  }
  return (
    <fieldset ref={groupe} className="space-y-1.5">
      <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">{legende}</legend>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
        <div className={cn("flex flex-wrap gap-1", className)}>
          {options.map(option => (
            <label key={String(option.valeur)} className={cn("flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 px-2.5 text-sm has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 dark:border-slate-600 dark:has-[:checked]:border-blue-400 dark:has-[:checked]:bg-blue-950", CIBLE, "pointer-coarse:min-w-11")}>
              <input type="radio" name={nom} className="sr-only" checked={valeur === option.valeur} onChange={() => onChange(option.valeur)} aria-label={option.nomAccessible} />
              {option.libelle}
            </label>
          ))}
        </div>
        {valeur !== null ? (
          <Button type="button" variant="link" size="sm" className={cn("h-auto px-2 text-sm", CIBLE)} onClick={effacerLeChoix}>
            {effacer}
          </Button>
        ) : null}
      </div>
    </fieldset>
  )
}

/** Étoiles de la note : pleines jusqu'à la note choisie. */
function Etoiles({ nombre, pleines }: { nombre: number; pleines: boolean }) {
  return (
    <span aria-hidden className="flex items-center gap-1">
      <Star className={cn("size-4", pleines ? "fill-amber-400 text-amber-500 dark:text-amber-400" : "text-slate-500 dark:text-slate-400")} />
      <span className="tabular-nums">{nombre}</span>
    </span>
  )
}

/** Un moyen d'envoi : son bouton, puis ce qu'il faut savoir avant de l'utiliser. */
function MoyenDEnvoi({ bouton, children }: { bouton: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5 rounded-md border border-slate-200 p-3 dark:border-slate-700">
      {bouton}
      <div className={cn("space-y-1", PETIT_TEXTE)}>{children}</div>
    </div>
  )
}

/** Résultat de l'action d'envoi ou de copie, lu par les lecteurs d'écran. */
type Etat = { message: string; erreur: boolean } | null

function useEnvoi(retour: Retour, diagnostic: Diagnostic) {
  const [etat, setEtat] = useState<Etat>(null)
  const ouvrir = async (adresse: string, succes: string) => {
    const ouverte = await window.api.ouvrirAdresseExterne(adresse).catch(() => false)
    setEtat(ouverte ? { message: succes, erreur: false } : { message: "L'adresse n'a pas pu être ouverte. Copiez le message pour l'envoyer vous-même.", erreur: true })
  }
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texteACopier(retour, diagnostic))
      setEtat({ message: "Adresse et message copiés : collez-les dans votre messagerie.", erreur: false })
    } catch {
      setEtat({ message: "La copie a échoué : sélectionnez le texte de l'aperçu pour le copier.", erreur: true })
    }
  }
  return {
    etat,
    effacerEtat: () => setEtat(null),
    envoyerSurGitHub: () => ouvrir(adresseDuTicket(retour, diagnostic).adresse, "Le formulaire GitHub s'ouvre dans votre navigateur : il reste à le valider."),
    envoyerParEMail: () => ouvrir(adresseDeLEMail(retour, diagnostic).adresse, "Votre messagerie s'ouvre avec le message prérempli : il reste à l'envoyer."),
    copier
  }
}

function ZoneDEnvoi({ retour, diagnostic }: { retour: Retour; diagnostic: Diagnostic }) {
  const idCondition = useId()
  const envoyable = retourEnvoyable(retour)
  const { etat, envoyerSurGitHub, envoyerParEMail, copier } = useEnvoi(retour, diagnostic)
  const decrit = envoyable ? undefined : idCondition
  const ticketTronque = adresseDuTicket(retour, diagnostic).tronque
  const eMailTronque = adresseDeLEMail(retour, diagnostic).tronque
  return (
    <section aria-label="Envoyer" className="space-y-2">
      {envoyable ? null : (
        <p id={idCondition} className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {CONDITION_D_ENVOI}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <MoyenDEnvoi
          bouton={
            <Button type="button" className="h-auto min-h-9 w-full whitespace-normal py-1.5" disabled={!envoyable} aria-describedby={decrit} onClick={envoyerSurGitHub}>
              <Github aria-hidden />
              Envoyer sur GitHub (compte requis, message public)
            </Button>
          }
        >
          <p className="font-medium text-amber-800 dark:text-amber-300">Votre message sera public sur GitHub : n'y mettez pas d'informations personnelles.</p>
          <p>Il faut un compte GitHub ; une prochaine version permettra d'envoyer son avis sans compte. Une seule note compte par compte : la plus récente.</p>
          {ticketTronque ? <p>Message très long : il sera coupé dans le ticket ; vous pourrez y ajouter la suite.</p> : null}
        </MoyenDEnvoi>
        <MoyenDEnvoi
          bouton={
            <Button type="button" variant="secondary" className="h-auto min-h-9 w-full whitespace-normal py-1.5" disabled={!envoyable} aria-describedby={decrit} onClick={envoyerParEMail}>
              <Mail aria-hidden />
              Envoyer par e-mail
            </Button>
          }
        >
          <p className="font-medium text-amber-800 dark:text-amber-300">Votre adresse e-mail sera visible par le destinataire ; elle ne sert qu'à vous répondre.</p>
          <p>
            À : <span className="break-all">{ADRESSE_E_MAIL_DES_RETOURS}</span>. Les avis reçus par e-mail ne comptent pas dans la note moyenne publiée.
          </p>
          {eMailTronque ? <p>Message long : il sera coupé dans l'e-mail ; copiez-le pour l'envoyer en entier.</p> : null}
          <Button type="button" variant="outline" size="sm" className={cn("mt-1 w-full", CIBLE)} disabled={!envoyable} aria-describedby={decrit} onClick={copier}>
            <Copy aria-hidden />
            Copier le message
          </Button>
        </MoyenDEnvoi>
      </div>
      <p role="status" className={cn("min-h-5 text-sm", etat?.erreur ? "text-red-700 dark:text-red-400" : "text-emerald-800 dark:text-emerald-300")}>
        {etat?.message}
      </p>
    </section>
  )
}

function Apercu({ retour, diagnostic }: { retour: Retour; diagnostic: Diagnostic }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="space-y-1">
      <h3 id={id} className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        Aperçu de ce qui sera envoyé
      </h3>
      <p className={PETIT_TEXTE}>La version de l'application et le type d'installation sont toujours joints. Aucun montant ni aucun nom de la simulation n'est envoyé.</p>
      {/* Défile seul s'il est long ; atteignable au clavier pour être lu ou sélectionné. */}
      <pre tabIndex={0} aria-label="Texte envoyé" className="max-h-48 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-sans text-sm whitespace-pre-wrap [overflow-wrap:anywhere] text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        {texteDuRetour(retour, diagnostic)}
      </pre>
    </section>
  )
}

function Formulaire({ retour, setRetour }: { retour: Retour; setRetour: (retour: Retour) => void }) {
  const idMessage = useId()
  const idDiagnostic = useId()
  const modifier = (changement: Partial<Retour>) => setRetour({ ...retour, ...changement })
  return (
    <div className="space-y-4">
      <ChoixUnique
        legende="Note"
        valeur={retour.note}
        options={NOTES.map(note => ({ valeur: note, libelle: <Etoiles nombre={note} pleines={retour.note !== null && note <= retour.note} />, nomAccessible: `${note} sur 5` }))}
        onChange={note => modifier({ note })}
        effacer="Effacer la note"
      />
      <ChoixUnique legende="Affichage préféré" valeur={retour.affichage} options={AFFICHAGES.map(a => ({ valeur: a.valeur, libelle: a.libelle }))} onChange={affichage => modifier({ affichage })} effacer="Effacer l'affichage" />
      <ChoixUnique legende="Type de retour" valeur={retour.type} options={TYPES_DE_RETOUR} onChange={type => modifier({ type })} effacer="Effacer le type" />
      <div className="space-y-1.5">
        <label htmlFor={idMessage} className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
          Message
        </label>
        <textarea
          id={idMessage}
          value={retour.message}
          maxLength={5000}
          rows={4}
          onChange={event => modifier({ message: event.target.value })}
          placeholder="Votre avis, le bug rencontré ou votre idée"
          className="w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-600 dark:placeholder:text-slate-400"
        />
      </div>
      <div className="flex items-start gap-2">
        <input id={idDiagnostic} type="checkbox" checked={retour.diagnostic} onChange={event => modifier({ diagnostic: event.target.checked })} aria-describedby={`${idDiagnostic}-aide`} className="mt-0.5 size-5 shrink-0 accent-blue-600 pointer-coarse:size-6" />
        <div>
          <label htmlFor={idDiagnostic} className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Joindre un diagnostic
          </label>
          <p id={`${idDiagnostic}-aide`} className={PETIT_TEXTE}>
            Système et navigateur, affichage en cours, nombre d'années et d'acteurs. Jamais de montant ni de nom.
          </p>
        </div>
      </div>
    </div>
  )
}

export function DialogueDAvis({ isOpen, onClose, diagnostic }: DialogueDAvisProps) {
  // Le brouillon reste le temps de la session de l'application, même fenêtre fermée.
  const [retour, setRetour] = useState<Retour>(RETOUR_VIDE)
  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Donner mon avis</DialogTitle>
          <DialogDescription>Tout est facultatif : une seule information suffit. Le simulateur est en bêta, et vos retours aident à choisir l'affichage à garder.</DialogDescription>
        </DialogHeader>
        <Formulaire retour={retour} setRetour={setRetour} />
        <Apercu retour={retour} diagnostic={diagnostic} />
        <ZoneDEnvoi retour={retour} diagnostic={diagnostic} />
      </DialogContent>
    </Dialog>
  )
}
