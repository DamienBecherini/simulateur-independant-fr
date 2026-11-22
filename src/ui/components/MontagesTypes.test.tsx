// src/ui/components/MontagesTypes.test.tsx
// Fenêtre des situations types : liste en cartes, recherche et filtres, détail, chargement direct ou après confirmation, retour du focus ;
// dans la démo web, la copie du lien de chaque situation.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ANCRES } from "@/lib/ancres"
import { MONTAGES_TYPES } from "@/lib/montages/montages"
import { allerALaReponse } from "../allerALaReponse"
import { PLATEFORME_DE_BUREAU, PlateformeContext, type Plateforme } from "../plateforme"
import { BoutonDesMontages } from "./MontagesTypes"

vi.mock("../allerALaReponse", async importOriginal => ({ ...(await importOriginal<typeof import("../allerALaReponse")>()), allerALaReponse: vi.fn() }))

function ouvrir(confirmationNecessaire = false) {
  const onCharger = vi.fn()
  const user = userEvent.setup({ delay: null })
  render(<BoutonDesMontages onCharger={onCharger} confirmationNecessaire={confirmationNecessaire} nomDeLaSession="Ma simulation" />)
  return { user, onCharger, ouvrirLaFenetre: () => user.click(screen.getByRole("button", { name: "Partir d'une situation type..." })) }
}

const fenetre = () => screen.getByRole("dialog", { name: "Par où commencer ?" })

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

  it("s'ouvre sur l'onglet « Situations types » ; l'onglet « Questions » liste les questions de chaque situation", async () => {
    const { user, ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()

    expect(within(fenetre()).getByRole("tab", { name: /^Situations types/ })).toHaveAttribute("aria-selected", "true")
    await user.click(within(fenetre()).getByRole("tab", { name: /^Questions/ }))
    const questions = within(within(fenetre()).getByRole("list", { name: "Questions" })).getAllByRole("listitem")
    expect(questions).toHaveLength(MONTAGES_TYPES.flatMap(montage => montage.questions).length)
    expect(questions[0]).toHaveTextContent("Combien me reste-t-il après cotisations et impôt ?Situation type : Micro-entreprise seule (BNC)")
  })

  it("les onglets se parcourent aux flèches du clavier", async () => {
    const { user, ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()

    within(fenetre()).getByRole("tab", { name: /^Situations types/ }).focus()
    await user.keyboard("{ArrowRight}")
    expect(within(fenetre()).getByRole("tab", { name: /^Questions/ })).toHaveFocus()
    expect(within(fenetre()).getByRole("tab", { name: /^Questions/ })).toHaveAttribute("aria-selected", "true")
  })

  it("une question mène à sa situation : l'onglet change, sa carte est mise en avant avec le focus sur « Charger », puis « Retour aux questions »", async () => {
    const { user, onCharger, ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()
    await user.click(within(fenetre()).getByRole("tab", { name: /^Questions/ }))

    await user.click(within(fenetre()).getAllByRole("button", { name: "Voir la situation « Couple en union libre, puis marié ou pacsé »" })[0])
    expect(within(fenetre()).getByRole("tab", { name: /^Situations types/ })).toHaveAttribute("aria-selected", "true")
    expect(within(fenetre()).getByText(/La situation qui répond à « Le mariage ou le Pacs réduirait-il notre impôt \? »/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Charger la situation « Couple en union libre, puis marié ou pacsé »" })).toHaveFocus()

    await user.click(within(fenetre()).getByRole("button", { name: "Retour aux questions" }))
    expect(within(fenetre()).getByRole("tab", { name: /^Questions/ })).toHaveAttribute("aria-selected", "true")
    expect(onCharger).not.toHaveBeenCalled()
  })

  it("« Charger » d'une question charge sa situation et ferme la fenêtre, après confirmation si la simulation en cours serait perdue", async () => {
    const { user, onCharger, ouvrirLaFenetre } = ouvrir(true)
    await ouvrirLaFenetre()
    await user.click(within(fenetre()).getByRole("tab", { name: /^Questions/ }))

    await user.click(screen.getByRole("button", { name: "Charger la situation qui répond à « Le mariage ou le Pacs réduirait-il notre impôt ? »" }))
    const confirmation = screen.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })
    await user.click(within(confirmation).getByRole("button", { name: "Remplacer" }))
    expect(onCharger).toHaveBeenCalledWith(MONTAGES_TYPES.find(m => m.id === "couple-union-libre"))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(allerALaReponse).toHaveBeenCalledWith(ANCRES.comparaisonDuCouple)
  })

  it("la carte mise en avant depuis une question se charge comme les autres : en haut de la page, sans mener à la réponse", async () => {
    vi.mocked(allerALaReponse).mockClear()
    const { user, onCharger, ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()
    await user.click(within(fenetre()).getByRole("tab", { name: /^Questions/ }))
    await user.click(within(fenetre()).getAllByRole("button", { name: "Voir la situation « Couple en union libre, puis marié ou pacsé »" })[0])

    await user.click(screen.getByRole("button", { name: "Charger la situation « Couple en union libre, puis marié ou pacsé »" }))
    expect(onCharger).toHaveBeenCalledWith(MONTAGES_TYPES.find(m => m.id === "couple-union-libre"))
    expect(allerALaReponse).not.toHaveBeenCalled()
  })

  it("la recherche et les filtres valent pour les questions : « En couple » n'en garde que celles des couples", async () => {
    const { user, ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()
    await user.click(within(fenetre()).getByRole("tab", { name: /^Questions/ }))

    await user.click(within(within(fenetre()).getByRole("group", { name: "Foyer" })).getByRole("button", { name: "En couple" }))
    expect(within(fenetre()).getByText(/^\d+ questions sur 36$/)).toBeInTheDocument()
    await user.type(screen.getByRole("searchbox", { name: "Rechercher une question" }), "pacs")
    const questions = within(within(fenetre()).getByRole("list", { name: "Questions" })).getAllByRole("listitem")
    // « pacs » se trouve dans une question, et dans le titre de sa situation : ses trois questions restent.
    expect(questions.map(q => q.querySelector("p")?.textContent)).toEqual(["Le mariage ou le Pacs réduirait-il notre impôt ?", "Combien chacun paie-t-il aujourd'hui ?", "Le versement libératoire reste-t-il possible après un mariage ?"])
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

describe("Recherche et filtres des situations types", () => {
  const titres = () =>
    within(within(fenetre()).getByRole("list", { name: "Situations types" }))
      .queryAllByRole("heading", { level: 3 })
      .map(titre => titre.textContent)
  const puce = (nom: string) => within(fenetre()).getByRole("button", { name: new RegExp(`^${nom}$`) })
  const recherche = () => within(fenetre()).getByRole("searchbox", { name: "Rechercher une situation" })

  it("à l'ouverture, le focus est sur la recherche, et rien n'est filtré", async () => {
    const { ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()
    expect(recherche()).toHaveFocus()
    expect(titres()).toHaveLength(MONTAGES_TYPES.length)
    expect(within(fenetre()).queryByText(/situations? sur/)).not.toBeInTheDocument()
    expect(within(within(fenetre()).getByRole("group", { name: "Statut" })).getAllByRole("button").map(b => [b.textContent, b.getAttribute("aria-pressed")])).toEqual([
      ["Micro", "false"],
      ["SASU", "false"],
      ["EURL", "false"],
      ["Entreprise individuelle", "false"]
    ])
    expect(within(within(fenetre()).getByRole("group", { name: "Foyer" })).getAllByRole("button").map(b => b.textContent)).toEqual(["Seul", "En couple"])
  })

  it("la recherche filtre à la frappe, sans accent ni majuscule ; « Tout afficher » rend la bibliothèque", async () => {
    const { user, ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()
    await user.type(recherche(), "kine")
    expect(titres()).toEqual(["Kinésithérapeute conventionné en entreprise individuelle"])
    expect(within(fenetre()).getByText(`1 situation sur ${MONTAGES_TYPES.length}`)).toBeInTheDocument()

    await user.clear(recherche())
    await user.type(recherche(), "licorne")
    expect(titres()).toEqual([])
    expect(within(fenetre()).getByText("Aucune situation ne correspond.")).toBeInTheDocument()

    await user.click(within(fenetre()).getByRole("button", { name: "Tout afficher" }))
    expect(recherche()).toHaveValue("")
    expect(titres()).toHaveLength(MONTAGES_TYPES.length)
  })

  it("les filtres se cochent et se combinent : statut et foyer", async () => {
    const { user, ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()
    await user.click(puce("EURL"))
    expect(puce("EURL")).toHaveAttribute("aria-pressed", "true")
    expect(titres()).toHaveLength(1)
    // Un second statut s'ajoute au premier.
    await user.click(puce("Entreprise individuelle"))
    expect(titres()).toHaveLength(2)
    expect(within(fenetre()).getByText(`2 situations sur ${MONTAGES_TYPES.length}`)).toBeInTheDocument()
    // Le foyer restreint : aucune de ces deux situations n'est en couple.
    await user.click(puce("En couple"))
    expect(titres()).toEqual([])
    // Décocher rend les situations.
    await user.click(puce("EURL"))
    await user.click(puce("Entreprise individuelle"))
    expect(puce("EURL")).toHaveAttribute("aria-pressed", "false")
    expect(titres().length).toBeGreaterThan(2)
    expect(titres().length).toBeLessThan(MONTAGES_TYPES.length)
  })

  it("les critères sont gardés au retour du détail d'une situation, et oubliés à la fermeture de la fenêtre", async () => {
    const { user, ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()
    await user.type(recherche(), "zone franche")
    await user.click(puce("SASU"))
    expect(titres()).toEqual(["SASU en zone franche urbaine (ZFU-TE)"])
    await user.click(within(fenetre()).getByRole("button", { name: "Détails de la situation « SASU en zone franche urbaine (ZFU-TE) »" }))
    await user.click(screen.getByRole("button", { name: "Retour" }))
    expect(recherche()).toHaveValue("zone franche")
    expect(puce("SASU")).toHaveAttribute("aria-pressed", "true")
    expect(titres()).toEqual(["SASU en zone franche urbaine (ZFU-TE)"])

    await user.keyboard("{Escape}")
    await ouvrirLaFenetre()
    expect(recherche()).toHaveValue("")
    expect(titres()).toHaveLength(MONTAGES_TYPES.length)
  })
})
