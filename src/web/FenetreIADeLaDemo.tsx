// src/web/FenetreIADeLaDemo.tsx
// La fenêtre « Utiliser avec une IA (MCP) » de la démo web : ce que cela permet, et pourquoi il faut l'application de
// bureau, avec ses liens. Le bouton des paramètres l'affiche par la plateforme de la démo (plateforme-web.ts), le
// bandeau de la version installée par « En savoir plus ».

import type { ReactNode } from "react"
import { CE_QUE_PERMET_L_IA, FenetreIA } from "@/ui/components/UtiliserAvecUneIA"
import { LiensVersLApplicationDeBureau } from "./ApplicationDeBureau"

/** Dans la démo web : ce que permet le serveur MCP, et pourquoi il faut l'application de bureau. */
export function SeulementDansLApplicationDeBureau() {
  return (
    <div className="space-y-4 text-sm">
      <p>{CE_QUE_PERMET_L_IA}</p>
      <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        <strong>Seulement dans l'application de bureau :</strong> le client d'IA y lance un petit programme du simulateur, sur votre ordinateur, et un navigateur ne peut pas démarrer de programme.
      </p>
      <LiensVersLApplicationDeBureau />
    </div>
  )
}

/** La fenêtre de la démo web (renvoi vers l'application de bureau), ouverte par un autre bouton que celui des paramètres. */
export function FenetreIADeLaDemo({ declencheur }: { declencheur: ReactNode }) {
  return (
    <FenetreIA declencheur={declencheur}>
      <SeulementDansLApplicationDeBureau />
    </FenetreIA>
  )
}
