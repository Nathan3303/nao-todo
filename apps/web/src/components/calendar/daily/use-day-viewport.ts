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
import { nowLabelLayoutOf } from './now-label'
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

/** 当前时间标注的贴端阈值（分钟）：`00:00–00:30` / `23:30–24:00`（PRD AC6b） */
const NOW_EDGE_MINUTES = 30

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
        syncScrollLeft()
    }
    /** 进入日视图：横向定位到当前时间（非今天 → 00:00） */
    const scrollToNow = (): void => {
        const body = bodyEl.value
        const width = axisWidth()
        const viewport = body?.clientWidth ?? 0
        if (!body || width <= 0 || viewport <= 0) return
        if (!model.value.isToday) {
            body.scrollLeft = 0
            syncScrollLeft()
            return
        }
        const nowMin = dayjs().hour() * 60 + dayjs().minute()
        body.scrollLeft = clamp((nowMin / DAY_MINUTES) * width - viewport / 2, 0, width - viewport)
        syncScrollLeft()
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
    // @computed 当前时刻（分钟，0–1439）—— 唯一时基派生源（`now` 由既有 30s 定时器推进）
    const nowMinutes = computed(() => now.value.hour() * 60 + now.value.minute())
    const nowLeft = computed(() => `${(nowMinutes.value / DAY_MINUTES) * 100}%`)

    // @computed 当前时刻文本（R8 / AC6a）：恒 `HH:mm`（两位补零、不随档位简化；dayjs 的分钟占位符是 `mm`）
    //          沿用既有 `now` 时基（30s）⇒ **不新增定时器**
    const nowText = computed(() => now.value.format('HH:mm'))

    // @computed 当前时刻是否贴近轴端（AC6b：`00:00–00:30` / `23:30–24:00`）—— 语义标记，
    //          实际横向钳制由 `nowLabelTransform`（轴端点 ⊕ 视口，取更严格者）统一计算（R11）
    const nowEdge = computed<'start' | 'end' | 'center'>(() => {
        if (nowMinutes.value <= NOW_EDGE_MINUTES) return 'start'
        if (nowMinutes.value >= DAY_MINUTES - NOW_EDGE_MINUTES) return 'end'
        return 'center'
    })

    // —— R11 / AC8a·AC8b：文本宽度缓存 + 视口贴边（禁在滚动 / 拖拽帧内读布局） ——
    // 宽度缓存 ==**只在三个时机重测**：① 挂载后首帧 ② `nowText` / 档位 / 容器宽变化 ③ 切日（`anchorKey`）。
    // 读 `offsetWidth` 属布局读取 ⇒ 一律经 `nextTick`（rAF 之后）执行，**绝不**在 `onBodyScroll` / `pointermove` 内调用。
    const nowLabelEl = ref<HTMLElement | null>(null)
    const nowLabelW = ref(0)
    const measureNowLabel = (): void => {
        nowLabelW.value = nowLabelEl.value?.offsetWidth ?? 0
    }

    // 可见区域左缘：只在滚动回调的 rAF 内同步（`scrollLeft` 为纯属性读，不触发重排）
    const scrollLeftPx = ref(0)
    const syncScrollLeft = (): void => {
        scrollLeftPx.value = bodyEl.value?.scrollLeft ?? 0
    }

    // @computed 文本中心相对线的偏移（轴端点 ⊕ 视口，取更严格者；纯函数 `nowLabelLayoutOf`）
    const nowLabelOffsetPx = computed(() => {
        const axisWidth = Number.parseFloat(scrollWidthCss.value)
        return nowLabelLayoutOf({
            lineX: (nowMinutes.value / DAY_MINUTES) * axisWidth,
            labelWidth: nowLabelW.value,
            axisWidth,
            scrollLeft: scrollLeftPx.value,
            viewportWidth: containerW.value
        }).offsetPx
    })

    // @computed 文本横向位移（居中 + 钳制偏移；`-50%` = 以自身中心对齐线 x）
    const nowLabelTransform = computed(() => `translateX(calc(-50% + ${nowLabelOffsetPx.value}px))`)

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
        // R11 / AC8c：滚动帧内**只读** `scrollLeft`（纯属性，不做布局读取）⇒ 与遮罩同帧 rAF 批处理
        syncScrollLeft()
        if (fadeRaf) return
        fadeRaf = requestAnimationFrame(() => {
            fadeRaf = 0
            syncScrollLeft()
            updateFades()
        })
    }

    // —— 挂载：一次测量 + 视口定位 + 遮罩；resize 只重测容器宽（AC6：档位值 k 不被 resize 改写） ——
    let resizeObserver: ResizeObserver | undefined
    onMounted(() => {
        measureContainer()
        void nextTick(() => {
            scrollToNow()
            syncScrollLeft()
            updateFades()
            measureNowLabel()
        })
        if (typeof ResizeObserver === 'undefined') return
        resizeObserver = new ResizeObserver(() => {
            measureContainer()
            syncScrollLeft()
            updateFades()
            measureNowLabel() // AC8b：resize ⇒ 字号可能变 ⇒ 宽度缓存失效重测
        })
        if (bodyEl.value) resizeObserver.observe(bodyEl.value)
    })
    watch(dayZoom, () => void nextTick(updateFades))
    // AC8b：缓存失效点 = 文本内容变化 / 档位切换 / 切日 / 容器宽变化（字号随根字号）—— 全部经 nextTick 重测
    watch(
        [nowText, dayZoom, containerW, () => model.value.anchorKey],
        () => void nextTick(measureNowLabel)
    )
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
        nowText,
        nowEdge,
        nowLabelEl,
        nowLabelTransform,
        isPanning,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onBodyScroll,
        showStartFade,
        showEndFade,
        scrollToNow
    }
}