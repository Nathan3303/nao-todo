import { onMounted, onUnmounted } from 'vue'
import { matchesKeyEvent, parseKeys } from '@nao-todo/infrastructure/commands'
import type { KeyEvent, Platform } from '@nao-todo/infrastructure/commands'
import { registry, scopeManager } from '@/infrastructure/commands/instance'

/**
 * 键盘快捷键引擎
 * @description 在 App 根组件中调用一次，全局监听 document keydown
 * 将按键事件经 Registry + ScopeManager 匹配后派发到对应的 Command
 */
const useKeyboardShortcuts = () => {
    // 平台检测：Mac 上 $mod → metaKey，其他平台 → ctrlKey
    const isMac =
        typeof navigator !== 'undefined' &&
        (/mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent))
    const platform: Platform = isMac ? 'mac' : 'win'

    /**
     * 键盘事件处理
     * @param event 原始键盘事件
     */
    const handleKeyDown = (event: KeyboardEvent) => {
        // 跳过输入框内的按键，避免与文本输入冲突
        const target = event.target as HTMLElement
        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        ) {
            // 修饰键组合仍然响应（如 Ctrl+S 保存）
            if (!(event.ctrlKey || event.metaKey)) return
        }

        // 构造平台无关的按键事件
        const keyEvent: KeyEvent = {
            key: event.key,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey
        }

        // 从栈顶（最高优先级）向下匹配
        const activeScopes = [...scopeManager.activeScopes].reverse()
        for (const scope of activeScopes) {
            const commands = registry.getByScope(scope)
            for (const command of commands) {
                if (!command.keyboard) continue

                // 平台过滤
                const bindingPlatforms = command.keyboard.platforms
                if (bindingPlatforms != null && !bindingPlatforms.includes(platform)) continue

                // 可用性检查
                if (command.available != null && !command.available({ scope })) continue

                // 快捷键匹配
                const parsed = parseKeys(command.keyboard.keys)
                if (!matchesKeyEvent(parsed, keyEvent, platform)) continue

                // 匹配成功，阻止默认行为后执行
                if (command.keyboard.preventDefault) {
                    event.preventDefault()
                }
                command.handler(keyEvent)
                return // 只执行第一个匹配的命令
            }
        }
    }

    onMounted(() => {
        document.addEventListener('keydown', handleKeyDown)
    })

    onUnmounted(() => {
        document.removeEventListener('keydown', handleKeyDown)
    })
}

export default useKeyboardShortcuts

