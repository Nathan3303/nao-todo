import { localDatabase, localSession, syncStatus } from '@nao-todo/infrastructure'
import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import { getMirrorState } from '@/data-plane'

/**
 * 触顶文案 N（AC13b / PM 裁定）—— 镜像中**实际已加载**行数
 *
 * @description **不得**用固定上限（`PULL_LIMIT × PULL_MAX_ROUNDS`）冒充：截断可由
 *              ① **行数上限** 或 ② **时间预算** 触发，固定数字在 ② 下会误导。
 *              取「当前用户镜像里 tasks 表实际行数」⇒ 两种截断原因下都真实（文案「已加载 N 条」），
 *              且**不引服务端 `pagination.total`**（R2：`Total` 非剩余总数）。
 *
 *              仅 `mirrorTruncated` 为真时统计（否则 0 ⇒ 组件退回通用文案）；
 *              订阅 `syncStatus` 在拉取/落盘后刷新。
 *
 * @see docs/prds/2026-09-23-web-offline-stage1.md（AC13b）
 */

/** 触顶文案涉及的主表（业务主体，与既有覆盖度文案口径一致） */
const COVERAGE_TABLE = 'tasks'

/**
 * 镜像中当前用户的主表已加载行数（无会话/无表 ⇒ 0）
 * @description 只读计数，不产生任何写路径（C-59）；`userId` 为空时不查库（C-55 硬失败口径：
 *              UI 侧不需要硬失败，退 0 由通用文案兜底）。
 */
export const countMirrorRows = async (table: string = COVERAGE_TABLE): Promise<number> => {
    const userId = localSession.getCurrentUserId()
    if (!userId) return 0
    return localDatabase.table(table).where('userId').equals(userId).count()
}

/** 触顶时镜像已加载行数（响应式；未触顶恒 0） */
export const useMirrorLoadedCount = (): Ref<number> => {
    const count = ref(0)

    const refresh = async (): Promise<void> => {
        const { mirrorTruncated } = getMirrorState()
        count.value = mirrorTruncated ? await countMirrorRows() : 0
    }

    let unsubscribe: (() => void) | null = null

    onMounted(() => {
        void refresh()
        unsubscribe = syncStatus.subscribe(() => {
            void refresh()
        })
    })

    onUnmounted(() => {
        unsubscribe?.()
        unsubscribe = null
    })

    return count
}