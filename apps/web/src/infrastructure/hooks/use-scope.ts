import { onMounted, onUnmounted } from 'vue'
import { scopeManager } from '@/infrastructure/commands/instance'

/**
 * 作用域绑定
 * @description 在组件中调用，组件挂载时自动激活作用域，卸载时自动释放
 * 与 Vue 组件生命周期绑定，形成组件树对应的作用域栈
 * @param name 作用域名称
 *
 * @example
 * // TableView.vue 中
 * useScope('task-table')
 * // mount → scopeManager.enter('task-table')
 * // unmount → scopeManager.leave('task-table')
 */
const useScope = (name: string) => {
    onMounted(() => {
        scopeManager.enter(name)
    })

    onUnmounted(() => {
        scopeManager.leave(name)
    })
}

export default useScope

