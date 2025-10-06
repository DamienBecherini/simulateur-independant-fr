// src/ui/components/AvatarDisplay.tsx

import { Briefcase, Building, Store, User } from "lucide-react"
import { cn } from "@/lib/utils"

// On centralise les icônes ici, elles n'auront plus besoin d'être dans les autres fichiers.
export const availableIcons: { [key: string]: React.ReactNode } = {
  Briefcase: <Briefcase size={20} />,
  Building: <Building size={20} />,
  Store: <Store size={20} />,
  User: <User size={20} />
}

// On peut aussi exporter une version plus petite si besoin
export const availableIconsSmall: { [key: string]: React.ReactNode } = {
  Briefcase: <Briefcase size={16} />,
  Building: <Building size={16} />,
  Store: <Store size={16} />,
  User: <User size={16} />
}

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

  const icons = size === "sm" ? availableIconsSmall : availableIcons

  return (
    <div className={cn("rounded-md flex items-center justify-center font-bold text-white shrink-0", sizeClasses[size])} style={{ backgroundColor: avatar.color }}>
      {isIcon ? icons[avatar.value] || <Briefcase /> : avatar.value}
    </div>
  )
}
