import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import {
    UPDATE_CHECK_INTERVAL_MS,
    UPDATE_HISTORY_LIMIT,
    UPDATE_STORE_FILE,
    createUpdateStore,
    isCheckFresh
} from '../store'

/**
 * T736 · 检查缓存与结果历史（AC8 · 可测性前置 ⑤）
 *
 * @description 走「传入目录的 fs 面」（同 `app-settings.ts` 范式）：用例用**真 temp dir**，
 *              不 mock `node:fs`、不碰 `app.getPath`。24h 边界是 QA 标的可观测代价：
 *              `23:59:59.999` ⇒ 仍新鲜（静默检查 0 请求）· `24:00:00.000` ⇒ 过期（1 请求）。
 */

let dir = ''

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nao-update-store-'))
})

afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
})

describe('检查缓存（AC8）', () => {
    it('无记录 ⇒ null 且不创建文件（零副作用）', () => {
        const store = createUpdateStore(dir)
        expect(store.readCheck()).toBeNull()
        expect(readdirSync(dir)).toEqual([])
    })

    it('写入后可读回（版本 / 结论 / 体积 / 待重启版本）', () => {
        const store = createUpdateStore(dir)
        store.writeCheck({
            lastCheckAt: 1_700_000_000_000,
            latestVersion: '1.21.0',
            result: 'available',
            sizeBytes: 113_246_208
        })
        store.writeCheck({ readyVersion: '1.21.0' })
        expect(store.readCheck()).toEqual({
            lastCheckAt: 1_700_000_000_000,
            latestVersion: '1.21.0',
            result: 'available',
            sizeBytes: 113_246_208,
            readyVersion: '1.21.0'
        })
        expect(readdirSync(dir)).toEqual([UPDATE_STORE_FILE])
    })

    it('清 readyVersion ⇒ 键真的消失（上次启动已装好的标记不就位）', () => {
        const store = createUpdateStore(dir)
        store.writeCheck({ lastCheckAt: 1, latestVersion: '1.21.0', result: 'available' })
        store.writeCheck({ readyVersion: '1.21.0' })
        store.writeCheck({ readyVersion: undefined })
        const raw = JSON.parse(readFileSync(join(dir, UPDATE_STORE_FILE), 'utf8')) as {
            check: Record<string, unknown>
        }
        expect('readyVersion' in raw.check).toBe(false)
    })

    it('文件损坏 ⇒ 回默认值且不抛错（启动期不得因此崩）', () => {
        writeFileSync(join(dir, UPDATE_STORE_FILE), '{ 这不是 JSON', 'utf8')
        const store = createUpdateStore(dir)
        expect(store.readCheck()).toBeNull()
        expect(store.readHistory()).toEqual([])
        // 再次写入自愈
        store.writeCheck({ lastCheckAt: 2, latestVersion: '1.21.0', result: 'up-to-date' })
        expect(store.readCheck()?.latestVersion).toBe('1.21.0')
    })

    it('字段类型不对 ⇒ 视为缺失（不把字符串当版本/时间）', () => {
        writeFileSync(
            join(dir, UPDATE_STORE_FILE),
            JSON.stringify({ check: { lastCheckAt: '1', latestVersion: 42, result: '最新' } }),
            'utf8'
        )
        expect(createUpdateStore(dir).readCheck()).toBeNull()
    })
})

describe('24h 新鲜度边界（AC8 可观测代价）', () => {
    const record = { lastCheckAt: 1_000_000, latestVersion: '1.21.0', result: 'available' as const }

    it('23:59:59.999 ⇒ 新鲜（静默检查 0 请求）', () => {
        expect(isCheckFresh(record, record.lastCheckAt + UPDATE_CHECK_INTERVAL_MS - 1)).toBe(true)
    })

    it('24:00:00.000 ⇒ 过期（静默检查 1 请求）', () => {
        expect(isCheckFresh(record, record.lastCheckAt + UPDATE_CHECK_INTERVAL_MS)).toBe(false)
    })

    it('无记录 ⇒ 不新鲜（首启必查一次）', () => {
        expect(isCheckFresh(null, 1_000_000)).toBe(false)
    })
})

describe('结果历史（可观测 NFR）', () => {
    it('按发生顺序保留最近 20 条（超限丢最旧）', () => {
        const store = createUpdateStore(dir)
        for (let index = 0; index < UPDATE_HISTORY_LIMIT + 5; index += 1) {
            store.appendHistory({ at: index, kind: 'check', ok: index % 2 === 0 })
        }
        const history = store.readHistory()
        expect(history).toHaveLength(UPDATE_HISTORY_LIMIT)
        expect(history[0]?.at).toBe(5)
        expect(history.at(-1)?.at).toBe(UPDATE_HISTORY_LIMIT + 4)
    })

    it('失败原因与版本可读回（报障用，不含本机路径）', () => {
        const store = createUpdateStore(dir)
        store.appendHistory({
            at: 1,
            kind: 'download',
            ok: false,
            reason: 'timeout',
            version: '1.21.0'
        })
        expect(store.readHistory()).toEqual([
            { at: 1, kind: 'download', ok: false, reason: 'timeout', version: '1.21.0' }
        ])
        // 与检查结论互不覆盖（同一份文件两块内容）
        store.writeCheck({ lastCheckAt: 2, latestVersion: '1.21.0', result: 'available' })
        expect(store.readHistory()).toHaveLength(1)
        expect(store.readCheck()?.latestVersion).toBe('1.21.0')
    })
})