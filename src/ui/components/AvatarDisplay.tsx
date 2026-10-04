// src/ui/components/AvatarDisplay.tsx
import { Briefcase } from "lucide-react" // Gardez un import par défaut
import { cn } from "@/lib/utils"
import { couleurDeTexteSur } from "@/lib/contraste"
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

  const sizeClasses = {
    sm: "h-8 w-8 text-sm",
    md: "h-10 w-10 text-lg",
    lg: "h-12 w-12 text-xl"
  }

  // 2. Le code ici ne change pas, il utilise juste les constantes importées
  const icons = size === "sm" ? availableIconsSmall : availableIcons

  return (
    <div className={cn("rounded-md flex items-center justify-center font-bold shrink-0", sizeClasses[size])} style={{ backgroundColor: avatar.color, color: couleurDeTexteSur(avatar.color) }} aria-hidden="true">
      {isIcon ? icons[avatar.value] || <Briefcase /> : avatar.value}
    </div>
  )
}
