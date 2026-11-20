// src/ui/hooks/useZoom.ts
// Zoom de l'interface, borné selon la largeur de la fenêtre (voir src/lib/zoom.ts) et réajusté quand elle change.
// Le zoom demandé est une préférence de l'utilisateur, retenue d'une ouverture à l'autre : il est fourni par l'appelant.
// Ctrl+0 (Cmd+0 sur Mac) ramène l'interface à 100 %.

import { useEffect, useState } from "react"
import { demandeLeZoomNormal, estUnMac } from "@/lib/raccourcis-clavier"
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
    // Sous un zoom, Chromium agrandit aussi les unités de l'écran (100dvh vaut 1,3 écran à 130 %) : ce qui doit tenir
    // dans la hauteur de la fenêtre divise par --zoom (notification de l'IA, fenêtre de saisie mensuelle).
    document.documentElement.style.setProperty("--zoom", `${zoom}`)
  }, [zoom])

  useEffect(() => {
    const mac = estUnMac(navigator.userAgent)
    const surTouche = (event: KeyboardEvent) => {
      // À 100 %, la touche reste au navigateur ou à l'application de bureau : elle y remet leur propre zoom à 100 %.
      if (zoom === 1 || !demandeLeZoomNormal(event, mac)) return
      event.preventDefault()
      setZoomDemande(1)
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [zoom, setZoomDemande])

  return {
    zoom,
    /** Le zoom maximal que permet la largeur de la fenêtre : au-delà, la mise en page ne tiendrait plus. */
    zoomMaximal: zoomMaximalPour(largeurFenetre),
    reinitialiser: () => setZoomDemande(1),
    // On part du zoom affiché, pas du zoom demandé : après un rétrécissement de la fenêtre, un clic agit tout de suite.
    zoomIn: () => setZoomDemande(bornerZoom(zoom + PAS_DE_ZOOM, largeurFenetre)),
    zoomOut: () => setZoomDemande(bornerZoom(zoom - PAS_DE_ZOOM, largeurFenetre)),
    canZoomIn: zoom < zoomMaximalPour(largeurFenetre),
    canZoomOut: zoom > ZOOM_MINIMAL
  }
}
