// src/ui/components/MessageDeMontantInvalide.tsx
// Message sous un champ de montant dont la saisie est refusée : le champ le désigne par aria-describedby.

/**
 * Une saisie refusée est signalée, jamais ignorée en silence : la ligne passe à la suivante (`basis-full`). `nul` :
 * le montant est 0 sur la ligne d'ajout, où il n'y a rien à ajouter.
 */
export function MessageDeMontantInvalide({ id, nul = false }: { id: string; nul?: boolean }) {
  return (
    <p id={id} role="alert" className="basis-full text-right text-sm text-destructive dark:text-red-400">
      {nul
        ? "Un flux à 0 € n'est pas ajouté. Pour retirer un flux existant, ramenez son montant à 0 dans sa ligne ou utilisez sa corbeille ; « Appliquer à » l'étend aux autres mois."
        : "Montant positif attendu, par exemple 1 250,50. Une charge se saisit avec un type de flux de charge, pas avec un montant négatif."}
    </p>
  )
}
