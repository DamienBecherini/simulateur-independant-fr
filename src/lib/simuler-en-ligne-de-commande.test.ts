// src/lib/simuler-en-ligne-de-commande.test.ts

import { describe, expect, it } from "vitest"
import { lireLaSession, contenuDuFichier } from "@/backend/logic/fichiers-de-donnees"
import { simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { eurosEnTexteBrut as euros } from "@/backend/logic/format"
import { MONTAGES_TYPES, sessionDUnMontage } from "@/lib/montages/montages"
import { AIDE, executerSimuler, lireLesArguments, messageDErreurDuFichier } from "@/lib/simuler-en-ligne-de-commande"
import { sessionMaximale } from "@/lib/testing/session-maximale"
import type { SessionState } from "@/types"

/** La commande sur un fichier en mémoire, nommé « session.json ». */
const simuler = (contenu: string, ...options: string[]) => executerSimuler(["session.json", ...options], () => contenu)
const maximale = contenuDuFichier(sessionMaximale())
const rapports = simulerLesAnnees(lireLaSession(maximale).safeState).annees

describe("lireLesArguments", () => {
  it("lit le fichier et les options, dans n'importe quel ordre", () => {
    expect(lireLesArguments(["--annee", "2025", "s.json", "--acteur", "Alice", "--json"])).toEqual({ fichier: "s.json", annee: 2025, acteur: "Alice", json: true })
    expect(lireLesArguments(["s.json"])).toEqual({ fichier: "s.json", json: false })
  })

  it.each([["--aide"], ["-h"], ["--help"]])("rend null pour %s (aide)", option => {
    expect(lireLesArguments(["s.json", option])).toBeNull()
  })

  it.each([
    [[], "Indiquez le fichier"],
    [["a.json", "b.json"], "Un seul fichier"],
    [["s.json", "--annee"], "--annee attend une valeur"],
    [["s.json", "--acteur", "--json"], "--acteur attend une valeur"],
    [["s.json", "--annee", "26"], "Année invalide"],
    [["s.json", "--verbeux"], "Option inconnue : --verbeux"]
  ])("refuse %j", (args, message) => {
    expect(() => lireLesArguments(args)).toThrow(message)
  })
})

describe("executerSimuler", () => {
  it("affiche chaque année avec ses règles, chaque activité, chaque foyer et le bilan", () => {
    const { code, texte } = simuler(maximale)
    expect(code).toBe(0)
    expect(texte).toMatch(/^Simulation « Famille Martin — tout rempli » : session\.json\n/)
    for (const { annee, report } of rapports) {
      expect(texte).toContain(`== ${annee} (règles de ${annee}) ==`)
      for (const activite of report!.activities) expect(texte).toContain(`  ${activite.name} (${activite.statut})`)
      expect(texte).toContain(euros(report!.totalNetApresImpots))
    }
    const derniere = rapports[rapports.length - 1].report!
    const sasu = derniere.activities.find(a => a.entityId === "c-sasu")!
    expect(texte).toContain(`    ${"Impôt sur les sociétés".padEnd(30)}${euros(sasu.impotSocietes).padStart(14)}`)
    expect(texte).toContain(`  Alice Martin, Bob Martin (2,5 parts)`)
    // La micro-entreprise sans titulaire : avertissement et montant non rattaché.
    expect(texte).toContain("    ! Aucune relation « Titulaire »")
    expect(texte).toContain("Non rattaché à une personne")
    expect(texte).toContain("Versement libératoire")
    expect(texte).toContain("dont TNS (assiette)")
    expect(texte).not.toContain("Nettoyage")
  })

  it("--annee : seulement cette année, calculée avec ce qu'elle hérite des précédentes", () => {
    const { texte } = simuler(maximale, "--annee", "2025")
    expect(texte).toContain("== 2025 (règles de 2025) ==")
    expect(texte).not.toContain("== 2024")
    expect(texte).not.toContain("== 2026")
    expect(texte).toContain(euros(rapports[1].report!.totalNetApresImpots))
  })

  it("--annee hors de la session : erreur d'usage avec les années de la session", () => {
    expect(simuler(maximale, "--annee", "2030")).toEqual({ code: 2, texte: "L'année 2030 n'est pas dans la session (années : 2024, 2025, 2026)." })
  })

  it("--acteur d'une personne : ses activités et son foyer, sans le bilan de l'année", () => {
    const { code, texte } = simuler(maximale, "--acteur", "alice m", "--annee", "2026")
    expect(code).toBe(0)
    expect(texte).toContain("Acteur : Alice Martin")
    expect(texte).toContain("  Martin Conseil (SASU)")
    expect(texte).toContain("  Alice Formations (Micro-entreprise)")
    expect(texte).not.toContain("Bob Photos")
    expect(texte).toContain("  Alice Martin, Bob Martin")
    expect(texte).not.toContain("Chloé, Dan")
    expect(texte).not.toContain("Bilan de l'année")
  })

  it("--acteur d'une activité, par identifiant : elle seule et les foyers de ses bénéficiaires", () => {
    const { texte } = simuler(maximale, "--acteur", "m-bnc", "--annee", "2024")
    expect(texte).toContain("  Bob Photos (Micro-entreprise)")
    expect(texte).not.toContain("Martin Conseil")
    expect(texte).toMatch(/Foyers\n {2}\(aucun\)/)
  })

  it("--acteur sans activité : « (aucune) »", () => {
    expect(simuler(maximale, "--acteur", "Chloé", "--annee", "2024").texte).toMatch(/Activités\n {2}\(aucune\)/)
  })

  it("--acteur introuvable ou ambigu : erreur d'usage", () => {
    expect(simuler(maximale, "--acteur", "Zoé")).toEqual({ code: 2, texte: expect.stringContaining("Acteur introuvable : « Zoé ». Acteurs de la session : Alice Martin, Bob Martin") })
    expect(simuler(maximale, "--acteur", "martin")).toEqual({ code: 2, texte: expect.stringContaining("Plusieurs acteurs répondent à « martin »") })
  })

  it("--json : les rapports du moteur, tels quels", () => {
    const { code, texte } = simuler(maximale, "--json", "--annee", "2026")
    expect(code).toBe(0)
    expect(JSON.parse(texte)).toEqual({ annees: [rapports[2]] })
    expect(simuler(maximale, "--json", "--acteur", "Dan").code).toBe(2)
  })

  it("une année au-delà des règles connues : les dernières règles et leur avertissement", () => {
    const session: SessionState = { ...sessionDUnMontage(MONTAGES_TYPES[0]), annees: sessionDUnMontage(MONTAGES_TYPES[0]).annees.map(a => ({ ...a, annee: 2099 })) }
    const { texte } = simuler(contenuDuFichier(session))
    expect(texte).toMatch(/== 2099 \(règles de \d{4}, les dernières connues\) ==\n {2}! /)
  })

  it("une année sans règles : non simulée, avec la raison", () => {
    const session: SessionState = { ...sessionDUnMontage(MONTAGES_TYPES[0]), annees: sessionDUnMontage(MONTAGES_TYPES[0]).annees.map(a => ({ ...a, annee: 2000 })) }
    expect(simuler(contenuDuFichier(session)).texte).toMatch(/== 2000 : non simulée ==\n {2}\S/)
  })

  it("signale le nettoyage et la conversion d'un format précédent", () => {
    const session = sessionMaximale()
    session.entities.push({ id: "x", type: "inconnu" } as never)
    // Sans numéro de format : fichier du format 1, converti.
    const { texte } = simuler(JSON.stringify(session))
    expect(texte).toContain("Nettoyage : écartés 1 acteur(s).")
    expect(texte).toContain("Conversion depuis le format 1 : ")
  })

  it("signale les années en double écartées", () => {
    const session = sessionMaximale()
    session.annees.push(session.annees[0])
    expect(simuler(contenuDuFichier(session)).texte).toContain("Nettoyage : années en double écartées 2024.")
  })

  it("rend l'aide, ou l'aide après une erreur d'usage", () => {
    expect(executerSimuler(["--aide"], () => "")).toEqual({ code: 0, texte: AIDE })
    expect(executerSimuler([], () => "")).toEqual({ code: 2, texte: `Indiquez le fichier de la session.\n\n${AIDE}` })
  })

  it.each([
    ["absent", () => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }) }, "Fichier introuvable : session.json"],
    ["dossier", () => { throw Object.assign(new Error("EISDIR"), { code: "EISDIR" }) }, "Fichier illisible : session.json (EISDIR)."],
    ["pas du JSON", () => "{ tronqué", "Fichier illisible : session.json n'est pas du JSON valide"],
    ["refusé en bloc par le schéma", () => JSON.stringify({ ...sessionMaximale(), name: 42 }), "Fichier refusé : session.json. La session n'a pas la forme d'une session du simulateur"],
    ["années qui ne se suivent pas", () => contenuDuFichier({ ...sessionMaximale(), annees: [sessionMaximale().annees[0], sessionMaximale().annees[2]] }), "Fichier refusé : session.json. "]
  ])("fichier %s : code 1 et message clair", (_, lire, message) => {
    const { code, texte } = executerSimuler(["session.json"], lire)
    expect(code).toBe(1)
    expect(texte).toContain(message)
  })

  it("laisse passer une erreur inattendue", () => {
    expect(() => messageDErreurDuFichier("session.json", new RangeError("inattendue"))).toThrow("inattendue")
  })
})
