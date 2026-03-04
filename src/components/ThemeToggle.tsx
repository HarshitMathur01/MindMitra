import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme()

    return (
        <button
            onClick={toggleTheme}
            className="relative w-14 h-7 rounded-full p-1 bg-border border border-border transition-all duration-300 ease-in-out hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Toggle theme"
            type="button"
        >
            <div
                className={`absolute top-1 w-5 h-5 rounded-full flex items-center justify-center bg-primary text-white shadow-theme transition-all duration-300 ease-in-out ${theme === 'dark' ? 'left-7' : 'left-1'
                    }`}
            >
                {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
            </div>
        </button>
    )
}
