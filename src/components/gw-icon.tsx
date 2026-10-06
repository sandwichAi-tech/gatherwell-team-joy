import type { ComponentType, CSSProperties } from 'react';
import {
  At, PaperPlaneRight, ArrowCounterClockwise, Microphone, ArrowDown, ArrowLeft, ArrowRight, ArrowSquareOut, ArrowUUpLeft, ArrowUp, ArrowUpRight, ArrowsClockwise, ArrowsCounterClockwise, Barbell, Bell, BellRinging, BookOpen, BookmarkSimple, Broadcast, CalendarCheck, CalendarDots, CalendarHeart, CalendarPlus, Camera, CaretDown, CaretLeft, CaretRight, CaretUp, ChartBar, ChatCircle, ChatTeardrop, ChatText, Check, CheckCircle, Circle, ClipboardText, Clock, CloudSun, Compass, Confetti, Copy, CopySimple, CreditCard, Crop, Crosshair, Crown, DeviceMobile, DotsSixVertical, DotsThree, DownloadSimple, EnvelopeSimple, Eye, EyeSlash, FileText, Fire, Flag, FloppyDisk, FlowerLotus, Gift, Footprints, Globe, GraduationCap, HandHeart, Heart, House, Image, ImageSquare, Leaf, Lifebuoy, Link, List, Lock, MagnifyingGlass, MapPin, MapPinArea, MapTrifold, Medal, Megaphone, Minus, Monitor, Moon, Mountains, Pause, NavigationArrow, PencilSimple, PersonSimpleRun, PersonSimpleWalk, Phone, Play, Plus, Printer, Prohibit, PushPin, QrCode, Question, Repeat, RocketLaunch, Scan, ShareNetwork, ShieldCheck, Sidebar, SignOut, SlidersHorizontal, Smiley, Sparkle, SquaresFour, Stack, Star, Sun, TennisBall, ThumbsUp, Translate, Trash, TreeStructure, Trophy, UploadSimple, User, UserPlus, UsersThree, VideoCamera, WarningCircle, Waveform, X,
  type IconProps as PhIconProps,
} from '@phosphor-icons/react';

/** Every icon in Gatherwell renders through GwIcon so weight, size and color stay consistent. */
const REGISTRY = {
  AtSign: At,
  Reply: ArrowUUpLeft,
  Send: PaperPlaneRight,
  AlertCircle: WarningCircle,
  ArrowDown: ArrowDown,
  ArrowLeft: ArrowLeft,
  ArrowRight: ArrowRight,
  ArrowUp: ArrowUp,
  ArrowUpRight: ArrowUpRight,
  Award: Medal,
  Ban: Prohibit,
  BarChart3: ChartBar,
  Bell: Bell,
  BellRing: BellRinging,
  BookOpen: BookOpen,
  Bookmark: BookmarkSimple,
  BookmarkCheck: BookmarkSimple,
  CalendarCheck: CalendarCheck,
  CalendarDays: CalendarDots,
  CalendarHeart: CalendarHeart,
  CalendarPlus: CalendarPlus,
  Camera: Camera,
  Check: Check,
  CheckCircle2: CheckCircle,
  ChevronLeft: CaretLeft,
  ChevronRight: CaretRight,
  ChevronDown: CaretDown,
  ChevronUp: CaretUp,
  ChevronDownIcon: CaretDown,
  ChevronLeftIcon: CaretLeft,
  ChevronRightIcon: CaretRight,
  Circle: Circle,
  CircleCheck: CheckCircle,
  CircleHelp: Question,
  ClipboardCheck: ClipboardText,
  Clock: Clock,
  CloudSun: CloudSun,
  Compass: Compass,
  Copy: Copy,
  CopyPlus: CopySimple,
  CreditCard: CreditCard,
  Crown: Crown,
  Download: DownloadSimple,
  ExternalLink: ArrowSquareOut,
  Eye: Eye,
  EyeOff: EyeSlash,
  FileText: FileText,
  Flag: Flag,
  Gift: Gift,
  Flame: Fire,
  Footprints: Footprints,
  Globe2: Globe,
  GraduationCap: GraduationCap,
  GripVertical: DotsSixVertical,
  HandHeart: HandHeart,
  Heart: Heart,
  Home: House,
  ImageDown: ImageSquare,
  ImagePlus: ImageSquare,
  Languages: Translate,
  Layers: Stack,
  Leaf: Leaf,
  LifeBuoy: Lifebuoy,
  Link2: Link,
  List: List,
  LocateFixed: Crosshair,
  Lock: Lock,
  LogOut: SignOut,
  Mail: EnvelopeSimple,
  Map: MapTrifold,
  MapPin: MapPin,
  MapPinned: MapPinArea,
  Medal: Medal,
  Megaphone: Megaphone,
  MessageCircle: ChatCircle,
  MessageSquare: ChatTeardrop,
  MessageSquareText: ChatText,
  Minus: Minus,
  Monitor: Monitor,
  Moon: Moon,
  MoreHorizontal: DotsThree,
  Mountain: Mountains,
  Navigation: NavigationArrow,
  Network: TreeStructure,
  PanelLeft: Sidebar,
  PartyPopper: Confetti,
  Pencil: PencilSimple,
  Phone: Phone,
  Pin: PushPin,
  Play: Play,
  Plus: Plus,
  Printer: Printer,
  QrCode: QrCode,
  Radio: Broadcast,
  Microphone: Microphone,
  RefreshCw: ArrowsClockwise,
  Repeat: Repeat,
  Repeat2: ArrowsCounterClockwise,
  Rocket: RocketLaunch,
  Save: FloppyDisk,
  ScanLine: Scan,
  Search: MagnifyingGlass,
  Settings2: SlidersHorizontal,
  Share2: ShareNetwork,
  ShieldCheck: ShieldCheck,
  Smartphone: DeviceMobile,
  Smile: Smiley,
  Sparkles: Sparkle,
  Star: Star,
  Sun: Sun,
  ThumbsUp: ThumbsUp,
  Trash2: Trash,
  Trophy: Trophy,
  Undo2: ArrowUUpLeft,
  Upload: UploadSimple,
  UserPlus: UserPlus,
  UserRound: User,
  UsersRound: UsersThree,
  Video: VideoCamera,
  X: X,
  PersonSimpleRun: PersonSimpleRun,
  Barbell: Barbell,
  FlowerLotus: FlowerLotus,
  Waveform: Waveform,
  Mountains: Mountains,
  PersonSimpleWalk: PersonSimpleWalk,
  TennisBall: TennisBall,
  SquaresFour: SquaresFour,
  Crop: Crop,
  ArrowCounterClockwise: ArrowCounterClockwise,
  Image: Image,
  UploadSimple: UploadSimple,
  Pause: Pause,
} satisfies Record<string, ComponentType<PhIconProps>>;

export type GwIconName = keyof typeof REGISTRY;

/** Category map from DESIGN_RULES.md. */
export const CATEGORY_ICONS = {'run': 'PersonSimpleRun', 'fitcamp': 'Barbell', 'yoga': 'FlowerLotus', 'soundbath': 'Waveform', 'hike': 'Mountains', 'walk': 'PersonSimpleWalk', 'pickleball': 'TennisBall', 'more': 'SquaresFour'} as const satisfies Record<string, GwIconName>;

export function hasGwIcon(name: string): name is GwIconName { return name in REGISTRY; }

export type GwIconProps = {
  name: GwIconName;
  variant?: 'ui' | 'feature';
  size?: number | string;
  className?: string;
  style?: CSSProperties;
  color?: string;
  title?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-label'?: string;
  /** Accepted for compatibility; Phosphor weight controls stroke. */
  strokeWidth?: number;
};

export function GwIcon({ name, variant = 'ui', size, className, strokeWidth: _sw, title, ...rest }: GwIconProps) {
  const Cmp = REGISTRY[name] ?? REGISTRY.SquaresFour;
  const feature = variant === 'feature';
  return (
    <Cmp
      weight={feature ? 'duotone' : 'light'}
      size={size ?? (feature ? 26 : 20)}
      className={`gw-icon ${feature ? 'gw-icon-feature' : 'gw-icon-ui'} ${className ?? ''}`.trim()}
      aria-hidden={rest['aria-label'] ? undefined : true}
      {...(title ? { alt: title } : {})}
      {...rest}
    />
  );
}

/** Feature tile: 56px rounded square holding a duotone icon. */
export function GwFeatureTile({ name, size = 26, className }: { name: GwIconName; size?: number; className?: string }) {
  return <span className={`gw-feature-tile ${className ?? ''}`.trim()}><GwIcon name={name} variant="feature" size={size} /></span>;
}
