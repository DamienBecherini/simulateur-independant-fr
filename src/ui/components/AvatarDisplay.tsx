// src/ui/components/AvatarDisplay.tsx
import { Briefcase } from "lucide-react" // Gardez un import par défaut
import { cn } from "@/lib/utils"
import { fondPourTexteBlanc } from "@/lib/contraste"
import type { Avatar } from "@/types"
// 1. Importez les constantes depuis leur nouveau fichier
import { availableIcons, availableIconsSmall } from "@/lib/avatar-constants"

// Les constantes ont été déplacées. Ce fichier est maintenant "pur".

interface AvatarDisplayProps {
  avatar: Avatar
  size?: "sm" | "md" | "lg"
}

export function AvatarDisplay({ avatar, size = "md" }: AvatarDisplayProps) {
  const isIcon = avatar.type === "icon"

  // En moyen et grand format, les initiales sont en grand texte gras (20 px et plus) : 3:1 suffit avec le blanc
  // (WCAG 1.4.3), ce qui garde aux couleurs vives leur teinte. Le petit format, en 14 px, demande 4,5:1.
  const sizeClasses = {
    sm: "h-8 w-8 text-sm",
    md: "h-10 w-10 text-xl",
    lg: "h-12 w-12 text-2xl"
  }
  const contrasteMinimal = size === "sm" ? 4.5 : 3

  // 2. Le code ici ne change pas, il utilise juste les constantes importées
  const icons = size === "sm" ? availableIconsSmall : availableIcons

  return (
    <div className={cn("rounded-md flex items-center justify-center font-bold shrink-0", sizeClasses[size])} style={{ backgroundColor: fondPourTexteBlanc(avatar.color, contrasteMinimal), color: "#ffffff" }} aria-hidden="true">
      {isIcon ? icons[avatar.value] || <Briefcase /> : avatar.value}
    </div>
  )
}
