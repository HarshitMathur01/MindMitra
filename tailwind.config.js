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
				display: ["DM Sans", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
				sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
				"serif-display": ["Fraunces", "ui-serif", "Georgia", "Cambria", "\"Times New Roman\"", "serif"],
			},
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
