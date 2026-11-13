// 图标统一从 lucide-react 取。名字（name）→ Lucide 组件的对照都写在 ICONS 里。
// 新增图标：先在上面 import，再往 ICONS 里加一行 xxx: 组件，然后 <Icon name="xxx" /> 即可。
// Lucide 默认用 currentColor 描边，颜色会跟随外层文字颜色（主题变量照常生效）。
import {
  Clock,
  Folder,
  FolderOpen,
  Heart,
  Image as ImageIcon, // 避免和浏览器全局的 Image 重名
  Info,
  LayoutGrid,
  Moon,
  Plus,
  Settings,
  Sparkles,
  Sun,
  X,
  Search,
  FolderInput,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  grid: LayoutGrid,
  clock: Clock,
  sparkle: Sparkles,
  heart: Heart,
  image: ImageIcon,
  plus: Plus,
  folder: Folder,
  folderOpen: FolderOpen,
  settings: Settings,
  moon: Moon,
  sun: Sun,
  info: Info,
  close: X,
  search: Search,
  import: FolderInput,
};

export interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 18, className }: IconProps) {
  // 找不到的名字退回 info 图标，和原来的行为一致
  const Component = ICONS[name] ?? ICONS.info;
  return <Component size={size} className={className} aria-hidden="true" />;
}
