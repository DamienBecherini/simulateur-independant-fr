// src/web/BoutonInstaller.tsx
// Bouton « Installer l'application » de la démo web : il n'apparaît que lorsque le navigateur propose de l'installer
// (voir pwa/installation.ts), donc jamais dans l'application de bureau ni une fois la démo installée.

import { useSyncExternalStore } from "react"
import { MonitorDown } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { installationPossible, installer, surLInstallation } from "./pwa/installation"

export const TITRE_INSTALLER = "Installer l'application"

export function BoutonInstaller(bouton: Pick<ButtonProps, "variant" | "size" | "className">) {
  const possible = useSyncExternalStore(surLInstallation, installationPossible, () => false)
  if (!possible) return null
  return (
    <Button type="button" {...bouton} onClick={() => void installer()}>
      <MonitorDown className="mr-2 size-4" aria-hidden="true" /> {TITRE_INSTALLER}
    </Button>
  )
}
