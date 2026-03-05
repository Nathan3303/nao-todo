import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

/**
 * Theme mode type
 */
export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * Theme store key
 */
export const THEME_MODE_KEY = 'theme-mode'

/**
 * Theme store
 * Manages theme mode state and persistence
 */
const useThemeStore = defineStore('ThemeStore', () => {
    // @state Theme mode - light | dark | system
    const themeMode = ref<ThemeMode>('system')

    // @state System preference for dark mode
    const systemPrefersDark = ref(false)

    // @computed Actual applied theme (resolves 'system' to actual value)
    const actualTheme = computed(() => {
        if (themeMode.value === 'system') {
            return systemPrefersDark.value ? 'dark' : 'light'
        }
        return themeMode.value
    })

    // @computed Is dark theme active
    const isDark = computed(() => actualTheme.value === 'dark')

    /**
     * Set theme mode
     * @param mode - Theme mode to set
     */
    const setTheme = (mode: ThemeMode) => {
        themeMode.value = mode
        localStorage.setItem(THEME_MODE_KEY, mode)
    }

    /**
     * Initialize system preference listener
     */
    const initSystemListener = () => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        systemPrefersDark.value = mediaQuery.matches

        mediaQuery.addEventListener('change', (e) => {
            systemPrefersDark.value = e.matches
        })
    }

    /**
     * Load saved theme from localStorage
     */
    const loadSavedTheme = () => {
        const saved = localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null
        if (saved && ['light', 'dark', 'system'].includes(saved)) {
            themeMode.value = saved
        }
    }

    /**
     * Apply theme to document
     */
    const applyTheme = () => {
        const flag = isDark.value ? 1 : 0
        document.documentElement.style.setProperty('--nue-dark-switch', flag.toString())
    }

    // Watch actual theme changes and apply to DOM
    watch(
        actualTheme,
        () => {
            applyTheme()
        },
        { immediate: true }
    )

    return {
        themeMode,
        actualTheme,
        isDark,
        setTheme,
        initSystemListener,
        loadSavedTheme,
        applyTheme
    }
})

export { useThemeStore }
