import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  MessageSquare,
  Heart,
  Brain,
  Shield,
  Phone,
  Users,
  GraduationCap,
  Dumbbell,
  Puzzle,
  BookOpen,
  User,
  Settings,
  Sun,
  Moon,
  LifeBuoy,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Global ⌘K palette. Navigation-first; later phases can add search
 * over message history or quick actions.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const go = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search MindMitra — pages, actions, support…" />
      <CommandList>
        <CommandEmpty>No matches. Try "chat", "breathe", "help".</CommandEmpty>

        <CommandGroup heading="Conversations">
          <CommandItem onSelect={() => go("/chat")}>
            <MessageSquare />
            <span>Open AI chat</span>
            <CommandShortcut>⌘ C</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/wellness-checkin")}>
            <Heart />
            <span>Wellness check-in</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Practice">
          <CommandItem onSelect={() => go("/mindgym")}>
            <Dumbbell />
            <span>MindGym</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/games")}>
            <Puzzle />
            <span>Mindfulness games</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/qa-tests")}>
            <BookOpen />
            <span>Q&A assessments</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="WeCircle">
          <CommandItem onSelect={() => go("/therapist-bridge")}>
            <Phone />
            <span>Therapist bridge</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/peer-support")}>
            <Users />
            <span>Peer support</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/psychological-content")}>
            <GraduationCap />
            <span>Psychology library</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Account">
          <CommandItem onSelect={() => go("/profile")}>
            <User />
            <span>Profile</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <Settings />
            <span>Settings</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              toggleTheme();
              onOpenChange(false);
            }}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
            <span>{theme === "dark" ? "Switch to light" : "Switch to dark"}</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Support">
          <CommandItem
            onSelect={() => {
              window.location.href = "tel:18005990019";
              onOpenChange(false);
            }}
          >
            <LifeBuoy />
            <span>KIRAN helpline · 1800-599-0019</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/crisis-support")}>
            <Shield />
            <span>Crisis support resources</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/")}>
            <Brain />
            <span>Home</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export const COMMAND_PALETTE_EVENT = "mindmitra:open-command-palette";

/** Dispatch this to open the palette from anywhere (e.g. header button). */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT));
}

/** Hook that toggles a ⌘K / Ctrl+K palette. */
export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onExternalOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_PALETTE_EVENT, onExternalOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onExternalOpen);
    };
  }, []);
  return { open, setOpen };
}
