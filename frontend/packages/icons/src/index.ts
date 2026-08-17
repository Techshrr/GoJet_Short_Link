import type { LucideIcon, LucideProps } from "lucide-react";

export type { LucideIcon, LucideProps };

export {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  File,
  Filter,
  Folder,
  Globe2,
  Info,
  KeyRound,
  Link2,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  Plus,
  QrCode,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  User,
  Users,
  X
} from "lucide-react";

export const functionalIconPolicy = {
  library: "lucide",
  strokeWidth: 1.75,
  emphasizedStrokeWidth: 2,
  sizes: {
    inline: 16,
    button: 16,
    sidebar: 18,
    pageAction: 18,
    marketingFeature: 24,
    emptyState: 32
  }
} as const;

export const brandAssetPriority = ["official-brand-kit", "official-svg", "simple-icons"] as const;

export const customProductIconPolicy = {
  grid: 24,
  safeArea: 2,
  strokeWidth: 1.75,
  linecap: "round",
  linejoin: "round"
} as const;

export type FunctionalIconSize = keyof typeof functionalIconPolicy.sizes;
