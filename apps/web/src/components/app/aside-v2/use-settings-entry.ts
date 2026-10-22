import { open as settingsDialogOpen, openSettingsDialog } from '@/components/settings/dialog'
import { nextTick, onBeforeUnmount, shallowRef, watch, type ComponentPublicInstance } from 'vue'

/**
 * 侧栏设置入口（齿轮）—— rail / 抽屉两变体共用的**单一来源**
 * @description T521：变体只允许摆放位置不同，不允许能力有无不同。齿轮的 ① 打开（受
 *              `hostReady` 闸门约束的 `openSettingsDialog`）② 焦点归还目标 ③ 卸载清理
 *              三件事在此收敛，两变体不再各写一套。
 *              焦点归还只在**当前可见变体**的齿轮上（注册表指向在屏变体，切变体即改绑）。
 */

/** 当前可见变体的齿轮按钮（对话框关闭后焦点归还目标） */
export const settingsGearButton = shallowRef<HTMLButtonElement | null>(null)

// @watch 关闭后把焦点归还齿轮（Esc/关闭钮均经 NueDialog v-model 写回 state.open）
// 模块级安装（只装一次、不随任一变体卸载而停止）⇒ 两变体共用一份，无「各挂一个」也无重装竞态
watch(settingsDialogOpen, (visible) => {
    if (visible) return
    void nextTick(() => settingsGearButton.value?.focus())
})

/** 齿轮挂载/卸载时改绑（元素令牌：迟到的旧变体解绑不清掉新变体） */
export const bindSettingsGearButton = (el: HTMLButtonElement | null): void => {
    settingsGearButton.value = el
}

export const unbindSettingsGearButton = (el?: HTMLButtonElement | null): void => {
    if (el && settingsGearButton.value !== el) return
    settingsGearButton.value = null
}

/**
 * @composable 侧栏设置入口（在变体组件 setup 中调用）
 * @returns `setGearButton` 供模板函数 ref 绑定；`openSettings` 为受闸门约束的打开命令
 */
export const useSettingsEntry = () => {
    const gearButton = shallowRef<HTMLButtonElement | null>(null)

    const setGearButton = (el: Element | ComponentPublicInstance | null): void => {
        if (el instanceof HTMLButtonElement) {
            gearButton.value = el
            bindSettingsGearButton(el)
            return
        }
        if (gearButton.value) {
            unbindSettingsGearButton(gearButton.value)
            gearButton.value = null
        }
    }

    onBeforeUnmount(() => {
        if (gearButton.value) unbindSettingsGearButton(gearButton.value)
    })

    return { setGearButton, openSettings: openSettingsDialog }
}