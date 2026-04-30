import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, ShieldCheck, ArrowLeft } from "lucide-react";
import Header from "@/components/layout/Header";
import HillsFooter from "@/components/layout/HillsFooter";
import PageShell from "@/components/layout/PageShell";

const Booking = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <>
            <Header />
            <PageShell width="page" as="main">
                <div className="py-12 sm:py-20">
                    <button
                        type="button"
                        onClick={() => navigate("/therapist-bridge")}
                        className="mb-10 inline-flex items-center gap-2 text-sm text-[color:var(--qc-ink-muted)] transition-colors hover:text-[color:var(--qc-ink)]"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to directory
                    </button>

                    <div className="mx-auto max-w-2xl">
                        {loading ? (
                            <Card className="animate-pulse p-10 text-center">
                                <div className="mx-auto mb-4 h-8 w-1/2 rounded bg-[color:var(--qc-border-stronger)]" />
                                <div className="mx-auto mb-8 h-4 w-3/4 rounded bg-[color:var(--qc-border-stronger)]" />
                                <div className="h-32 w-full rounded bg-[color:var(--qc-border-stronger)]" />
                            </Card>
                        ) : (
                            <Card className="rounded-3xl border-[color:var(--qc-border)] bg-[color:var(--qc-surface)] p-10 text-center">
                                <div className="mb-6 flex justify-center">
                                    <div className="rounded-full bg-[color:var(--qc-sage)]/30 p-4">
                                        <CheckCircle2 className="h-12 w-12 text-[color:var(--qc-forest)]" />
                                    </div>
                                </div>

                                <p className="qc-eyebrow">Bridge complete</p>
                                <h1 className="qc-display mt-3 text-3xl sm:text-4xl">
                                    Referral confirmed.
                                </h1>
                                <p className="mt-3 text-sm text-[color:var(--qc-ink-muted)]">
                                    Referral ID:{" "}
                                    <span className="rounded bg-[color:var(--qc-canvas)] px-2 py-1 font-mono text-[color:var(--qc-ink)]">
                                        {id}
                                    </span>
                                </p>

                                <div className="mt-10 space-y-5 rounded-2xl bg-[color:var(--qc-canvas)] p-6 text-left">
                                    <div className="flex items-start gap-4">
                                        <ShieldCheck className="mt-0.5 h-6 w-6 text-[color:var(--qc-forest)]" />
                                        <div>
                                            <h3 className="qc-display text-lg">Secure data transfer</h3>
                                            <p className="mt-1 text-sm leading-relaxed text-[color:var(--qc-ink-muted)]">
                                                Your emotional profile and assessment scores have
                                                been securely encrypted and are ready for your
                                                therapist to review.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <Calendar className="mt-0.5 h-6 w-6 text-[color:var(--qc-forest)]" />
                                        <div>
                                            <h3 className="qc-display text-lg">Next step: schedule a session</h3>
                                            <p className="mt-1 text-sm leading-relaxed text-[color:var(--qc-ink-muted)]">
                                                Please check your email for the scheduling link
                                                from the therapist's office to finalise your
                                                appointment time.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={() => navigate("/")}
                                        className="qc-pill-primary"
                                    >
                                        Return home
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navigate("/therapist-bridge")}
                                        className="qc-pill-outline"
                                    >
                                        Browse more therapists
                                    </button>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            </PageShell>
            <HillsFooter />
        </>
    );
};

export default Booking;
