import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import Pulse from "@/components/identity/Pulse";
import { DURATION, EASE } from "@/lib/redesign/tokens";

/**
 * Auth — single-column "Quiet Companion" entrance.
 *
 * - Pulse is the focal element (replaces the heavy left brand panel).
 * - One-sentence privacy reassurance, calmer copy, no quirky placeholders.
 * - All auth handlers (`signIn`, `signUp`, `signInWithGoogle`) and the
 *   redirect-on-session effect are preserved verbatim.
 */

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");
  const { signIn, signUp, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    if (!error) navigate("/");
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await signUp(email, password);
    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    await signInWithGoogle();
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 50% 12%, hsl(var(--accent-100) / 0.45) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 50% 95%, hsl(var(--warmth-100) / 0.32) 0%, transparent 60%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-6 py-10 sm:px-8 sm:py-14">
        <button
          onClick={() => navigate("/")}
          className="flex w-fit items-center gap-2.5 text-left"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-700))]">
            <img
              src="/favicon.png"
              alt=""
              aria-hidden
              className="h-5 w-5 object-contain"
            />
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-base font-medium tracking-tight text-foreground">
              MindMitra
            </span>
            <span className="text-xs text-muted-foreground">· beta</span>
          </span>
        </button>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: DURATION.long, ease: EASE.outExpo }}
          className="mt-12 flex flex-col items-center text-center"
        >
          <Pulse size={132} state="idle" intensity={0.85} />
          <h1 className="mt-8 font-display text-[clamp(28px,5vw,36px)] leading-[1.15] tracking-tight text-foreground">
            {activeTab === "signin" ? "Welcome back." : "Make a quiet corner."}
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {activeTab === "signin"
              ? "Your past conversations are waiting where you left them."
              : "One private account so the conversation can continue between visits."}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: DURATION.long,
            delay: 0.12,
            ease: EASE.outExpo,
          }}
          className="mt-10 w-full"
        >
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full font-normal"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {isGoogleLoading ? "Connecting…" : "Continue with Google"}
          </Button>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or with email</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 grid h-10 w-full grid-cols-2 rounded-full bg-[hsl(var(--ink-2))] p-1">
              <TabsTrigger
                value="signin"
                className="rounded-full text-sm data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                Sign in
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="rounded-full text-sm data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                Sign up
              </TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait">
              <TabsContent value="signin" key="signin">
                <motion.form
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: DURATION.base, ease: EASE.outExpo }}
                  onSubmit={handleSignIn}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="signin-email"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="signin-password"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="px-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full rounded-full bg-primary text-primary-foreground hover:bg-[hsl(var(--accent-600))]"
                    disabled={isLoading || isGoogleLoading}
                  >
                    {isLoading ? "Signing in…" : "Sign in"}
                  </Button>
                </motion.form>
              </TabsContent>

              <TabsContent value="signup" key="signup">
                <motion.form
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: DURATION.base, ease: EASE.outExpo }}
                  onSubmit={handleSignUp}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="signup-email"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="signup-password"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        className="px-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full rounded-full bg-primary text-primary-foreground hover:bg-[hsl(var(--accent-600))]"
                    disabled={isLoading || isGoogleLoading}
                  >
                    {isLoading ? "Creating your space…" : "Create account"}
                  </Button>
                </motion.form>
              </TabsContent>
            </AnimatePresence>
          </Tabs>

          <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
            What you share stays between you and this space — no ads, no
            resale.{" "}
            <a
              href="#"
              className="underline decoration-border underline-offset-4 hover:text-foreground"
            >
              Privacy
            </a>{" "}
            ·{" "}
            <a
              href="#"
              className="underline decoration-border underline-offset-4 hover:text-foreground"
            >
              Terms
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
