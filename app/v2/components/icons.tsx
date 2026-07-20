/* =====================================================================
   Icon registry.
   - `Icon` resolves a content string name to a Lucide icon.
   - Brand icons (Discord/Telegram/VK/YouTube/TikTok/Steam) are inline SVGs,
     since Lucide has no brand marks.
   ===================================================================== */

import {
  Puzzle,
  ShieldCheck,
  Gauge,
  Headset,
  Swords,
  Coins,
  Castle,
  Dices,
  Truck,
  Trophy,
  Gift,
  Users,
  UserPlus,
  MessageCircle,
  Bomb,
  Crosshair,
  RefreshCw,
  Crown,
  Package,
  Play,
  Copy,
  Check,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Zap,
  Server,
  Clock,
  Map as MapIcon,
  Star,
  Heart,
  Flame,
  Wifi,
  X,
  Menu,
  Plus,
  ShoppingCart,
  Sparkles,
  Signal,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minus,
  Award,
  Rocket,
  Timer,
  Percent,
  Tag,
  Wallet,
  Send,
  Shield,
  Skull,
  Target,
  Swords as SwordsIcon,
  Boxes,
  Layers,
  Sword,
  Eye,
  ThumbsUp,
  Cpu,
  Activity,
  Hammer,
  Building2,
  Search,
  Medal,
  Swords as SwordsAlt,
  type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  Puzzle, ShieldCheck, Gauge, Headset, Swords, Coins, Castle, Dices, Truck,
  Trophy, Gift, Users, UserPlus, MessageCircle, Bomb, Crosshair, RefreshCw,
  Crown, Package, Play, Copy, Check, ArrowRight, ArrowUpRight, ChevronDown,
  ChevronLeft, ChevronRight, Zap, Server, Clock, Map: MapIcon, Star, Heart,
  Flame, Wifi, X, Menu, Plus, ShoppingCart, Sparkles, Signal, Pause, Volume2,
  VolumeX, Maximize2, Minus, Award, Rocket, Timer, Percent, Tag, Wallet, Send,
  Shield, Skull, Target, Sword: SwordsIcon, Boxes, Layers, Blade: Sword, Eye,
  ThumbsUp, Cpu, Activity, Hammer, Building2, Search, Medal, SwordsAlt,
};

export function Icon({
  name,
  className,
  size = 20,
  strokeWidth = 1.75,
}: {
  name: string;
  className?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const Cmp = ICONS[name] ?? Sparkles;
  return <Cmp className={className} size={size} strokeWidth={strokeWidth} />;
}

/* -------------------------------------------------- Brand icons */

type BrandProps = { className?: string; size?: number };

export function BrandIcon({ name, className, size = 22 }: { name: string } & BrandProps) {
  switch (name) {
    case "discord":
      return <DiscordIcon className={className} size={size} />;
    case "telegram":
      return <TelegramIcon className={className} size={size} />;
    case "vk":
      return <VkIcon className={className} size={size} />;
    case "youtube":
      return <YoutubeIcon className={className} size={size} />;
    case "tiktok":
      return <TiktokIcon className={className} size={size} />;
    case "steam":
      return <SteamIcon className={className} size={size} />;
    default:
      return null;
  }
}

export function DiscordIcon({ className, size = 22 }: BrandProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.548-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.42 0-1.332.955-2.418 2.157-2.418 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.42 0-1.332.955-2.418 2.157-2.418 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418Z" />
    </svg>
  );
}

export function TelegramIcon({ className, size = 22 }: BrandProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0Zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635Z" />
    </svg>
  );
}

export function VkIcon({ className, size = 22 }: BrandProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M.723 3.223C0 3.94 0 5.093 0 7.398v1.204c0 2.305 0 3.458.723 4.175.723.716 1.887.716 4.215.716h9.324c2.328 0 3.492 0 4.215-.716.723-.717.723-1.87.723-4.175V7.398c0-2.305 0-3.458-.723-4.175C17.777 2.507 16.613 2.507 14.285 2.507H4.938C2.61 2.507 1.446 2.507.723 3.223Zm2.582 3.06h1.68c.055 2.79.298 4.148 1.163 4.148.599 0 .863-.386.863-1.472V7.34c0-.72.155-.93.71-.93.42 0 .698.128 1.033.588 1.163 1.596 1.16 3.87 1.16 3.87h1.68s.297-3.14-1.05-4.9c-.42-.55-.24-.79 0-1.28.35-.72 1.03-1.72 1.03-1.72h-1.68s-.51.86-1.16 1.9c-.55.87-.79.87-1.03.87-.46 0-.44-.51-.44-1.03V4.6c0-.72-.21-1.03-.79-1.03H6.28c-.44 0-.7.31-.7.61 0 .68 1.03.84 1.14 2.79Z" transform="translate(0 4)" />
      <path d="M12.06 17.09h1.01c.31 0 .4-.24.4-.24s.02-1.35.66-1.55c.63-.2 1.44 1.34 2.3 1.93.65.46 1.15.36 1.15.36l2.3-.03s1.2-.07.63-1.02c-.05-.08-.34-.7-1.72-1.98-1.45-1.35-1.26-1.13.49-3.44 1.06-1.41 1.49-2.27 1.35-2.63-.12-.35-.9-.26-.9-.26l-2.58.02s-.19-.03-.33.06c-.14.08-.23.28-.23.28s-.42 1.11-.97 2.05c-1.17 1.99-1.64 2.09-1.83 1.97-.44-.29-.33-1.14-.33-1.75 0-1.9.29-2.69-.56-2.9-.28-.07-.49-.11-1.21-.12-.92-.01-1.7 0-2.14.22-.29.14-.52.46-.38.48.17.02.56.1.76.39.27.36.26 1.19.26 1.19s.15 2.28-.36 2.56c-.35.19-.83-.2-1.87-2.01-.53-.92-.94-1.94-.94-1.94s-.08-.19-.21-.29c-.16-.12-.39-.16-.39-.16l-2.45.02s-.37.01-.5.17c-.12.14-.01.44-.01.44s1.92 4.5 4.1 6.76c1.99 2.07 4.26 1.94 4.26 1.94Z" />
    </svg>
  );
}

export function YoutubeIcon({ className, size = 22 }: BrandProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
    </svg>
  );
}

export function TiktokIcon({ className, size = 22 }: BrandProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.525.02c1.31-.02 2.611-.01 3.911-.02.079 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z" />
    </svg>
  );
}

export function SteamIcon({ className, size = 22 }: BrandProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0ZM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25.965.4 2.055.05 2.606-.79.267-.406.412-.882.416-1.372.006-.494-.14-.98-.416-1.398-.28-.418-.66-.72-1.14-.87v.03c.9.376 1.324 1.412.948 2.314-.377.9-1.413 1.323-2.314.947-.19-.08-.36-.19-.51-.32Z" />
    </svg>
  );
}
