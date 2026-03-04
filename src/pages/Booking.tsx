import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, ShieldCheck, ArrowLeft } from "lucide-react";
import Header from "@/components/layout/Header";

const Booking = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate loading referral details
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen bg-background text-text-primary">
            <Header />
            <main className="container mx-auto px-4 py-8">
                <Button
                    variant="ghost"
                    className="mb-6 flex items-center gap-2"
                    onClick={() => navigate("/therapist-bridge")}
                >
                    <ArrowLeft className="h-4 w-4" /> Back to Directory
                </Button>

                <div className="max-w-2xl mx-auto">
                    {loading ? (
                        <Card className="p-8 text-center animate-pulse">
                            <div className="h-8 bg-muted rounded w-1/2 mx-auto mb-4"></div>
                            <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-8"></div>
                            <div className="h-32 bg-muted rounded w-full"></div>
                        </Card>
                    ) : (
                        <Card className="p-8 text-center border-t-4 border-t-green-500 shadow-lg">
                            <div className="flex justify-center mb-6">
                                <div className="bg-green-100 p-4 rounded-full">
                                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                                </div>
                            </div>

                            <h1 className="text-3xl font-bold mb-2">Referral Confirmed</h1>
                            <p className="text-muted-foreground mb-8">
                                Referral ID: <span className="font-mono bg-muted px-2 py-1 rounded text-foreground">{id}</span>
                            </p>

                            <div className="text-left bg-muted/30 p-6 rounded-lg mb-8 space-y-4">
                                <div className="flex items-start gap-4">
                                    <ShieldCheck className="h-6 w-6 text-primary mt-0.5" />
                                    <div>
                                        <h3 className="font-semibold text-lg">Secure Data Transfer</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Your emotional profile and assessment scores have been securely encrypted and are ready for your therapist to review.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <Calendar className="h-6 w-6 text-primary mt-0.5" />
                                    <div>
                                        <h3 className="font-semibold text-lg">Next Step: Schedule Session</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Please check your email for the scheduling link from the therapist's office to finalize your appointment time.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button onClick={() => navigate("/")}>Return Home</Button>
                                <Button variant="outline" onClick={() => navigate("/therapist-bridge")}>
                                    Browse More Therapists
                                </Button>
                            </div>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Booking;
