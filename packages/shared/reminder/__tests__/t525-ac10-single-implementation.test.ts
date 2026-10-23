import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

/**
 * T525 · AC10 单一判定实现（结构断言）
 *
 * @description 用**文件级**断言锁住「SSE 通道下线 + 桌面旧扫描器下线 + 单一实现装配 +
 *              类型迁移 + 开关清零」，防止只删一半（双通道会双提醒，PRD 硬约束）。
 *              移动端红线（`apps/mobile` / `packages/presentation-react`）由
 *              `guard:*` 与 `git status --porcelain` 把关，不在此断言。
 * @see docs/prds/2026-10-23-reminder-local-polling.md §七 AC10 · 报告 §1 影响面
 */

const ROOT = process.cwd()

const readIfExists = (relativePath: string): string | null => {
    const file = join(ROOT, relativePath)
    return existsSync(file) ? readFileSync(file, 'utf-8') : null
}

/** 期望**仍存在**的文件：缺失即视为装配未完成（防「文件被误删」导致断言空转） */
const readRequired = (relativePath: string): string => {
    const content = readIfExists(relativePath)
    expect(content, `${relativePath} 应存在`).not.toBeNull()
    return content ?? ''
}

describe('T525 · AC10 单一判定实现', () => {
    it('AC10 SSE 提醒通道下线（模块 + 其用例 + use-sse 死代码）', () => {
        expect(readIfExists('apps/web/src/views/index/reminder-sse.ts')).toBeNull()
        expect(readIfExists('apps/web/src/views/index/__tests__/reminder-sse.test.ts')).toBeNull()
        expect(readIfExists('packages/shared/hooks/use-sse.ts')).toBeNull()
    })

    it('AC10 桌面自有扫描器下线（改用 webapp 壳内同一引擎）', () => {
        expect(readIfExists('apps/desktop/src/renderer/src/hooks/use-local-reminder.ts')).toBeNull()

        const appRoot = readRequired('apps/desktop/src/renderer/src/AppRoot.vue')
        expect(appRoot).not.toContain('useLocalReminder')
        expect(appRoot).not.toContain('use-local-reminder')
    })

    it('AC10 `VITE_DISABLE_SSE` 清零（env / 接线 / CSP 注释 / README）', () => {
        const files = [
            'apps/desktop/.env.development',
            'apps/desktop/.env.production',
            'apps/desktop/src/renderer/csp-policy.ts',
            'apps/desktop/README.md',
            'apps/web/src/views/index/index-view.ts'
        ]

        for (const file of files) {
            expect(readRequired(file), `${file} 不应再引用 VITE_DISABLE_SSE`).not.toContain(
                'VITE_DISABLE_SSE'
            )
        }
    })

    it('AC10 事件类型迁移：`types/sse.ts` → `types/reminder.ts` 的 `TaskReminderEvent`', () => {
        expect(readIfExists('packages/shared/types/sse.ts')).toBeNull()

        const reminderTypes = readRequired('packages/shared/types/reminder.ts')
        expect(reminderTypes).toContain('TaskReminderEvent')
        expect(reminderTypes).not.toContain('SSEReminderEvent')
    })

    it('AC10 装配点：index-view 经共享引擎启动提醒，且不再连 SSE', () => {
        const indexView = readRequired('apps/web/src/views/index/index-view.ts')

        expect(indexView).toContain('createReminderEngine')
        expect(indexView).not.toContain('startReminderSse')
        expect(indexView).not.toContain('EventSource')
    })

    it('AC10 弹窗通道不变：仍注册 `TASK_REMINDER_DIALOG_KEY`', () => {
        const dialog = readRequired(
            'packages/presentation/task/components/dialogs/reminder/task-reminder.vue'
        )
        expect(dialog).toContain('TASK_REMINDER_DIALOG_KEY')
    })
})