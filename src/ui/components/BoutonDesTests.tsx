// src/ui/components/BoutonDesTests.tsx
// Le bouton « Tests » de la barre d'outils, en mode développement seulement (npm run dev, npm run dev:web). Hors de
// ce mode, `import.meta.env.DEV` vaut false à la compilation : la fenêtre et les scénarios ne sont pas même
// embarqués dans l'application ni dans la démo.

import { lazy, Suspense } from "react"
import type { ScenariosDeTestProps } from "./ScenariosDeTest"

const ScenariosDeTest = import.meta.env.DEV ? lazy(() => import("./ScenariosDeTest")) : null

export function BoutonDesTests(props: ScenariosDeTestProps) {
  if (!ScenariosDeTest) return null
  return (
    <Suspense fallback={null}>
      <ScenariosDeTest {...props} />
    </Suspense>
  )
}
