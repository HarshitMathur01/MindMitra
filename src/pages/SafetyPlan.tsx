import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
    ShieldCheck,
    AlertCircle,
    Heart,
    Users,
    Phone,
    Home,
    Check,
    Save,
    Plus,
    X,
} from "lucide-react";

import Header from "@/components/layout/Header";
import HillsFooter from "@/components/layout/HillsFooter";
import { PageShell } from "@/components/layout/PageShell";
import Pulse from "@/components/identity/Pulse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { DURATION, EASE } from "@/lib/redesign/tokens";

const eyebrow = "qc-eyebrow";

/**
 * Stanley-Brown Safety Planning Intervention (SPI).
 *
 * Six steps, in clinically-validated order. We deliberately:
 *   - Use the user's voice ("Things that help me", not "Coping strategies")
 *     so the plan feels like *theirs*, not a worksheet.
 *   - Persist locally so a user can build the plan without an account
 *     and the data never leaves their device unless they sign up.
 *   - Never lock fields — partial plans are still useful, and the
 *     last step (means safety) often takes time to think through.
 *
 * No clinical jargon on the surface. No "are you safe?" pop-ups. The
 * tone is the same as the rest of the product: calm, on the user's side.
 */

interface ContactEntry {
    id: string;
    name: string;
    phone: string;
}

interface SafetyPlanData {
    warningSigns: string;
    internalCoping: string;
    socialDistraction: string;
    trustedContacts: ContactEntry[];
    professionalContacts: ContactEntry[];
    environment: string;
    updatedAt?: string;
}

const STORAGE_KEY = "mm-safety-plan";

const emptyPlan: SafetyPlanData = {
    warningSigns: "",
    internalCoping: "",
    socialDistraction: "",
    trustedContacts: [],
    professionalContacts: [],
    environment: "",
};

const helplines = [
    { name: "KIRAN (Govt. of India)", number: "1800-599-0019" },
    { name: "Vandrevala Foundation", number: "1860 2662 345" },
    { name: "iCall (TISS)", number: "9152 987 821" },
    { name: "AASRA", number: "9820 466 726" },
];

const loadPlan = (): SafetyPlanData => {
    if (typeof window === "undefined") return emptyPlan;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPlan;
    try {
        return { ...emptyPlan, ...JSON.parse(raw) };
    } catch {
        return emptyPlan;
    }
};

const savePlan = (plan: SafetyPlanData) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...plan, updatedAt: new Date().toISOString() }),
    );
};

const StepHeading = ({
    number,
    icon: Icon,
    title,
    blurb,
}: {
    number: number;
    icon: typeof ShieldCheck;
    title: string;
    blurb: string;
}) => (
    <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--qc-sage)]/30 text-[12px] font-medium text-[color:var(--qc-forest)]">
            {number}
        </div>
        <div className="min-w-0">
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[color:var(--qc-ink-soft)]" />
                <h2 className="qc-display text-[18px] text-[color:var(--qc-ink)]">{title}</h2>
            </div>
            <p className="mt-1 text-[13.5px] leading-[1.55] text-[color:var(--qc-ink-muted)]">{blurb}</p>
        </div>
    </div>
);

const ContactList = ({
    label,
    entries,
    onChange,
}: {
    label: string;
    entries: ContactEntry[];
    onChange: (next: ContactEntry[]) => void;
}) => {
    const update = (id: string, patch: Partial<ContactEntry>) =>
        onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));

    const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));

    const add = () =>
        onChange([
            ...entries,
            { id: crypto.randomUUID(), name: "", phone: "" },
        ]);

    return (
        <div className="space-y-3">
            {entries.length === 0 && (
                <p className="text-[13px] text-[color:var(--qc-ink-muted)]">No one yet.</p>
            )}
            {entries.map((entry) => (
                <div
                    key={entry.id}
                    className="flex flex-col gap-2 rounded-2xl border border-[color:var(--qc-border)] bg-[color:var(--qc-surface)] p-3 sm:flex-row sm:items-center"
                >
                    <Input
                        value={entry.name}
                        onChange={(e) => update(entry.id, { name: e.target.value })}
                        placeholder="Name"
                        className="h-10 sm:max-w-[200px]"
                    />
                    <Input
                        value={entry.phone}
                        onChange={(e) => update(entry.id, { phone: e.target.value })}
                        placeholder="Phone"
                        type="tel"
                        inputMode="tel"
                        className="h-10 flex-1"
                    />
                    <div className="flex items-center gap-1">
                        {entry.phone && (
                            <a
                                href={`tel:${entry.phone.replace(/\s/g, "")}`}
                                className="inline-flex h-9 items-center justify-center rounded-lg border border-[color:var(--qc-border-stronger)] bg-[color:var(--qc-canvas)] px-3 text-[12px] font-medium text-[color:var(--qc-ink-soft)] transition-colors hover:bg-[color:var(--qc-canvas)]"
                                aria-label={`Call ${entry.name || "contact"}`}
                            >
                                <Phone className="h-3.5 w-3.5" />
                            </a>
                        )}
                        <button
                            type="button"
                            onClick={() => remove(entry.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[color:var(--qc-ink-muted)] transition-colors hover:bg-[color:var(--qc-canvas)] hover:text-[color:var(--qc-ink-soft)]"
                            aria-label="Remove contact"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            ))}
            <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-[color:var(--qc-ink-muted)] hover:text-[color:var(--qc-ink)]"
                onClick={add}
            >
                <Plus className="h-3.5 w-3.5" />
                {label}
            </Button>
        </div>
    );
};

export default function SafetyPlan() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [plan, setPlan] = useState<SafetyPlanData>(emptyPlan);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<string | null>(null);

    useEffect(() => {
        const loaded = loadPlan();
        setPlan(loaded);
        setSavedAt(loaded.updatedAt ?? null);
    }, []);

    const handleSave = () => {
        setSaving(true);
        savePlan(plan);
        setSavedAt(new Date().toISOString());
        // Tiny delay so the button transition reads as intentional.
        setTimeout(() => {
            setSaving(false);
            toast({
                title: "Saved",
                description: "Your safety plan stays on this device.",
            });
        }, 300);
    };

    return (
        <div className="flex min-h-screen flex-col">
            <Header />

            <PageShell width="narrow">
                {/* ── Hero ───────────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: DURATION.long, ease: EASE.outExpo }}
                    className="grid items-center gap-6 pt-10 sm:grid-cols-[1fr_auto] sm:gap-10 sm:pt-14"
                >
                    <div className="min-w-0">
                        <p className={eyebrow}>Safety plan</p>
                        <h1 className="mt-2 text-balance qc-display text-[clamp(1.75rem,3.6vw,2.25rem)] font-light leading-[1.15] tracking-tight text-[color:var(--qc-ink)]">
                            A plan for your hardest moments.
                        </h1>
                        <p className="mt-4 max-w-prose text-[15px] leading-[1.7] text-[color:var(--qc-ink-muted)]">
                            Build this once when you&apos;re feeling steadier, so a future
                            you in distress doesn&apos;t have to think their way out from
                            scratch. It stays on this device. You can edit any of it,
                            anytime.
                        </p>
                    </div>
                    <div className="hidden shrink-0 sm:block">
                        <Pulse size={108} state="idle" intensity={0.85} />
                    </div>
                </motion.section>

                {/* ── Always-quick helplines (above the fold) ─────────
                    Per the design language: helpline buttons stay loud
                    (forest fill, large tap target). Crisis affordance must
                    remain unmistakable — do not soften. */}
                <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: DURATION.long, ease: EASE.outExpo, delay: 0.05 }}
                    className="mt-10 rounded-[1.5rem] border border-[color:var(--qc-border)] bg-[color:var(--qc-surface)] p-6 sm:p-8"
                >
                    <div className="flex items-start gap-3">
                        <Phone className="mt-0.5 h-5 w-5 text-[color:var(--qc-forest)]" />
                        <div className="min-w-0 flex-1">
                            <p className={eyebrow}>If you need someone right now</p>
                            <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--qc-ink-soft)]">
                                These lines are free, confidential, and answered by people
                                trained to listen — not to fix you.
                            </p>
                            <div className="mt-5 flex flex-wrap gap-3">
                                {helplines.map((h) => (
                                    <a
                                        key={h.name}
                                        href={`tel:${h.number.replace(/\s/g, "")}`}
                                        className="qc-pill-primary"
                                    >
                                        <Phone className="h-4 w-4" />
                                        <span>{h.name}</span>
                                        <span className="opacity-80">{h.number}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* ── Step 1 — Warning signs ─────────────────────────── */}
                <Section delay={0.1}>
                    <StepHeading
                        number={1}
                        icon={AlertCircle}
                        title="What I notice when I'm starting to slip"
                        blurb="Thoughts, body sensations, situations, or behaviours that have meant trouble for you before. The earlier you can name it, the more options you'll have."
                    />
                    <Textarea
                        value={plan.warningSigns}
                        onChange={(e) => setPlan({ ...plan, warningSigns: e.target.value })}
                        placeholder={`e.g. "I stop replying to friends", "tight chest after class", "Sunday evenings"`}
                        rows={4}
                        className="mt-4 resize-y"
                    />
                </Section>

                {/* ── Step 2 — Internal coping ──────────────────────── */}
                <Section delay={0.15}>
                    <StepHeading
                        number={2}
                        icon={Heart}
                        title="Things that help me, on my own"
                        blurb="What you can do without needing anyone else — even something small. The point is to take your mind off it for long enough to let the wave pass."
                    />
                    <Textarea
                        value={plan.internalCoping}
                        onChange={(e) =>
                            setPlan({ ...plan, internalCoping: e.target.value })
                        }
                        placeholder={`e.g. "step outside for 5 minutes", "open MindMitra and just type how it feels", "shower with the lights low"`}
                        rows={4}
                        className="mt-4 resize-y"
                    />
                </Section>

                {/* ── Step 3 — Social distraction ───────────────────── */}
                <Section delay={0.2}>
                    <StepHeading
                        number={3}
                        icon={Users}
                        title="People and places that distract me"
                        blurb="Not someone you have to talk to about it — just being around them helps. A café, a friend's room, a sibling watching cricket."
                    />
                    <Textarea
                        value={plan.socialDistraction}
                        onChange={(e) =>
                            setPlan({ ...plan, socialDistraction: e.target.value })
                        }
                        placeholder={`e.g. "go sit with mom while she cooks", "library at college", "Aman's PG room"`}
                        rows={3}
                        className="mt-4 resize-y"
                    />
                </Section>

                {/* ── Step 4 — Trusted contacts ─────────────────────── */}
                <Section delay={0.25}>
                    <StepHeading
                        number={4}
                        icon={Users}
                        title="People I can actually talk to"
                        blurb="One or two people who have shown up before. You don't need to explain everything to them — saying you're not okay is enough."
                    />
                    <div className="mt-4">
                        <ContactList
                            label="Add a trusted person"
                            entries={plan.trustedContacts}
                            onChange={(next) => setPlan({ ...plan, trustedContacts: next })}
                        />
                    </div>
                </Section>

                {/* ── Step 5 — Professionals ────────────────────────── */}
                <Section delay={0.3}>
                    <StepHeading
                        number={5}
                        icon={Phone}
                        title="Professionals & lines I can reach"
                        blurb="Your therapist, your doctor, the GP at college, a helpline you trust. The helplines above are already saved — add anything else here."
                    />
                    <div className="mt-4">
                        <ContactList
                            label="Add a professional"
                            entries={plan.professionalContacts}
                            onChange={(next) =>
                                setPlan({ ...plan, professionalContacts: next })
                            }
                        />
                    </div>
                    <div className="mt-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-[13px]"
                            onClick={() => navigate("/therapist-bridge")}
                        >
                            Don&apos;t have one yet? Find a therapist
                        </Button>
                    </div>
                </Section>

                {/* ── Step 6 — Environment ──────────────────────────── */}
                <Section delay={0.35}>
                    <StepHeading
                        number={6}
                        icon={Home}
                        title="Making the room around me safer"
                        blurb="Distance and time make a real difference. If there's something near you in the lowest moments that you wouldn't want within reach — write down where it could go instead."
                    />
                    <Textarea
                        value={plan.environment}
                        onChange={(e) => setPlan({ ...plan, environment: e.target.value })}
                        placeholder={`e.g. "give pills to mom for the week", "sleep at Aman's tonight", "delete Instagram for the weekend"`}
                        rows={3}
                        className="mt-4 resize-y"
                    />
                </Section>

                {/* ── Save bar ──────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: DURATION.long, ease: EASE.outExpo, delay: 0.4 }}
                    className="mt-10 flex flex-col items-start justify-between gap-3 rounded-[1.5rem] border border-border/40 bg-[hsl(var(--card))] p-5 sm:flex-row sm:items-center sm:p-6"
                >
                    <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-[color:var(--qc-forest)]" />
                        <div>
                            <p className="text-[14px] font-medium text-[color:var(--qc-ink)]">
                                Saved to this device
                            </p>
                            <p className="text-[12px] text-[color:var(--qc-ink-muted)]">
                                {savedAt
                                    ? `Last saved ${new Date(savedAt).toLocaleString(undefined, {
                                          dateStyle: "medium",
                                          timeStyle: "short",
                                      })}`
                                    : "Not saved yet"}
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="gap-1.5"
                    >
                        {saving ? (
                            <Check className="h-3.5 w-3.5" />
                        ) : (
                            <Save className="h-3.5 w-3.5" />
                        )}
                        {saving ? "Saved" : "Save plan"}
                    </Button>
                </motion.section>

                <p className="mt-6 text-center text-[12px] text-[color:var(--qc-ink-muted)]">
                    This isn&apos;t medical advice. If you&apos;re in immediate danger,
                    please call one of the lines above or 112.
                </p>

                <div className="h-20" />
            </PageShell>

            <HillsFooter
                message="you don't have to carry it alone."
                scene="hills"
            />
        </div>
    );
}

const Section = ({
    children,
    delay = 0,
}: {
    children: React.ReactNode;
    delay?: number;
}) => (
    <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.long, ease: EASE.outExpo, delay }}
        className="mt-8 rounded-[1.5rem] border border-border/40 bg-[hsl(var(--card))] p-5 sm:p-6"
    >
        {children}
    </motion.section>
);
