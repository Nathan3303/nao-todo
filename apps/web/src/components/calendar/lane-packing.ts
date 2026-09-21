/**
 * 轨道打包（月/周/日唯一实现，ADR 2026-09-21 C3–C4）
 * @description 视图无关纯函数：稳定排序（仅按 `colStart` 升序，禁加 `colEnd` 比较 ——
 *              TASK-15 D1 铁律；同起点保持入参顺序＝用户排序）→ 贪婪首次适配分配轨道 →
 *              按探针统计 `lane >= maxLanes` 的隐藏项（溢出 `+N`）。
 *              月/周 7 探针、日视图单探针 `[0,47]` 均复用同一实现，禁第二套 greedy/溢出。
 */

/** 溢出探针（闭区间列坐标；`key` 用于回传结果） */
export type LaneProbe = {
    key: string
    colStart: number
    colEnd: number
}

/**
 * 打包区间项到轨道
 * @param items 入参顺序＝用户排序（同 `colStart` 内保持该顺序）
 * @param maxLanes 可视轨道数（`lane >= maxLanes` 计入溢出）
 * @param probes 溢出探针集合（零计数不上报）
 * @returns `packed`（保持排序后的入参项 + `lane`）与 `overflow`（`{ key, count }`）
 */
export const packLanes = <T extends { colStart: number; colEnd: number }>(
    items: T[],
    maxLanes: number,
    probes: LaneProbe[]
): { packed: (T & { lane: number })[]; overflow: { key: string; count: number }[] } => {
    // 1) 稳定排序：仅按 colStart 升序（禁 colEnd 比较，Array.sort 稳定性承载用户排序）
    const sorted = [...items].sort((a, b) => a.colStart - b.colStart)

    // 2) 贪婪首次适配：laneEnds[lane] 记录该轨道已占用区间的结束列
    const laneEnds: number[][] = []
    const packed: (T & { lane: number })[] = []
    for (const item of sorted) {
        let lane = 0
        while (true) {
            const ends = laneEnds[lane]
            if (!ends || !ends.some((end) => item.colStart <= end)) break
            lane++
        }
        ;(laneEnds[lane] ??= []).push(item.colEnd)
        packed.push({ ...item, lane })
    }

    // 3) 探针式溢出：统计与探针相交且 lane >= maxLanes 的项数（零计数省略）
    const overflow: { key: string; count: number }[] = []
    for (const probe of probes) {
        const count = packed.filter(
            (p) => p.lane >= maxLanes && p.colStart <= probe.colEnd && p.colEnd >= probe.colStart
        ).length
        if (count > 0) overflow.push({ key: probe.key, count })
    }

    return { packed, overflow }
}