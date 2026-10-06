// src/ui/components/Footer.tsx

import { BoutonDesMentionsLegales } from "./MentionsLegales"

function Footer() {
  return (
    <footer className="mt-16 pt-8 print:mt-8 print:pt-4 border-t border-slate-200 dark:border-slate-800">
      <p className="text-center text-sm text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
        <strong>Avertissement :</strong> Ce simulateur fournit des estimations à but purement pédagogique et informatif. Les calculs reposent sur les taux et barèmes de l'année indiquée dans les résultats et contiennent des approximations. Ils ne sauraient en aucun cas se substituer aux conseils personnalisés d'un professionnel qualifié (expert-comptable, avocat fiscaliste, etc.).
      </p>
      <p className="mt-2 text-center print:hidden">
        <BoutonDesMentionsLegales variant="link" size="sm" className="h-auto min-h-6 whitespace-normal text-slate-700 dark:text-slate-300" />
      </p>
    </footer>
  )
}

export default Footer
