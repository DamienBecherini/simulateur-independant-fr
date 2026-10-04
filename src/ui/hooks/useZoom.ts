// src/ui/hooks/useZoom.ts
// Zoom de l'interface, borné selon la largeur de la fenêtre (voir src/lib/zoom.ts) et réajusté quand elle change.

import { useEffect, useState } from "react"
import { PAS_DE_ZOOM, ZOOM_MINIMAL, bornerZoom, zoomMaximalPour } from "@/lib/zoom"

export function useZoom() {
  const [largeurFenetre, setLargeurFenetre] = useState(() => window.innerWidth)
  const [zoomDemande, setZoomDemande] = useState(1)
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
