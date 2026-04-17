import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { duration, ease } from "@/lib/motion";

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
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-12">
        {/* ── LEFT — Soft brand panel ── */}
        <motion.aside
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: duration.long, ease: ease.outExpo }}
          className="relative hidden overflow-hidden bg-[hsl(var(--accent-50))] text-ink-8 lg:col-span-5 lg:flex xl:col-span-6"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(700px 400px at 20% 20%, hsl(var(--warmth-100)) 0%, transparent 55%), radial-gradient(900px 500px at 85% 90%, hsl(var(--accent-100)) 0%, transparent 60%)",
            }}
          />

          <div className="relative z-10 flex h-full w-full flex-col justify-between p-12 xl:p-16">
            <button
              onClick={() => navigate("/")}
              className="flex w-fit items-center gap-2.5 text-left"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-700))]">
                <img
                  src="/favicon.png"
                  alt=""
                  aria-hidden
                  className="h-5 w-5 object-contain opacity-90"
                />
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-display text-[19px] font-medium tracking-tight-1 text-ink-8">
                  MindMitra
                </span>
                <span className="text-[12px] text-ink-5">· beta</span>
              </span>
            </button>

            <div className="max-w-xl">
              <p className="text-[13.5px] text-ink-6">Your account is yours alone</p>
              <h2 className="mt-4 font-display text-[clamp(32px,4vw,48px)] font-normal leading-[1.2] tracking-tight-1 text-ink-8">
                A quiet room,
                <br />
                <span className="font-display-soft text-[hsl(var(--accent-600))]">
                  you can close the door to.
                </span>
              </h2>
              <p className="mt-6 max-w-md text-[15.5px] leading-[1.75] text-ink-6">
                What you share stays between you and this space. No ads, no
                resale, no report going anywhere. Just privacy that makes
                honesty possible.
              </p>
            </div>

            <div className="text-[13px] leading-relaxed text-ink-6">
              Encrypted end-to-end. Compliant with India's data protection law.
              Built in a small cohort, with care.
            </div>
          </div>
        </motion.aside>

        {/* ── RIGHT — Auth form ── */}
        <div className="flex items-center justify-center p-6 sm:p-10 lg:col-span-7 xl:col-span-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration.long, ease: ease.outExpo, delay: 0.1 }}
            className="w-full max-w-md"
          >
            <div className="mb-10 flex items-center gap-2.5 lg:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-700))]">
                <img src="/favicon.png" alt="" aria-hidden className="h-5 w-5 object-contain" />
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-display text-[18px] font-medium tracking-tight-1 text-ink-8">
                  MindMitra
                </span>
                <span className="text-[12px] text-ink-5">· beta</span>
              </span>
            </div>

            <h1 className="font-display text-[clamp(28px,3.5vw,38px)] font-normal leading-[1.2] tracking-tight-1 text-ink-8">
              {activeTab === "signin" ? (
                <>
                  Welcome back.
                  <br />
                  <span className="font-display-soft text-[hsl(var(--accent-600))]">
                    Come sit down.
                  </span>
                </>
              ) : (
                <>
                  Make yourself a corner here.
                  <br />
                  <span className="font-display-soft text-[hsl(var(--accent-600))]">
                    It only takes a minute.
                  </span>
                </>
              )}
            </h1>

            <p className="mt-5 max-w-sm text-[15px] leading-[1.7] text-ink-6">
              {activeTab === "signin"
                ? "Your memories, moods, and past conversations are waiting — wherever you left them."
                : "No phone number. No public profile. Just a private account so your memories can stay with you between visits."}
            </p>

            {/* Google */}
            <div className="mt-8">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full font-normal"
                onClick={handleGoogleSignIn}
                disabled={isLoading || isGoogleLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {isGoogleLoading ? "Connecting…" : "Continue with Google"}
              </Button>
            </div>

            <div className="my-7 flex items-center gap-3">
              <span className="h-px flex-1 bg-ink-3" />
              <span className="text-[12.5px] text-ink-5">or with email</span>
              <span className="h-px flex-1 bg-ink-3" />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6 grid h-10 w-full grid-cols-2 rounded-full bg-ink-2 p-1">
                <TabsTrigger
                  value="signin"
                  className="rounded-full text-[13.5px] data-[state=active]:bg-ink-0 data-[state=active]:text-ink-8 data-[state=active]:shadow-e0"
                >
                  Sign in
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-full text-[13.5px] data-[state=active]:bg-ink-0 data-[state=active]:text-ink-8 data-[state=active]:shadow-e0"
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
                    transition={{ duration: duration.base, ease: ease.outExpo }}
                    onSubmit={handleSignIn}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="signin-email" className="text-[13px] font-medium text-ink-7">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-5" />
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signin-password" className="text-[13px] font-medium text-ink-7">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-5" />
                        <Input
                          id="signin-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="px-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-5 transition-colors hover:text-ink-8"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full"
                      disabled={isLoading || isGoogleLoading}
                    >
                      {isLoading ? "Signing in…" : "Come in"}
                    </Button>
                  </motion.form>
                </TabsContent>

                <TabsContent value="signup" key="signup">
                  <motion.form
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: duration.base, ease: ease.outExpo }}
                    onSubmit={handleSignUp}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email" className="text-[13px] font-medium text-ink-7">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-5" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-password" className="text-[13px] font-medium text-ink-7">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-5" />
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="At least 6 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="px-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-5 transition-colors hover:text-ink-8"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full"
                      disabled={isLoading || isGoogleLoading}
                    >
                      {isLoading ? "Creating your space…" : "Make my space"}
                    </Button>
                  </motion.form>
                </TabsContent>
              </AnimatePresence>
            </Tabs>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-[13.5px] text-ink-6 underline-offset-4 transition-colors hover:text-ink-8 hover:underline"
              >
                Or continue without signing on
              </button>
            </div>

            <p className="mt-10 max-w-sm text-[12.5px] leading-relaxed text-ink-5">
              Continuing means you're okay with our{" "}
              <a href="#" className="underline decoration-ink-4 underline-offset-4 hover:text-ink-7 hover:decoration-ink-6">
                terms
              </a>{" "}
              and{" "}
              <a href="#" className="underline decoration-ink-4 underline-offset-4 hover:text-ink-7 hover:decoration-ink-6">
                privacy
              </a>
              . You can leave anytime.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
