// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { LocalTagPreferenceRepoImpl } from '@nao-todo/infrastructure/src/persistence-local/repos/tag-preference-repo-impl'
import { useCaseBinding } from '../binding'

/**
 * T162 用例先行（红基线）—— 阶段二 2B · 面 ⑤ DP-5「web 撤 `withMirrorFallback`」
 *
 * 契约（ADR §9.4.2 / §9.6 R-18；F9）：
 * - 现状 web = `withMirrorFallback(远端 TagPreferenceRepoImpl, 本地, ['get'])`
 *   （读远端优先、写远端直连）⇒ **非 local-first 且与 desktop 不同构**；
 * - 收口后 web 改 `newLocalTagPreferenceRepository()`（**撤 `withMirrorFallback`**），
 *   与 desktop binding（本地点 39：`newLocalTagPreferenceRepository()`）**同构**。
 *
 * 绑定级断言（与 T145–T148 同范式）：仓储实例类型即契约。
 *
 * **红窗口**：本期预期**红**（T168/W4 落地后转绿）。
 */

describe('面 ⑤ DP-5 web 标签偏好绑定（红基线）', () => {
    it('web createTagPreferenceRepository 返回本地仓储（撤 withMirrorFallback，与 desktop 同构）', () => {
        const repo = useCaseBinding.createTagPreferenceRepository()

        expect(repo).toBeInstanceOf(LocalTagPreferenceRepoImpl)
    })
})