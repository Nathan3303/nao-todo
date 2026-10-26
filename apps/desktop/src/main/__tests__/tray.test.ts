import { describe, expect, it, vi } from 'vite-plus/test'
import { loadImpl } from './impl-seam'

/**
 * T544 · 托盘三态判定（AC9① / AC9② / AC2 / AC13）
 *
 * @description 判定口径唯一（`docs/reports/T543-arch-review.md` §四）：`new Tray()` 抛错 ⇒ `unsupported`；
 *              成功 ⇒ `available`；Linux 且 `XDG_CURRENT_DESKTOP` 含 GNOME/Unity ⇒ `unconfirmed`
 *              （**只影响文案与 P4 降级，不影响常驻**）。菜单只有「打开 NaoTodo」「退出」两项。
 *
 * 期望实现落点：`apps/desktop/src/main/tray.ts`
 * 契约：`createTray({ platform, env, iconPath, actions, Tray, Menu })`
 *       → `{ status: 'available' | 'unconfirmed' | 'unsupported', tray, destroy() }`
 *
 * ⚠️ 用户视觉验收项（本用例**不**覆盖，交用户人工）：托盘图标在浅色/深色/高 DPI 下的可辨识度（AC13）。
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC9 / AC2 / D3 / R1）
 * @see docs/reports/T543-arch-review.md §四（平台矩阵 · 托盘判定口径）
 */

type TrayStatus = 'available' | 'unconfirmed' | 'unsupported'

interface MenuItemLike {
    label: string
    click?: () => void
}

interface TrayLike {
    setToolTip?(toolTip: string): void
    setContextMenu(menu: unknown): void
    destroy(): void
}

interface CreateTrayDeps {
    platform: string
    env: Record<string, string | undefined>
    iconPath: string
    actions: { open(): void; quit(): void }
    Tray: new (icon: string) => TrayLike
    Menu: { buildFromTemplate(template: readonly MenuItemLike[]): unknown }
}

interface TrayHandle {
    status: TrayStatus
    tray: TrayLike | null
    destroy(): void
}

interface TrayModule {
    createTray(deps: CreateTrayDeps): TrayHandle
}

const MODULE = 'apps/desktop/src/main/tray.ts'
const load = (ac: string): Promise<TrayModule> =>
    loadImpl<TrayModule>('../tray', MODULE, ['createTray'], ac)

const createHarness = async (
    options: {
        ac: string
        platform?: string
        env?: Record<string, string | undefined>
        throws?: boolean
    } = { ac: 'AC9' }
) => {
    const mod = await load(options.ac)
    const created: string[] = []
    const menuTemplates: ReadonlyArray<MenuItemLike>[] = []
    const trayCalls = { setContextMenu: 0, destroy: 0 }
    const actions = { open: vi.fn(), quit: vi.fn() }

    class FakeTray implements TrayLike {
        constructor(icon: string) {
            if (options.throws) throw new Error('Tray is not supported on this platform')
            created.push(icon)
        }
        setToolTip(): void {}
        setContextMenu(menu: unknown): void {
            trayCalls.setContextMenu += 1
            void menu
        }
        destroy(): void {
            trayCalls.destroy += 1
        }
    }

    const handle = mod.createTray({
        platform: options.platform ?? 'linux',
        env: options.env ?? {},
        iconPath: '/app/build/tray/tray.png',
        actions,
        Tray: FakeTray,
        Menu: {
            buildFromTemplate: (template: readonly MenuItemLike[]) => {
                menuTemplates.push(template)
                return { template }
            }
        }
    })

    return { handle, actions, created, menuTemplates, trayCalls }
}

describe('托盘三态判定（AC9）', () => {
    it('构造成功 ⇒ available，并挂上上下文菜单', async () => {
        const { handle, created, trayCalls } = await createHarness({
            ac: 'AC9②',
            platform: 'win32'
        })

        expect(handle.status).toBe('available')
        expect(created).toHaveLength(1)
        expect(created[0]).toBe('/app/build/tray/tray.png')
        expect(trayCalls.setContextMenu).toBe(1)
    })

    it('new Tray() 抛错 ⇒ unsupported，且不向调用方抛错（关窗回退旧行为）（AC9①）', async () => {
        const { handle } = await createHarness({ ac: 'AC9①', platform: 'linux', throws: true })

        expect(handle.status).toBe('unsupported')
        expect(handle.tray).toBeNull()
    })

    it.each(['GNOME', 'ubuntu:GNOME', 'Unity', 'Unity:Unity7'])(
        'Linux 且 XDG_CURRENT_DESKTOP=%s ⇒ unconfirmed（仍创建托盘、仍常驻）（AC9②）',
        async (desktop) => {
            const { handle, created, trayCalls } = await createHarness({
                ac: 'AC9②',
                platform: 'linux',
                env: { XDG_CURRENT_DESKTOP: desktop }
            })

            expect(handle.status).toBe('unconfirmed')
            expect(created).toHaveLength(1)
            expect(trayCalls.setContextMenu).toBe(1)
        }
    )

    it.each(['KDE', 'XFCE', 'X-Cinnamon', ''])(
        'Linux 且 XDG_CURRENT_DESKTOP=%s ⇒ available（AC9）',
        async (desktop) => {
            const { handle } = await createHarness({
                ac: 'AC9',
                platform: 'linux',
                env: { XDG_CURRENT_DESKTOP: desktop }
            })

            expect(handle.status).toBe('available')
        }
    )

    it('非 Linux 平台不受 XDG_CURRENT_DESKTOP 影响 ⇒ available（AC9 / 平台差异）', async () => {
        const { handle } = await createHarness({
            ac: 'AC9',
            platform: 'darwin',
            env: { XDG_CURRENT_DESKTOP: 'GNOME' }
        })

        expect(handle.status).toBe('available')
    })
})

describe('托盘菜单（D3 / R1 / AC2）', () => {
    it('菜单恰好两项：打开 + 退出（不加任务操作、不加角标）（D3）', async () => {
        const { menuTemplates } = await createHarness({ ac: 'AC2', platform: 'linux' })

        const template = menuTemplates[0]
        expect(template, '未构建托盘菜单').toBeDefined()
        expect(template?.length).toBe(2)
    })

    it('第一项 ⇒ 打开主窗口；第二项 ⇒ 真退出（AC2 / R1）', async () => {
        const { menuTemplates, actions } = await createHarness({ ac: 'AC2', platform: 'linux' })

        const template = menuTemplates[0] ?? []
        const [openItem, quitItem] = template
        openItem?.click?.()
        quitItem?.click?.()

        expect(actions.open).toHaveBeenCalledTimes(1)
        expect(actions.quit).toHaveBeenCalledTimes(1)
    })

    it('destroy() ⇒ 托盘销毁（退出后图标消失，AC2）', async () => {
        const { handle, trayCalls } = await createHarness({ ac: 'AC2', platform: 'linux' })

        handle.destroy()

        expect(trayCalls.destroy).toBe(1)
    })
})