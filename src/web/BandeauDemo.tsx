// src/web/BandeauDemo.tsx
// Bandeau de la démo web : il précise où vont les données, permet de repartir de la simulation d'exemple, et
// explique comment installer la démo comme une application. Une fois installée, elle devient la « version web
// installée », et le bandeau rappelle que la connexion d'une IA (MCP) demande l'application de bureau.

import { useId } from "react"
import { Button } from "@/components/ui/button"
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

export function BandeauDemo() {
  const installee = useDemoInstallee()
  const nom = installee ? NOM_DE_LA_VERSION_INSTALLEE : NOM_DE_LA_DEMO
  return (
    <aside aria-label={nom} className="print:hidden mx-auto mt-4 max-w-3xl rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <p>
        {nom} : vos simulations restent {installee ? "sur cet ordinateur" : "dans ce navigateur"}, rien n'est envoyé. Les montants sont indicatifs (règles {ANNEE_COURANTE}).{" "}
        <a className="underline" href="https://github.com/DamienBecherini/simulateur-independant-fr">Code source et application de bureau</a>
        <Button variant="link" size="sm" className={BOUTON_DU_BANDEAU} onClick={reinitialiserDemo}>
          Recommencer avec l'exemple
        </Button>
      </p>
      {installee ? <IAVersLApplicationDeBureau /> : <InvitationAInstaller className={BOUTON_DU_BANDEAU} />}
    </aside>
  )
}
