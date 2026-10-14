// src/ui/components/MontagesTypes.test.tsx
// Fenêtre des situations types : liste en cartes, détail, chargement direct ou après confirmation, retour du focus ;
// dans la démo web, la copie du lien de chaque situation.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { MONTAGES_TYPES } from "@/lib/montages/montages"
import { PLATEFORME_DE_BUREAU, PlateformeContext, type Plateforme } from "../plateforme"
import { BoutonDesMontages } from "./MontagesTypes"

function ouvrir(confirmationNecessaire = false) {
  const onCharger = vi.fn()
  const user = userEvent.setup({ delay: null })
  render(<BoutonDesMontages onCharger={onCharger} confirmationNecessaire={confirmationNecessaire} nomDeLaSession="Ma simulation" />)
  return { user, onCharger, ouvrirLaFenetre: () => user.click(screen.getByRole("button", { name: "Partir d'une situation type..." })) }
}

const fenetre = () => screen.getByRole("dialog", { name: "Partir d'une situation type" })

describe("Fenêtre des situations types", () => {
  it("liste chaque montage en carte : titre, résumé et mots-clés", async () => {
    const { ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()

    const cartes = within(within(fenetre()).getByRole("list", { name: "Situations types" })).getAllByRole("listitem").filter(item => item.querySelector("h3"))
    expect(cartes).toHaveLength(MONTAGES_TYPES.length)
    const sasu = within(fenetre()).getByRole("heading", { name: "SASU sans salaire, tout en dividendes" }).closest("li")!
    expect(sasu).toHaveTextContent("Thomas préside seul une SASU")
    expect(within(within(sasu).getByRole("list", { name: "Mots-clés" })).getAllByRole("listitem").map(li => li.textContent)).toEqual(["SASU", "Dividendes", "Retraite"])
  })

  it("montre le détail d'une situation, ses sources dans une nouvelle fenêtre, puis revient à la liste avec le focus sur sa carte", async () => {
    const { user, ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()

    await user.click(screen.getByRole("button", { name: "Détails de la situation « Couple en union libre, puis marié ou pacsé »" }))
    const detail = screen.getByRole("dialog", { name: "Couple en union libre, puis marié ou pacsé" })
    for (const rubrique of ["Questions auxquelles il répond", "Ce que cette situation illustre", "Conditions", "Points d'attention et risques", "Sources officielles"]) {
      expect(within(detail).getByRole("heading", { name: rubrique })).toBeInTheDocument()
    }
    const source = within(detail).getByRole("link", { name: /Déclaration de revenus d'un couple en union libre/ })
    expect(source).toHaveAttribute("href", "https://www.service-public.gouv.fr/particuliers/vosdroits/F362")
    expect(source).toHaveAttribute("target", "_blank")
    expect(within(detail).getByRole("button", { name: "Toutes les situations" })).toHaveFocus()

    await user.click(within(detail).getByRole("button", { name: "Retour" }))
    expect(screen.getByRole("button", { name: "Détails de la situation « Couple en union libre, puis marié ou pacsé »" })).toHaveFocus()
  })

  it("charge le montage depuis son détail et ferme la fenêtre, sans confirmation quand rien n'est perdu", async () => {
    const { user, onCharger, ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()

    await user.click(screen.getByRole("button", { name: "Détails de la situation « SASU sans salaire, tout en dividendes »" }))
    await user.click(screen.getByRole("button", { name: "Charger cette situation" }))

    expect(onCharger).toHaveBeenCalledWith(MONTAGES_TYPES.find(m => m.id === "sasu-sans-salaire"))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("demande confirmation avant de remplacer une simulation non enregistrée ; « Annuler » ne charge rien", async () => {
    const { user, onCharger, ouvrirLaFenetre } = ouvrir(true)
    await ouvrirLaFenetre()

    await user.click(screen.getByRole("button", { name: "Charger la situation « Micro-entreprise seule (BNC) »" }))
    const confirmation = screen.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })
    expect(confirmation).toHaveTextContent("« Ma simulation » n'est pas enregistrée dans une sauvegarde. La situation « Micro-entreprise seule (BNC) » la remplacera")

    await user.click(within(confirmation).getByRole("button", { name: "Annuler" }))
    expect(onCharger).not.toHaveBeenCalled()
    expect(fenetre()).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Charger la situation « Micro-entreprise seule (BNC) »" })).toHaveFocus()

    await user.click(screen.getByRole("button", { name: "Charger la situation « Micro-entreprise seule (BNC) »" }))
    await user.click(screen.getByRole("button", { name: "Remplacer" }))
    expect(onCharger).toHaveBeenCalledWith(MONTAGES_TYPES[0])
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("se ferme à la touche Échap, puis se rouvre sur la liste", async () => {
    const { user, ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()
    await user.click(screen.getByRole("button", { name: "Détails de la situation « Conjoint salarié de la SASU »" }))

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await ouvrirLaFenetre()
    expect(fenetre()).toBeInTheDocument()
  })

  describe("« Copier le lien » d'une situation", () => {
    /** La démo web : chaque situation a son lien à partager. */
    const DEMO: Plateforme = { ...PLATEFORME_DE_BUREAU, web: true, lienVersUneSituation: identifiant => `https://exemple.fr/simulateur/#situation=${identifiant}` }

    function ouvrirDansLaDemo() {
      const user = userEvent.setup({ delay: null })
      render(
        <PlateformeContext value={DEMO}>
          <BoutonDesMontages onCharger={vi.fn()} confirmationNecessaire={false} nomDeLaSession="Ma simulation" />
        </PlateformeContext>
      )
      return { user, ouvrirLaFenetre: () => user.click(screen.getByRole("button", { name: "Partir d'une situation type..." })) }
    }

    it("n'existe pas dans l'application de bureau, qui n'a pas d'adresse à partager", async () => {
      const { ouvrirLaFenetre } = ouvrir()
      await ouvrirLaFenetre()
      expect(within(fenetre()).queryByRole("button", { name: /^Copier le lien/ })).not.toBeInTheDocument()
      expect(within(fenetre()).queryByRole("status")).not.toBeInTheDocument()
    })

    it("dans la démo, copie l'adresse de la situation et le confirme sur le bouton et à voix haute", async () => {
      const { user, ouvrirLaFenetre } = ouvrirDansLaDemo()
      await ouvrirLaFenetre()
      expect(within(fenetre()).getAllByRole("button", { name: /^Copier le lien de la situation/ })).toHaveLength(MONTAGES_TYPES.length)
      const ecrire = vi.spyOn(navigator.clipboard, "writeText")

      const bouton = within(fenetre()).getByRole("button", { name: "Copier le lien de la situation « Couple en union libre, puis marié ou pacsé »" })
      await user.click(bouton)

      expect(ecrire).toHaveBeenCalledWith("https://exemple.fr/simulateur/#situation=couple-union-libre")
      expect(await within(fenetre()).findByRole("status")).toHaveTextContent("Lien de « Couple en union libre, puis marié ou pacsé » copié : https://exemple.fr/simulateur/#situation=couple-union-libre")
      expect(bouton).toHaveTextContent("Lien copié")
      // Les autres cartes gardent leur bouton tel quel.
      expect(within(fenetre()).getByRole("button", { name: "Copier le lien de la situation « Salarié avec une micro-entreprise à côté »" })).toHaveTextContent("Copier le lien")
    })

    it("dans la démo, dit quand la copie échoue et montre le lien à copier", async () => {
      const { user, ouvrirLaFenetre } = ouvrirDansLaDemo()
      await ouvrirLaFenetre()
      vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("refusé"))

      const bouton = within(fenetre()).getByRole("button", { name: "Copier le lien de la situation « Salarié avec une micro-entreprise à côté »" })
      await user.click(bouton)

      expect(await within(fenetre()).findByRole("status")).toHaveTextContent("La copie a échoué : sélectionnez le lien pour le copier, https://exemple.fr/simulateur/#situation=salarie-et-micro")
      expect(bouton).toHaveTextContent("Copier le lien")
    })
  })
})
