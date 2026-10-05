// src/ui/hooks/useZoom.ts
// Zoom de l'interface, borné selon la largeur de la fenêtre (voir src/lib/zoom.ts) et réajusté quand elle change.
// Le zoom demandé est une préférence de l'utilisateur, retenue d'une ouverture à l'autre : il est fourni par l'appelant.

import { useEffect, useState } from "react"
import { PAS_DE_ZOOM, ZOOM_MINIMAL, bornerZoom, zoomMaximalPour } from "@/lib/zoom"

/**
 * @param zoomDemande Zoom choisi par l'utilisateur (1 = 100 %), appliqué dans les limites permises par la fenêtre.
 * @param setZoomDemande Retient le nouveau zoom choisi.
 */
export function useZoom(zoomDemande: number, setZoomDemande: (zoom: number) => void) {
  const [largeurFenetre, setLargeurFenetre] = useState(() => window.innerWidth)
  const zoom = bornerZoom(zoomDemande, largeurFenetre)

  useEffect(() => {
    const surRedimensionnement = () => setLargeurFenetre(window.innerWidth)
    window.addEventListener("resize", surRedimensionnement)
    return () => window.removeEventListener("resize", surRedimensionnement)
  }, [])

  useEffect(() => {
    document.body.style.zoom = `${zoom}`
  }, [zoom])

  return {
    zoom,
    // On part du zoom affiché, pas du zoom demandé : après un rétrécissement de la fenêtre, un clic agit tout de suite.
    zoomIn: () => setZoomDemande(bornerZoom(zoom + PAS_DE_ZOOM, largeurFenetre)),
    zoomOut: () => setZoomDemande(bornerZoom(zoom - PAS_DE_ZOOM, largeurFenetre)),
    canZoomIn: zoom < zoomMaximalPour(largeurFenetre),
    canZoomOut: zoom > ZOOM_MINIMAL
  }
}
