// src/ui/components/ConfirmationDeRemplacement.tsx
// Confirmation avant de remplacer la simulation en cours (montage type, réinitialisation) : une question, une phrase
// qui dit ce qui sera remplacé, et le focus rendu au bouton qui l'a demandée.

import type { ReactNode, RefObject } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ConfirmationDeRemplacementProps {
  open: boolean
  /** Fermeture sans remplacer (bouton « Annuler », Échap, clic à côté). */
  onAnnuler: () => void
  onConfirmer: () => void
  titre: string
  libelleDeConfirmation: string
  /** Bouton qui a demandé la confirmation : le focus y revient à la fermeture. */
  declencheur: RefObject<HTMLElement | null>
  children: ReactNode
}

export function ConfirmationDeRemplacement({ open, onAnnuler, onConfirmer, titre, libelleDeConfirmation, declencheur, children }: ConfirmationDeRemplacementProps) {
  return (
    <Dialog open={open} onOpenChange={ouverte => !ouverte && onAnnuler()}>
      <DialogContent
        onCloseAutoFocus={evenement => {
          evenement.preventDefault()
          if (declencheur.current?.isConnected) declencheur.current.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
          <DialogDescription>{children}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onAnnuler}>
            Annuler
          </Button>
          <Button onClick={onConfirmer}>{libelleDeConfirmation}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
