// src/lib/montages/filtres.test.ts

import { describe, expect, it } from "vitest"
import { AUCUN_CRITERE, criteresActifs, filtrerLesMontages, foyerDuContenu, sansAccent, statutsDuContenu, type CriteresDesMontages } from "./filtres"
import { MONTAGES_TYPES } from "./montages"

const trouver = (criteres: Partial<CriteresDesMontages>) => filtrerLesMontages(MONTAGES_TYPES, { ...AUCUN_CRITERE, ...criteres }).map(montage => montage.id)
const montage = (id: string) => MONTAGES_TYPES.find(m => m.id === id)!

describe("classement d'une situation type, déduit de son contenu", () => {
  it("donne les statuts de ses activités", () => {
    expect(statutsDuContenu(montage("micro-bnc-seule").contenu())).toEqual(["micro"])
    expect(statutsDuContenu(montage("kinesitherapeute-ei").contenu())).toEqual(["EI"])
    expect(statutsDuContenu(montage("eurl-is-remuneration-gerant").contenu())).toEqual(["EURL"])
    // Deux activités dans le même foyer : la situation répond aux deux filtres.
    expect(statutsDuContenu(montage("micro-et-sasu-du-conjoint").contenu()).sort()).toEqual(["SASU", "micro"])
  })

  it("dit le foyer : en couple pour un mariage, un Pacs ou une union libre, seul sinon", () => {
    expect(foyerDuContenu(montage("sasu-sans-salaire").contenu())).toBe("seul")
    expect(foyerDuContenu(montage("conjoint-salarie-sasu").contenu())).toBe("couple")
    expect(foyerDuContenu(montage("couple-union-libre").contenu())).toBe("couple")
    // Un salarié qui a aussi une micro-entreprise est seul : la relation « Titulaire » n'est pas un couple.
    expect(foyerDuContenu(montage("salarie-et-micro").contenu())).toBe("seul")
  })

  it("classe chaque situation de la bibliothèque : au moins un statut, et un foyer", () => {
    for (const m of MONTAGES_TYPES) expect(statutsDuContenu(m.contenu()).length, m.id).toBeGreaterThan(0)
    // Chaque filtre proposé trouve au moins une situation, et aucun ne les trouve toutes.
    for (const statuts of [["micro"], ["SASU"], ["EURL"], ["EI"]] as const) {
      const trouvees = trouver({ statuts: [...statuts] })
      expect(trouvees.length, statuts[0]).toBeGreaterThan(0)
      expect(trouvees.length, statuts[0]).toBeLessThan(MONTAGES_TYPES.length)
    }
    expect(trouver({ foyers: ["seul"] }).length + trouver({ foyers: ["couple"] }).length).toBe(MONTAGES_TYPES.length)
  })
})

describe("filtrer les situations types", () => {
  it("sans critère, garde toute la bibliothèque dans son ordre", () => {
    expect(trouver({})).toEqual(MONTAGES_TYPES.map(m => m.id))
    expect(criteresActifs(AUCUN_CRITERE)).toBe(false)
    expect(criteresActifs({ ...AUCUN_CRITERE, recherche: "  " })).toBe(false)
    expect(criteresActifs({ ...AUCUN_CRITERE, foyers: ["couple"] })).toBe(true)
  })

  it("les filtres d'un même axe s'ajoutent, les deux axes se combinent", () => {
    expect(trouver({ statuts: ["EURL"] })).toEqual(["eurl-is-remuneration-gerant"])
    expect(trouver({ statuts: ["EURL", "EI"] })).toEqual(["kinesitherapeute-ei", "eurl-is-remuneration-gerant"])
    expect(trouver({ statuts: ["SASU"], foyers: ["couple"] })).toEqual(["sasu-et-conjoint-salarie-ailleurs", "micro-et-sasu-du-conjoint", "conjoint-salarie-sasu"])
    expect(trouver({ statuts: ["EURL"], foyers: ["couple"] })).toEqual([])
    // Cocher les deux foyers revient à n'en cocher aucun.
    expect(trouver({ foyers: ["seul", "couple"] })).toHaveLength(MONTAGES_TYPES.length)
  })

  it("la recherche ignore la casse et les accents, et lit le titre, le résumé, les mots-clés et les questions", () => {
    expect(sansAccent("Kinésithérapeute À L'Œuvre")).toBe("kinesitherapeute a l'oeuvre")
    expect(trouver({ recherche: "kine" })).toEqual(["kinesitherapeute-ei"])
    expect(trouver({ recherche: "OSTÉOPATHE" })).toEqual(["osteopathe-micro"])
    // Un mot-clé de la carte.
    expect(trouver({ recherche: "zone franche" })).toEqual(["sasu-en-zone-franche-urbaine"])
    expect(trouver({ recherche: "union libre" })).toEqual(["couple-union-libre"])
  })

  it("chaque mot de la recherche doit s'y trouver, et la recherche se combine avec les filtres", () => {
    const retraite = trouver({ recherche: "retraite" })
    expect(retraite).toContain("sasu-sans-salaire")
    expect(retraite).toContain("sasu-salaire-4-trimestres")
    expect(trouver({ recherche: "retraite kiné" })).toEqual(retraite.filter(id => id === "kinesitherapeute-ei"))
    expect(trouver({ recherche: "retraite", statuts: ["SASU"], foyers: ["seul"] }).every(id => id.startsWith("sasu"))).toBe(true)
    expect(trouver({ recherche: "licorne" })).toEqual([])
  })
})
