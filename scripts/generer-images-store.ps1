# scripts/generer-images-store.ps1
# Génère les images du paquet du Microsoft Store (build/appx/) à partir de l'icône de l'application (templateIcon.png),
# aux tailles et facteurs d'échelle que lit Windows. electron-builder les range dans le dossier « assets » du paquet et,
# parce que des variantes « .scale-* » et « .targetsize-* » sont présentes, compile leur index (resources.pri).
# Fond transparent : la couleur des tuiles est celle du thème de l'utilisateur (backgroundColor « transparent »).
# Écrit aussi les logos de la fiche du Store (documentation/microsoft-store/logos/), à déposer dans Partner Center.
#
# Windows seulement (System.Drawing de Windows PowerShell). À relancer seulement si l'icône change :
#   powershell -ExecutionPolicy Bypass -File scripts/generer-images-store.ps1

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$racine = Split-Path -Parent $PSScriptRoot
$source = [System.Drawing.Image]::FromFile((Join-Path $racine "templateIcon.png"))
$sortie = Join-Path $racine "build/appx"
New-Item -ItemType Directory -Force $sortie | Out-Null
Get-ChildItem $sortie -Filter *.png | Remove-Item

# Nom, largeur et hauteur à l'échelle 100, part de la hauteur occupée par l'icône (le reste est une marge transparente).
$images = @(
  @{ Nom = "StoreLogo"; Largeur = 50; Hauteur = 50; Part = 1.0 },
  @{ Nom = "Square44x44Logo"; Largeur = 44; Hauteur = 44; Part = 1.0 },
  @{ Nom = "SmallTile"; Largeur = 71; Hauteur = 71; Part = 0.7 },
  @{ Nom = "Square150x150Logo"; Largeur = 150; Hauteur = 150; Part = 0.6 },
  @{ Nom = "Wide310x150Logo"; Largeur = 310; Hauteur = 150; Part = 0.6 },
  @{ Nom = "LargeTile"; Largeur = 310; Hauteur = 310; Part = 0.5 }
)
$echelles = @(100, 125, 150, 200, 400)
# Icône de la barre des tâches et de la liste des applications, en pixels exacts ; « altform-unplated » : sans plaque de couleur.
$taillesCibles = @(16, 24, 32, 48, 256)

function Ecrire-Image([string]$fichier, [int]$largeur, [int]$hauteur, [double]$part) {
  $image = New-Object System.Drawing.Bitmap $largeur, $hauteur, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $dessin = [System.Drawing.Graphics]::FromImage($image)
  $dessin.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $dessin.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $dessin.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $dessin.Clear([System.Drawing.Color]::Transparent)
  $cote = [int][Math]::Round([Math]::Min($largeur, $hauteur) * $part)
  $x = [int][Math]::Floor(($largeur - $cote) / 2)
  $y = [int][Math]::Floor(($hauteur - $cote) / 2)
  $dessin.DrawImage($source, $x, $y, $cote, $cote)
  $dessin.Dispose()
  $image.Save((Join-Path $sortie $fichier), [System.Drawing.Imaging.ImageFormat]::Png)
  $image.Dispose()
}

foreach ($i in $images) {
  foreach ($e in $echelles) {
    $largeur = [int][Math]::Round($i.Largeur * $e / 100)
    $hauteur = [int][Math]::Round($i.Hauteur * $e / 100)
    Ecrire-Image "$($i.Nom).scale-$e.png" $largeur $hauteur $i.Part
  }
}
foreach ($t in $taillesCibles) {
  Ecrire-Image "Square44x44Logo.targetsize-$t.png" $t $t 1.0
  Ecrire-Image "Square44x44Logo.targetsize-$($t)_altform-unplated.png" $t $t 1.0
}

# Logos de la fiche du Store, à déposer à la main dans Partner Center (Fiche du Store > Logos du Store).
$sortie = Join-Path $racine "documentation/microsoft-store/logos"
New-Item -ItemType Directory -Force $sortie | Out-Null
Ecrire-Image "icone-300x300.png" 300 300 1.0
Ecrire-Image "boite-1080x1080.png" 1080 1080 0.5
Ecrire-Image "affiche-720x1080.png" 720 1080 0.6
$source.Dispose()
Write-Output "Images du Microsoft Store : $sortie"
