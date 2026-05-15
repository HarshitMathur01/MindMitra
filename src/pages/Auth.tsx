/**
 * Auth — MindMitra storybook entrance.
 *
 * VISUAL SPEC (locked — do not introduce other colors):
 *   cream        #F5F0E6   page background, primary button text
 *   cream-warm   #FAF6EC   form panel background (subtle separation)
 *   sage         #9CAF88   primary button bg, input borders, accents
 *   slate        #7B8FA1   secondary text, links, labels
 *   peach        #F4B89C   focus glow, hover, decorative
 *   peach-deep   #D97757   error text (AA contrast), footer link
 *   ink          #2C2C2C   body text (NOT pure black)
 *
 * Typography:
 *   display  Fraunces (serif, italic affirmations + headings)
 *   body     Inter (already loaded via index.css)
 *
 * Layout:
 *   ≥1024px  50/50 split — watercolor left, form right
 *   768–1023 single column, max-width 480px, brand collapses to header strip
 *   <768px   single column form-only, 24px h padding, tighter rhythm
 *
 * Auth logic (signIn / signUp / signInWithGoogle / redirect-on-session) is
 * preserved verbatim — only the UI layer is replaced. No new dependencies.
 *
 * Accessibility: floating labels use real <label for>, errors carry role="alert",
 * focus rings are 3px peach@30% with 2px offset, prefers-reduced-motion strips
 * transforms but keeps color transitions. Body text in slate is a deliberate
 * tone choice — uses sufficient size + ink for primary content.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { WatercolorScene } from "@/components/layout/WatercolorScene";
import { cn } from "@/lib/utils";

const AFFIRMATIONS = [
  "Not therapy. A thread you can drop into in Hindi, English, or Hinglish.",
  "Remembers your story across nights — not like a form, like continuity.",
  "Short resets when your head won’t quiet. Humans when you want a person.",
  "Never a diagnosis. Never a prescription. A bridge, not a replacement.",
  "Your data stays in India. You control what’s remembered.",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = "signin" | "signup";
type FormValues = { email: string; password: string };

const Auth = () => {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { user, signIn, signUp, signInWithGoogle, resetPasswordForEmail } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [affirmIdx, setAffirmIdx] = useState(0);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormValues>({ mode: "onBlur" });

  const watchedEmail = watch("email");

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  useEffect(() => {
    const t = window.setInterval(
      () => setAffirmIdx((i) => (i + 1) % AFFIRMATIONS.length),
      8000,
    );
    return () => window.clearInterval(t);
  }, []);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    if (mode === "signin") {
      const { error } = await signIn(values.email, values.password);
      if (!error) navigate("/");
    } else {
      await signUp(values.email, values.password);
    }
    setSubmitting(false);
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    await signInWithGoogle();
  };

  const toggleMode = () => {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    reset();
    setForgotOpen(false);
  };

  const openForgot = () => {
    setForgotOpen(true);
    setForgotEmail((watchedEmail || "").trim());
  };

  const sendForgot = async () => {
    const e = forgotEmail.trim();
    if (!EMAIL_RE.test(e)) return;
    setForgotSending(true);
    await resetPasswordForEmail(e);
    setForgotSending(false);
    setForgotOpen(false);
  };

  const container = reduce
    ? { hidden: {}, show: {} }
    : { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

  const item = reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3 } } }
    : {
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
        },
      };

  return (
    <div className="mm-auth">
      <style>{styles}</style>

      <aside className="mm-auth__brand" aria-hidden="false">
        <a href="/" className="mm-wordmark" aria-label="MindMitra home">
          MindMitra
        </a>

        <div className="mm-art-wrap">
          <div className="mm-art-glow" aria-hidden />
          <WatercolorScene
            name="breath"
            maxRenderedWidth={960}
            loading="eager"
            className="mm-art"
          />
        </div>

        <div className="mm-affirm" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.p
              key={affirmIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            >
              {AFFIRMATIONS[affirmIdx]}
            </motion.p>
          </AnimatePresence>
        </div>
      </aside>

      <main className="mm-auth__form-panel">
        <motion.div
          className="mm-form-card"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.h1 variants={item} className="mm-heading">
            {mode === "signin" ? "Welcome back" : "Begin here"}
          </motion.h1>

          <motion.p variants={item} className="mm-sub">
            {mode === "signin"
              ? "step gently back into your space."
              : "a quiet corner — yours to return to."}
          </motion.p>

          <motion.form
            variants={item}
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="mm-form"
          >
            <div className="mm-field">
              <input
                id="email"
                type="email"
                placeholder=" "
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-err" : undefined}
                {...register("email", {
                  required: "your email is needed to sign in",
                  pattern: {
                    value: EMAIL_RE,
                    message: "that doesn't look like an email",
                  },
                })}
              />
              <label htmlFor="email">email</label>
            </div>
            {errors.email && (
              <p id="email-err" role="alert" className="mm-err">
                {errors.email.message}
              </p>
            )}

            <div className="mm-field mm-field--toggle">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder=" "
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "pw-err" : undefined}
                {...register("password", {
                  required: "a password is needed",
                  minLength: {
                    value: 8,
                    message: "a bit longer please — at least 8 characters",
                  },
                })}
              />
              <label htmlFor="password">password</label>
              <button
                type="button"
                className="mm-eye"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "hide password" : "show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.6} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.6} />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="pw-err" role="alert" className="mm-err">
                {errors.password.message}
              </p>
            )}

            {mode === "signin" && !forgotOpen && (
              <button type="button" className="mm-forgot" onClick={openForgot}>
                forgot password?
              </button>
            )}

            {mode === "signin" && forgotOpen && (
              <div className="mm-forgot-panel" role="region" aria-label="Reset password">
                <label htmlFor="forgot-email" className="mm-forgot-label">
                  email for reset link
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  className="mm-forgot-input"
                  value={forgotEmail}
                  onChange={(ev) => setForgotEmail(ev.target.value)}
                  autoComplete="email"
                  aria-invalid={forgotEmail.length > 0 && !EMAIL_RE.test(forgotEmail)}
                />
                <div className="mm-forgot-actions">
                  <button
                    type="button"
                    className="mm-link-peach"
                    onClick={() => setForgotOpen(false)}
                  >
                    cancel
                  </button>
                  <button
                    type="button"
                    className="mm-btn-primary mm-btn-primary--inline"
                    disabled={forgotSending || !EMAIL_RE.test(forgotEmail.trim())}
                    onClick={sendForgot}
                  >
                    {forgotSending ? "sending…" : "send link"}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              className={cn("mm-btn-primary", submitting && "mm-btn-loading")}
              disabled={submitting || googleLoading}
              aria-busy={submitting}
            >
              <span className="mm-btn-label">
                {submitting
                  ? mode === "signin"
                    ? "signing in…"
                    : "creating your space…"
                  : mode === "signin"
                  ? "sign in"
                  : "create account"}
              </span>
            </button>
          </motion.form>

          <motion.div variants={item} className="mm-divider" aria-hidden>
            <span>or continue with</span>
          </motion.div>

          <motion.button
            variants={item}
            type="button"
            className="mm-btn-outline"
            onClick={onGoogle}
            disabled={submitting || googleLoading}
            aria-busy={googleLoading}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
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
            <span>{googleLoading ? "connecting…" : "Continue with Google"}</span>
          </motion.button>

          <motion.p variants={item} className="mm-footer">
            {mode === "signin" ? "New here? " : "Have an account? "}
            <button type="button" className="mm-link-peach" onClick={toggleMode}>
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </motion.p>
        </motion.div>
      </main>
    </div>
  );
};

const styles = `
.mm-auth {
  /* Aligned to Quiet Companion canvas tokens (src/index.css .qc-canvas).
     Local --mm-* aliases preserved so the existing layout / floating-label
     CSS keeps working. */
  --mm-cream: #F5EDE0;
  --mm-cream-warm: #FBF6EC;
  --mm-forest: #3F6B47;
  --mm-forest-hover: #345a3b;
  --mm-sage: #A8BC9A;
  --mm-sage-rgb: 168, 188, 154;
  --mm-slate: #7A736A;
  --mm-peach: #E8C9B0;
  --mm-peach-rgb: 232, 201, 176;
  --mm-peach-deep: #D97757;
  --mm-ink: #2D2A24;

  min-height: 100vh;
  background: var(--mm-cream);
  color: var(--mm-ink);
  font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
  display: grid;
  grid-template-columns: 1fr;
}

@media (min-width: 1024px) {
  .mm-auth { grid-template-columns: 1fr 1fr; }
}

/* ── brand panel ─────────────────────────────────────────── */
.mm-auth__brand {
  position: relative;
  background: var(--mm-cream);
  display: flex;
  flex-direction: column;
  padding: 24px 24px 0;
}

@media (min-width: 1024px) {
  .mm-auth__brand {
    padding: 40px 56px 48px;
    min-height: 100vh;
  }
}

.mm-wordmark {
  font-family: 'Fraunces', ui-serif, Georgia, serif;
  font-weight: 400;
  font-size: 18px;
  letter-spacing: 0.005em;
  color: var(--mm-ink);
  text-decoration: none;
  align-self: flex-start;
}

.mm-art-wrap {
  position: relative;
  flex: 1;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
  min-height: 320px;
}

@media (min-width: 1024px) {
  .mm-art-wrap { display: flex; }
}

.mm-art-glow {
  position: absolute;
  inset: 8% 8%;
  background: radial-gradient(
    ellipse 70% 60% at 50% 50%,
    rgba(var(--mm-sage-rgb), 0.08),
    transparent 70%
  );
  pointer-events: none;
}

.mm-art {
  position: relative;
  max-width: 460px;
  width: 100%;
  height: auto;
}

.mm-affirm {
  text-align: center;
  font-family: 'Fraunces', ui-serif, Georgia, serif;
  font-style: italic;
  color: var(--mm-slate);
  padding: 16px 0 24px;
  min-height: 1.6em;
}

.mm-affirm p {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
}

@media (min-width: 1024px) {
  .mm-affirm { padding: 8px 0 0; }
  .mm-affirm p { font-size: 17px; }
}

/* ── form panel ──────────────────────────────────────────── */
.mm-auth__form-panel {
  background: var(--mm-cream-warm);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 24px 48px;
  min-height: 100vh;
}

@media (min-width: 768px) and (max-width: 1023px) {
  .mm-auth__form-panel { padding: 32px 32px 56px; }
}

@media (min-width: 1024px) {
  .mm-auth__form-panel { padding: 48px 64px; }
}

.mm-form-card {
  width: 100%;
  max-width: 400px;
}

@media (min-width: 768px) and (max-width: 1023px) {
  .mm-form-card { max-width: 480px; }
}

.mm-heading {
  font-family: 'Fraunces', ui-serif, Georgia, serif;
  font-weight: 400;
  font-size: 32px;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--mm-ink);
  margin: 0 0 8px;
}

.mm-sub {
  font-size: 14px;
  line-height: 1.5;
  color: var(--mm-slate);
  margin: 0 0 28px;
}

.mm-form > * + * { margin-top: 16px; }

@media (max-width: 767px) {
  .mm-form > * + * { margin-top: 12px; }
}

/* ── floating-label fields ──────────────────────────────── */
.mm-field { position: relative; }

.mm-field input {
  width: 100%;
  height: 52px;
  padding: 18px 16px 6px;
  border: 1px solid var(--mm-sage);
  border-radius: 12px;
  background: transparent;
  color: var(--mm-ink);
  font-size: 16px;
  font-family: inherit;
  outline: none;
  transition: border-color 200ms ease, box-shadow 200ms ease;
  appearance: none;
  -webkit-appearance: none;
}

.mm-field--toggle input { padding-right: 48px; }

.mm-field label {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: var(--mm-slate);
  pointer-events: none;
  background: var(--mm-cream-warm);
  padding: 0 6px;
  transition: top 200ms ease, font-size 200ms ease, color 200ms ease;
}

.mm-field input:focus + label,
.mm-field input:not(:placeholder-shown) + label,
.mm-field input:-webkit-autofill + label {
  top: 0;
  font-size: 12px;
  color: var(--mm-slate);
}

.mm-field input:focus {
  border-color: var(--mm-forest);
  box-shadow: 0 0 0 4px rgba(var(--mm-peach-rgb), 0.18);
}

.mm-field input[aria-invalid="true"] {
  border-color: var(--mm-peach-deep);
}

/* keep autofill from painting harsh blue/yellow over cream */
.mm-field input:-webkit-autofill {
  -webkit-text-fill-color: var(--mm-ink);
  -webkit-box-shadow: 0 0 0 1000px var(--mm-cream-warm) inset;
  transition: background-color 9999s ease-out 0s;
}

.mm-eye {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: 0;
  color: var(--mm-slate);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  transition: color 200ms ease;
}
.mm-eye:hover { color: var(--mm-ink); }

.mm-err {
  margin: 6px 4px 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--mm-peach-deep);
}

.mm-forgot {
  display: inline-block;
  margin: 4px 4px 0;
  font-size: 13px;
  color: var(--mm-slate);
  text-decoration: none;
  background: transparent;
  border: 0;
  padding: 4px 0;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}
.mm-forgot:hover { text-decoration: underline; text-underline-offset: 3px; }

.mm-forgot-panel {
  margin-top: 8px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(var(--mm-sage-rgb), 0.35);
  background: var(--mm-cream);
}

.mm-forgot-label {
  display: block;
  font-size: 12px;
  letter-spacing: 0.02em;
  color: var(--mm-slate);
  margin-bottom: 8px;
}

.mm-forgot-input {
  width: 100%;
  height: 48px;
  padding: 12px 14px;
  border: 1px solid var(--mm-sage);
  border-radius: 10px;
  background: var(--mm-cream-warm);
  color: var(--mm-ink);
  font-size: 15px;
  font-family: inherit;
  outline: none;
}
.mm-forgot-input:focus {
  border-color: var(--mm-forest);
  box-shadow: 0 0 0 4px rgba(var(--mm-peach-rgb), 0.18);
}
.mm-forgot-input[aria-invalid="true"] {
  border-color: var(--mm-peach-deep);
}

.mm-forgot-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}

.mm-btn-primary--inline {
  width: auto;
  min-width: 128px;
  margin-top: 0;
  height: 44px;
  padding: 0 18px;
}

/* ── primary button ──────────────────────────────────────── */
.mm-btn-primary {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 52px;
  margin-top: 24px;
  background: var(--mm-forest);
  color: var(--mm-cream-warm);
  border: 0;
  border-radius: 9999px;
  font-size: 14px;
  letter-spacing: 0.02em;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 200ms ease, transform 200ms ease;
}

.mm-btn-primary .mm-btn-label { position: relative; z-index: 1; }

.mm-btn-primary:hover:not(:disabled) {
  background: var(--mm-forest-hover);
  transform: translateY(-1px);
}

.mm-btn-primary:disabled { cursor: default; opacity: 0.92; }

.mm-btn-loading::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.45) 50%,
    transparent 100%
  );
  animation: mm-sweep 1.4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes mm-sweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* ── divider ─────────────────────────────────────────────── */
.mm-divider {
  margin: 24px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--mm-slate);
  text-transform: lowercase;
}
.mm-divider::before,
.mm-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: rgba(var(--mm-sage-rgb), 0.3);
}

/* ── outline (Google) ────────────────────────────────────── */
.mm-btn-outline {
  width: 100%;
  height: 52px;
  background: var(--mm-cream);
  border: 1px solid rgba(0, 0, 0, 0.10);
  border-radius: 9999px;
  color: var(--mm-ink);
  font-size: 14px;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: pointer;
  transition: background-color 200ms ease, border-color 200ms ease, transform 200ms ease;
}
.mm-btn-outline:hover:not(:disabled) {
  border-color: var(--mm-ink);
  background: var(--mm-cream-warm);
  transform: translateY(-1px);
}
.mm-btn-outline:disabled { opacity: 0.6; cursor: default; }

/* ── footer toggle ───────────────────────────────────────── */
.mm-footer {
  margin: 28px 0 0;
  text-align: center;
  font-size: 14px;
  color: var(--mm-slate);
}

.mm-link-peach {
  background: transparent;
  border: 0;
  padding: 0;
  font: inherit;
  color: var(--mm-forest);
  font-weight: 500;
  cursor: pointer;
}
.mm-link-peach:hover { text-decoration: underline; text-underline-offset: 3px; }

/* ── focus rings ─────────────────────────────────────────── */
.mm-auth :focus-visible {
  outline: 3px solid rgba(var(--mm-peach-rgb), 0.3);
  outline-offset: 2px;
  border-radius: 6px;
}
.mm-auth input:focus-visible { outline: none; }

/* ── reduced motion ──────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .mm-btn-primary:hover:not(:disabled) { transform: none; }
  .mm-btn-loading::after { animation: none; }
}
`;

export default Auth;
