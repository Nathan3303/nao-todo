import { computed, shallowRef } from 'vue'
import { t } from '@nao-todo/shared/locales'
import type { Command } from '@nao-todo/shared/commands'
import { registry } from '@/commands/instance'
import { detectPlatform } from '@/commands/platform'
import { buildShortcutGroups } from './shortcuts-model'

/**
 * 快捷键帮助数据面（DI 唯一入口）
 * @description 与命令面板同源：内容**全部**由 `registry.getAll()` 派生（按键 + 说明 + 分组），
 *              只列真的有键位/手势的命令 ⇒ 占位命令、不可达命令（已删的 `app.modal.close`）不出现。
 */
export const useShortcutsHelp = () => {
    const platform = detectPlatform()
    const snapshot = shallowRef<Command[]>([])

    const refresh = (): void => {
        snapshot.value = registry.getAll()
    }

    const groups = computed(() =>
        buildShortcutGroups(snapshot.value, {
            platform,
            wheelLabel: t('commands.key.wheel')
        })
    )

    /** 无任何键位 ⇒ 空态（`LoadingError` 的 empty 态） */
    const isEmpty = computed(() => groups.value.length === 0)

    return { platform, groups, isEmpty, refresh }
}