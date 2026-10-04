// src/ui/components/DevWindowSize.tsx

import { useEffect, useState } from "react"

// Points de rupture de Tailwind, du plus large au plus étroit.
const breakpoints: [name: string, minWidth: number][] = [
  ["2xl", 1536],
  ["xl", 1280],
  ["lg", 1024],
  ["md", 768],
  ["sm", 640]
]

/**
 * Pastille de développement : dimensions de la fenêtre et point de rupture Tailwind actif.
 * N'est rendue qu'en mode développement (voir App.tsx).
 */
export function DevWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const breakpoint = breakpoints.find(([, minWidth]) => size.width >= minWidth)?.[0] ?? "base"

  return (
    <div className="pointer-events-none fixed bottom-2 right-2 z-50 rounded bg-black/70 px-2 py-1 font-mono text-xs text-white">
      {size.width} × {size.height} · {breakpoint}
    </div>
  )
}
