import { ref } from 'vue'

const DEFAULT_STORAGE_KEY = 'ASIDE_WIDTH'

export const useAsideWidth = (defaultWidth: number, storageKey?: string) => {
    storageKey = storageKey || DEFAULT_STORAGE_KEY

    // @states 读取侧边栏宽度记录
    const width = ref(localStorage.getItem(storageKey) || `${defaultWidth}px`)

    // @methods 写入侧边栏宽度记录 - 当侧边栏宽度手动修改时调用
    const updater = (newWidth: number) => {
        localStorage.setItem(storageKey, `${newWidth}px`)
    }

    return { width, updater }
}
