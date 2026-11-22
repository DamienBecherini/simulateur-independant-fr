// src/ui/components/ProtectionDesStatuts.test.tsx

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { ScenarioStatut } from "@/types"
import { GARANTIES_DE_TEST } from "@/backend/logic/testing/garanties-de-test"
import { ProtectionDesStatuts } from "./ProtectionDesStatuts"

const micro = {
  statut: "micro",
  libelle: "Micro-entreprise",
  protectionSociale: { etoiles: 2, trimestres: 4, resume: "", garanties: GARANTIES_DE_TEST }
} as unknown as ScenarioStatut

describe("ce que recouvre la note de protection sociale", () => {
  it("montre une étoile dans le titre, lue « en étoiles » par un lecteur d'écran", () => {
    const { container } = render(<ProtectionDesStatuts scenarios={[micro]} />)
    const titre = container.querySelector("summary")!
    expect(titre).toHaveTextContent(/note en\s*★/)
    expect(titre.querySelector('span[aria-hidden="true"]')).toHaveTextContent("★")
    expect(screen.getByText("étoiles")).toHaveClass("sr-only")
    // Le texte lu, sans l'étoile cachée : une phrase entière.
    const lu = Array.from(titre.querySelectorAll("span"))
      .find(span => span.textContent?.startsWith("Ce que recouvre"))!
      .cloneNode(true) as HTMLElement
    lu.querySelectorAll('[aria-hidden="true"]').forEach(cache => cache.remove())
    expect(lu.textContent?.replace(/\s+/g, " ")).toMatch(/^Ce que recouvre la note en étoiles de protection sociale\b/)
  })
})
