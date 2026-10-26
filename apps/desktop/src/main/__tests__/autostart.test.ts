import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { loadImpl } from './impl-seam'

/**
 * T544 · 开机自启「回读三态」与写入语义（AC4 / AC10 / R6 / R13 / §五 5.4）
 *
 * @description 核心红线：**「写入成功」≠「已生效」**。状态一律以系统回读为准：
 *              Win `openAtLogin && executableWillLaunchAtLogin`；mac `status === 'enabled'`；
 *              Linux 文件存在且 `Hidden ≠ true`。任一不满足 ⇒ `not-effective`（设置区显示「未生效」+ 重试），
 *              ⛔ 不得显示已开启（AC10）。Linux 无 Electron API ⇒ 自写 XDG `.desktop`，
 *              AppImage 必须用 `process.env.APPIMAGE`（`execPath` 是每次不同的临时挂载路径）。
 *
 * 期望实现落点：`apps/desktop/src/main/autostart.ts`
 * 契约：`readAutostartStatus(deps)` / `setAutostart(enabled, deps)` /
 *       `buildLinuxAutostartEntry({ execPath, appImagePath, appName })` /
 *       `shouldAutoEnableAutostart({ hasUserRecord, autostartUserDisabled })`
 *
 * ⚠️ 真机项（本用例不覆盖，交用户/PM 验收）：实际重启后的自启、macOS 13+ 系统批准、卸载后残留（R13）。
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC4 / AC10 / D0② / D4）
 * @see docs/reports/T543-arch-review.md（§四 平台矩阵 / §五 5.4 自启持久化语义 / R6）
 */

type AutostartStatus = 'enabled' | 'disabled' | 'not-effective' | 'needs-approval'

interface LoginItemSettings {
    openAtLogin: boolean
    executableWillLaunchAtLogin?: boolean
    status?: 'enabled' | 'requires-approval' | 'not-registered' | 'enabled-hidden'
}

interface LoginItemSettingsInput {
    openAtLogin: boolean
    args?: string[]
    openAsHidden?: boolean
}

interface FsLike {
    existsSync(path: string): boolean
    readFileSync(path: string, encoding: 'utf8'): string
    writeFileSync(path: string, content: string): void
    mkdirSync(path: string, options: { recursive: boolean }): void
    renameSync(from: string, to: string): void
    unlinkSync(path: string): void
}

interface AutostartDeps {
    platform: string
    env: Record<string, string | undefined>
    execPath: string
    homeDir: string
    fs: FsLike
    getLoginItemSettings(): LoginItemSettings
    setLoginItemSettings(settings: LoginItemSettingsInput): void
}

interface AutostartModule {
    readAutostartStatus(deps: AutostartDeps): AutostartStatus
    setAutostart(enabled: boolean, deps: AutostartDeps): AutostartStatus
    buildLinuxAutostartEntry(options: {
        execPath: string
        appImagePath?: string
        appName?: string
    }): string
    shouldAutoEnableAutostart(state: {
        hasUserRecord: boolean
        autostartUserDisabled: boolean
    }): boolean
}

const MODULE = 'apps/desktop/src/main/autostart.ts'
const load = (ac: string): Promise<AutostartModule> =>
    loadImpl<AutostartModule>(
        '../autostart',
        MODULE,
        [
            'readAutostartStatus',
            'setAutostart',
            'buildLinuxAutostartEntry',
            'shouldAutoEnableAutostart'
        ],
        ac
    )

const HOME = '/home/qa'
const DESKTOP_FILE = join(HOME, '.config/autostart/nao-todo.desktop')
const EXEC_PATH = '/opt/nao-todo/nao-todo'
const APPIMAGE_PATH = '/home/qa/Applications/NaoTodo-1.13.0.AppImage'

/** 内存 fs：可注入写失败（验证「写不进 ⇒ 不得谎报已开启」） */
const createMemoryFs = () => {
    const files = new Map<string, string>()
    const state = { failWrite: false }
    const fs: FsLike = {
        existsSync: (path) => files.has(path),
        readFileSync: (path) => {
            const content = files.get(path)
            if (content === undefined) throw new Error(`ENOENT: ${path}`)
            return content
        },
        writeFileSync: (path, content) => {
            if (state.failWrite) throw new Error('EACCES: permission denied')
            files.set(path, content)
        },
        mkdirSync: () => undefined,
        renameSync: (from, to) => {
            const content = files.get(from)
            if (content === undefined) throw new Error(`ENOENT: ${from}`)
            files.delete(from)
            files.set(to, content)
        },
        unlinkSync: (path) => {
            files.delete(path)
        }
    }
    return { fs, files, state }
}

const createHarness = async (options: {
    ac: string
    platform?: string
    env?: Record<string, string | undefined>
    loginItem?: Partial<LoginItemSettings>
    /** 写入后系统侧回读是否随之变化（false = 模拟「写成功但未生效」，如任务管理器禁用） */
    applyLoginItemWrites?: boolean
    initialFiles?: Record<string, string>
}) => {
    const mod = await load(options.ac)
    const { fs, files, state } = createMemoryFs()
    for (const [path, content] of Object.entries(options.initialFiles ?? {}))
        files.set(path, content)

    const setCalls: LoginItemSettingsInput[] = []
    let loginItem: LoginItemSettings = {
        openAtLogin: false,
        executableWillLaunchAtLogin: false,
        status: 'not-registered',
        ...options.loginItem
    }

    const deps: AutostartDeps = {
        platform: options.platform ?? 'linux',
        env: options.env ?? {},
        execPath: EXEC_PATH,
        homeDir: HOME,
        fs,
        getLoginItemSettings: () => ({ ...loginItem }),
        setLoginItemSettings: (settings) => {
            setCalls.push(settings)
            if (options.applyLoginItemWrites) {
                loginItem = {
                    ...loginItem,
                    openAtLogin: settings.openAtLogin,
                    executableWillLaunchAtLogin: settings.openAtLogin,
                    status: settings.openAtLogin ? 'enabled' : 'not-registered'
                }
            }
        }
    }

    return { mod, deps, files, state, setCalls }
}

describe('自启回读 · Windows（AC4 / AC10）', () => {
    it('openAtLogin && executableWillLaunchAtLogin ⇒ enabled（唯一「已生效」判据）', async () => {
        const { mod, deps } = await createHarness({
            ac: 'AC4',
            platform: 'win32',
            loginItem: { openAtLogin: true, executableWillLaunchAtLogin: true }
        })

        expect(mod.readAutostartStatus(deps)).toBe('enabled')
    })

    it('openAtLogin 但 executableWillLaunchAtLogin=false（任务管理器禁用）⇒ not-effective（AC10）', async () => {
        const { mod, deps } = await createHarness({
            ac: 'AC10',
            platform: 'win32',
            loginItem: { openAtLogin: true, executableWillLaunchAtLogin: false }
        })

        expect(mod.readAutostartStatus(deps)).toBe('not-effective')
    })

    it('openAtLogin=false ⇒ not-effective（不得显示已开启，AC10）', async () => {
        const { mod, deps } = await createHarness({
            ac: 'AC10',
            platform: 'win32',
            loginItem: { openAtLogin: false, executableWillLaunchAtLogin: false }
        })

        expect(mod.readAutostartStatus(deps)).toBe('not-effective')
    })

    it('开启自启 ⇒ 写 openAtLogin + --autostart 参数，回读生效 ⇒ enabled（AC4 / D4）', async () => {
        const { mod, deps, setCalls } = await createHarness({
            ac: 'AC4',
            platform: 'win32',
            applyLoginItemWrites: true
        })

        expect(mod.setAutostart(true, deps)).toBe('enabled')
        expect(setCalls).toEqual([{ openAtLogin: true, args: ['--autostart'] }])
    })

    it('写入成功但系统侧仍未生效 ⇒ not-effective（AC10 不谎报）', async () => {
        const { mod, deps, setCalls } = await createHarness({
            ac: 'AC10',
            platform: 'win32',
            applyLoginItemWrites: false
        })

        expect(mod.setAutostart(true, deps)).toBe('not-effective')
        expect(setCalls).toHaveLength(1)
    })
})

describe('自启回读 · macOS（AC4 / AC10 / R6）', () => {
    it("status === 'enabled' ⇒ enabled（AC4）", async () => {
        const { mod, deps } = await createHarness({
            ac: 'AC4',
            platform: 'darwin',
            loginItem: { openAtLogin: true, status: 'enabled' }
        })

        expect(mod.readAutostartStatus(deps)).toBe('enabled')
    })

    it("status === 'requires-approval'（macOS 13+）⇒ needs-approval（AC10）", async () => {
        const { mod, deps } = await createHarness({
            ac: 'AC10',
            platform: 'darwin',
            loginItem: { openAtLogin: true, status: 'requires-approval' }
        })

        expect(mod.readAutostartStatus(deps)).toBe('needs-approval')
    })

    it("ad-hoc 签名登记失败（status = 'not-registered'）⇒ not-effective（R6）", async () => {
        const { mod, deps } = await createHarness({
            ac: 'R6',
            platform: 'darwin',
            loginItem: { openAtLogin: false, status: 'not-registered' }
        })

        expect(mod.readAutostartStatus(deps)).toBe('not-effective')
    })

    it('macOS 关闭自启 ⇒ 写 openAtLogin=false 并返回 disabled（AC4）', async () => {
        const { mod, deps, setCalls } = await createHarness({
            ac: 'AC4',
            platform: 'darwin',
            loginItem: { openAtLogin: true, status: 'enabled' },
            applyLoginItemWrites: true
        })

        expect(mod.setAutostart(false, deps)).toBe('disabled')
        expect(setCalls[0]).toMatchObject({ openAtLogin: false })
    })
})

describe('自启回读 · Linux XDG（AC4 / AC10 / R13）', () => {
    const desktopEntry = (extra = ''): string =>
        [
            '[Desktop Entry]',
            'Type=Application',
            'Name=NaoTodo',
            `Exec="${EXEC_PATH}" --autostart`,
            `TryExec=${EXEC_PATH}`,
            'X-GNOME-Autostart-enabled=true',
            extra
        ]
            .filter(Boolean)
            .join('\n')

    it('文件存在且未标 Hidden ⇒ enabled（AC4）', async () => {
        const { mod, deps } = await createHarness({
            ac: 'AC4',
            platform: 'linux',
            initialFiles: { [DESKTOP_FILE]: desktopEntry() }
        })

        expect(mod.readAutostartStatus(deps)).toBe('enabled')
    })

    it('文件被 DE 回写 Hidden=true ⇒ not-effective（AC10）', async () => {
        const { mod, deps } = await createHarness({
            ac: 'AC10',
            platform: 'linux',
            initialFiles: { [DESKTOP_FILE]: desktopEntry('Hidden=true') }
        })

        expect(mod.readAutostartStatus(deps)).toBe('not-effective')
    })

    it('文件不存在 ⇒ not-effective（不得显示已开启，AC10）', async () => {
        const { mod, deps } = await createHarness({ ac: 'AC10', platform: 'linux' })

        expect(mod.readAutostartStatus(deps)).toBe('not-effective')
    })

    it('AppImage：Exec/TryExec 用 APPIMAGE 路径（execPath 是临时挂载点，R5/R13）', async () => {
        const { mod } = await createHarness({ ac: 'AC4', platform: 'linux' })
        const entry = mod.buildLinuxAutostartEntry({
            execPath: '/tmp/.mount_nao123/nao-todo',
            appImagePath: APPIMAGE_PATH,
            appName: 'NaoTodo'
        })

        expect(entry).toContain(`Exec="${APPIMAGE_PATH}" --autostart`)
        expect(entry).toContain(`TryExec=${APPIMAGE_PATH}`)
        expect(entry).toContain('X-GNOME-Autostart-enabled=true')
        expect(entry).toContain('Type=Application')
        expect(entry).not.toContain('/tmp/.mount_nao123')
    })

    it('非 AppImage（deb 安装）⇒ Exec/TryExec 用 execPath', async () => {
        const { mod } = await createHarness({ ac: 'AC4', platform: 'linux' })
        const entry = mod.buildLinuxAutostartEntry({ execPath: EXEC_PATH, appName: 'NaoTodo' })

        expect(entry).toContain(`Exec="${EXEC_PATH}" --autostart`)
        expect(entry).toContain(`TryExec=${EXEC_PATH}`)
    })

    it('开启自启 ⇒ 写 ~/.config/autostart/nao-todo.desktop 并回读 enabled（AC4）', async () => {
        const { mod, deps, files } = await createHarness({
            ac: 'AC4',
            platform: 'linux',
            env: { APPIMAGE: APPIMAGE_PATH }
        })

        expect(mod.setAutostart(true, deps)).toBe('enabled')
        const content = files.get(DESKTOP_FILE) ?? ''
        expect(content).toContain('--autostart')
        expect(content).toContain(APPIMAGE_PATH)
    })

    it('关闭自启 ⇒ 标记 Hidden=true（系统侧不再启动），返回 disabled（AC4）', async () => {
        const { mod, deps, files } = await createHarness({
            ac: 'AC4',
            platform: 'linux',
            initialFiles: { [DESKTOP_FILE]: desktopEntry() }
        })

        expect(mod.setAutostart(false, deps)).toBe('disabled')
        expect(files.get(DESKTOP_FILE) ?? '').toContain('Hidden=true')
        expect(mod.readAutostartStatus(deps)).toBe('not-effective')
    })

    it('落盘失败（EACCES）⇒ not-effective，不抛错、不谎报已开启（AC10）', async () => {
        const { mod, deps, state } = await createHarness({ ac: 'AC10', platform: 'linux' })
        state.failWrite = true

        expect(mod.setAutostart(true, deps)).toBe('not-effective')
    })

    it('Linux 不调用 setLoginItemSettings（Electron 43 仅 mac/win，必须走 XDG）', async () => {
        const { mod, deps, setCalls } = await createHarness({
            ac: 'AC4',
            platform: 'linux',
            env: { APPIMAGE: APPIMAGE_PATH }
        })

        mod.setAutostart(true, deps)

        expect(setCalls).toEqual([])
    })
})

describe('自启持久化语义（§五 5.4：默认开、可关、不反复骚扰）', () => {
    it('首次运行（无记录）⇒ 默认写入开启意图（D0②）', async () => {
        const { mod } = await createHarness({ ac: 'AC4' })

        expect(
            mod.shouldAutoEnableAutostart({ hasUserRecord: false, autostartUserDisabled: false })
        ).toBe(true)
    })

    it('用户关闭过（autostartUserDisabled=true）⇒ 此后永不自动重开（AC4）', async () => {
        const { mod } = await createHarness({ ac: 'AC4' })

        expect(
            mod.shouldAutoEnableAutostart({ hasUserRecord: true, autostartUserDisabled: true })
        ).toBe(false)
    })

    it('已有记录且未被用户关闭 ⇒ 不自动改写（系统侧禁用只显示未生效，不偷偷改回）（§五 5.4）', async () => {
        const { mod } = await createHarness({ ac: 'AC10' })

        expect(
            mod.shouldAutoEnableAutostart({ hasUserRecord: true, autostartUserDisabled: false })
        ).toBe(false)
    })
})