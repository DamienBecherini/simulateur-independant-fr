// src/ui/components/DetailDesModificationsDeLIA.tsx
// Le corps de la notification des modifications de l'IA (voir useModificationsDeLIA) : les dernières lignes de résumé,
// le nombre des plus anciennes, et comment les défaire.

/** Au-delà, les plus anciennes sont comptées sans être recopiées : la notification doit tenir à l'écran. */
const LIGNES_AFFICHEES = 6

export function DetailDesModificationsDeLIA({ lignes }: { lignes: readonly string[] }) {
  const affichees = lignes.slice(-LIGNES_AFFICHEES)
  const masquees = lignes.length - affichees.length
  return (
    <div className="space-y-1">
      <ul className="list-disc space-y-0.5 pl-4">
        {affichees.map((ligne, rang) => (
          <li key={rang}>{ligne}</li>
        ))}
      </ul>
      {masquees > 0 ? <p>et {masquees > 1 ? `${masquees} modifications plus anciennes` : "1 modification plus ancienne"}.</p> : null}
      <p>{lignes.length > 1 ? "Vérifiez-les ; « Annuler » dans la barre d'outils (Ctrl+Z) les défait une à une." : "Vérifiez-la ; « Annuler » dans la barre d'outils (Ctrl+Z) la défait."}</p>
    </div>
  )
}

