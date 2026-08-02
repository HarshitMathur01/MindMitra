import tailwindcssAnimate from "tailwindcss-animate";
import tailwindcssTypography from "@tailwindcss/typography";

export default {
	darkMode: ["class", '[data-theme="dark"]'],
	content: [
		"./index.html",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: "2rem",
			screens: {
				"2xl": "1400px",
			},
		},
		extend: {
			fontFamily: {
				display: ["Caveat", "cursive", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
				sans: ["Kalam", "Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
				"serif-display": ["Fraunces", "ui-serif", "Georgia", "Cambria", "\"Times New Roman\"", "serif"],
				// ── Public landing ("watercolour" surface) ──────────────────
				// Scoped to src/components/landing/*. Loaded via <link> in
				// index.html. Do not use these outside the landing — the rest
				// of the app is on the Sanctuary type scale above.
				deva: ["\"Tiro Devanagari Hindi\"", "serif"],
				"serif-brand": ["Fraunces", "ui-serif", "Georgia", "serif"],
				ui: ["Mukta", "system-ui", "-apple-system", "sans-serif"],
				"editorial-serif": ["\"Libre Baskerville\"", "ui-serif", "Georgia", "serif"],
				"editorial-sans": ["\"IBM Plex Sans\"", "system-ui", "-apple-system", "sans-serif"],
				// ── Night River (post-login SanctuaryHome) ──────────────────
				// Scoped to src/components/sanctuary/river/*. Instrument Serif
				// is used *italic* for every headline — it is the signature of
				// this surface, not a body face.
				"nr-display": ["\"Instrument Serif\"", "ui-serif", "Georgia", "serif"],
				"nr-sans": ["\"Work Sans\"", "ui-sans-serif", "system-ui", "sans-serif"],
			},
			// Tailwind v3 only emits an opacity modifier (`bg-cream/85`) when the
			// value exists in this scale; v4 computes any number on the fly. The
			// landing was authored against v4 and uses values like /8 and /85, so
			// we materialise the full 0–100 range once here.
			opacity: Object.fromEntries(
				Array.from({ length: 101 }, (_, i) => [String(i), String(i / 100)]),
			),
			maxWidth: {
				page: "var(--max-page)",
			},
			colors: {
				border: "hsl(var(--border) / <alpha-value>)",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				background: "hsl(var(--background))",
				surface: "hsl(var(--surface) / <alpha-value>)",
				"crushed-silk": "hsl(var(--crushed-silk) / <alpha-value>)",
				foreground: "hsl(var(--text-primary))",
				"text-primary": "hsl(var(--text-primary))",
				"text-secondary": "hsl(var(--text-secondary))",
				danger: "hsl(var(--danger))",
				success: "hsl(var(--success))",
				warning: "hsl(var(--warning))",
				primary: {
					DEFAULT: "hsl(var(--primary) / <alpha-value>)",
					foreground: "hsl(var(--primary-foreground))",
					glow: "hsl(var(--primary-glow))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent) / <alpha-value>)",
					foreground: "hsl(var(--accent-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--surface) / <alpha-value>)",
					foreground: "hsl(var(--popover-foreground))",
				},
				card: {
					DEFAULT: "hsl(var(--surface) / <alpha-value>)",
					foreground: "hsl(var(--card-foreground))",
				},
				sidebar: {
					DEFAULT: "hsl(var(--sidebar-background))",
					foreground: "hsl(var(--sidebar-foreground))",
					primary: "hsl(var(--sidebar-primary))",
					"primary-foreground": "hsl(var(--sidebar-primary-foreground))",
					accent: "hsl(var(--sidebar-accent))",
					"accent-foreground": "hsl(var(--sidebar-accent-foreground))",
					border: "hsl(var(--sidebar-border))",
					ring: "hsl(var(--sidebar-ring))",
				},
				"ink-0": "hsl(var(--ink-0))",
				"ink-1": "hsl(var(--ink-1))",
				"ink-2": "hsl(var(--ink-2))",
				"ink-3": "hsl(var(--ink-3))",
				"ink-4": "hsl(var(--ink-4))",
				"ink-5": "hsl(var(--ink-5))",
				"ink-6": "hsl(var(--ink-6))",
				"ink-7": "hsl(var(--ink-7))",
				"ink-8": "hsl(var(--ink-8))",
				"ink-9": "hsl(var(--ink-9))",
				"calm-blue": "hsl(var(--calm-blue))",
				"serene-green": "hsl(var(--serene-green))",
				"warm-purple": "hsl(var(--warm-purple))",
				"soft-pink": "hsl(var(--soft-pink))",

				// ── Public landing palette ──────────────────────────────────
				// Literal hex (not CSS vars) on purpose: the landing is a
				// light-only marketing surface and must not invert under the
				// app's dark theme. Mirrored in
				// src/components/landing/tokens.ts for JS consumers.
				forest: "#1B3A2B",
				cream: "#F6F0E2",
				terracotta: "#C8794F",
				"terracotta-ink": "#9E5A38",
				sage: "#8FA68E",
				ink: "#2A2A26",
				"night-indigo": "#1A1F3A",
				"sand-light": "#FAF8F5",
				sand: "#F0EBE3",
				"sand-tan": "#C9B99A",
				"sand-brown": "#8B7355",

				// ── Night River (post-login SanctuaryHome) ──────────────────
				// Deliberately namespaced `nr-`. The unprefixed `ink` / `forest`
				// / `sage` above are the *landing's* light-only hexes and are a
				// different palette entirely — reusing those names here would
				// silently repaint PublicLanding.
				//
				// Literal oklch with <alpha-value> so Tailwind v3 can still
				// substitute an opacity modifier (`bg-nr-forest/40`). Only
				// `nr-mood` is a live var, because the mood selector recolours
				// it at runtime — see .mm-river in components/sanctuary/river.
				"nr-paper": "oklch(0.949 0.005 150 / <alpha-value>)",
				"nr-paper-deep": "oklch(0.905 0.007 160 / <alpha-value>)",
				"nr-moon": "oklch(0.985 0.003 150 / <alpha-value>)",
				"nr-ink": "oklch(0.244 0.019 232 / <alpha-value>)",
				"nr-forest": "oklch(0.293 0.022 232 / <alpha-value>)",
				"nr-river": "oklch(0.626 0.045 235 / <alpha-value>)",
				"nr-clay": "oklch(0.66 0.055 60 / <alpha-value>)",
				"nr-moss": "oklch(0.62 0.04 165 / <alpha-value>)",
				"nr-gold": "oklch(0.8 0.04 90 / <alpha-value>)",
				"nr-lavender": "oklch(0.593 0.045 305 / <alpha-value>)",
				// Semantic aliases. These are the ones that FLIP on dark —
				// they resolve through vars declared on `.mm-river` in
				// river.css. No opacity modifier on any of them: a bare
				// var() can't carry <alpha-value>. Where you need alpha,
				// reach for the literal palette above, or color-mix().
				"nr-bg": "var(--nr-bg)",
				"nr-fg": "var(--nr-fg)",
				"nr-card": "var(--nr-card)",
				"nr-card-fg": "var(--nr-card-fg)",
				"nr-border": "var(--nr-border)",
				"nr-muted": "var(--nr-muted-fg)",
				"nr-mood": "var(--nr-mood)",
				// Hero-only foreground. The hero sits on a photograph that
				// changes with the hour, so its copy can't inherit `nr-fg` —
				// see the measured contrast table in river.css.
				"nr-hero-fg": "var(--nr-hero-fg)",
				"nr-hero-muted": "var(--nr-hero-muted)",
				"nr-hero-border": "var(--nr-hero-border)",
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
				"2xl": "var(--radius-2xl)",
				xl: "var(--radius-xl)",
			},
			spacing: {
				header: "var(--header-height)",
			},
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
				"fade-up": {
					from: { opacity: "0", transform: "translateY(20px)" },
					to: { opacity: "1", transform: "translateY(0)" },
				},
				"fade-in": {
					from: { opacity: "0" },
					to: { opacity: "1" },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				"fade-up": "fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
				"fade-in": "fade-in 0.5s ease both",
			},
			transitionDuration: {
				600: "600ms",
				1500: "1500ms",
				2000: "2000ms",
			},
			boxShadow: {
				theme: "0 4px 24px var(--shadow)",
				"theme-lg": "0 8px 40px var(--shadow)",
				card: "0 1px 4px var(--shadow), 0 0 0 1px hsl(var(--border) / 0.5)",
				"card-hover": "0 4px 16px var(--shadow)",
				overlay: "0 8px 32px var(--shadow), 0 0 0 1px hsl(var(--border) / 0.5)",
				xs: "0 1px 2px var(--shadow)",
				"dashboard-soft": "var(--shadow-dashboard-soft)",
				"dashboard-warm": "var(--shadow-dashboard-warm)",
			},
		},
	},
	plugins: [tailwindcssAnimate, tailwindcssTypography],
};
