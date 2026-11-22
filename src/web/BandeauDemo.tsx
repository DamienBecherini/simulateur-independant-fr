// src/web/BandeauDemo.tsx
// Bandeau de la démo web : il précise où vont les données, permet de repartir de la simulation d'exemple, et
// explique comment installer la démo comme une application. Une fois installée, elle devient la « version web
// installée », et le bandeau rappelle que la connexion d'une IA (MCP) demande l'application de bureau. Il se réduit
// à son nom, un bouton qui le déplie ; le choix est retenu comme celui des sections repliables.

import { useId } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSectionOuverte } from "@/ui/hooks/useSectionOuverte"
import { ANNEE_COURANTE } from "@/backend/regles/index"
import { reinitialiserDemo } from "./stockage-navigateur"
import { InvitationAInstaller } from "./AideALInstallation"
import { FenetreIADeLaDemo } from "./FenetreIADeLaDemo"
import { useDemoInstallee } from "./pwa/utiliser-l-installation"

const BOUTON_DU_BANDEAU = "h-auto min-h-6 p-0 pl-3 text-amber-900 dark:text-amber-100"

export const NOM_DE_LA_DEMO = "Démo web"
export const NOM_DE_LA_VERSION_INSTALLEE = "Version web installée"
export const IA_DANS_L_APPLICATION_DE_BUREAU = "Pour connecter une IA (Claude Desktop, LM Studio…) par MCP, il faut l'application de bureau."
export const EN_SAVOIR_PLUS = "En savoir plus"

/** La ligne de la version installée sur la connexion d'une IA ; « En savoir plus » ouvre la fenêtre MCP de la démo. */
function IAVersLApplicationDeBureau() {
  const id = useId()
  return (
    <p className="mt-1">
      <span id={id}>{IA_DANS_L_APPLICATION_DE_BUREAU}</span>
      <FenetreIADeLaDemo
        declencheur={
          <Button type="button" variant="link" size="sm" className={BOUTON_DU_BANDEAU} aria-describedby={id}>
            {EN_SAVOIR_PLUS}
          </Button>
        }
      />
    </p>
  )
}

/** Réduit ou déplie le bandeau ; « Voir plus » quand il est réduit à sa première phrase. */
/** Couleurs du bandeau, déplié ou réduit à son nom. */
const COULEURS_DU_BANDEAU = "border border-amber-300 bg-amber-50 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"

/**
 * Réduit le bandeau, depuis son angle haut droit : un bouton à contour, à l'écart des liens du texte pour ne pas s'y
 * confondre.
 */
function BoutonReduire({ controle, onReduire }: { controle: string; onReduire: () => void }) {
  return (
    <button type="button" aria-expanded="true" aria-controls={controle} onClick={onReduire} className={cn("inline-flex min-h-7 shrink-0 items-center gap-0.5 self-start whitespace-nowrap rounded-md border border-amber-400 bg-amber-100/60 px-2 text-xs font-semibold hover:bg-amber-100 pointer-coarse:min-h-11 dark:border-amber-600 dark:bg-amber-900/50 dark:hover:bg-amber-900", FOCUS)}>
      Réduire
      <ChevronDown aria-hidden="true" className="size-4 rotate-180" />
    </button>
  )
}

export function BandeauDemo() {
  const installee = useDemoInstallee()
  const nom = installee ? NOM_DE_LA_VERSION_INSTALLEE : NOM_DE_LA_DEMO
  // Déplié à la première visite : ce qu'il dit des données et des montants doit être lu une fois.
  const [ouvert, setOuvert] = useSectionOuverte("bandeau-demo", true)
  const contenu = useId()
  if (!ouvert) {
    // Réduit : son nom seul, en un bouton qui le déplie tout entier.
    return (
      <aside aria-label={nom} className="print:hidden mx-auto mt-4 flex justify-center">
        <button type="button" aria-expanded="false" onClick={() => setOuvert(true)} className={cn("inline-flex min-h-8 items-center gap-1 rounded-full px-3 font-semibold hover:bg-amber-100 pointer-coarse:min-h-11 dark:hover:bg-amber-900", COULEURS_DU_BANDEAU, FOCUS)}>
          {nom}
          <span className="sr-only"> : voir plus</span>
          <ChevronDown aria-hidden="true" className="size-4" />
        </button>
      </aside>
    )
  }
  return (
    <aside aria-label={nom} className={cn("print:hidden mx-auto mt-4 flex max-w-3xl items-start gap-3 rounded-md py-2 pl-4 pr-2", COULEURS_DU_BANDEAU)}>
      <div id={contenu} className="min-w-0 flex-1">
        <p>
          {nom} : vos simulations restent {installee ? "sur cet ordinateur" : "dans ce navigateur"}, rien n'est envoyé. Les montants sont indicatifs (règles {ANNEE_COURANTE}).{" "}
          <a className="underline" href="https://github.com/DamienBecherini/simulateur-independant-fr">
            Code source et application de bureau
          </a>
          <Button variant="link" size="sm" className={BOUTON_DU_BANDEAU} onClick={reinitialiserDemo}>
            Recommencer avec l'exemple
          </Button>
        </p>
        {installee ? <IAVersLApplicationDeBureau /> : <InvitationAInstaller className={BOUTON_DU_BANDEAU} />}
      </div>
      <BoutonReduire controle={contenu} onReduire={() => setOuvert(false)} />
    </aside>
  )
}
