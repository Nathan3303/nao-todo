import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { loadImpl } from './impl-seam'

/**
 * T544 · 桌面端本地设置（AC14 / AC4 / §五 5.4）
 *
 * @description 只存两个标记：`autostartUserDisabled`（用户关闭过自启 ⇒ 永不自动重开）、
 *              `trayHintShown`（首次收进托盘提示只发一次）。落点 `userData/nao-desktop.json`
 *              （**不写 localStorage**，不动 K10 白名单），原子写（tmp+rename），损坏回默认。
 *
 * 期望实现落点：`apps/desktop/src/main/app-settings.ts`
 * 契约：`DEFAULT_DESKTOP_APP_SETTINGS` / `readAppSettings(dir)` / `writeAppSettings(dir, patch)`
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC14 / AC4）
 * @see docs/reports/T543-arch-review.md（§二 2.1 app-settings.ts / §五 5.4）
 */

interface DesktopAppSettings {
    autostartUserDisabled: boolean
    trayHintShown: boolean
}

interface AppSettingsModule {
    DEFAULT_DESKTOP_APP_SETTINGS: DesktopAppSettings
    readAppSettings(dir: string): DesktopAppSettings
    writeAppSettings(dir: string, patch: Partial<DesktopAppSettings>): DesktopAppSettings
}

const MODULE = 'apps/desktop/src/main/app-settings.ts'
const load = (ac: string): Promise<AppSettingsModule> =>
    loadImpl<AppSettingsModule>(
        '../app-settings',
        MODULE,
        ['DEFAULT_DESKTOP_APP_SETTINGS', 'readAppSettings', 'writeAppSettings'],
        ac
    )

const SETTINGS_FILE = 'nao-desktop.json'
let dir = ''

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nao-desktop-settings-'))
})

afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
})

describe('app-settings（AC14 / AC4）', () => {
    it('无文件 ⇒ 返回默认值（两标记均为 false），且不创建文件', async () => {
        const mod = await load('AC14')

        expect(mod.readAppSettings(dir)).toEqual({
            autostartUserDisabled: false,
            trayHintShown: false
        })
        expect(existsSync(join(dir, SETTINGS_FILE))).toBe(false)
        expect(mod.DEFAULT_DESKTOP_APP_SETTINGS).toEqual({
            autostartUserDisabled: false,
            trayHintShown: false
        })
    })

    it('写入 trayHintShown ⇒ 持久化并回读（首次提示只一次，AC14）', async () => {
        const mod = await load('AC14')

        const written = mod.writeAppSettings(dir, { trayHintShown: true })

        expect(written).toEqual({ autostartUserDisabled: false, trayHintShown: true })
        expect(mod.readAppSettings(dir)).toEqual({
            autostartUserDisabled: false,
            trayHintShown: true
        })
        // 落点必须是 userData 下的 json（不写 localStorage）
        expect(readFileSync(join(dir, SETTINGS_FILE), 'utf8')).toContain('trayHintShown')
    })

    it('局部写入保留其他键（autostartUserDisabled 不被 trayHintShown 写入抹掉）', async () => {
        const mod = await load('AC4')

        mod.writeAppSettings(dir, { autostartUserDisabled: true })
        const merged = mod.writeAppSettings(dir, { trayHintShown: true })

        expect(merged).toEqual({ autostartUserDisabled: true, trayHintShown: true })
        expect(mod.readAppSettings(dir)).toEqual({
            autostartUserDisabled: true,
            trayHintShown: true
        })
    })

    it('文件损坏（非法 JSON）⇒ 回默认值，不抛错（避免启动即崩）', async () => {
        const mod = await load('AC4')
        writeFileSync(join(dir, SETTINGS_FILE), '{ "trayHintShown": ', 'utf8')

        expect(() => mod.readAppSettings(dir)).not.toThrow()
        expect(mod.readAppSettings(dir)).toEqual({
            autostartUserDisabled: false,
            trayHintShown: false
        })
    })

    it('原子写：写后无 .tmp 残留（tmp+rename，防断电写坏）', async () => {
        const mod = await load('AC4')

        mod.writeAppSettings(dir, { trayHintShown: true })

        expect(readdirSync(dir)).toEqual([SETTINGS_FILE])
    })

    it('目录不存在时自动创建（首次运行 userData 可能尚未建目录）', async () => {
        const mod = await load('AC4')
        const nested = join(dir, 'userData')

        expect(() => mod.writeAppSettings(nested, { trayHintShown: true })).not.toThrow()
        expect(mod.readAppSettings(nested).trayHintShown).toBe(true)
    })

    it('用户关闭自启后重开应用仍读回 true（不自动改回，§五 5.4）', async () => {
        const mod = await load('AC4')

        mod.writeAppSettings(dir, { autostartUserDisabled: true })

        expect(mod.readAppSettings(dir).autostartUserDisabled).toBe(true)
    })
})