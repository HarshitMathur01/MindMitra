/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'

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

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const getSystemTheme = (): Theme =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const resolveTheme = (preference: ThemePreference): Theme =>
    preference === 'system' ? getSystemTheme() : preference

/**
 * The saved preference, with the same precedence the blocking script in
 * index.html applies: an explicit choice wins over the OS, 'system' defers to
 * it, and anything else — including a first visit — is light.
 *
 * Read synchronously rather than in an effect. When this ran as an effect the
 * first render was unconditionally light, which cost a white flash for
 * dark-mode users and made every theme-dependent render decision wrong on the
 * first pass — Doors picked its light art before the effect swapped it. Both
 * halves must agree; change them together.
 */
const readPreference = (): ThemePreference => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
    } catch {
        // Storage blocked (private mode) — fall through to the default.
    }
    return 'light'
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [themePreference, setThemePreferenceState] = useState<ThemePreference>(readPreference)
    const [theme, setThemeState] = useState<Theme>(() => resolveTheme(readPreference()))

    // Re-stamp rather than derive: the script in <head> has almost certainly
    // set this already and this is a no-op, but the attribute must not depend
    // on that script having survived an edit to index.html.
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
    }, [theme])

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = () => {
            setThemeState((current) => {
                if (themePreference !== 'system') {
                    return current
                }
                const nextTheme = getSystemTheme()
                document.documentElement.setAttribute('data-theme', nextTheme)
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
        document.documentElement.setAttribute('data-theme', newTheme)
    }

    const setThemePreference = (preference: ThemePreference) => {
        const nextTheme = resolveTheme(preference)
        setThemePreferenceState(preference)
        setThemeState(nextTheme)
        localStorage.setItem(STORAGE_KEY, preference)
        document.documentElement.setAttribute('data-theme', nextTheme)
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
