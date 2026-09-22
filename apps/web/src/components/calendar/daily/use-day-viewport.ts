import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
// 相对路径导入（而非 `@/hooks/use-shortcut`）：桌面端 electron.vite 对 `@/hooks` 做前缀别名
// （→ 桌面装配层 hooks 目录），子路径会解析失败；相对路径指向 webapp 真实文件，两端一致。
import { useShortcut } from '../../../hooks/use-shortcut'
import { CALENDAR_KEY_SCOPE } from '../monthly/keyboard-nav'
import type { DayGridModel } from './build-day-grid'
import {
    DAY_MINUTES,
    DAY_ZOOM_DEFAULT,
    dayScrollWidthCss,
    nextDayZoom,
    prevDayZoom,
    type DayZoom
} from './day-zoom'
import { useDayPan } from './use-day-pan'

/**
 * useDayViewport —— 日视图时间轴视口（TASK-19 档位 / TASK-19B pan·遮罩 / TASK-20 AC1·AC3·AC5·AC6·AC9）
 * @description 一个关注点：**时间轴视口**（滚动宿主 + 缩放两入口 + 视口锚定 + 空白平移 + 裁切遮罩 + 当前时间线）。
 *              - 总宽（AC9）：整数列宽公式，容器宽在**挂载 / `ResizeObserver` 读一次**（`pointermove` 禁读布局）；
 *              - 缩放两入口（轴 ADR r3）：`Ctrl/⌘ ±`·`Ctrl/⌘ 0` 快捷键 + `Ctrl/⌘ + 滚轮`（头部按钮已退役）；
 *              - pan 见 `useDayPan`（自愈 / 兜底收尾 / `preventDefault`）；
 *              - 遮罩置于滚动容器之外（C7），仅该侧有可滚内容时显示（rAF 合并）。
 */

/** 视口依赖：`model` 提供 `isToday` 与列数；档位偏好由 entry 级 context 注入（D6） */
export type DayViewportDeps = {
    model: Ref<DayGridModel>
    dayZoom: Ref<DayZoom>
    setDayZoom?: (zoom: DayZoom) => void
}

export const useDayViewport = ({ model, dayZoom, setDayZoom }: DayViewportDeps) => {
    // @states 滚动宿主（`.day-body` 双轴滚动容器）与横向内容层（`.day-scroll`）
    const bodyEl = ref<HTMLElement | null>(null)
    const scrollEl = ref<HTMLElement | null>(null)

    // —— 容器可视宽（AC9）：挂载 / ResizeObserver 读一次；`<= 0`（jsdom）⇒ 宽度公式自然落下限 ——
    const containerW = ref(0)
    const measureContainer = (): void => {
        containerW.value = bodyEl.value?.clientWidth ?? 0
    }

    // @computed 横向内容层宽度：整数列宽 `max(列数 × ceil(k × 容器宽 ÷ 列数), 列数 × 20px)`（D3′）
    const scrollWidthCss = computed(() =>
        dayScrollWidthCss(dayZoom.value, model.value.columns.length, containerW.value)
    )

    // —— 视口锚定（ADR §5.3 #12）：进入定位当前时间；缩放保持视口中心；禁 smooth；不持久化 scrollLeft ——
    const clamp = (value: number, min: number, max: number): number =>
        Math.min(Math.max(value, min), max)
    /** 时间轴实宽（`.day-scroll` 内容宽）；未布局（jsdom）→ 0 */
    const axisWidth = (): number => scrollEl.value?.getBoundingClientRect().width ?? 0
    /** 当前视口中心对应的时间（分钟）；无法计算 → null */
    const currentCenterMin = (): number | null => {
        const body = bodyEl.value
        const width = axisWidth()
        const viewport = body?.clientWidth ?? 0
        if (!body || width <= 0 || viewport <= 0) return null
        return ((body.scrollLeft + viewport / 2) / width) * DAY_MINUTES
    }
    let pendingCenterMin: number | null = null
    /** 缩放后把原视口中心写回（禁 smooth，避免与宽度变更竞态） */
    const restoreCenter = (): void => {
        const body = bodyEl.value
        const width = axisWidth()
        const viewport = body?.clientWidth ?? 0
        const centerMin = pendingCenterMin
        pendingCenterMin = null
        if (!body || width <= 0 || viewport <= 0 || centerMin === null) return
        body.scrollLeft = clamp(
            (centerMin / DAY_MINUTES) * width - viewport / 2,
            0,
            width - viewport
        )
    }
    /** 进入日视图：横向定位到当前时间（非今天 → 00:00） */
    const scrollToNow = (): void => {
        const body = bodyEl.value
        const width = axisWidth()
        const viewport = body?.clientWidth ?? 0
        if (!body || width <= 0 || viewport <= 0) return
        if (!model.value.isToday) {
            body.scrollLeft = 0
            return
        }
        const nowMin = dayjs().hour() * 60 + dayjs().minute()
        body.scrollLeft = clamp((nowMin / DAY_MINUTES) * width - viewport / 2, 0, width - viewport)
    }

    // —— 当前时间线（仅锚点日=今天；30 秒更新；非今天不挂定时器） ——
    const now = ref(dayjs())
    let timer: ReturnType<typeof setInterval> | undefined
    watch(
        () => model.value.isToday,
        (isToday) => {
            clearInterval(timer)
            timer = undefined
            if (isToday) {
                now.value = dayjs()
                timer = setInterval(() => (now.value = dayjs()), 30000)
            }
        },
        { immediate: true }
    )
    onUnmounted(() => clearInterval(timer))
    const nowLeft = computed(() => {
        const minutes = now.value.hour() * 60 + now.value.minute()
        return `${(minutes / DAY_MINUTES) * 100}%`
    })

    // —— 缩放：写回（优先 entry 级 setter 以持久化；无 setter 时直改 ref） ——
    const applyZoom = (next: DayZoom): void => {
        if (next === dayZoom.value) return
        pendingCenterMin = currentCenterMin()
        if (setDayZoom) setDayZoom(next)
        else dayZoom.value = next
        void nextTick(restoreCenter)
    }
    const zoomIn = (): void => applyZoom(nextDayZoom(dayZoom.value))
    const zoomOut = (): void => applyZoom(prevDayZoom(dayZoom.value))
    const zoomReset = (): void => applyZoom(DAY_ZOOM_DEFAULT)
    // 入口②：快捷键（keys 字面量已定死；scope=CALENDAR_KEY_SCOPE，随日视图卸载注销）
    useShortcut('calendar.dayzoom.in', '$mod+=', () => zoomIn(), { scope: CALENDAR_KEY_SCOPE })
    useShortcut('calendar.dayzoom.out', '$mod+-', () => zoomOut(), { scope: CALENDAR_KEY_SCOPE })
    useShortcut('calendar.dayzoom.reset', '$mod+0', () => zoomReset(), {
        scope: CALENDAR_KEY_SCOPE
    })
    // 入口③：Ctrl/⌘ + 滚轮（deltaY < 0 放大、> 0 缩小、=== 0 忽略；preventDefault 由 .prevent 承担）
    const onWheel = (event: WheelEvent): void => {
        if (event.deltaY === 0) return
        if (event.deltaY < 0) zoomIn()
        else zoomOut()
    }

    // —— C4 空白横向平移（pan；独立极小组合式，复用同一阈值） ——
    const { isPanning, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } =
        useDayPan(bodyEl)

    // —— C7 裁切渐隐遮罩（滚动容器之外；rAF 合并，仅该侧有可滚内容时显示） ——
    const showStartFade = ref(false)
    const showEndFade = ref(false)
    let fadeRaf = 0
    const updateFades = (): void => {
        const el = bodyEl.value
        if (!el) return
        showStartFade.value = el.scrollLeft > 0
        showEndFade.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 1
    }
    const onBodyScroll = (): void => {
        if (fadeRaf) return
        fadeRaf = requestAnimationFrame(() => {
            fadeRaf = 0
            updateFades()
        })
    }

    // —— 挂载：一次测量 + 视口定位 + 遮罩；resize 只重测容器宽（AC6：档位值 k 不被 resize 改写） ——
    let resizeObserver: ResizeObserver | undefined
    onMounted(() => {
        measureContainer()
        void nextTick(() => {
            scrollToNow()
            updateFades()
        })
        if (typeof ResizeObserver === 'undefined') return
        resizeObserver = new ResizeObserver(() => {
            measureContainer()
            updateFades()
        })
        if (bodyEl.value) resizeObserver.observe(bodyEl.value)
    })
    watch(dayZoom, () => void nextTick(updateFades))
    onUnmounted(() => {
        resizeObserver?.disconnect()
        if (fadeRaf) cancelAnimationFrame(fadeRaf)
    })

    return {
        bodyEl,
        scrollEl,
        scrollWidthCss,
        onWheel,
        nowLeft,
        isPanning,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onBodyScroll,
        showStartFade,
        showEndFade
    }
}