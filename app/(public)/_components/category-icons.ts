import {
  Braces,
  Calculator,
  ClipboardList,
  Cog,
  Factory,
  GraduationCap,
  Headset,
  Landmark,
  Laptop,
  Megaphone,
  Stethoscope,
  TrendingUp,
  Users,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

/** Category slug -> Lucide icon. One set, one weight — no emoji. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  it: Laptop,
  "software-development": Braces,
  accounting: Calculator,
  finance: Landmark,
  sales: TrendingUp,
  marketing: Megaphone,
  "customer-service": Headset,
  administration: ClipboardList,
  engineering: Cog,
  education: GraduationCap,
  healthcare: Stethoscope,
  operations: Factory,
  "human-resources": Users,
};

export function categoryIcon(slug: string): LucideIcon {
  return CATEGORY_ICONS[slug] ?? Briefcase;
}
