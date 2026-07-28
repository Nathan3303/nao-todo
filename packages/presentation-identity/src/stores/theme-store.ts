import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { THEME_MODE_KEY, type ThemeMode } from '@nao-todo/domain-identity'

/**
 * 主题存储
 * @description 主题存储负责管理主题模式状态和持久化存储
 */
export const useThemeStore = defineStore('ThemeStore', () => {
    // @state 主题模式 - light | dark | system
    const themeMode = ref<ThemeMode>('system')

    // @state 系统偏好（深模式）
    const systemPrefersDark = ref(false)

    /**
     * 实际应用的主题（根据系统偏好解析 'system' 模式）
     */
    const actualTheme = computed(() => {
        if (themeMode.value === 'system') {
            return systemPrefersDark.value ? 'dark' : 'light'
        }
        return themeMode.value
    })

    /**
     * 是否激活深模式主题
     * @description 计算属性，根据实际主题模式判断是否激活深模式主题
     */
    const isDark = computed(() => actualTheme.value === 'dark')

    /**
     * 设置主题模式
     * @param mode - 主题模式
     */
    const setTheme = (mode: ThemeMode) => {
        themeMode.value = mode
        localStorage.setItem(THEME_MODE_KEY, mode)
    }

    /**
     * 更新主题模式
     * @param mode - 主题模式
     */
    const updateTheme = (mode?: ThemeMode | null) => {
        if (!mode) {
            loadSavedTheme()
            return
        }
        setTheme(mode)
    }

    /**
     * 初始化系统偏好监听器
     * @description 初始化系统偏好变化监听器，用于监听用户系统偏好变化
     */
    const initSystemListener = () => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        systemPrefersDark.value = mediaQuery.matches

        mediaQuery.addEventListener('change', (e) => {
            systemPrefersDark.value = e.matches
        })
    }

    /**
     * 从 localStorage 加载已保存的主题模式
     */
    const loadSavedTheme = () => {
        const saved = localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null
        if (saved && ['light', 'dark', 'system'].includes(saved)) {
            themeMode.value = saved
        }
    }

    /**
     * 应用主题到文档
     * @description 应用当前主题模式到文档根元素，用于切换深模式主题
     */
    const applyTheme = () => {
        const flag = isDark.value ? 1 : 0
        document.documentElement.style.setProperty('--nue-dark-switch', flag.toString())
    }

    /**
     * 监听实际主题变化并应用到 DOM
     * @description 监听实际主题变化，当主题模式变化时应用到文档
     */
    watch(actualTheme, () => applyTheme(), { immediate: true })

    return {
        themeMode,
        actualTheme,
        isDark,
        setTheme,
        updateTheme,
        initSystemListener,
        loadSavedTheme,
        applyTheme
    }
})