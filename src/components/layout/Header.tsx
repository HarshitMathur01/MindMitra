import { LogOut, Menu, X, ArrowRight, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { DURATION, EASE } from "@/lib/redesign/tokens";

/**
 * Header — slim glass bar.
 *
 * Nav reduced to 4 items per surface (signed-in vs public). A ⌘K
 * pill on desktop opens the global CommandPalette; same shortcut
 * also works via keyboard listener registered here so the palette is
 * reachable from any route.
 */
const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle =
        (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
      if (isToggle) {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navItems = user
    ? [
        { label: "Home", path: "/" },
        { label: "Chat", path: "/chat" },
        { label: "Mind Gym", path: "/mindgym" },
        { label: "Resources", path: "/psychological-content" },
      ]
    : [
        { label: "How it holds you", path: "#how-it-works" },
        { label: "A live look", path: "#features" },
        { label: "In your words", path: "#about" },
        { label: "Resources", path: "/psychological-content" },
      ];

  const handleNavClick = (path: string) => {
    setMobileMenuOpen(false);
    if (path.startsWith("#")) {
      const el = document.querySelector(path);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(path);
    }
  };

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50 glass"
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: DURATION.long, ease: EASE.outExpo }}
      >
        <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
            onClick={() => navigate("/")}
          >
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl">
              <img src="/image.png" alt="MindMitra" className="h-9 w-9 object-contain" />
            </div>
            <span className="font-display text-lg tracking-tight text-foreground">
              MindMitra
            </span>
          </button>

          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNavClick(item.path)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-700))]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-full border border-border/50 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground lg:flex"
              aria-label="Open command palette"
            >
              <span>Search</span>
              <span className="flex items-center gap-0.5 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px]">
                <Command className="h-2.5 w-2.5" />K
              </span>
            </button>

            <ThemeToggle />

            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-[hsl(var(--ink-2))] lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {user ? (
              <div className="hidden items-center gap-2 lg:flex">
                <button
                  type="button"
                  onClick={() => navigate("/profile")}
                  className="flex items-center gap-2 rounded-full px-2 py-1.5 transition-colors hover:bg-[hsl(var(--ink-2))]"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                      {user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium text-foreground xl:inline">
                    {user.email?.split("@")[0]}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Sign out</span>
                </Button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/auth")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Sign in
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("/auth")}
                  className="gap-1.5 rounded-full bg-primary px-5 text-primary-foreground hover:bg-[hsl(var(--accent-600))]"
                >
                  Open MindMitra
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              className="border-t border-border/40 lg:hidden glass-strong"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: DURATION.base, ease: EASE.outExpo }}
            >
              <div className="mx-auto max-w-page space-y-1 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => handleNavClick(item.path)}
                      className={`flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-700))]"
                          : "text-muted-foreground hover:bg-[hsl(var(--ink-2))] hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setPaletteOpen(true);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-[hsl(var(--ink-2))] hover:text-foreground"
                >
                  <span>Search</span>
                  <span className="flex items-center gap-0.5 rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px]">
                    <Command className="h-2.5 w-2.5" />K
                  </span>
                </button>

                <div className="mt-2 border-t border-border/30 pt-3">
                  {user ? (
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          navigate("/profile");
                          setMobileMenuOpen(false);
                        }}
                        className="flex items-center gap-2 rounded-xl px-4 py-2"
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                            {user.email?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {user.email?.split("@")[0]}
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={signOut}
                        className="gap-1.5 text-muted-foreground"
                      >
                        <LogOut className="h-3.5 w-3.5" /> Sign out
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        className="w-full justify-center"
                        onClick={() => {
                          navigate("/auth");
                          setMobileMenuOpen(false);
                        }}
                      >
                        Sign in
                      </Button>
                      <Button
                        className="w-full justify-center gap-1.5 rounded-full bg-primary text-primary-foreground hover:bg-[hsl(var(--accent-600))]"
                        onClick={() => {
                          navigate("/auth");
                          setMobileMenuOpen(false);
                        }}
                      >
                        Open MindMitra <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
};

export default Header;
