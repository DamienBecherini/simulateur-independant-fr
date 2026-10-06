// src/web/pwa/installation.ts
// Installation de la démo comme une application (Chrome, Edge) : le navigateur annonce par l'événement
// `beforeinstallprompt` qu'elle est installable ; l'interface garde cet événement pour proposer son propre bouton
// « Installer l'application ». Il n'arrive ni dans Firefox et Safari, ni une fois la démo installée, ni dans
// l'application de bureau : le bouton n'y apparaît donc pas.

import { demanderUnStockagePersistant } from "../stockage-navigateur"

/** L'événement `beforeinstallprompt`, que TypeScript ne décrit pas (il n'est pas standard). */
export interface InvitationAInstaller extends Event {
  prompt(): Promise<unknown>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let invitation: InvitationAInstaller | null = null
const abonnes = new Set<() => void>()
const prevenir = () => abonnes.forEach(abonne => abonne())

/** À appeler au démarrage, avant l'affichage : l'événement peut arriver très tôt. */
export function suivreLInstallation(cible: Pick<Window, "addEventListener"> = window) {
  cible.addEventListener("beforeinstallprompt", evenement => {
    // Sans cela, Chrome sur téléphone affiche son propre bandeau d'installation en plus du bouton.
    evenement.preventDefault()
    invitation = evenement as InvitationAInstaller
    prevenir()
  })
  cible.addEventListener("appinstalled", () => {
    invitation = null
    prevenir()
    void demanderUnStockagePersistant()
  })
}

/** Vrai si le navigateur propose d'installer la démo. */
export const installationPossible = () => invitation !== null

/** Pour `useSyncExternalStore` : rend la fonction de désabonnement. */
export function surLInstallation(abonne: () => void) {
  abonnes.add(abonne)
  return () => {
    abonnes.delete(abonne)
  }
}

/** Ouvre la fenêtre d'installation du navigateur ; vrai si l'utilisateur a installé la démo. */
export async function installer(): Promise<boolean> {
  const enCours = invitation
  if (!enCours) return false
  // Une invitation ne sert qu'une fois ; si l'utilisateur refuse, le navigateur en enverra une autre plus tard.
  invitation = null
  prevenir()
  await enCours.prompt()
  const { outcome } = await enCours.userChoice
  return outcome === "accepted"
}
