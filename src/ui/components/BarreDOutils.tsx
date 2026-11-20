// src/ui/components/BarreDOutils.tsx
// La barre d'outils, fixée en haut de la page : paramètres, annuler et rétablir, avis, situations types, affichage,
// export, zoom et thème. Sur un téléphone, les actions secondaires passent dans le menu « Plus d'actions ». La barre
// porte aussi les deux fenêtres qu'elle ouvre (avis, situations types depuis le menu), pour y rendre le focus au bouton
// qui les a ouvertes. « Donner mon avis » est mis en valeur (le simulateur est en bêta) ; l'utilisateur peut le
// retirer de la barre, depuis la fenêtre d'avis ou les paramètres.

import { useRef, useState, type ReactNode } from "react"
import { Download, MessageSquareHeart, Redo2, Settings, Undo2, ZoomIn, ZoomOut } from "lucide-react"
import { pourcentDeNombre } from "@/backend/logic/format"
import { Button } from "@/components/ui/button"
import type { MontageType } from "@/lib/montages/montages"
import { ADRESSE_DE_L_AVIS } from "@/lib/retours"
import { cn } from "@/lib/utils"
import { infobulleDuZoom } from "@/lib/zoom"
import type { Affichage, SessionState } from "@/types"
import { useDiagnostic, type ReglageDuBoutonDAvis } from "../hooks/useAvis"
import { useFenetreParLAdresse } from "../hooks/useFenetreParLAdresse"
import type { useZoom } from "../hooks/useZoom"
import { BoutonDesTests } from "./BoutonDesTests"
import { DialogueDAvis } from "./DialogueDAvis"
import { MenuPlusDActions } from "./MenuPlusDActions"
import { BoutonDesMontages, FenetreDesMontages } from "./MontagesTypes"
import { SelecteurAffichage } from "./SelecteurAffichage"
import { ThemeToggle } from "./ThemeToggle"

/** Annuler et rétablir : l'historique de la simulation. */
interface Historique {
  annuler: () => void
  retablir: () => void
  peutAnnuler: boolean
  peutRetablir: boolean
}

/** Charger une situation type, ou un scénario de test (mode développement), à la place de la session. */
interface Chargement {
  onChargerUnMontage: (montage: MontageType) => void
  onChargerUneSession: (session: SessionState) => void
  /** La simulation en cours serait perdue : charger une situation demande d'abord une confirmation. */
  confirmationNecessaire: boolean
}

interface BarreDOutilsProps {
  /** La simulation affichée : son nom (confirmations) et sa taille (diagnostic joint à un avis). */
  session: SessionState
  historique: Historique
  chargement: Chargement
  affichage: Affichage
  onAffichage: (affichage: Affichage) => void
  zoom: ReturnType<typeof useZoom>
  onParametres: () => void
  onExporter: () => void
  /** La pastille « IA en direct », près d'« Annuler », tant que l'IA modifie directement la simulation. */
  indicateurIA?: ReactNode
  /** « Donner mon avis » affiché dans la barre ou retiré par l'utilisateur ; sans ce réglage, il est toujours affiché. */
  boutonDAvis?: ReglageDuBoutonDAvis
}

/** La fenêtre d'avis : ouverte par son bouton, par « Plus d'actions », ou par l'adresse #donner-mon-avis (lien de la page outil du site). */
function useFenetreDAvis() {
  const [ouvert, setOuvert] = useFenetreParLAdresse(ADRESSE_DE_L_AVIS)
  // Le bouton qui a ouvert la fenêtre (celui de la barre, ou « Plus d'actions » sur un téléphone) : le focus y revient.
  const declencheur = useRef<HTMLElement | null>(null)
  return {
    ouvert,
    declencheur,
    ouvrir: (bouton: HTMLElement) => {
      declencheur.current = bouton
      setOuvert(true)
    },
    fermer: () => setOuvert(false)
  }
}

/**
 * « Donner mon avis » montre son nom quand la barre en a la place : à partir de 1 024 px de fenêtre, ou de 1 280 px
 * quand le niveau du zoom s'affiche à côté des loupes. Classes écrites en entier : Tailwind les lit dans le source.
 */
const NOM_DE_L_AVIS = {
  sansNiveauDuZoom: { bouton: "@min-[63rem]:w-auto @min-[63rem]:gap-2 @min-[63rem]:px-3", nom: "hidden @min-[63rem]:inline" },
  avecNiveauDuZoom: { bouton: "@min-[79rem]:w-auto @min-[79rem]:gap-2 @min-[79rem]:px-3", nom: "hidden @min-[79rem]:inline" }
}

/**
 * « Donner mon avis », mis en valeur par une teinte : fond et contour bleus, sans changer sa taille (la place de la
 * barre est comptée au pixel).
 */
const TEINTE_DE_L_AVIS = "bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200 hover:bg-blue-100 hover:text-blue-900 dark:bg-blue-950/60 dark:text-blue-200 dark:ring-blue-800 dark:hover:bg-blue-900/60 dark:hover:text-blue-100"

export function BarreDOutils({ session, historique, chargement, affichage, onAffichage, zoom, onParametres, onExporter, indicateurIA, boutonDAvis }: BarreDOutilsProps) {
  const avis = useFenetreDAvis()
  const avisMasque = boutonDAvis?.masque === true
  // Le bouton d'avis retiré pendant que sa fenêtre est ouverte : à la fermeture, le focus va aux paramètres, qui la rouvrent.
  const parametres = useRef<HTMLButtonElement>(null)
  // Les situations types ouvertes depuis le menu « Plus d'actions » d'un téléphone ; le focus revient à ce menu.
  const [montagesDuMenu, setMontagesDuMenu] = useState(false)
  const declencheurDesMontages = useRef<HTMLElement | null>(null)
  const niveauDuZoom = pourcentDeNombre(zoom.zoom * 100)
  const nomDeLAvis = zoom.zoom === 1 ? NOM_DE_L_AVIS.sansNiveauDuZoom : NOM_DE_L_AVIS.avecNiveauDuZoom
  const diagnostic = useDiagnostic(session, affichage)

  return (
    <>
      {/* La barre choisit sa forme d'après la place qu'elle a vraiment (requêtes de conteneur, « @min-[39rem]: »), pas
          d'après la largeur de la fenêtre. Cette place, c'est la largeur du bloc centré ci-dessous : la fenêtre divisée
          par le zoom (1 280 px zoomés à 200 % n'offrent que 640 px), moins 16 px de marges, et jamais plus que la largeur
          du contenu de la page (classe `container`, qui suit la fenêtre : à 50 % dans 700 px, elle ne laisse que 640 px
          là où la barre zoomée en compte 1 400). Les seuils sont ceux de la page moins ces 16 px : 39rem (fenêtre de
          640 px), 47rem (768 px), 63rem (1 024 px), 79rem (1 280 px). La place demandée par chaque forme est mesurée ;
          e2e-web/zoom-balayage.web.ts vérifie que rien ne sort de l'écran, à chaque zoom et à chaque largeur. */}
      <nav aria-label="Barre d'outils" className="print:hidden fixed top-0 left-0 right-0 z-50 backdrop-blur-sm bg-background/80 border-b p-2">
        <div className="@container container mx-auto">
          {/* Sur un téléphone, la barre perd ses marges verticales (moins de hauteur collée en haut). Sous 1024 px, elle n'a
              pas non plus de marges latérales : entre 640 et 900 px, ses boutons ne tiendraient pas avec. */}
          <div className="flex items-center justify-between px-0 @min-[39rem]:py-2 @min-[63rem]:px-8">
            {/* Groupe de boutons de gauche */}
            <div className="flex items-center gap-1">
              <Button ref={parametres} variant="ghost" size="icon" aria-label="Paramètres" className="h-10 w-9 @min-[39rem]:w-10 [&_svg]:size-6" onClick={onParametres}>
                <Settings className="text-slate-600 dark:text-slate-400" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Annuler" title="Annuler (Ctrl+Z). L'historique s'efface au rechargement de la page ou à la fermeture de l'application." onClick={historique.annuler} disabled={!historique.peutAnnuler} className="h-10 w-9 @min-[39rem]:w-10 [&_svg]:size-6 @min-[39rem]:ml-2">
                <Undo2 className="dark:text-slate-300" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Rétablir" title="Rétablir (Ctrl+Y). L'historique s'efface au rechargement de la page ou à la fermeture de l'application." onClick={historique.retablir} disabled={!historique.peutRetablir} className="h-10 w-9 @min-[39rem]:w-10 [&_svg]:size-6">
                <Redo2 className="dark:text-slate-300" />
              </Button>
              {indicateurIA}
              {/* Sur un écran large, les deux boutons les plus utiles à qui découvre le simulateur montrent leur nom ;
                  en dessous, leur icône seule. Le nom de « Donner mon avis » attend 1 280 px quand le niveau du zoom
                  s'affiche : entre 1 024 et 1 280 px, la barre n'a que 944 px, et il en faudrait 1 020 pour les deux. Sur un téléphone (moins de 640 px), ils passent dans le menu « Plus
                  d'actions », avec l'affichage et le thème : la barre garde les actions principales sans rien couper. */}
              {avisMasque ? null : (
                <Button variant="ghost" size="icon" aria-label="Donner mon avis" title="Donner mon avis" onClick={e => avis.ouvrir(e.currentTarget)} className={cn("h-10 w-9 @max-[39rem]:hidden @min-[39rem]:ml-2 @min-[39rem]:w-10 [&_svg]:size-6", TEINTE_DE_L_AVIS, nomDeLAvis.bouton)}>
                  <MessageSquareHeart />
                  <span className={nomDeLAvis.nom}>Donner mon avis</span>
                </Button>
              )}
              <BoutonDesMontages variant="outline" size="sm" aria-label="Situations types" className="ml-1 h-8 gap-2 pointer-coarse:min-w-11 @max-[39rem]:hidden @min-[39rem]:ml-2" onCharger={chargement.onChargerUnMontage} confirmationNecessaire={chargement.confirmationNecessaire} nomDeLaSession={session.name}>
                <span className="hidden @min-[47rem]:inline">Situations types</span>
              </BoutonDesMontages>
              {/* En mode développement seulement : scénarios prêts à charger pour vérifier une fonctionnalité. */}
              <BoutonDesTests onCharger={chargement.onChargerUneSession} />
            </div>
            {/* Groupe de boutons de droite */}
            <div className="flex items-center gap-1">
              <div className="@max-[39rem]:hidden">
                <SelecteurAffichage affichage={affichage} onChange={onAffichage} />
              </div>
              {/* Son nom visible à partir de 1024 px ; en dessous, l'icône seule, pour que la barre tienne. */}
              <Button variant="outline" size="sm" aria-label="Exporter" title="Exporter" className="h-8 gap-2 pointer-coarse:min-w-11 @min-[39rem]:mr-2" onClick={onExporter}>
                <Download className="size-4" />
                <span className="hidden @min-[63rem]:inline">Exporter</span>
              </Button>
              {/* Le niveau du zoom, tant que l'interface n'est pas à 100 % : un clic y ramène. Il se place à gauche des deux
                  boutons, qui ne bougent donc pas sous le pointeur quand il apparaît, et s'efface quand la barre n'a plus la
                  place (moins de 832 px de fenêtre) : les infobulles des boutons disent alors le niveau, et Ctrl+0 ramène à 100 %. */}
              {zoom.zoom === 1 ? null : (
                <Button variant="ghost" size="sm" aria-label={`Zoom de l'interface : ${niveauDuZoom}. Revenir à 100 %`} title="Revenir à 100 % (Ctrl+0)" onClick={zoom.reinitialiser} className="h-8 px-2 text-sm tabular-nums text-slate-600 @max-[51rem]:hidden dark:text-slate-400">
                  {niveauDuZoom}
                </Button>
              )}
              {/* Sur un écran tactile de moins de 768 px, on zoome avec les doigts : les boutons de zoom y laissent la place
                  aux autres. Dans une fenêtre très étroite (moins de 416 px), ils s'effacent aussi : le menu « Plus d'actions »,
                  affiché sous 640 px, porte alors les mêmes commandes de zoom. */}
              <Button variant="ghost" size="icon" aria-label="Zoom arrière" title={infobulleDuZoom(zoom, "arriere")} onClick={zoom.zoomOut} disabled={!zoom.canZoomOut} className="h-10 w-9 pointer-coarse:@max-[47rem]:hidden @max-[25rem]:hidden @min-[39rem]:w-10 [&_svg]:size-6">
                <ZoomOut className="text-slate-600 dark:text-slate-400" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Zoom avant" title={infobulleDuZoom(zoom, "avant")} onClick={zoom.zoomIn} disabled={!zoom.canZoomIn} className="h-10 w-9 pointer-coarse:@max-[47rem]:hidden @max-[25rem]:hidden @min-[39rem]:w-10 [&_svg]:size-6 @min-[39rem]:mr-4">
                <ZoomIn className="text-slate-600 dark:text-slate-400" />
              </Button>
              <ThemeToggle className="@max-[39rem]:hidden" />
              <MenuPlusDActions
                className="@min-[39rem]:hidden"
                affichage={affichage}
                onAffichage={onAffichage}
                zoom={zoom}
                onAvis={avisMasque ? undefined : avis.ouvrir}
                onMontages={declencheur => {
                  declencheurDesMontages.current = declencheur
                  setMontagesDuMenu(true)
                }}
              />
            </div>
          </div>
        </div>
      </nav>
      <DialogueDAvis isOpen={avis.ouvert} onClose={avis.fermer} diagnostic={diagnostic} declencheur={avis.declencheur} repli={parametres} boutonDansLaBarre={boutonDAvis} />
      <FenetreDesMontages open={montagesDuMenu} onOpenChange={setMontagesDuMenu} onCharger={chargement.onChargerUnMontage} confirmationNecessaire={chargement.confirmationNecessaire} nomDeLaSession={session.name} declencheur={declencheurDesMontages} />
    </>
  )
}
