// src/web/pwa/installation.ts
// Installation de la démo comme une application (Chrome, Edge) : le navigateur annonce par l'événement
// `beforeinstallprompt` qu'elle est installable ; l'interface garde cet événement pour que le bouton « Installer
// maintenant » de l'aide à l'installation (AideALInstallation.tsx) ouvre directement la fenêtre du navigateur. Il
// n'arrive ni dans Firefox et Safari, ni une fois la démo installée, ni dans l'application de bureau.

import { demanderUnStockagePersistant } from "../stockage-navigateur"

/** L'événement `beforeinstallprompt`, que TypeScript ne décrit pas (il n'est pas standard). */
export interface InvitationAInstaller extends Event {
  prompt(): Promise<unknown>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let invitation: InvitationAInstaller | null = null
let installeeDepuisCetOnglet = false
const abonnes = new Set<() => void>()
const prevenir = () => abonnes.forEach(abonne => abonne())

/** À appeler au démarrage, avant l'affichage : l'événement peut arriver très tôt. */
export function suivreLInstallation(cible: Pick<Window, "addEventListener"> = window) {
  cible.addEventListener("beforeinstallprompt", evenement => {
    // Sans cela, Chrome sur téléphone affiche son propre bandeau d'installation en plus de l'aide de la démo.
    evenement.preventDefault()
    invitation = evenement as InvitationAInstaller
    prevenir()
  })
  cible.addEventListener("appinstalled", () => {
    invitation = null
    installeeDepuisCetOnglet = true
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

/** Ce que l'aide doit savoir de la fenêtre : son mode d'affichage et, sur iPhone, `navigator.standalone`. */
export interface FenetreDeLaDemo {
  matchMedia?: (requete: string) => { matches: boolean }
  navigator: Partial<Navigator> & { standalone?: boolean }
}

/** Vrai si la démo est installée : ouverte dans sa propre fenêtre, ou installée depuis cet onglet. */
export function demoInstallee(fenetre: FenetreDeLaDemo = window): boolean {
  return installeeDepuisCetOnglet || fenetre.matchMedia?.("(display-mode: standalone)").matches === true || fenetre.navigator.standalone === true
}

/** Ce que l'aide doit savoir du navigateur ; `userAgentData` n'existe que dans les navigateurs Chromium récents. */
export interface NavigateurDeLaDemo {
  userAgent: string
  userAgentData?: { brands?: readonly { brand: string }[] }
}

/**
 * « chromium » pour les navigateurs qui installent un site comme une application (Edge, Chrome et leurs cousins),
 * « autre » pour Firefox, Safari et tout navigateur d'iPhone ou d'iPad (ce sont tous des Safari).
 */
export function familleDuNavigateur(navigateur: NavigateurDeLaDemo = navigator): "chromium" | "autre" {
  if (navigateur.userAgentData?.brands?.some(marque => marque.brand === "Chromium")) return "chromium"
  const { userAgent } = navigateur
  if (/iPhone|iPad|iPod|Firefox\//.test(userAgent)) return "autre"
  return /\b(Chrome|Chromium|Edg)\//.test(userAgent) ? "chromium" : "autre"
}
