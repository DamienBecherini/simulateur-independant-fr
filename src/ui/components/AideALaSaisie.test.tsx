// src/ui/components/AideALaSaisie.test.tsx

import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AideALaSaisie } from "./AideALaSaisie"

const consignes = () => within(screen.getByRole("list")).getAllByRole("listitem").map(ligne => ligne.textContent)

describe("aide à la saisie de la fenêtre d'un mois", () => {
  it("une consigne par ligne, qui commence par le geste, dans l'ordre où l'on en a besoin", () => {
    render(<AideALaSaisie autresAnnees recopie anneeDesCotisations={2026} />)
    expect(consignes()).toEqual([
      "Chaque mois ? Choisissez « Ajouter à » avant d'ajouter : le flux est recopié sur les autres mois, et aux mêmes mois des années cochées sous « Aussi en ».",
      "Modifier, retirer ne vaut que pour ce mois ; si le même flux (même type, même libellé) existe dans d'autres mois, une barre propose ensuite de faire de même.",
      "Recopier un flux jusqu'en décembre de l'année affichée.",
      "Retirer : la corbeille, ou un montant ramené à 0.",
      "Réordonner : glissez la poignée.",
      "Salaire : sans brut saisi, il est calculé avec les cotisations salariales de 2026 ; videz-le pour n'en compter aucune."
    ])
    expect(screen.getByText("Recopier").tagName).toBe("STRONG")
  })

  it("suit la fenêtre : sans autre année, sans recopie (décembre), pour une activité (pas de salaire)", () => {
    render(<AideALaSaisie autresAnnees={false} recopie={false} />)
    const lignes = consignes()
    expect(lignes.map(ligne => ligne?.split(" ")[0])).toEqual(["Chaque", "Modifier,", "Retirer", "Réordonner"])
    expect(lignes[0]).not.toContain("Aussi en")
  })
})
