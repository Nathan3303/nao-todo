import { describe, expect, it } from 'vite-plus/test'
import { DAY_SNAP_MINUTES } from '../../snap'
import { MIN_SPAN_MIN } from '../build-day-grid'
import {
    DAY_ZOOM_DEFAULT,
    DAY_ZOOM_LEVELS,
    MIN_DAY_COLUMN_PX,
    dayAxisSpecOf,
    dayScrollWidthCss,
    nextDayZoom,
    prevDayZoom,
    readDayZoom,
    writeDayZoom,
    type DayZoom
} from '../day-zoom'

/**
 * TASK-19 档位纯函数（ADR `2026-09-22-day-view-zoom-and-axis-parameterization` §5.1 / §5.4；D1–D3 / C2 / C7）
 *
 * 冻结口径：
 *  - 阶梯 `[1, 1.5, 2, 3, 4]`；`next/prev` 逐级、到端返回自身（按钮 disabled 依据）。
 *  - 档位矩阵（I1–I4 唯一解，r2）：×1/×1.5=30min/48 列；×2/×3=15min/96；×4=5min/288；
 *    量子不变量 `30 % columnMinutes === 0`、`columns === 1440 / columnMinutes`。
 *  - 标签两型：30min 档 `HH`（24 个，与现状逐字节一致）；15/5min 档 `HH:MM`（48 个）——见 build-day-grid.test.ts。
 *  - 总宽 `max(k × 容器宽, 列数 × 20px)`：AC1 是下界 `≥ k × 容器宽`（ADR §3-D3）。
 *  - 持久化键 `CALENDAR_DAY_ZOOM`（PRD §5.5）；非法/缺失 → 回退 ×1 并规范写回。
 *
 * 注：本文件为**新增纯函数用例**，不修改任何既有断言（ADR §5.4 唯一批准契约变更限于 2 文件）。
 */

const DAY_ZOOM_STORAGE_KEY = 'CALENDAR_DAY_ZOOM'

const createStorage = (init: Record<string, string> = {}): Storage => {
    const map = new Map<string, string>(Object.entries(init))
    return {
        get length() {
            return map.size
        },
        clear: () => map.clear(),
        getItem: (key) => map.get(key) ?? null,
        key: (index) => Array.from(map.keys())[index] ?? null,
        removeItem: (key) => {
            map.delete(key)
        },
        setItem: (key, value) => {
            map.set(key, String(value))
        }
    } as Storage
}

const throwingStorage = (): Storage =>
    ({
        get length() {
            throw new Error('storage denied')
        },
        clear: () => {
            throw new Error('storage denied')
        },
        getItem: () => {
            throw new Error('storage denied')
        },
        key: () => {
            throw new Error('storage denied')
        },
        removeItem: () => {
            throw new Error('storage denied')
        },
        setItem: () => {
            throw new Error('storage denied')
        }
    }) as unknown as Storage

describe('TASK-19 档位阶梯（D1 / §5.1）', () => {
    it('DAY_ZOOM_LEVELS 顺序 = [1, 1.5, 2, 3, 4]；默认 ×1', () => {
        expect(DAY_ZOOM_LEVELS).toEqual([1, 1.5, 2, 3, 4])
        expect(DAY_ZOOM_DEFAULT).toBe(1)
    })

    it('nextDayZoom 逐级 +1 档；×4 到端返回自身', () => {
        expect(nextDayZoom(1)).toBe(1.5)
        expect(nextDayZoom(1.5)).toBe(2)
        expect(nextDayZoom(2)).toBe(3)
        expect(nextDayZoom(3)).toBe(4)
        expect(nextDayZoom(4)).toBe(4)
    })

    it('prevDayZoom 逐级 −1 档；×1 到端返回自身', () => {
        expect(prevDayZoom(4)).toBe(3)
        expect(prevDayZoom(3)).toBe(2)
        expect(prevDayZoom(2)).toBe(1.5)
        expect(prevDayZoom(1.5)).toBe(1)
        expect(prevDayZoom(1)).toBe(1)
    })

    it('next/prev 互为逆（除到端）', () => {
        for (const zoom of DAY_ZOOM_LEVELS) {
            const stepped = nextDayZoom(zoom)
            if (stepped !== zoom) expect(prevDayZoom(stepped)).toBe(zoom)
        }
    })
})

describe('TASK-19 档位矩阵 → 轴规格（D1 / I1–I4 / C2）', () => {
    // R2：×4 = 5min / 288 列（C2 枚举 {30,15,5}，10min 已退役）
    const MATRIX: { zoom: DayZoom; columnMinutes: 30 | 15 | 5; columns: number }[] = [
        { zoom: 1, columnMinutes: 30, columns: 48 },
        { zoom: 1.5, columnMinutes: 30, columns: 48 },
        { zoom: 2, columnMinutes: 15, columns: 96 },
        { zoom: 3, columnMinutes: 15, columns: 96 },
        { zoom: 4, columnMinutes: 5, columns: 288 }
    ]

    for (const row of MATRIX) {
        it(`×${row.zoom} ⇒ ${row.columnMinutes}min / ${row.columns} 列（量子整除 + 列数一致）`, () => {
            const spec = dayAxisSpecOf(row.zoom)
            expect(spec).toEqual({
                zoom: row.zoom,
                columnMinutes: row.columnMinutes,
                columns: row.columns
            })
            // I1：30 分钟必须为整数列
            expect(30 % spec.columnMinutes).toBe(0)
            // 列数 = 1440 / 粒度（C4：不新增字段，columns.length 即列数）
            expect(spec.columns).toBe(1440 / spec.columnMinutes)
        })
    }

    it('矩阵覆盖全部档位且无遗漏（5 档）', () => {
        expect(MATRIX.map((row) => row.zoom)).toEqual(DAY_ZOOM_LEVELS)
    })

    it('DayAxisSpec.columnMinutes 枚举为 {30,15,5}（10min 已退役；类型层断言，C2/r2）', () => {
        const spec: { columnMinutes: 30 | 15 | 5; columns: number } = dayAxisSpecOf(4)
        expect(spec.columnMinutes).toBe(5)
        expect(spec.columns).toBe(288)
    })
})

describe('TASK-19 总宽公式（D3 / AC1 / AC6）', () => {
    it('MIN_DAY_COLUMN_PX = 20（下限常量，ADR §3-D3）', () => {
        expect(MIN_DAY_COLUMN_PX).toBe(20)
    })

    // TASK-20 变更 E（轴 ADR r3 / D3′）：总宽 = max(列数 × ceil(k × 容器宽 ÷ 列数), 列数 × 20px)
    // 结果以整数 px 字符串返回（容器宽在挂载/resize 读一次后为常量）。
    const CONTAINER_W = 1200
    const expectedWidth = (zoom: number, columns: number, containerW: number): number =>
        Math.max(columns * Math.ceil((zoom * containerW) / columns), columns * MIN_DAY_COLUMN_PX)

    it('dayScrollWidthCss = 整数列宽 max(列数×ceil(k×容器宽/列数), 列数×20px)（逐档）', () => {
        for (const zoom of DAY_ZOOM_LEVELS) {
            const spec = dayAxisSpecOf(zoom)
            const expected = expectedWidth(zoom, spec.columns, CONTAINER_W)
            expect(dayScrollWidthCss(zoom, spec.columns, CONTAINER_W)).toBe(`${expected}px`)
            // 每列整数像素（可整除）
            expect(expected % spec.columns).toBe(0)
        }
    })

    it('AC1/AC9 下界：总宽 ≥ k×容器宽（向上取整只增不减）', () => {
        for (const container of [800, 1200, 1440, 1920]) {
            for (const zoom of DAY_ZOOM_LEVELS) {
                const { columns } = dayAxisSpecOf(zoom)
                const px = Number.parseInt(dayScrollWidthCss(zoom, columns, container), 10)
                expect(px).toBeGreaterThanOrEqual(zoom * container)
            }
        }
        // 窄容器 ⇒ 下限接管（AC6）
        expect(dayScrollWidthCss(1, 48, 800)).toBe('960px')
        // 宽容器 + k×容器宽 已过下限 ⇒ 取整数列宽 ≥ k×容器宽
        expect(dayScrollWidthCss(1, 48, 1200)).toBe('1200px')
        expect(dayScrollWidthCss(1.5, 48, 1200)).toBe('1824px')
        expect(dayScrollWidthCss(2, 96, 1200)).toBe('2400px')
    })

    it('×4 档下限接管：dayScrollWidthCss(4, 288, 1200) = 5760px（288×20）', () => {
        expect(dayScrollWidthCss(4, 288, CONTAINER_W)).toBe('5760px')
    })

    it('AC9 整数 px + 可整除 + ≥ k×容器宽（多容器宽）', () => {
        for (const container of [800, 1200, 1440, 1920]) {
            for (const zoom of DAY_ZOOM_LEVELS) {
                const { columns } = dayAxisSpecOf(zoom)
                const out = dayScrollWidthCss(zoom, columns, container)
                expect(out).toMatch(/^\d+px$/)
                const px = Number.parseInt(out, 10)
                expect(px % columns).toBe(0)
                expect(px).toBeGreaterThanOrEqual(zoom * container)
                expect(px).toBeGreaterThanOrEqual(columns * MIN_DAY_COLUMN_PX)
            }
        }
    })
})

describe('TASK-19 持久化（D6 / AC5）', () => {
    it('缺失 → 回退 ×1 并规范写回 "1"', () => {
        const storage = createStorage()
        expect(readDayZoom(storage)).toBe(1)
        expect(storage.getItem(DAY_ZOOM_STORAGE_KEY)).toBe('1')
    })

    it('非法值 → 回退 ×1 并规范写回 "1"（含 0/越界/非阶梯/空串）', () => {
        for (const bad of ['0', '5', '2.5', 'true', '', 'NaN', '1,5', ' 2 ']) {
            const storage = createStorage({ [DAY_ZOOM_STORAGE_KEY]: bad })
            expect(readDayZoom(storage)).toBe(1)
            expect(storage.getItem(DAY_ZOOM_STORAGE_KEY)).toBe('1')
        }
    })

    it('合法值原样读取（1 / 1.5 / 2 / 3 / 4）', () => {
        for (const zoom of DAY_ZOOM_LEVELS) {
            const storage = createStorage({ [DAY_ZOOM_STORAGE_KEY]: String(zoom) })
            expect(readDayZoom(storage)).toBe(zoom)
        }
    })

    it('writeDayZoom 写规范字符串（1.5 为 "1.5"）', () => {
        const storage = createStorage()
        for (const zoom of DAY_ZOOM_LEVELS) {
            writeDayZoom(storage, zoom)
            expect(storage.getItem(DAY_ZOOM_STORAGE_KEY)).toBe(String(zoom))
        }
        expect(storage.getItem(DAY_ZOOM_STORAGE_KEY)).toBe('4')
    })

    it('storage 读取/写入抛错时不冒泡（AC5：不抛错、不白屏）', () => {
        expect(() => readDayZoom(throwingStorage())).not.toThrow()
        expect(readDayZoom(throwingStorage())).toBe(1)
        expect(() => writeDayZoom(throwingStorage(), 2)).not.toThrow()
    })
})

describe('TASK-19 吸附量子不变量（D2 / P1 / C7）', () => {
    it('DAY_SNAP_MINUTES === 30 且 MIN_SPAN_MIN === DAY_SNAP_MINUTES（单一来源）', () => {
        // 裁决 2：取消三相等式；DAY_SNAP_MINUTES 为唯一来源，MIN_SPAN_MIN 为具名导出别名
        expect(DAY_SNAP_MINUTES).toBe(30)
        expect(MIN_SPAN_MIN).toBe(DAY_SNAP_MINUTES)
    })
})