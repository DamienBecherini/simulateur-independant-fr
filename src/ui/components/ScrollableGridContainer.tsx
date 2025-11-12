// src/ui/components/ScrollableGridContainer.tsx

import React, { useRef, useState, useEffect, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ScrollableGridContainerProps {
  children: React.ReactNode
}

export function ScrollableGridContainer({ children }: ScrollableGridContainerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // États pour le glissement tactile
  const isTouchDragging = useRef(false)
  const touchStartX = useRef(0)
  const scrollLeftStart = useRef(0)

  // Met à jour la visibilité des flèches en fonction de la position de défilement
  const checkScrollability = useCallback(() => {
    const el = scrollContainerRef.current
    if (el) {
      const isScrollable = el.scrollWidth > el.clientWidth
      setCanScrollLeft(isScrollable && el.scrollLeft > 1)
      setCanScrollRight(isScrollable && el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
    }
  }, [])

  // Attache un écouteur d'événement au défilement et à la redimension
  useEffect(() => {
    const el = scrollContainerRef.current
    if (el) {
      checkScrollability()
      el.addEventListener("scroll", checkScrollability)
      window.addEventListener("resize", checkScrollability)
      return () => {
        el.removeEventListener("scroll", checkScrollability)
        window.removeEventListener("resize", checkScrollability)
      }
    }
  }, [checkScrollability])

  // Fonctions pour les clics sur les flèches
  const handleScroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current
    if (el) {
      const scrollAmount = el.clientWidth * 0.8
      el.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" })
    }
  }

  // Logique pour le glisser-déposer TACTILE uniquement
  const handleTouchStart = (e: React.TouchEvent) => {
    const el = scrollContainerRef.current
    if (el) {
      isTouchDragging.current = true
      touchStartX.current = e.touches[0].pageX - el.offsetLeft
      scrollLeftStart.current = el.scrollLeft
    }
  }

  const handleTouchEnd = () => {
    isTouchDragging.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isTouchDragging.current) return
    const el = scrollContainerRef.current
    if (el) {
      const x = e.touches[0].pageX - el.offsetLeft
      const walk = (x - touchStartX.current) * 2
      el.scrollLeft = scrollLeftStart.current - walk
    }
  }

  return (
    <div className="relative group">
      {" "}
      {/* Ajout de la classe "group" pour le hover */}
      {/* MODIFIÉ : Flèche Gauche */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 z-20",
          "-translate-x-3/4", // MODIFIÉ : Positionnement à 50% pour la robustesse
          "h-24 w-14 rounded-lg shadow-lg",
          // MODIFIÉ : Nouvelles couleurs et effet de transition + backdrop-blur
          "bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200 dark:border-slate-700",
          "hover:bg-slate-200/90 dark:hover:bg-slate-800/90",
          // MODIFIÉ : L'opacité est maintenant gérée par l'état et le hover du parent "group"
          "transition-opacity duration-300",
          canScrollLeft ? "opacity-100" : "opacity-0 group-hover:opacity-100 pointer-events-none"
        )}
        onClick={() => handleScroll("left")}
      >
        <ChevronLeft className="h-8 w-8" />
      </Button>
      <div ref={scrollContainerRef} className="overflow-x-auto" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {children}
      </div>
      {/* MODIFIÉ : Flèche Droite */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "absolute right-0 top-1/2 -translate-y-1/2 z-20",
          "translate-x-3/4", // MODIFIÉ : Positionnement à 50% pour la robustesse
          "h-24 w-14 rounded-lg shadow-lg",
          // MODIFIÉ : Nouvelles couleurs et effet de transition + backdrop-blur
          "bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200 dark:border-slate-700",
          "hover:bg-slate-200/90 dark:hover:bg-slate-800/90",
          // MODIFIÉ : L'opacité est maintenant gérée par l'état et le hover du parent "group"
          "transition-opacity duration-300",
          canScrollRight ? "opacity-100" : "opacity-0 group-hover:opacity-100 pointer-events-none"
        )}
        onClick={() => handleScroll("right")}
      >
        <ChevronRight className="h-8 w-8" />
      </Button>
    </div>
  )
}
