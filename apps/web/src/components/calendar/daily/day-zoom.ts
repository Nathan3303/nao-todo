/**
 * 日视图时间轴档位纯函数（TASK-19 / ADR 2026-09-22 §5.1；D1–D3 / D6 / C2 / C7）
 * @description 无 Vue 依赖：档位阶梯、轴规格（粒度 / 列数）、总宽下限公式、偏好读写。
 *              `max()` 无法在 jsdom 计算 ⇒ 以 CSS 字符串形式产出（单测断言字符串，ADR §5.4）。
 */

/** 档位（k）：时间轴总宽 = k × 容器宽 */
export type DayZoom = 1 | 1.5 | 2 | 3 | 4

/** 档位阶梯（D1：I1–I4 下的唯一解） */
export const DAY_ZOOM_LEVELS: readonly DayZoom[] = [1, 1.5, 2, 3, 4]

/** 默认档位（×1：与现状视觉等价） */
export const DAY_ZOOM_DEFAULT: DayZoom = 1

/** 列宽下限（px；由容器总宽 `max()` 承接，D3 / AC1 / AC6） */
export const MIN_DAY_COLUMN_PX = 20

/** 单日总分钟数（坐标换算基准；与 daily/build-day-grid.ts 同口径） */
const DAY_MINUTES = 1440

/** 档位 → 轴规格（列数 = 1440 / 粒度；C4：不新增模型字段） */
export type DayAxisSpec = {
    zoom: DayZoom
    columnMinutes: 30 | 15 | 10
    columns: number
}

/** 档位矩阵（D1）：×1/×1.5 = 30min、×2/×3 = 15min、×4 = 10min */
const COLUMN_MINUTES_OF: Record<DayZoom, 30 | 15 | 10> = {
    1: 30,
    1.5: 30,
    2: 15,
    3: 15,
    4: 10
}

/** 档位 → 轴规格 */
export const dayAxisSpecOf = (zoom: DayZoom): DayAxisSpec => {
    const columnMinutes = COLUMN_MINUTES_OF[zoom]
    return { zoom, columnMinutes, columns: DAY_MINUTES / columnMinutes }
}

/** 升一档；到端（×4）返回自身（按钮 disabled 依据） */
export const nextDayZoom = (zoom: DayZoom): DayZoom => {
    const index = DAY_ZOOM_LEVELS.indexOf(zoom)
    return DAY_ZOOM_LEVELS[Math.min(index + 1, DAY_ZOOM_LEVELS.length - 1)]!
}

/** 降一档；到端（×1）返回自身（按钮 disabled 依据） */
export const prevDayZoom = (zoom: DayZoom): DayZoom => {
    const index = DAY_ZOOM_LEVELS.indexOf(zoom)
    return DAY_ZOOM_LEVELS[Math.max(index - 1, 0)]!
}

/** 时间轴总宽 CSS：`max(k × 容器宽, 列数 × 20px)`（D3 / AC1 / AC6） */
export const dayScrollWidthCss = (zoom: DayZoom, columns: number): string =>
    `max(calc(${zoom} * 100%), calc(${columns} * ${MIN_DAY_COLUMN_PX}px))`

/** 档位偏好存储键（PRD §5.5 / D6） */
const DAY_ZOOM_STORAGE_KEY = 'CALENDAR_DAY_ZOOM'

/** 读取档位偏好：缺失 / 非法 → ×1 并规范写回（异常静默降级，AC5） */
export const readDayZoom = (storage: Storage): DayZoom => {
    let raw: string | null = null
    try {
        raw = storage.getItem(DAY_ZOOM_STORAGE_KEY)
    } catch {
        return DAY_ZOOM_DEFAULT
    }
    const matched = DAY_ZOOM_LEVELS.find((zoom) => String(zoom) === raw)
    if (matched !== undefined) return matched
    try {
        storage.setItem(DAY_ZOOM_STORAGE_KEY, String(DAY_ZOOM_DEFAULT))
    } catch {
        /* ignore */
    }
    return DAY_ZOOM_DEFAULT
}

/** 写入档位偏好（规范字符串；异常静默降级） */
export const writeDayZoom = (storage: Storage, zoom: DayZoom): void => {
    try {
        storage.setItem(DAY_ZOOM_STORAGE_KEY, String(zoom))
    } catch {
        /* ignore */
    }
}