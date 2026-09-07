import { describe, expect, it } from 'vite-plus/test'
import {
    badgeLabelOf,
    CALENDAR_POMODORO_BADGE_KEY,
    countTimerRoundsByDate,
    isTimerRound,
    POMODORO_BADGE_CAP,
    readPomodoroBadgePref,
    toTimerRecordList,
    writePomodoroBadgePref
} from './pomodoro-badge'

type Rec = { type: number; startAt: string }
const iso = (day: string, time = 'T10:00:00') => `${day}T${time}.000`

const rec = (type: number, startAt: string): Rec => ({ type, startAt })

describe('B1-F5 番茄徽标纯逻辑', () => {
    it('type=1 判定；type=2 不计', () => {
        expect(isTimerRound(1)).toBe(true)
        expect(isTimerRound(2)).toBe(false)
    })

    it('区间聚合：type=1 按本地日计数（含边界日），越界与 type=2 排除；孤儿快照不按任务过滤', () => {
        const records: Rec[] = [
            rec(1, iso('2026-09-05')),
            rec(1, iso('2026-09-05', 'T23:00:00')),
            rec(1, iso('2026-09-06')),
            rec(2, iso('2026-09-06', 'T12:00:00')), // type=2 不计
            rec(1, iso('2026-09-04')), // 早于区间
            rec(1, iso('2026-09-08')) // 晚于区间
        ]
        const map = countTimerRoundsByDate(records, '2026-09-05', '2026-09-07', (s) =>
            s.slice(0, 10)
        )
        expect(map.get('2026-09-05')).toBe(2)
        expect(map.get('2026-09-06')).toBe(1) // type=1 记录含孤儿口径，type=2 排除
        expect(map.has('2026-09-04')).toBe(false)
        expect(map.has('2026-09-08')).toBe(false)
    })

    it('显示标签：0 → 空串、1~99 → 数字、>99 → 99+', () => {
        expect(badgeLabelOf(0)).toBe('')
        expect(badgeLabelOf(1)).toBe('1')
        expect(badgeLabelOf(POMODORO_BADGE_CAP)).toBe('99')
        expect(badgeLabelOf(100)).toBe('99+')
        expect(badgeLabelOf(150)).toBe('99+')
    })

    it('聚合累积封顶 99+（防止超长数字撑破角标）', () => {
        const records = Array.from({ length: 120 }, (_, i) =>
            rec(1, iso('2026-09-05', `T${String(i % 24).padStart(2, '0')}:00`))
        )
        const map = countTimerRoundsByDate(records, '2026-09-05', '2026-09-05', (s) =>
            s.slice(0, 10)
        )
        expect(map.get('2026-09-05')).toBe(POMODORO_BADGE_CAP)
    })

    it('toTimerRecordList：Map<id,record> → values 数组（防形态错配致徽标恒空）；数组原样；其它 → []', () => {
        const map = new Map([
            ['r1', rec(1, iso('2026-09-05'))],
            ['r2', rec(1, iso('2026-09-06'))]
        ])
        const list = toTimerRecordList(map)
        expect(list).toHaveLength(2)
        expect(list[0]!.type).toBe(1)
        // Map 迭代产物（[id, record] 对）若被当数组用：type 为 undefined（回归根因的坏路径）
        const badPairIteration = countTimerRoundsByDate(
            map as unknown as Array<{ type: number; startAt: string }>,
            '2026-09-05',
            '2026-09-07',
            (s) => s.slice(0, 10)
        )
        expect(badPairIteration.size).toBe(0)
        // 正确路径：归一后计数命中
        const good = countTimerRoundsByDate(list, '2026-09-05', '2026-09-07', (s) => s.slice(0, 10))
        expect(good.get('2026-09-05')).toBe(1)
        expect(good.get('2026-09-06')).toBe(1)
        expect(toTimerRecordList([rec(1, iso('2026-09-05'))])).toHaveLength(1)
        expect(toTimerRecordList(undefined)).toHaveLength(0)
    })

    it('偏好读写：缺省/非法回退开并规范写回；on/off 往返', () => {
        const storage = new Map<string, string>()
        const fakeStorage = {
            getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
            setItem: (k: string, v: string) => void storage.set(k, v)
        }
        expect(readPomodoroBadgePref(fakeStorage)).toBe(true) // 缺省开
        expect(storage.get(CALENDAR_POMODORO_BADGE_KEY)).toBe('on') // 规范写回
        writePomodoroBadgePref(fakeStorage, false)
        expect(readPomodoroBadgePref(fakeStorage)).toBe(false)
        writePomodoroBadgePref(fakeStorage, true)
        expect(readPomodoroBadgePref(fakeStorage)).toBe(true)
        // 非法值回退开
        storage.set(CALENDAR_POMODORO_BADGE_KEY, 'garbage')
        expect(readPomodoroBadgePref(fakeStorage)).toBe(true)
        expect(storage.get(CALENDAR_POMODORO_BADGE_KEY)).toBe('on')
    })
})