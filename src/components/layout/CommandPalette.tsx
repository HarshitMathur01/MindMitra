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
  ShieldCheck,
  Phone,
  Users,
  GraduationCap,
  Dumbbell,
  User,
  Settings,
  Sun,
  Moon,
  LifeBuoy,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/hooks/useAuth";

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
  const { user } = useAuth();

  const go = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search MindMitra — pages, actions, support…" />
      <CommandList>
        <CommandEmpty>No matches. Try "chat", "breathe", "help".</CommandEmpty>

        {/*
          `data-prefetch` is read by the delegated prefetcher in
          useRoutePrefetch — pointing at an item warms its route chunk before
          the user commits, same as hovering a link.
        */}
        <CommandGroup heading="Talk">
          <CommandItem data-prefetch="/chat" onSelect={() => go("/chat")}>
            <MessageSquare />
            <span>Open chat</span>
            <CommandShortcut>⌘ C</CommandShortcut>
          </CommandItem>
          <CommandItem data-prefetch="/me" onSelect={() => go("/me")}>
            <Heart />
            <span>You — memory &amp; mood</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Practice">
          <CommandItem data-prefetch="/mindgym" onSelect={() => go("/mindgym")}>
            <Dumbbell />
            <span>Mind Gym</span>
          </CommandItem>
          <CommandItem
            data-prefetch="/mindgym/breath-sphere"
            onSelect={() => go("/mindgym/breath-sphere")}
          >
            <Heart />
            <span>Breathe with me</span>
          </CommandItem>
          <CommandItem data-prefetch="/journal" onSelect={() => go("/journal")}>
            <GraduationCap />
            <span>Journal</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="People">
          <CommandItem
            data-prefetch={user ? "/therapist-bridge" : "/therapy"}
            onSelect={() => go(user ? "/therapist-bridge" : "/therapy")}
          >
            <Phone />
            <span>Talk to a therapist</span>
          </CommandItem>
          <CommandItem data-prefetch="/peer-support" onSelect={() => go("/peer-support")}>
            <Users />
            <span>Peer support</span>
          </CommandItem>
          <CommandItem
            data-prefetch="/psychological-content"
            onSelect={() => go("/psychological-content")}
          >
            <GraduationCap />
            <span>Resources library</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Account">
          <CommandItem data-prefetch="/profile" onSelect={() => go("/profile")}>
            <User />
            <span>Profile</span>
          </CommandItem>
          <CommandItem data-prefetch="/settings" onSelect={() => go("/settings")}>
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

        <CommandGroup heading="If you need help right now">
          <CommandItem data-prefetch="/safety-plan" onSelect={() => go("/safety-plan")}>
            <ShieldCheck />
            <span>Open my safety plan</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              window.location.href = "tel:18005990019";
              onOpenChange(false);
            }}
          >
            <LifeBuoy />
            <span>KIRAN helpline · 1800-599-0019</span>
          </CommandItem>
          <CommandItem data-prefetch="/" onSelect={() => go("/")}>
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
