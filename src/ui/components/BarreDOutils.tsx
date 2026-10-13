// src/ui/components/BarreDOutils.tsx
// La barre d'outils, fixée en haut de la page : paramètres, annuler et rétablir, avis, situations types, affichage,
// export, zoom et thème. Sur un téléphone, les actions secondaires passent dans le menu « Plus d'actions ». La barre
// porte aussi les deux fenêtres qu'elle ouvre (avis, situations types depuis le menu), pour y rendre le focus au bouton
// qui les a ouvertes.

import { useRef, useState } from "react"
import { Download, MessageSquareHeart, Redo2, Settings, Undo2, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MontageType } from "@/lib/montages/montages"
import { ADRESSE_DE_L_AVIS, systemeEtNavigateur, type Diagnostic } from "@/lib/retours"
import { VERSION_DE_L_APPLICATION } from "@/lib/version"
import type { Affichage, SessionState } from "@/types"
import { useFenetreParLAdresse } from "../hooks/useFenetreParLAdresse"
import type { useZoom } from "../hooks/useZoom"
import { usePlateforme } from "../plateforme"
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
}

/** La fenêtre d'avis : ouverte par son bouton, par « Plus d'actions », ou par l'adresse #donner-mon-avis (lien de la page outil du site). */
function useAvis() {
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

export function BarreDOutils({ session, historique, chargement, affichage, onAffichage, zoom, onParametres, onExporter }: BarreDOutilsProps) {
  const plateforme = usePlateforme()
  const avis = useAvis()
  // Les situations types ouvertes depuis le menu « Plus d'actions » d'un téléphone ; le focus revient à ce menu.
  const [montagesDuMenu, setMontagesDuMenu] = useState(false)
  const declencheurDesMontages = useRef<HTMLElement | null>(null)
  // Diagnostic proposé avec un avis : aucune donnée de la simulation, seulement des nombres d'années et d'acteurs.
  const diagnostic: Diagnostic = { version: VERSION_DE_L_APPLICATION, web: plateforme.web, installee: plateforme.installee(), ...systemeEtNavigateur(navigator.userAgent), affichageEnCours: affichage, nombreDAnnees: session.annees.length, nombreDActeurs: session.entities.length }

  return (
    <>
      <nav aria-label="Barre d'outils" className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-2 backdrop-blur-sm bg-background/80 border-b">
        {/* Sur un téléphone, la barre perd ses marges verticales (moins de hauteur collée en haut). Sous 1024 px, elle n'a
            pas non plus de marges latérales : entre 640 et 900 px, ses boutons ne tiendraient pas avec. */}
        <div className="container mx-auto flex items-center justify-between px-0 sm:py-2 lg:px-8">
          {/* Groupe de boutons de gauche */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Paramètres" className="h-10 w-9 sm:w-10 [&_svg]:size-6" onClick={onParametres}>
              <Settings className="text-slate-600 dark:text-slate-400" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Annuler" title="Annuler (Ctrl+Z)" onClick={historique.annuler} disabled={!historique.peutAnnuler} className="h-10 w-9 sm:w-10 [&_svg]:size-6 sm:ml-2">
              <Undo2 className="dark:text-slate-300" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Rétablir" title="Rétablir (Ctrl+Y)" onClick={historique.retablir} disabled={!historique.peutRetablir} className="h-10 w-9 sm:w-10 [&_svg]:size-6">
              <Redo2 className="dark:text-slate-300" />
            </Button>
            {/* Sur un écran large, les deux boutons les plus utiles à qui découvre le simulateur montrent leur nom ;
                en dessous, leur icône seule. Sur un téléphone (moins de 640 px), ils passent dans le menu « Plus
                d'actions », avec l'affichage et le thème : la barre garde les actions principales sans rien couper. */}
            <Button variant="ghost" size="icon" aria-label="Donner mon avis" title="Donner mon avis" onClick={e => avis.ouvrir(e.currentTarget)} className="h-10 w-9 max-sm:hidden sm:ml-2 sm:w-10 lg:w-auto lg:gap-2 lg:px-3 [&_svg]:size-6">
              <MessageSquareHeart className="text-slate-600 dark:text-slate-400" />
              <span className="hidden lg:inline">Donner mon avis</span>
            </Button>
            <BoutonDesMontages variant="outline" size="sm" aria-label="Situations types" className="ml-1 h-8 gap-2 pointer-coarse:min-w-11 max-sm:hidden sm:ml-2" onCharger={chargement.onChargerUnMontage} confirmationNecessaire={chargement.confirmationNecessaire} nomDeLaSession={session.name}>
              <span className="hidden md:inline">Situations types</span>
            </BoutonDesMontages>
            {/* En mode développement seulement : scénarios prêts à charger pour vérifier une fonctionnalité. */}
            <BoutonDesTests onCharger={chargement.onChargerUneSession} />
          </div>
          {/* Groupe de boutons de droite */}
          <div className="flex items-center gap-1">
            <div className="max-sm:hidden">
              <SelecteurAffichage affichage={affichage} onChange={onAffichage} />
            </div>
            {/* Son nom visible à partir de 1024 px ; en dessous, l'icône seule, pour que la barre tienne. */}
            <Button variant="outline" size="sm" aria-label="Exporter" title="Exporter" className="h-8 gap-2 pointer-coarse:min-w-11 sm:mr-2" onClick={onExporter}>
              <Download className="size-4" />
              <span className="hidden lg:inline">Exporter</span>
            </Button>
            {/* Sur un écran tactile de moins de 768 px, on zoome avec les doigts : les boutons de zoom y laissent la place
                aux autres. Dans une fenêtre très étroite (moins de 416 px), ils s'effacent aussi : le zoom du navigateur reste. */}
            <Button variant="ghost" size="icon" aria-label="Zoom arrière" onClick={zoom.zoomOut} disabled={!zoom.canZoomOut} className="h-10 w-9 pointer-coarse:max-md:hidden max-[26rem]:hidden sm:w-10 [&_svg]:size-6">
              <ZoomOut className="text-slate-600 dark:text-slate-400" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Zoom avant" onClick={zoom.zoomIn} disabled={!zoom.canZoomIn} className="h-10 w-9 pointer-coarse:max-md:hidden max-[26rem]:hidden sm:w-10 [&_svg]:size-6 sm:mr-4">
              <ZoomIn className="text-slate-600 dark:text-slate-400" />
            </Button>
            <ThemeToggle className="max-sm:hidden" />
            <MenuPlusDActions
              className="sm:hidden"
              affichage={affichage}
              onAffichage={onAffichage}
              onAvis={avis.ouvrir}
              onMontages={declencheur => {
                declencheurDesMontages.current = declencheur
                setMontagesDuMenu(true)
              }}
            />
          </div>
        </div>
      </nav>
      <DialogueDAvis isOpen={avis.ouvert} onClose={avis.fermer} diagnostic={diagnostic} declencheur={avis.declencheur} />
      <FenetreDesMontages open={montagesDuMenu} onOpenChange={setMontagesDuMenu} onCharger={chargement.onChargerUnMontage} confirmationNecessaire={chargement.confirmationNecessaire} nomDeLaSession={session.name} declencheur={declencheurDesMontages} />
    </>
  )
}
