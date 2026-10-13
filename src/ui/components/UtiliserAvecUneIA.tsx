// src/ui/components/UtiliserAvecUneIA.tsx
// Section « Utiliser avec une IA (MCP) » des paramètres. Dans l'application de bureau : ce que fait le serveur MCP
// local, l'avertissement de confidentialité, et la configuration à copier dans un client d'IA de bureau, avec les
// chemins réels de cette installation (voir documentation/utiliser-avec-une-ia.md et l'ADR 011). Dans la démo web, la
// plateforme fournit le contenu de la fenêtre : ce que cela permet, et les liens vers l'application de bureau, seule à le
// faire (src/web/FenetreIADeLaDemo.tsx).

import { useEffect, useState, type ReactNode } from "react"
import { Bot, Copy } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { usePlateforme } from "../plateforme"
import { ALIAS_D_EXECUTION, blocAInserer, commandeDeClaudeCode, commandeDeVerification, configurationDeClaudeDesktop, configurationDuClient, NOM_DU_SERVEUR_MCP, type InfosDuServeurMcp } from "@/lib/configuration-mcp"

const TITRE_IA = "Utiliser avec une IA (MCP)"

const PETIT_TEXTE = "text-sm text-slate-600 dark:text-slate-400"
// Les chemins de la configuration sont longs : ils passent à la ligne, sans défilement horizontal (le bouton copie le texte exact).
const CODE = "max-h-64 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere] rounded-md bg-slate-100 p-3 font-mono text-xs dark:bg-slate-800"
const TITRE_DE_PARTIE = "text-sm font-semibold text-slate-800 dark:text-slate-100"

/** Ce que permet le serveur MCP, en deux phrases : dans l'application de bureau et dans la démo web. */
export const CE_QUE_PERMET_L_IA = "Un client d'IA (Claude Desktop, Claude Code, LM Studio…) peut se servir du simulateur comme d'un outil : lire votre simulation, la calculer, comparer les statuts, et proposer des ajouts tirés de vos factures ou relevés. Les chiffres viennent toujours du simulateur."

const CHEMIN = "[overflow-wrap:anywhere]"

/**
 * Les étapes de Claude Desktop. Son fichier de configuration n'est jamais vide (`"preferences"`…) : le cas courant est
 * d'y insérer un bloc après la première accolade. Le fichier s'ouvre par son menu, car son chemin dépend du mode
 * d'installation (paquet MSIX sous Windows) ; il faut quitter Claude Desktop avant d'enregistrer, sinon il peut
 * réécrire le fichier en se fermant ; ses serveurs MCP ne servent que dans l'onglet Chat.
 */
function EtapesDeClaudeDesktop({ plateforme }: { plateforme: string }) {
  const fichier = configurationDeClaudeDesktop(plateforme)
  if (!fichier) return <p>Claude Desktop n'existe pas officiellement sur ce système : utilisez un autre client d'IA.</p>
  const quitter = plateforme === "darwin" ? "menu Claude, puis « Quitter »" : "clic droit sur son icône près de l'horloge, puis « Quitter »"
  return (
    <>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Dans Claude Desktop, ouvrez Paramètres, puis Développeur, puis « Modifier la configuration » (en anglais : Settings, Developer, « Edit Config ») : il affiche le fichier claude_desktop_config.json dans l'explorateur de fichiers, sans l'ouvrir. Ouvrez-le avec un éditeur de texte, par exemple le Bloc-notes sous Windows (clic droit, puis « Ouvrir avec »).</li>
        <li>Quittez complètement Claude Desktop ({quitter}) : fermer sa fenêtre ne suffit pas, il pourrait réécrire le fichier en se fermant et votre ajout serait perdu.</li>
        <li>Le fichier contient déjà des réglages (« preferences »…) : copiez le bloc à insérer et collez-le juste après la toute première accolade {"« { »"} du fichier, sans rien toucher d'autre. S'il contient déjà une rubrique « mcpServers », ajoutez-y seulement l'entrée « simulateur-independant-fr » de la configuration ci-dessous, suivie d'une virgule si une autre entrée vient après. Si le fichier est vide, collez la configuration complète.</li>
        <li>Enregistrez le fichier et relancez Claude Desktop. Les outils du simulateur s'utilisent dans l'onglet Chat (pas dans l'onglet Code) : ils apparaissent dans le menu « + » sous la zone de saisie, et dans Paramètres, Développeur, avec leur état.</li>
      </ol>
      <p className={PETIT_TEXTE}>
        Chemin habituel du fichier : <code className={CHEMIN}>{fichier.habituel}</code>.
        {fichier.enPaquet && (
          <>
            {" "}
            Si Claude Desktop est installé en paquet, il est dans <code className={CHEMIN}>{fichier.enPaquet}</code>.
          </>
        )}
      </p>
    </>
  )
}

/** Le contenu de la fenêtre, une fois les chemins de l'installation connus. */
function GuideDuServeurMcp({ infos }: { infos: InfosDuServeurMcp }) {
  const [etat, setEtat] = useState("")
  const [etatClaudeCode, setEtatClaudeCode] = useState("")
  const configuration = configurationDuClient(infos)

  const copier = async (texte: string, copie: string, afficher = setEtat) => {
    try {
      await navigator.clipboard.writeText(texte)
      afficher(copie)
    } catch {
      afficher("La copie a échoué : sélectionnez le texte pour le copier.")
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <p>
        {CE_QUE_PERMET_L_IA} L'IA ne modifie rien elle-même : chaque proposition s'affiche ici, et vous choisissez « Appliquer » ou « Refuser » ; « Annuler » la défait en une étape.
      </p>
      <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        <strong>Confidentialité :</strong> ce que l'IA lit de votre simulation (et les documents que vous lui donnez) part chez le fournisseur de l'IA choisie. Pour des données sensibles, préférez une IA locale (LM Studio, par exemple), qui reste sur votre ordinateur ; un petit modèle enchaîne moins bien les outils et lit moins bien les factures scannées. Ce simulateur n'est pas l'avis d'un expert-comptable.
      </p>

      <section aria-labelledby="ia-claude" className="space-y-2">
        <h3 id="ia-claude" className={TITRE_DE_PARTIE}>
          Avec Claude Desktop
        </h3>
        <EtapesDeClaudeDesktop plateforme={infos.plateforme} />
      </section>

      <section aria-labelledby="ia-claude-code" className="space-y-2">
        <h3 id="ia-claude-code" className={TITRE_DE_PARTIE}>
          Avec Claude Code
        </h3>
        <p>Dans un terminal, cette commande ajoute le simulateur à Claude Code, pour tous vos projets (portée « user » ; « local » le limite au dossier courant, pour un essai) :</p>
        <pre className={CODE} tabIndex={0} aria-label="Commande pour Claude Code">
          {commandeDeClaudeCode(infos)}
        </pre>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal" onClick={() => copier(commandeDeClaudeCode(infos), "Commande copiée : collez-la dans un terminal, puis relancez Claude Code.", setEtatClaudeCode)}>
            <Copy className="mr-2 size-4" aria-hidden="true" /> Copier la commande pour Claude Code
          </Button>
        </div>
        <p aria-live="polite" className={PETIT_TEXTE}>
          {etatClaudeCode}
        </p>
        <p className={PETIT_TEXTE}>
          Claude Code charge ses serveurs au démarrage d'une session : relancez-le (« claude --continue » reprend la conversation en cours), puis tapez « /mcp » pour voir l'état du serveur « {NOM_DU_SERVEUR_MCP} ». Pour le retirer : « claude mcp remove {NOM_DU_SERVEUR_MCP} --scope user ».
        </p>
      </section>

      <section aria-labelledby="ia-configuration" className="space-y-2">
        <h3 id="ia-configuration" className={TITRE_DE_PARTIE}>
          Configuration de cette installation
        </h3>
        <pre className={CODE} tabIndex={0} aria-label="Configuration à copier">
          {configuration}
        </pre>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal" onClick={() => copier(blocAInserer(infos), "Bloc copié : collez-le juste après la première accolade « { » du fichier, sans rien toucher d'autre.")}>
            <Copy className="mr-2 size-4" aria-hidden="true" /> Copier le bloc à insérer (fichier existant)
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal" onClick={() => copier(configuration, "Configuration copiée : collez-la dans le fichier vide.")}>
            <Copy className="mr-2 size-4" aria-hidden="true" /> Copier la configuration complète (fichier vide)
          </Button>
        </div>
        <p role="status" className={PETIT_TEXTE}>
          {etat}
        </p>
        <p className={PETIT_TEXTE}>Le serveur se lance avec l'exécutable de l'application (ELECTRON_RUN_AS_NODE) : rien d'autre à installer. Il lit la simulation dans votre dossier de données, telle que l'application l'enregistre, environ une seconde après chaque modification. Si vous déplacez ou réinstallez l'application, copiez à nouveau la configuration.</p>
        {infos.microsoftStore && (
          <p className={PETIT_TEXTE}>
            Version du Microsoft Store : la configuration lance l'application par son alias d'exécution « {ALIAS_D_EXECUTION} », qui reste valable après chaque mise à jour, et le serveur est recopié dans votre dossier de données à chaque démarrage de l'application. Si le serveur ne démarre pas, vérifiez que cet alias est activé dans les Paramètres de Windows : Applications, Paramètres avancés des applications, Alias d'exécution d'application.
          </p>
        )}
      </section>

      <section aria-labelledby="ia-autres" className="space-y-2">
        <h3 id="ia-autres" className={TITRE_DE_PARTIE}>
          Avec un autre client d'IA
        </h3>
        <p>
          La même configuration convient aux clients qui lisent la notation « mcpServers » : dans LM Studio (version 0.3.17 ou plus récente), onglet Program, puis Install, puis « Edit mcp.json » ; comme pour Claude Desktop, ajoutez l'entrée « simulateur-independant-fr » si le fichier a déjà une rubrique « mcpServers ». Sinon, indiquez au client la commande, ses arguments et la variable d'environnement de la configuration.
        </p>
        <p className={PETIT_TEXTE}>Pour vérifier que le serveur démarre, dans un terminal (il attend ensuite les messages du client ; Ctrl+C pour l'arrêter) :</p>
        <pre className={CODE} tabIndex={0} aria-label="Commande de vérification">
          {commandeDeVerification(infos)}
        </pre>
      </section>
    </div>
  )
}

/** La fenêtre, ouverte par le bouton `declencheur` ; le focus y revient à sa fermeture. */
export function FenetreIA({ declencheur, children }: { declencheur: ReactNode; children: ReactNode }) {
  const [ouverte, setOuverte] = useState(false)
  return (
    <Dialog open={ouverte} onOpenChange={setOuverte}>
      <DialogTrigger asChild>{declencheur}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>{TITRE_IA}</DialogTitle>
          <DialogDescription>Connecter un client d'IA de bureau au simulateur, par le protocole MCP (Model Context Protocol).</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Le bouton des paramètres qui ouvre la fenêtre. Dans l'application de bureau, il attend les chemins de
 * l'installation ; dans la démo web, où il n'y a pas de serveur local, la fenêtre renvoie vers l'application de bureau.
 */
export function BoutonUtiliserAvecUneIA(bouton: Pick<ButtonProps, "variant" | "className">) {
  const { RenvoiVersLApplicationDeBureau } = usePlateforme()
  const [infos, setInfos] = useState<InfosDuServeurMcp | null>(null)

  useEffect(() => {
    if (RenvoiVersLApplicationDeBureau) return
    let actif = true
    window.api
      .infosDuServeurMcp()
      .then(lues => {
        if (actif) setInfos(lues)
      })
      .catch(() => undefined)
    return () => {
      actif = false
    }
  }, [RenvoiVersLApplicationDeBureau])

  if (!RenvoiVersLApplicationDeBureau && !infos) return null
  return (
    <FenetreIA
      declencheur={
        <Button {...bouton}>
          <Bot className="mr-2 size-4" aria-hidden="true" /> {TITRE_IA}
        </Button>
      }
    >
      {RenvoiVersLApplicationDeBureau ? <RenvoiVersLApplicationDeBureau /> : infos && <GuideDuServeurMcp infos={infos} />}
    </FenetreIA>
  )
}
