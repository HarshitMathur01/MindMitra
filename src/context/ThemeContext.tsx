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

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system')
    const [theme, setThemeState] = useState<Theme>('light')

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY) as ThemePreference | null
        const initialPreference: ThemePreference = saved === 'light' || saved === 'dark' || saved === 'system'
            ? saved
            : 'light'
        const initialTheme = resolveTheme(initialPreference)

        setThemePreferenceState(initialPreference)
        setThemeState(initialTheme)
        document.documentElement.setAttribute('data-theme', initialTheme)
    }, [])

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
