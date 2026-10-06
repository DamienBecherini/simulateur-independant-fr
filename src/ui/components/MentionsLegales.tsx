// src/ui/components/MentionsLegales.tsx
// Fenêtre « Mentions légales et confidentialité » : le texte de src/lib/mentions-legales.ts. Elle s'ouvre depuis le
// pied de page, depuis les paramètres, et dans la démo web par son adresse (#mentions-legales).

import { useRef, useState, type MouseEvent, type ReactNode } from "react"
import { ExternalLink, Scale } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useFenetreParLAdresse } from "@/ui/hooks/useFenetreParLAdresse"
import { ADRESSE_DES_MENTIONS_LEGALES, INTRODUCTION, RUBRIQUES, TITRE_DES_MENTIONS_LEGALES, estUnLienExterne, type Bloc, type Lien, type Morceau } from "@/lib/mentions-legales"

const STYLE_DU_LIEN = "text-blue-700 underline underline-offset-2 [overflow-wrap:anywhere] hover:no-underline dark:text-blue-300"

/** L'e-mail de contact passe par l'application, comme les avis : la fenêtre d'Electron ne suit pas un lien mailto:. */
function ouvrirLaMessagerie(evenement: MouseEvent<HTMLAnchorElement>, adresse: string) {
  evenement.preventDefault()
  window.api.ouvrirAdresseExterne(adresse).catch(() => false)
}

function LienDuTexte({ lien }: { lien: Lien }) {
  if (!estUnLienExterne(lien.adresse)) {
    return (
      <a href={lien.adresse} onClick={evenement => ouvrirLaMessagerie(evenement, lien.adresse)} className={STYLE_DU_LIEN}>
        {lien.texte}
      </a>
    )
  }
  return (
    <a href={lien.adresse} target="_blank" rel="noreferrer" className={STYLE_DU_LIEN}>
      {lien.texte}
      <ExternalLink aria-hidden="true" className="ml-1 inline size-3.5 align-[-2px]" />
      <span className="sr-only"> (nouvelle fenêtre)</span>
    </a>
  )
}

function MorceauDuTexte({ morceau }: { morceau: Morceau }) {
  if (typeof morceau === "string") return morceau
  if ("code" in morceau) return <code className="rounded bg-slate-100 px-1 text-[0.85em] [overflow-wrap:anywhere] dark:bg-slate-800">{morceau.code}</code>
  return <LienDuTexte lien={morceau} />
}

function Ligne({ morceaux }: { morceaux: Morceau[] }) {
  return morceaux.map((morceau, i) => <MorceauDuTexte key={i} morceau={morceau} />)
}

function BlocDuTexte({ bloc }: { bloc: Bloc }) {
  if ("paragraphe" in bloc) {
    return (
      <p>
        <Ligne morceaux={bloc.paragraphe} />
      </p>
    )
  }
  return (
    <ul className="list-disc space-y-1 pl-5">
      {bloc.liste.map((element, i) => (
        <li key={i}>
          <Ligne morceaux={element} />
        </li>
      ))}
    </ul>
  )
}

interface FenetreDesMentionsLegalesProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Bouton qui ouvre la fenêtre : le focus lui revient à la fermeture. */
  declencheur?: ReactNode
}

/** La fenêtre des mentions légales ; à l'ouverture, le focus va au titre, pour que la lecture parte du début. */
export function FenetreDesMentionsLegales({ open, onOpenChange, declencheur }: FenetreDesMentionsLegalesProps) {
  const titre = useRef<HTMLHeadingElement>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {declencheur ? <DialogTrigger asChild>{declencheur}</DialogTrigger> : null}
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        onOpenAutoFocus={evenement => {
          evenement.preventDefault()
          titre.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle ref={titre} tabIndex={-1} className="pr-6 leading-snug focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            {TITRE_DES_MENTIONS_LEGALES}
          </DialogTitle>
          <DialogDescription>
            <Ligne morceaux={INTRODUCTION} />
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm text-slate-700 dark:text-slate-300">
          {RUBRIQUES.map(rubrique => (
            <section key={rubrique.titre} className="space-y-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{rubrique.titre}</h3>
              {rubrique.blocs.map((bloc, i) => (
                <BlocDuTexte key={i} bloc={bloc} />
              ))}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Le bouton qui ouvre les mentions légales ; le focus lui revient à la fermeture. */
export function BoutonDesMentionsLegales({ children, icone = false, ...bouton }: Pick<ButtonProps, "variant" | "size" | "className"> & { children?: ReactNode; icone?: boolean }) {
  const [ouverte, setOuverte] = useState(false)
  const declencheur = (
    <Button {...bouton}>
      {icone ? <Scale /> : null}
      {children ?? TITRE_DES_MENTIONS_LEGALES}
    </Button>
  )
  return <FenetreDesMentionsLegales open={ouverte} onOpenChange={setOuverte} declencheur={declencheur} />
}

/**
 * Les mentions légales ouvertes par l'adresse de la page (#mentions-legales), au chargement ou en cours de route.
 * À la fermeture, l'adresse reprend le fragment d'avant (la vue affichée), sans nouvelle entrée dans l'historique.
 */
export function MentionsLegalesParLAdresse() {
  const [ouverte, changerOuverture] = useFenetreParLAdresse(ADRESSE_DES_MENTIONS_LEGALES)
  return <FenetreDesMentionsLegales open={ouverte} onOpenChange={changerOuverture} />
}
