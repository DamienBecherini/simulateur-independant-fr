// src/web/BandeauDemo.tsx
// Bandeau de la démo web : il précise où vont les données et permet de repartir de la simulation d'exemple.

import { Button } from "@/components/ui/button"
import { reinitialiserDemo } from "./stockage-navigateur"

export function BandeauDemo() {
  return (
    <aside aria-label="Démo web" className="mx-auto mt-4 max-w-3xl rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      Démo web : vos simulations restent dans ce navigateur, rien n'est envoyé. Les montants sont indicatifs (règles 2026).{" "}
      <a className="underline" href="https://github.com/DamienBecherini/simulateur-independant-fr">Code source et application de bureau</a>
      <Button variant="link" size="sm" className="h-auto p-0 pl-3 text-amber-900 dark:text-amber-100" onClick={reinitialiserDemo}>
        Recommencer avec l'exemple
      </Button>
    </aside>
  )
}
