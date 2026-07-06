/**
 * ErrorBoundary — last-line-of-defense for the React tree.
 *
 * Why this exists: MindMitra is used by people in distress. A blank
 * white screen with no path forward is the worst possible failure
 * mode. If anything inside the tree throws synchronously during
 * render, this boundary catches it and shows a calm fallback that
 * always offers (a) a way to reload, and (b) immediate access to
 * crisis resources without depending on any component below it.
 *
 * Notes:
 *   - We deliberately do NOT use any of our own UI components inside
 *     the fallback. Doing so would risk the same render bug taking
 *     down the recovery surface itself. Plain HTML + inline styles
 *     so this works even if Tailwind / theme / fonts haven't loaded.
 *   - We call `window.location.reload()` rather than React-router
 *     navigation because the router itself may be the broken thing.
 *   - The helpline numbers mirror `src/lib/helplines.ts`. Keep in sync
 *     manually — we cannot import it here without re-introducing the
 *     coupling that this boundary is supposed to insulate against.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
    children: ReactNode;
    /**
     * Optional quiet fallback for non-fatal, contained subtrees (e.g. a
     * lazy-loaded avatar pane). When provided, a caught error renders this
     * instead of the full-screen crisis recovery surface — so a broken
     * non-essential widget can disappear gracefully while the rest of the
     * app (and text chat) keeps working. Omit it at the app root, where the
     * crisis fallback is the intended last line of defense.
     */
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error("[ErrorBoundary] caught render error:", error, info);
        // We deliberately do not push to product analytics here — the
        // analytics provider may itself be the source of the throw.
        // Wire to a dedicated error tracker (Sentry/Highlight) when one
        // is added, with PII scrubbing.
    }

    private handleReload = (): void => {
        window.location.reload();
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        // Contained subtrees opt into a quiet fallback rather than the
        // full-screen crisis surface below.
        if (this.props.fallback !== undefined) return this.props.fallback;

        return (
            <div
                role="alert"
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "24px",
                    backgroundColor: "#f7f4ee",
                    color: "#2a2a2a",
                    fontFamily:
                        "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
                }}
            >
                <div
                    style={{
                        maxWidth: "32rem",
                        width: "100%",
                        backgroundColor: "#ffffff",
                        borderRadius: "20px",
                        padding: "28px",
                        boxShadow: "0 12px 40px rgba(0,0,0,0.06)",
                        border: "1px solid rgba(0,0,0,0.06)",
                    }}
                >
                    <h1
                        style={{
                            fontSize: "20px",
                            fontWeight: 600,
                            margin: "0 0 8px",
                            color: "#1d3a36",
                        }}
                    >
                        Something on our side broke.
                    </h1>
                    <p
                        style={{
                            fontSize: "15px",
                            lineHeight: 1.55,
                            margin: "0 0 20px",
                            color: "#4a5654",
                        }}
                    >
                        We're sorry — this isn't on you. Reload the page and we'll keep going. If
                        you need someone right now, please reach out to one of the lines below.
                    </p>

                    <button
                        type="button"
                        onClick={this.handleReload}
                        style={{
                            width: "100%",
                            padding: "12px 16px",
                            borderRadius: "12px",
                            backgroundColor: "#1d3a36",
                            color: "#ffffff",
                            fontSize: "15px",
                            fontWeight: 500,
                            border: "none",
                            cursor: "pointer",
                            marginBottom: "20px",
                        }}
                    >
                        Reload the page
                    </button>

                    <div
                        style={{
                            borderTop: "1px solid rgba(0,0,0,0.08)",
                            paddingTop: "16px",
                        }}
                    >
                        <p
                            style={{
                                fontSize: "12px",
                                fontWeight: 600,
                                letterSpacing: "0.12em",
                                textTransform: "uppercase",
                                margin: "0 0 12px",
                                color: "#8a9290",
                            }}
                        >
                            If you need to talk to someone now
                        </p>
                        <ul
                            style={{
                                listStyle: "none",
                                padding: 0,
                                margin: 0,
                                display: "grid",
                                gap: "10px",
                            }}
                        >
                            <li>
                                <a
                                    href="tel:9152987821"
                                    style={{
                                        display: "block",
                                        padding: "12px 14px",
                                        borderRadius: "10px",
                                        backgroundColor: "#f3efe6",
                                        color: "#1d3a36",
                                        textDecoration: "none",
                                        fontSize: "14px",
                                        fontWeight: 500,
                                    }}
                                >
                                    iCall — 9152987821 (Mon–Sat, 8am–10pm)
                                </a>
                            </li>
                            <li>
                                <a
                                    href="tel:18005990019"
                                    style={{
                                        display: "block",
                                        padding: "12px 14px",
                                        borderRadius: "10px",
                                        backgroundColor: "#f3efe6",
                                        color: "#1d3a36",
                                        textDecoration: "none",
                                        fontSize: "14px",
                                        fontWeight: 500,
                                    }}
                                >
                                    KIRAN — 1800-599-0019 (24/7, free)
                                </a>
                            </li>
                        </ul>
                    </div>

                    {import.meta.env.DEV && this.state.error && (
                        <details
                            style={{
                                marginTop: "20px",
                                fontSize: "12px",
                                color: "#8a9290",
                            }}
                        >
                            <summary style={{ cursor: "pointer" }}>Developer details</summary>
                            <pre
                                style={{
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                    marginTop: "8px",
                                }}
                            >
                                {this.state.error.message}
                                {"\n"}
                                {this.state.error.stack}
                            </pre>
                        </details>
                    )}
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
