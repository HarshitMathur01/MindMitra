/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react'

type Theme = 'light' | 'dark'
type ThemePreference = Theme | 'system'

interface ThemeContextType {
    theme: Theme
    themePreference: ThemePreference
    toggleTheme: () => void
    setTheme: (theme: Theme) => void
    setThemePreference: (theme: ThemePreference) => void
}

const STORAGE_KEY = 'mindmitra-theme'
// Window for the global theme cross-fade (see globals.css `html.theme-transition`).
// Slightly longer than the 300ms CSS transition so it doesn't get cut off.
const THEME_TRANSITION_MS = 400

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const getSystemTheme = (): Theme =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const resolveTheme = (preference: ThemePreference): Theme =>
    preference === 'system' ? getSystemTheme() : preference

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system')
    const [theme, setThemeState] = useState<Theme>('light')
    const transitionTimer = useRef<number | null>(null)

    // Apply the resolved theme to <html>. When `animate` is true (user toggle
    // or live system change) we briefly enable the global `theme-transition`
    // class so colours cross-fade; on initial load we apply instantly to avoid
    // a flash. The class is removed after the transition window so normal
    // interaction never pays the per-element transition cost.
    const applyThemeAttribute = (next: Theme, animate: boolean) => {
        const root = document.documentElement
        if (animate) {
            root.classList.add('theme-transition')
            if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
            transitionTimer.current = window.setTimeout(() => {
                root.classList.remove('theme-transition')
                transitionTimer.current = null
            }, THEME_TRANSITION_MS)
        }
        root.setAttribute('data-theme', next)
    }

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY) as ThemePreference | null
        const initialPreference: ThemePreference = saved === 'light' || saved === 'dark' || saved === 'system'
            ? saved
            : 'light'
        const initialTheme = resolveTheme(initialPreference)

        setThemePreferenceState(initialPreference)
        setThemeState(initialTheme)
        applyThemeAttribute(initialTheme, false)

        return () => {
            if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
        }
    }, [])

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = () => {
            setThemeState((current) => {
                if (themePreference !== 'system') {
                    return current
                }
                const nextTheme = getSystemTheme()
                applyThemeAttribute(nextTheme, true)
                return nextTheme
            })
        }

        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [themePreference])

    const setTheme = (newTheme: Theme) => {
        setThemePreferenceState(newTheme)
        setThemeState(newTheme)
        localStorage.setItem(STORAGE_KEY, newTheme)
        applyThemeAttribute(newTheme, true)
    }

    const setThemePreference = (preference: ThemePreference) => {
        const nextTheme = resolveTheme(preference)
        setThemePreferenceState(preference)
        setThemeState(nextTheme)
        localStorage.setItem(STORAGE_KEY, preference)
        applyThemeAttribute(nextTheme, true)
    }

    const toggleTheme = () => {
        const targetTheme: Theme = theme === 'light' ? 'dark' : 'light'
        setTheme(targetTheme)
    }

    const value = {
        theme,
        themePreference,
        toggleTheme,
        setTheme,
        setThemePreference,
    }

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
    const ctx = useContext(ThemeContext)
    if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
    return ctx
}
