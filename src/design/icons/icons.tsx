/**
 * Every icon of the app in Broomit's style, under the names the code uses. Icons with a
 * Broomit drawing (glyphs.tsx) use it; the rest are line icons (lineGlyphs.ts). All show in
 * color when `colored`, or inside a chosen icon button.
 */
import { LineIcon, type IconProps } from './LineIcon.tsx'

export type { IconProps }
export type LucideIcon = (props: IconProps) => React.JSX.Element

export const AlignCenter = (props: IconProps) => <LineIcon line="AlignCenter" {...props} />
export const AlignLeft = (props: IconProps) => <LineIcon line="AlignLeft" {...props} />
export const AlignRight = (props: IconProps) => <LineIcon line="AlignRight" {...props} />
export const ArchiveRestore = (props: IconProps) => <LineIcon line="ArchiveRestore" {...props} />
export const ArrowBigUp = (props: IconProps) => <LineIcon line="ArrowBigUp" {...props} />
export const ArrowBigUpDash = (props: IconProps) => <LineIcon line="ArrowBigUpDash" {...props} />
export const ArrowDown = (props: IconProps) => <LineIcon line="ArrowDown" {...props} />
export const ArrowDownAZ = (props: IconProps) => <LineIcon line="ArrowDownAZ" {...props} />
export const ArrowDownUp = (props: IconProps) => <LineIcon line="ArrowDownUp" {...props} />
export const ArrowDownWideNarrow = (props: IconProps) => (
  <LineIcon line="ArrowDownWideNarrow" {...props} />
)
export const ArrowLeftRight = (props: IconProps) => <LineIcon line="ArrowLeftRight" {...props} />
export const ArrowRight = (props: IconProps) => <LineIcon line="ArrowRight" {...props} />
export const ArrowUp = (props: IconProps) => <LineIcon line="ArrowUp" {...props} />
export const ArrowUpDown = (props: IconProps) => <LineIcon line="ArrowUpDown" {...props} />
export const ArrowUpNarrowWide = (props: IconProps) => (
  <LineIcon line="ArrowUpNarrowWide" {...props} />
)
export const Atom = (props: IconProps) => <LineIcon line="Atom" {...props} />
export const Baby = (props: IconProps) => <LineIcon line="Baby" {...props} />
export const BarChart3 = (props: IconProps) => <LineIcon glyph="chart" {...props} />
export const Bell = (props: IconProps) => <LineIcon line="Bell" {...props} />
export const Bike = (props: IconProps) => <LineIcon line="Bike" {...props} />
export const Bold = (props: IconProps) => <LineIcon line="Bold" {...props} />
export const BookMarked = (props: IconProps) => <LineIcon line="BookMarked" {...props} />
export const BookOpen = (props: IconProps) => <LineIcon line="BookOpen" {...props} />
export const BookmarkPlus = (props: IconProps) => <LineIcon line="BookmarkPlus" {...props} />
export const Brain = (props: IconProps) => <LineIcon line="Brain" {...props} />
export const Briefcase = (props: IconProps) => <LineIcon line="Briefcase" {...props} />
export const Building2 = (props: IconProps) => <LineIcon line="Building2" {...props} />
export const Calculator = (props: IconProps) => <LineIcon line="Calculator" {...props} />
export const Calendar = (props: IconProps) => <LineIcon line="Calendar" {...props} />
export const CalendarCheck = (props: IconProps) => <LineIcon line="CalendarCheck" {...props} />
export const CalendarDays = (props: IconProps) => <LineIcon line="CalendarDays" {...props} />
export const CalendarPlus = (props: IconProps) => <LineIcon line="CalendarPlus" {...props} />
export const Camera = (props: IconProps) => <LineIcon glyph="camera" {...props} />
export const Car = (props: IconProps) => <LineIcon line="Car" {...props} />
export const ChartColumn = (props: IconProps) => <LineIcon glyph="chart" {...props} />
export const ChartLine = (props: IconProps) => <LineIcon line="ChartLine" {...props} />
export const ChartPie = (props: IconProps) => <LineIcon line="ChartPie" {...props} />
export const ChartSpline = (props: IconProps) => <LineIcon line="ChartSpline" {...props} />
export const Check = (props: IconProps) => <LineIcon line="Check" {...props} />
export const CheckCheck = (props: IconProps) => <LineIcon line="CheckCheck" {...props} />
export const CheckSquare = (props: IconProps) => <LineIcon line="CheckSquare" {...props} />
export const ChevronDown = (props: IconProps) => <LineIcon line="ChevronDown" {...props} />
export const ChevronLeft = (props: IconProps) => <LineIcon line="ChevronLeft" {...props} />
export const ChevronRight = (props: IconProps) => <LineIcon line="ChevronRight" {...props} />
export const ChevronUp = (props: IconProps) => <LineIcon line="ChevronUp" {...props} />
export const Circle = (props: IconProps) => <LineIcon line="Circle" {...props} />
export const CircleDashed = (props: IconProps) => <LineIcon line="CircleDashed" {...props} />
export const CircleDot = (props: IconProps) => <LineIcon line="CircleDot" {...props} />
export const ClipboardList = (props: IconProps) => <LineIcon line="ClipboardList" {...props} />
export const ClipboardPaste = (props: IconProps) => <LineIcon line="ClipboardPaste" {...props} />
export const Clock = (props: IconProps) => <LineIcon line="Clock" {...props} />
export const CloudAlert = (props: IconProps) => <LineIcon line="CloudAlert" {...props} />
export const Code = (props: IconProps) => <LineIcon line="Code" {...props} />
export const Coffee = (props: IconProps) => <LineIcon line="Coffee" {...props} />
export const Copy = (props: IconProps) => <LineIcon line="Copy" {...props} />
export const CopyPlus = (props: IconProps) => <LineIcon line="CopyPlus" {...props} />
export const CornerDownLeft = (props: IconProps) => <LineIcon line="CornerDownLeft" {...props} />
export const CornerLeftDown = (props: IconProps) => <LineIcon line="CornerLeftDown" {...props} />
export const Crop = (props: IconProps) => <LineIcon line="Crop" {...props} />
export const Crown = (props: IconProps) => <LineIcon line="Crown" {...props} />
export const Delete = (props: IconProps) => <LineIcon line="Delete" {...props} />
export const Diamond = (props: IconProps) => <LineIcon line="Diamond" {...props} />
export const Divide = (props: IconProps) => <LineIcon line="Divide" {...props} />
export const Dna = (props: IconProps) => <LineIcon line="Dna" {...props} />
export const Download = (props: IconProps) => <LineIcon line="Download" {...props} />
export const Dumbbell = (props: IconProps) => <LineIcon line="Dumbbell" {...props} />
export const Ellipsis = (props: IconProps) => <LineIcon line="Ellipsis" {...props} />
export const Eye = (props: IconProps) => <LineIcon line="Eye" {...props} />
export const EyeOff = (props: IconProps) => <LineIcon line="EyeOff" {...props} />
export const Feather = (props: IconProps) => <LineIcon line="Feather" {...props} />
export const FileImage = (props: IconProps) => <LineIcon line="FileImage" {...props} />
export const FilePlus2 = (props: IconProps) => <LineIcon line="FilePlus2" {...props} />
export const FileUp = (props: IconProps) => <LineIcon line="FileUp" {...props} />
export const Film = (props: IconProps) => <LineIcon line="Film" {...props} />
export const FlaskConical = (props: IconProps) => <LineIcon line="FlaskConical" {...props} />
export const FlipHorizontal2 = (props: IconProps) => <LineIcon line="FlipHorizontal2" {...props} />
export const FlipVertical2 = (props: IconProps) => <LineIcon line="FlipVertical2" {...props} />
export const Flower2 = (props: IconProps) => <LineIcon line="Flower2" {...props} />
export const Folder = (props: IconProps) => <LineIcon glyph="folder" {...props} />
export const FolderClosed = (props: IconProps) => <LineIcon glyph="folder" {...props} />
export const FolderInput = (props: IconProps) => <LineIcon line="FolderInput" {...props} />
export const FolderKanban = (props: IconProps) => <LineIcon line="FolderKanban" {...props} />
export const FolderPlus = (props: IconProps) => <LineIcon glyph="new-folder" {...props} />
export const Gamepad2 = (props: IconProps) => <LineIcon glyph="quiz" {...props} />
export const Gift = (props: IconProps) => <LineIcon line="Gift" {...props} />
export const Globe = (props: IconProps) => <LineIcon line="Globe" {...props} />
export const GraduationCap = (props: IconProps) => <LineIcon line="GraduationCap" {...props} />
export const Grid3x3 = (props: IconProps) => <LineIcon glyph="table" {...props} />
export const GripHorizontal = (props: IconProps) => <LineIcon line="GripHorizontal" {...props} />
export const GripVertical = (props: IconProps) => <LineIcon line="GripVertical" {...props} />
export const Handshake = (props: IconProps) => <LineIcon line="Handshake" {...props} />
export const HardDriveDownload = (props: IconProps) => (
  <LineIcon line="HardDriveDownload" {...props} />
)
export const Heart = (props: IconProps) => <LineIcon line="Heart" {...props} />
export const House = (props: IconProps) => <LineIcon line="House" {...props} />
export const Inbox = (props: IconProps) => <LineIcon line="Inbox" {...props} />
export const InfinityIcon = (props: IconProps) => <LineIcon line="Infinity" {...props} />
export const Info = (props: IconProps) => <LineIcon line="Info" {...props} />
export const Italic = (props: IconProps) => <LineIcon line="Italic" {...props} />
export const Keyboard = (props: IconProps) => <LineIcon line="Keyboard" {...props} />
export const Landmark = (props: IconProps) => <LineIcon line="Landmark" {...props} />
export const Languages = (props: IconProps) => <LineIcon line="Languages" {...props} />
export const Laptop = (props: IconProps) => <LineIcon line="Laptop" {...props} />
export const Lasso = (props: IconProps) => <LineIcon glyph="lasso" {...props} />
export const Layers = (props: IconProps) => <LineIcon glyph="layers" {...props} />
export const LayoutGrid = (props: IconProps) => <LineIcon line="LayoutGrid" {...props} />
export const LayoutTemplate = (props: IconProps) => <LineIcon line="LayoutTemplate" {...props} />
export const Leaf = (props: IconProps) => <LineIcon line="Leaf" {...props} />
export const Library = (props: IconProps) => <LineIcon line="Library" {...props} />
export const Lightbulb = (props: IconProps) => <LineIcon line="Lightbulb" {...props} />
export const Link2 = (props: IconProps) => <LineIcon line="Link2" {...props} />
export const List = (props: IconProps) => <LineIcon line="List" {...props} />
export const LoaderCircle = (props: IconProps) => <LineIcon line="LoaderCircle" {...props} />
export const Lock = (props: IconProps) => <LineIcon line="Lock" {...props} />
export const LockOpen = (props: IconProps) => <LineIcon line="LockOpen" {...props} />
export const LogOut = (props: IconProps) => <LineIcon line="LogOut" {...props} />
export const Mail = (props: IconProps) => <LineIcon line="Mail" {...props} />
export const Map = (props: IconProps) => <LineIcon line="Map" {...props} />
export const MapPin = (props: IconProps) => <LineIcon line="MapPin" {...props} />
export const Maximize2 = (props: IconProps) => <LineIcon line="Maximize2" {...props} />
export const Megaphone = (props: IconProps) => <LineIcon line="Megaphone" {...props} />
export const Merge = (props: IconProps) => <LineIcon line="Merge" {...props} />
export const Microscope = (props: IconProps) => <LineIcon line="Microscope" {...props} />
export const Minus = (props: IconProps) => <LineIcon line="Minus" {...props} />
export const Moon = (props: IconProps) => <LineIcon line="Moon" {...props} />
export const MoreHorizontal = (props: IconProps) => <LineIcon line="MoreHorizontal" {...props} />
export const Mountain = (props: IconProps) => <LineIcon line="Mountain" {...props} />
export const Music = (props: IconProps) => <LineIcon line="Music" {...props} />
export const NotebookPen = (props: IconProps) => <LineIcon glyph="notebook" {...props} />
export const NotebookText = (props: IconProps) => <LineIcon glyph="notebook" {...props} />
export const PaintBucket = (props: IconProps) => <LineIcon line="PaintBucket" {...props} />
export const Paintbrush = (props: IconProps) => <LineIcon line="Paintbrush" {...props} />
export const Palette = (props: IconProps) => <LineIcon line="Palette" {...props} />
export const PawPrint = (props: IconProps) => <LineIcon line="PawPrint" {...props} />
export const PenLine = (props: IconProps) => <LineIcon glyph="pen" {...props} />
export const Pin = (props: IconProps) => <LineIcon line="Pin" {...props} />
export const PinOff = (props: IconProps) => <LineIcon line="PinOff" {...props} />
export const Plane = (props: IconProps) => <LineIcon line="Plane" {...props} />
export const Play = (props: IconProps) => <LineIcon line="Play" {...props} />
export const Plus = (props: IconProps) => <LineIcon line="Plus" {...props} />
export const Presentation = (props: IconProps) => <LineIcon glyph="presentation" {...props} />
export const Radio = (props: IconProps) => <LineIcon line="Radio" {...props} />
export const Redo2 = (props: IconProps) => <LineIcon line="Redo2" {...props} />
export const RefreshCw = (props: IconProps) => <LineIcon line="RefreshCw" {...props} />
export const Repeat = (props: IconProps) => <LineIcon line="Repeat" {...props} />
export const RotateCcw = (props: IconProps) => <LineIcon line="RotateCcw" {...props} />
export const Ruler = (props: IconProps) => <LineIcon line="Ruler" {...props} />
export const Scale = (props: IconProps) => <LineIcon line="Scale" {...props} />
export const Scaling = (props: IconProps) => <LineIcon line="Scaling" {...props} />
export const Scissors = (props: IconProps) => <LineIcon line="Scissors" {...props} />
export const Search = (props: IconProps) => <LineIcon line="Search" {...props} />
export const Send = (props: IconProps) => <LineIcon line="Send" {...props} />
export const Settings2 = (props: IconProps) => <LineIcon glyph="settings" {...props} />
export const Shapes = (props: IconProps) => <LineIcon glyph="shapes" {...props} />
export const Share = (props: IconProps) => <LineIcon line="Share" {...props} />
export const ShoppingBag = (props: IconProps) => <LineIcon glyph="shop" {...props} />
export const Sigma = (props: IconProps) => <LineIcon line="Sigma" {...props} />
export const SlidersHorizontal = (props: IconProps) => (
  <LineIcon line="SlidersHorizontal" {...props} />
)
export const Sparkles = (props: IconProps) => <LineIcon line="Sparkles" {...props} />
export const Spline = (props: IconProps) => <LineIcon glyph="anchor" {...props} />
export const Square = (props: IconProps) => <LineIcon line="Square" {...props} />
export const SquareRoundCorner = (props: IconProps) => (
  <LineIcon line="SquareRoundCorner" {...props} />
)
export const Star = (props: IconProps) => <LineIcon line="Star" {...props} />
export const Stethoscope = (props: IconProps) => <LineIcon line="Stethoscope" {...props} />
export const Sticker = (props: IconProps) => <LineIcon glyph="sticker" {...props} />
export const Sun = (props: IconProps) => <LineIcon line="Sun" {...props} />
export const Target = (props: IconProps) => <LineIcon line="Target" {...props} />
export const TextCursorInput = (props: IconProps) => <LineIcon line="TextCursorInput" {...props} />
export const Theater = (props: IconProps) => <LineIcon line="Theater" {...props} />
export const Timer = (props: IconProps) => <LineIcon line="Timer" {...props} />
export const ToggleLeft = (props: IconProps) => <LineIcon line="ToggleLeft" {...props} />
export const Trash2 = (props: IconProps) => <LineIcon line="Trash2" {...props} />
export const TriangleAlert = (props: IconProps) => <LineIcon line="TriangleAlert" {...props} />
export const Type = (props: IconProps) => <LineIcon line="Type" {...props} />
export const Underline = (props: IconProps) => <LineIcon line="Underline" {...props} />
export const Undo2 = (props: IconProps) => <LineIcon line="Undo2" {...props} />
export const Unlink = (props: IconProps) => <LineIcon line="Unlink" {...props} />
export const User = (props: IconProps) => <LineIcon line="User" {...props} />
export const UserPlus = (props: IconProps) => <LineIcon line="UserPlus" {...props} />
export const Users = (props: IconProps) => <LineIcon line="Users" {...props} />
export const Utensils = (props: IconProps) => <LineIcon line="Utensils" {...props} />
export const Vote = (props: IconProps) => <LineIcon line="Vote" {...props} />
export const Wallet = (props: IconProps) => <LineIcon line="Wallet" {...props} />
export const Waypoints = (props: IconProps) => <LineIcon line="Waypoints" {...props} />
export const X = (props: IconProps) => <LineIcon line="X" {...props} />
