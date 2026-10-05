// scripts/retours/etiqueter.test.mjs

import { describe, expect, it } from "vitest"
import { commandesGh, etiqueterTicket, lireEtiquettesActuelles } from "./etiqueter.mjs"

const CORPS = "### Note\n\n★★★★☆ 4/5\n\n### Affichage préféré\n\nClassique\n\n### Type de retour\n\nBug\n\n### Message\n\nLe total est faux."

// Exécuteur factice : retient les commandes au lieu de les lancer.
function enregistreur() {
  const appels = []
  return { appels, executer: (commande, args) => appels.push([commande, ...args]) }
}

describe("lireEtiquettesActuelles", () => {
  it("lit un tableau JSON de noms", () => {
    expect(lireEtiquettesActuelles('["retour","note-4"]')).toEqual(["retour", "note-4"])
  })

  it("renvoie un tableau vide pour un texte absent, invalide ou qui n'est pas un tableau, et ignore ce qui n'est pas un nom", () => {
    expect(lireEtiquettesActuelles(undefined)).toEqual([])
    expect(lireEtiquettesActuelles("pas du JSON")).toEqual([])
    expect(lireEtiquettesActuelles('{"name":"bug"}')).toEqual([])
    expect(lireEtiquettesActuelles('["bug", 3, null]')).toEqual(["bug"])
  })
})

describe("commandesGh", () => {
  it("ne lance rien quand il n'y a rien à changer", () => {
    expect(commandesGh("7", { ajouter: [], retirer: [] })).toEqual([])
  })

  it("crée les étiquettes ajoutées puis modifie le ticket en une fois", () => {
    expect(commandesGh("7", { ajouter: ["retour", "note-4"], retirer: ["note-5", "avis"] })).toEqual([
      ["label", "create", "retour", "--color", "0e8a16", "--description", "Retour d'un utilisateur (formulaire)", "--force"],
      ["label", "create", "note-4", "--color", "c2e0c6", "--description", "Note de 4/5", "--force"],
      ["issue", "edit", "7", "--add-label", "retour,note-4", "--remove-label", "note-5,avis"]
    ])
  })

  it("ne fait que retirer quand rien n'est ajouté", () => {
    expect(commandesGh("12", { ajouter: [], retirer: ["note-5"] })).toEqual([["issue", "edit", "12", "--remove-label", "note-5"]])
  })
})

describe("etiqueterTicket", () => {
  it("étiquette un nouveau ticket d'après son corps", () => {
    const { appels, executer } = enregistreur()
    const changements = etiqueterTicket({ ISSUE_NUMBER: "42", ISSUE_BODY: CORPS, ISSUE_LABELS: '["retour"]' }, executer)
    expect(changements).toEqual({ ajouter: ["note-4", "affichage-classique", "bug"], retirer: [] })
    expect(appels.map((appel) => appel.slice(0, 3))).toEqual([
      ["gh", "label", "create"],
      ["gh", "label", "create"],
      ["gh", "label", "create"],
      ["gh", "issue", "edit"]
    ])
    expect(appels.at(-1)).toEqual(["gh", "issue", "edit", "42", "--add-label", "note-4,affichage-classique,bug"])
  })

  it("ne lance aucune commande pour un ticket déjà à jour ou sans le formulaire", () => {
    const { appels, executer } = enregistreur()
    etiqueterTicket(
      { ISSUE_NUMBER: "42", ISSUE_BODY: CORPS, ISSUE_LABELS: '["retour","note-4","affichage-classique","bug"]' },
      executer
    )
    etiqueterTicket({ ISSUE_NUMBER: "43" }, executer)
    expect(appels).toEqual([])
  })

  it("passe un corps hostile sans jamais le placer dans les arguments", () => {
    const { appels, executer } = enregistreur()
    const hostile = "### Note\n\n$(touch /tmp/pwned)\n\n### Type de retour\n\nBug\"; rm -rf / #\n\n### Message\n\n`id`"
    etiqueterTicket({ ISSUE_NUMBER: "5", ISSUE_BODY: hostile, ISSUE_LABELS: "[]" }, executer)
    expect(appels.at(-1)).toEqual(["gh", "issue", "edit", "5", "--add-label", "retour"])
    expect(appels.flat().join(" ")).not.toMatch(/pwned|rm -rf|`id`/)
  })

  it("refuse un numéro de ticket absent ou invalide", () => {
    const { appels, executer } = enregistreur()
    expect(() => etiqueterTicket({ ISSUE_BODY: CORPS }, executer)).toThrow(/Numéro de ticket invalide/)
    expect(() => etiqueterTicket({ ISSUE_NUMBER: "1; rm -rf /", ISSUE_BODY: CORPS }, executer)).toThrow(
      /Numéro de ticket invalide/
    )
    expect(appels).toEqual([])
  })
})
