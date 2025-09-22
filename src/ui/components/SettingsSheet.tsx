import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Download, Upload, Save } from "lucide-react"

interface SettingsSheetProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  entities: Entity[]
  onStateImported: (newEntities: Entity[]) => void
}

export function SettingsSheet({ isOpen, onOpenChange, entities, onStateImported }: SettingsSheetProps) {
  const handleSave = () => {
    // La sauvegarde automatique est déjà en place, mais un bouton manuel peut être rassurant
    window.api.saveState(entities)
    // On pourrait ajouter un toast/notification ici pour confirmer
    console.log("Sauvegarde manuelle déclenchée !")
  }

  const handleExport = () => {
    window.api.exportState(entities)
  }

  const handleImport = async () => {
    const result = await window.api.importState()
    if (result.data) {
      onStateImported(result.data)
      onOpenChange(false) // Ferme le panneau après l'import
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Configuration</SheetTitle>
          <SheetDescription>Gérez les données de votre simulation. Vous pouvez sauvegarder votre session en cours, ou l'exporter dans un fichier pour la partager ou la conserver.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-8">
          <Button onClick={handleSave} variant="outline">
            <Save className="mr-2 h-4 w-4" />
            Sauvegarder la session actuelle
          </Button>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exporter dans un fichier
          </Button>
          <Button onClick={handleImport} variant="secondary">
            <Upload className="mr-2 h-4 w-4" />
            Importer depuis un fichier
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
