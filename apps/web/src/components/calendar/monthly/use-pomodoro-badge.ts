import { computed, ref, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import { usePomodoroRecordsStore } from '@nao-todo/presentation/pomodoro'
import { usePomodoroRecordUseCase } from '@/hooks'
import { badgeLabelOf, countTimerRoundsByDate } from './pomodoro-badge'

/**
 * B1-F5 专注徽标 - 数据加载/聚合组合式（组装点在月历视图根）
 * @description 开启时才按可见区间（月=网格首末格、周=锚点所在周）拉取 type=1 记录进共享 store，
 *              聚合按 startAt 本地日口径落格；计数从共享 store 现算（区间外旧响应天然不计，
 *              翻月竞态安全）；失败静默（不阻塞日历），后续翻月重试自然恢复。关闭=停拉+立即清零。
 */

/** 服务端分页单页条数/页数上限（防御） */
const PAGE_LIMIT = 100
const MAX_PAGES = 50

/** 开始时刻 → 本地日键（口径：记录按 startAt 落日本地日） */
const dayKeyOfLocal = (iso: string): string => dayjs(iso).format('YYYY-MM-DD')

export type PomodoroBadgeRange = { fromKey: string; toKey: string }

export const usePomodoroBadge = (range: Ref<PomodoroBadgeRange | null>, enabled: Ref<boolean>) => {
    const recordsStore = usePomodoroRecordsStore()
    const recordUseCase = usePomodoroRecordUseCase(recordsStore)
    const loading = ref(false)
    let runId = 0

    // @method 拉取当前区间（type=1；含孤儿完成快照口径=服务端返回全量记录，不做任务存在过滤）
    const loadRange = async (): Promise<void> => {
        if (!enabled.value) return
        const target = range.value
        if (!target || !target.fromKey || !target.toKey) return
        const id = ++runId
        loading.value = true
        try {
            for (let page = 1; page <= MAX_PAGES; page++) {
                if (id !== runId || !enabled.value) break // 锚点已移动/已关闭：放弃本次
                const [res, err] = await recordUseCase.getRecords({
                    type: 1,
                    startTime: dayjs(target.fromKey).startOf('day').toISOString(),
                    endTime: dayjs(target.toKey).endOf('day').toISOString(),
                    page,
                    limit: PAGE_LIMIT,
                    sort: 'startAt:asc'
                })
                if (err !== null) break // 静默失败：不阻塞日历，后续翻月重试自然恢复
                if (id !== runId || !enabled.value) break
                const maxPage = res?.pagination?.maxPage ?? page
                const isLast = !res || res.recordIds.length < PAGE_LIMIT || page >= maxPage
                if (isLast) break
            }
        } finally {
            if (id === runId) loading.value = false
        }
    }

    // @watch 区间（起/止键）或开关变化即（重）拉；关闭=停拉；同日不同引用不重复拉
    watch(
        [enabled, () => range.value?.fromKey, () => range.value?.toKey],
        () => {
            if (enabled.value) void loadRange()
        },
        { immediate: true }
    )

    // @computed 可见区间 dateKey → 显示标签（store 现算；关闭时为空）
    const labelMap = computed<Map<string, string>>(() => {
        const target = range.value
        if (!enabled.value || !target || !target.fromKey || !target.toKey) return new Map()
        const counts = countTimerRoundsByDate(
            recordsStore.records as unknown as Array<{
                type: number
                startAt: string
            }>,
            target.fromKey,
            target.toKey,
            dayKeyOfLocal
        )
        const result = new Map<string, string>()
        counts.forEach((count, dateKey) => {
            result.set(dateKey, badgeLabelOf(count))
        })
        return result
    })

    // @method 取某日期键角标标签（0 → ''）
    const badgeLabel = (dateKey: string): string => labelMap.value.get(dateKey) ?? ''

    return { loading, badgeLabel }
}