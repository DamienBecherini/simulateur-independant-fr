// src/ui/components/MessageDeMontantInvalide.tsx
// Message sous un champ de montant dont la saisie est refusée : le champ le désigne par aria-describedby.

/** Une saisie refusée est signalée, jamais ignorée en silence : la ligne passe à la suivante (`basis-full`). */
export function MessageDeMontantInvalide({ id }: { id: string }) {
  return (
    <p id={id} role="alert" className="basis-full text-right text-sm text-destructive dark:text-red-400">
      Montant positif attendu, par exemple 1 250,50. Une charge se saisit avec un type de flux de charge, pas avec un montant négatif.
    </p>
  )
}
