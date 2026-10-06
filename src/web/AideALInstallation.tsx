// src/web/AideALInstallation.tsx
// Aide à l'installation de la démo web comme une application, sans fenêtre qui s'ouvre d'elle-même : une ligne du
// bandeau de la démo (« Comment faire ? ») et un bouton des paramètres ouvrent la même fenêtre, qui s'adapte au
// navigateur. Edge et Chrome : les avantages, « Installer maintenant » quand le navigateur le propose (voir
// pwa/installation.ts), et les étapes à la main, en images. Firefox, Safari et les autres : ouvrir la démo dans Edge ou
// Chrome, ou télécharger l'application de bureau. Une fois la démo installée, rien de tout cela n'apparaît.

import { useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { HardDrive, MonitorDown, WifiOff } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { LiensVersLApplicationDeBureau } from "./ApplicationDeBureau"
import { familleDuNavigateur, installationPossible, installer, surLInstallation } from "./pwa/installation"
import { useDemoInstallee } from "./pwa/utiliser-l-installation"
import barreDAdresse from "./aide-installation/edge-barre-d-adresse.webp"
import fenetreDInstallation from "./aide-installation/edge-fenetre-d-installation.webp"

export const TITRE_INSTALLER = "Installer le simulateur"
export const INVITATION_A_INSTALLER = "Installer le simulateur sur votre ordinateur : il fonctionne hors ligne, sans compte."
export const COMMENT_FAIRE = "Comment faire ?"

const PETIT_TEXTE = "text-sm text-slate-600 dark:text-slate-400"
const TITRE_DE_PARTIE = "text-sm font-semibold text-slate-800 dark:text-slate-100"
// Captures d'Edge en thème sombre ; la fenêtre d'installation, à sa taille réelle, écraserait le texte : elle est réduite.
const IMAGE = "mt-2 block h-auto w-full"

const AVANTAGES: { icone: ReactNode; texte: string }[] = [
  { icone: <MonitorDown />, texte: "Une icône sur le bureau et dans le menu Démarrer, et sa propre fenêtre." },
  { icone: <WifiOff />, texte: "Il fonctionne hors ligne, sans compte." },
  { icone: <HardDrive />, texte: "Vos données restent sur votre ordinateur." }
]

function AvecEdgeOuChrome() {
  const possible = useSyncExternalStore(surLInstallation, installationPossible, () => false)
  const [etat, setEtat] = useState("")
  const message = useRef<HTMLParagraphElement>(null)

  const installerMaintenant = async () => {
    const installe = await installer()
    setEtat(installe ? "Le simulateur est installé : ouvrez-le depuis son icône, sur le bureau ou dans le menu Démarrer." : "Installation annulée. Vous pourrez la relancer plus tard, ou suivre les étapes ci-dessous.")
    // Le bouton a disparu (une invitation du navigateur ne sert qu'une fois) : le focus va sur le résultat.
    message.current?.focus()
  }

  return (
    <div className="space-y-4 text-sm">
      <ul className="space-y-2">
        {AVANTAGES.map(({ icone, texte }) => (
          <li key={texte} className="flex items-start gap-2 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-slate-600 dark:[&_svg]:text-slate-400">
            <span aria-hidden="true">{icone}</span>
            {texte}
          </li>
        ))}
      </ul>
      {possible ? (
        <Button type="button" className="h-auto min-h-11 whitespace-normal" onClick={() => void installerMaintenant()}>
          <MonitorDown className="mr-2 size-4" aria-hidden="true" /> Installer maintenant
        </Button>
      ) : etat ? null : (
        <p className={PETIT_TEXTE}>Le bouton « Installer maintenant » n'apparaît que lorsque le navigateur propose l'installation : ce n'est pas le cas pour l'instant (la démo est peut-être déjà installée, ou la page vient de s'ouvrir). Suivez les étapes ci-dessous.</p>
      )}
      <p ref={message} role="status" tabIndex={-1} className="focus:outline-none">
        {etat}
      </p>

      <section aria-labelledby="installer-a-la-main" className="space-y-2">
        <h3 id="installer-a-la-main" className={TITRE_DE_PARTIE}>
          Ou bien, à la main
        </h3>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            Dans Microsoft Edge, cliquez sur l'icône « L'application est disponible », à droite de la barre d'adresse.
            <img src={barreDAdresse} width={495} height={77} className={`${IMAGE} max-w-[495px] rounded-md border border-slate-300 dark:border-slate-600`} alt="Barre d'outils de Microsoft Edge : à droite de la barre d'adresse, la souris survole l'icône d'installation (des carrés et un signe plus), avec l'info-bulle « L'application est disponible. Installer Simulateur indépendant FR ». C'est sur cette icône qu'il faut cliquer." />
          </li>
          <li>
            Dans la fenêtre d'Edge qui s'ouvre, cliquez sur « Installer ».
            <img src={fenetreDInstallation} width={501} height={371} className={`${IMAGE} max-w-[22rem]`} alt="Fenêtre « Installer l'appli Simulateur indépendant FR » de Microsoft Edge, avec en bas les boutons « Installer » et « Pas maintenant ». Cliquez sur « Installer »." />
          </li>
        </ol>
        <p className={PETIT_TEXTE}>Si l'icône n'apparaît pas dans Edge : menu ⋯ (Paramètres et plus), puis Applications, puis « Installer ce site en tant qu'application ».</p>
        <p className={PETIT_TEXTE}>Google Chrome fonctionne de la même façon : l'icône d'installation est dans la barre d'adresse, ou bien menu ⋮, puis « Caster, enregistrer et partager », puis « Installer la page en tant qu'application ». Les noms des menus peuvent changer d'une version du navigateur à l'autre.</p>
      </section>
    </div>
  )
}

function AvecUnAutreNavigateur() {
  return (
    <div className="space-y-4 text-sm">
      <p>Deux solutions :</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>ouvrir cette démo dans Microsoft Edge ou Google Chrome, puis cliquer de nouveau sur « {COMMENT_FAIRE} » ;</li>
        <li>télécharger l'application de bureau, qui fonctionne elle aussi hors ligne et sans compte.</li>
      </ul>
      <LiensVersLApplicationDeBureau />
    </div>
  )
}

/** La fenêtre d'aide, ouverte par le bouton `declencheur`. */
function FenetreDInstallation({ declencheur }: { declencheur: ReactNode }) {
  const [ouverte, setOuverte] = useState(false)
  // Un navigateur qui envoie l'invitation sait installer la démo, quel que soit son nom.
  const chromium = installationPossible() || familleDuNavigateur() === "chromium"
  return (
    <Dialog open={ouverte} onOpenChange={setOuverte}>
      <DialogTrigger asChild>{declencheur}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>{TITRE_INSTALLER}</DialogTitle>
          <DialogDescription>{chromium ? "Ce navigateur installe la démo comme une application, sans rien télécharger d'autre." : "Ce navigateur (Firefox, Safari…) n'installe pas un site comme une application, à la façon d'Edge et de Chrome."}</DialogDescription>
        </DialogHeader>
        {chromium ? <AvecEdgeOuChrome /> : <AvecUnAutreNavigateur />}
      </DialogContent>
    </Dialog>
  )
}

/** La ligne du bandeau de la démo, et son bouton « Comment faire ? » ; rien une fois la démo installée. */
export function InvitationAInstaller({ className }: { className?: string }) {
  const id = useId()
  if (useDemoInstallee()) return null
  return (
    <p className="mt-1">
      <span id={id}>{INVITATION_A_INSTALLER}</span>
      <FenetreDInstallation
        declencheur={
          <Button type="button" variant="link" size="sm" className={className} aria-describedby={id}>
            {COMMENT_FAIRE}
          </Button>
        }
      />
    </p>
  )
}

/** Le bouton « Installer le simulateur » des paramètres de la démo ; rien une fois la démo installée. */
export function BoutonInstaller(bouton: Pick<ButtonProps, "variant" | "className">) {
  if (useDemoInstallee()) return null
  return (
    <FenetreDInstallation
      declencheur={
        <Button type="button" {...bouton}>
          <MonitorDown className="mr-2 size-4" aria-hidden="true" /> {TITRE_INSTALLER}
        </Button>
      }
    />
  )
}
