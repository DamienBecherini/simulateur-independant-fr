// src/lib/mentions-legales.ts
// « Mentions légales et confidentialité » : le texte, écrit une seule fois. La fenêtre de l'application et de la démo
// web l'affiche, et documentation/mentions-legales.md en est tiré (`npm run mentions-legales`) ; un test vérifie que le
// fichier suit le texte.

import { ADRESSE_E_MAIL_DES_RETOURS, DEPOT_GITHUB } from "./adresses-des-retours"

/** Un lien : vers une page web, ou l'adresse e-mail de contact (mailto:). */
export interface Lien {
  texte: string
  adresse: string
}

/** Un nom de dossier ou de fichier, à lire tel quel. */
export interface Code {
  code: string
}

export type Morceau = string | Lien | Code

export type Bloc = { paragraphe: Morceau[] } | { liste: Morceau[][] }

export interface Rubrique {
  titre: string
  blocs: Bloc[]
}

export const TITRE_DES_MENTIONS_LEGALES = "Mentions légales et confidentialité"

/** Adresse de la fenêtre dans la démo web : `#mentions-legales`. Ce n'est pas une vue de la page. */
export const ADRESSE_DES_MENTIONS_LEGALES = "mentions-legales"

export const DATE_DE_MISE_A_JOUR = "6 octobre 2026"

export const ADRESSE_DE_LA_LICENCE = `${DEPOT_GITHUB}/blob/main/LICENSE`

const CONTACT: Lien = { texte: ADRESSE_E_MAIL_DES_RETOURS, adresse: `mailto:${ADRESSE_E_MAIL_DES_RETOURS}` }
const LIEN_CNIL: Lien = { texte: "CNIL (cnil.fr)", adresse: "https://www.cnil.fr" }

/** Vrai pour un lien qui s'ouvre hors de l'application, dans le navigateur. */
export function estUnLienExterne(adresse: string): boolean {
  return adresse.startsWith("https://")
}

export const INTRODUCTION: Morceau[] = ["Ce simulateur est un projet personnel. Cette page dit qui l'édite, qui héberge la démo web et ce que deviennent vos données."]

export const RUBRIQUES: readonly Rubrique[] = [
  {
    titre: "Éditeur",
    blocs: [
      { paragraphe: ["Le simulateur est édité par Damien BECHERINI, à titre personnel et non professionnel : c'est un projet non commercial et open source."] },
      { paragraphe: ["Adresse : 20 rue des bois, 77140 Saint-Pierre-lès-Nemours, France."] },
      { paragraphe: ["Contact : ", CONTACT, ". Activité professionnelle de l'éditeur : ", { texte: "damien.becherini.fr", adresse: "https://damien.becherini.fr" }, "."] }
    ]
  },
  {
    titre: "Hébergement",
    blocs: [
      { paragraphe: ["La démo web est hébergée par GitHub Pages, un service de GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis (", { texte: "github.com", adresse: "https://github.com" }, ")."] },
      { paragraphe: ["L'application de bureau n'est pas hébergée : elle s'installe et fonctionne sur votre ordinateur."] }
    ]
  },
  {
    titre: "Données personnelles et confidentialité",
    blocs: [
      { paragraphe: ["Le simulateur ne demande ni compte, ni nom, ni adresse e-mail. Les calculs se font sur votre appareil, et ce que vous saisissez y reste :"] },
      {
        liste: [
          ["dans la démo web, dans le stockage local de votre navigateur (localStorage) : la simulation en cours, vos sauvegardes, vos préférences et le thème choisi ;"],
          ["dans l'application de bureau, dans un dossier de votre ordinateur : ", { code: "%APPDATA%\\simulateur-independant-fr" }, " sous Windows, ", { code: "~/Library/Application Support/simulateur-independant-fr" }, " sous macOS, ", { code: "~/.config/simulateur-independant-fr" }, " sous Linux."]
        ]
      },
      { paragraphe: ["Le projet n'a pas de serveur : rien ne lui est envoyé automatiquement. Des données ne quittent votre appareil que si vous le décidez, en donnant votre avis :"] },
      {
        liste: [
          ["sur GitHub, votre message devient un ticket public du dépôt, et la ", { texte: "déclaration de confidentialité de GitHub", adresse: "https://docs.github.com/fr/site-policy/privacy-policies/github-general-privacy-statement" }, " s'applique ;"],
          ["par e-mail, votre message part de votre messagerie vers l'adresse de contact."]
        ]
      },
      { paragraphe: ["Aucun montant ni aucun nom de la simulation n'est joint à un avis : vous relisez le texte avant de l'envoyer."] },
      { paragraphe: ["En tant qu'hébergeur, GitHub enregistre l'adresse IP des visiteurs de la démo web à des fins de sécurité (", { texte: "documentation de GitHub Pages", adresse: "https://docs.github.com/fr/pages/getting-started-with-github-pages/what-is-github-pages" }, ")."] },
      { paragraphe: ["Vos données restent tant que vous les gardez. Pour les effacer :"] },
      {
        liste: [
          ["« Nouvelle Simulation / Réinitialiser », dans les paramètres, vide la simulation en cours ; chaque sauvegarde se supprime dans « Charger une sauvegarde » ;"],
          ["dans la démo web, effacer les données du site dans votre navigateur supprime tout ;"],
          ["dans l'application de bureau, supprimer le dossier indiqué plus haut supprime tout."]
        ]
      },
      { paragraphe: ["Pour une question sur vos données, ou pour faire effacer un avis que vous avez envoyé, écrivez à ", CONTACT, ". Vous pouvez aussi adresser une réclamation à la ", LIEN_CNIL, "."] }
    ]
  },
  {
    titre: "Cookies et traceurs",
    blocs: [
      { paragraphe: ["Le simulateur ne dépose aucun cookie et n'utilise aucun outil de mesure d'audience ni de publicité. La police de caractères est fournie avec l'application : aucune ressource n'est chargée depuis un autre site."] },
      {
        paragraphe: [
          "Le stockage local du navigateur sert seulement à garder votre simulation et vos préférences. C'est un usage strictement nécessaire au service que vous demandez, qui n'exige pas de consentement (",
          { texte: "règles de la CNIL sur les cookies et traceurs", adresse: "https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/que-dit-la-loi" },
          ")."
        ]
      }
    ]
  },
  {
    titre: "Avertissement",
    blocs: [{ paragraphe: ["Les résultats sont des estimations simplifiées, non validées par un expert-comptable : ce n'est ni un conseil fiscal, ni un conseil juridique. Vérifiez votre situation avec un professionnel avant de décider."] }]
  },
  {
    titre: "Licence et code source",
    blocs: [{ paragraphe: ["Le code source est publié sur ", { texte: "le dépôt GitHub du projet", adresse: DEPOT_GITHUB }, ", sous ", { texte: "licence MIT", adresse: ADRESSE_DE_LA_LICENCE }, "."] }]
  },
  {
    titre: "Mise à jour",
    blocs: [{ paragraphe: [`Page mise à jour le ${DATE_DE_MISE_A_JOUR}. Si le simulateur propose un jour des fonctions d'intelligence artificielle, cette page sera mise à jour pour dire quelles données elles utilisent.`] }]
  }
]

function morceauEnMarkdown(morceau: Morceau): string {
  if (typeof morceau === "string") return morceau
  if ("code" in morceau) return `\`${morceau.code}\``
  return `[${morceau.texte}](${morceau.adresse})`
}

const ligneEnMarkdown = (morceaux: Morceau[]) => morceaux.map(morceauEnMarkdown).join("")

function blocEnMarkdown(bloc: Bloc): string {
  if ("paragraphe" in bloc) return ligneEnMarkdown(bloc.paragraphe)
  return bloc.liste.map(element => `- ${ligneEnMarkdown(element)}`).join("\n")
}

/** Le texte de la page en Markdown, tel qu'il est enregistré dans documentation/mentions-legales.md. */
export function mentionsLegalesEnMarkdown(): string {
  const parties = [`# ${TITRE_DES_MENTIONS_LEGALES}`, ligneEnMarkdown(INTRODUCTION)]
  for (const rubrique of RUBRIQUES) parties.push(`## ${rubrique.titre}`, ...rubrique.blocs.map(blocEnMarkdown))
  return `${parties.join("\n\n")}\n`
}
