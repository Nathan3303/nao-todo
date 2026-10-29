import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
    BrowserWindow,
    Menu,
    Notification,
    Tray,
    app,
    ipcMain,
    powerMonitor,
    shell
} from 'electron'
import { enforceSingleInstance } from './single-instance'
import {
    createAppLifecycle,
    shouldShowWindowOnReady,
    type AppLifecycle,
    type TrayStatus
} from './lifecycle'
import { createTray, type TrayHandle } from './tray'
import { desktopAppSettingsPath, readAppSettings, writeAppSettings } from './app-settings'
import {
    readAutostartStatus,
    setAutostart,
    shouldAutoEnableAutostart,
    type AutostartDeps,
    type FsLike
} from './autostart'
import {
    DESKTOP_POWER_EVENT_CHANNEL,
    registerDesktopIpcHandlers,
    registerDesktopTrayTooltipHandler
} from './ipc'

/**
 * Windows toast 通知依赖 AppUserModelID，未设置则打包版系统通知不显示
 */
app.setAppUserModelId('space.nathanao.todo')

const isDev = !app.isPackaged

/**
 * 托盘图标（`build/tray/*`，总计 <2KB；macOS 用 Template 图以适配深浅色菜单栏）
 * @description 打包态由 electron-builder `extraResources` 拷到 `resources/tray`；
 *              dev 态取源码目录（`out/main` → `../../build/tray`）。
 */
const resolveTrayIconPath = (): string => {
    const dir = app.isPackaged
        ? join(process.resourcesPath, 'tray')
        : join(__dirname, '../../build/tray')
    return join(dir, process.platform === 'darwin' ? 'trayTemplate.png' : 'tray-22.png')
}

/** 真实文件系统适配（`autostart.ts` 只依赖同步接口，便于单测注入内存 fs） */
const fsLike: FsLike = {
    existsSync: (path) => existsSync(path),
    readFileSync: (path, encoding) => readFileSync(path, encoding),
    writeFileSync: (path, content) => writeFileSync(path, content, 'utf8'),
    mkdirSync: (path, options) => {
        mkdirSync(path, options)
    },
    renameSync: (from, to) => renameSync(from, to),
    unlinkSync: (path) => unlinkSync(path)
}

/** 主进程自启依赖（Electron API + 真实 fs） */
const autostartDeps = (): AutostartDeps => ({
    platform: process.platform,
    env: process.env,
    execPath: process.execPath,
    homeDir: app.getPath('home'),
    fs: fsLike,
    // Electron 的 LoginItemSettings 字段更全 ⇒ 只取本模块用到的三项再回读
    getLoginItemSettings: () => {
        const settings = app.getLoginItemSettings()
        return {
            openAtLogin: settings.openAtLogin,
            executableWillLaunchAtLogin: settings.executableWillLaunchAtLogin,
            status: settings.status
        }
    },
    setLoginItemSettings: (settings) => app.setLoginItemSettings(settings)
})

const userDataDir = (): string => app.getPath('userData')

/** 主窗口（可能隐藏 / 未创建 / 已销毁） */
let mainWindow: BrowserWindow | null = null
/** 生命周期状态机（托盘判定后才可创建，见 `whenReady`） */
let lifecycle: AppLifecycle | null = null
/** 托盘句柄（退出时销毁，避免图标残留） */
let trayHandle: TrayHandle | null = null
/** 托盘判定结果（默认 `unsupported` = 未初始化前按旧行为处理） */
let trayStatus: TrayStatus = 'unsupported'
/** 首次 `ready-to-show` 的显示决策是否已用掉（自启静默只针对开机那次） */
let startupShowResolved = false

/** 首次「收进托盘」提示文案（主进程不引 i18n 包：其依赖 vue-i18n，不该进主进程产物） */
const trayHintText = (): string =>
    app.getLocale().toLowerCase().startsWith('zh')
        ? 'NaoTodo 仍在后台运行，提醒照常；需要完全退出时请用托盘菜单里的「退出」。'
        : 'NaoTodo keeps running in the background so reminders still arrive. Use “Quit” in the menu bar to stop it.'

/** 首次收进托盘：系统通知（此时窗口已隐藏，通知仍是用户唯一可见的确认） */
const notifyTrayHint = (): void => {
    if (!Notification.isSupported()) return
    new Notification({ title: 'NaoTodo', body: trayHintText() }).show()
}

/** 桌面渲染层来源（打包态 `file://…/out/renderer/*`；dev 态为 Vite dev server） */
const isTrustedUrl = (url: string): boolean => {
    if (url.startsWith('file://')) return url.includes('/out/renderer/')
    const devUrl = process.env.ELECTRON_RENDERER_URL
    return Boolean(devUrl) && url.startsWith(devUrl as string)
}

/** 显示并聚焦主窗口（已隐藏时 `focus()` 无效 ⇒ 必须先 `show()`，AC5 / AC9②） */
const showMainWindow = (): void => {
    if (lifecycle?.handleActivate() === 'shown') return
    createWindow()
}

/** 退出（托盘菜单 / 设置页「退出 NaoTodo」唯一出口，AC2） */
const requestQuit = (): void => {
    if (lifecycle) lifecycle.requestQuit()
    else app.quit()
}

const createWindow = (): BrowserWindow => {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 960,
        minHeight: 640,
        title: 'NaoTodo',
        show: false,
        // 隐藏窗口顶部默认菜单栏（Alt 可临时唤出）
        autoHideMenuBar: true,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            // 隐藏后仍保持 `visibilityState === 'visible'` ⇒ 提醒引擎按原逻辑继续 10s 轮询
            // （缺了不报错，只会静默变慢；`window-web-preferences.test.ts` 有防回退守卫，R7）
            backgroundThrottling: false
        }
    })
    mainWindow = win

    // 关窗 = 隐藏（托盘可用）/ 放行（托盘不可用 / 真退出）；一次性提示由状态机发
    win.on('close', (event) => {
        lifecycle?.handleWindowClose(event, win)
    })

    win.on('closed', () => {
        if (mainWindow === win) mainWindow = null
    })

    // Windows 注销/关机：置退出位，否则隐藏态拦截 close 会拖住系统关机（R14）
    win.on('query-session-end', () => lifecycle?.handleQuitSignal('query-session-end'))
    win.on('session-end', () => lifecycle?.handleQuitSignal('session-end'))

    win.on('ready-to-show', () => {
        // 自启（`--autostart`）+ 托盘可用 ⇒ 静默到托盘；托盘不可用/不可见 ⇒ 显示窗口（P4）
        if (!startupShowResolved) {
            startupShowResolved = true
            if (!shouldShowWindowOnReady({ argv: process.argv, trayStatus })) return
        }
        win.show()
    })

    // 外部链接交给系统浏览器，不在应用内新开窗口
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url)
        return { action: 'deny' }
    })

    if (isDev && process.env.ELECTRON_RENDERER_URL) {
        win.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
        win.loadFile(join(__dirname, '../renderer/index.html'))
    }

    return win
}

/**
 * 首次运行写入「开机自启」意图（D0② 默认开启）
 * @description 只在**无本地记录**时写一次；用户关过（`autostartUserDisabled`）永不自动重开，
 *              系统侧被禁也不偷偷改回（§五 5.4）。
 */
const ensureAutostartIntent = (): void => {
    const dir = userDataDir()
    const hasUserRecord = existsSync(desktopAppSettingsPath(dir))
    const settings = readAppSettings(dir)
    if (
        !shouldAutoEnableAutostart({
            hasUserRecord,
            autostartUserDisabled: settings.autostartUserDisabled
        })
    )
        return
    setAutostart(true, autostartDeps())
    // 写入即视为「已有记录」⇒ 后续不再自动改写（即便本次未生效，也只显示未生效 + 重试）
    writeAppSettings(dir, {})
}

/** 注册桌面端 IPC（4 个窄通道，来源受信校验） */
const registerIpc = (): void => {
    registerDesktopIpcHandlers({
        ipcMain,
        isTrustedUrl,
        actions: {
            getShellStatus: () => ({
                tray: trayStatus,
                autostart: readAutostartStatus(autostartDeps())
            }),
            setAutostart: (enabled) => {
                writeAppSettings(userDataDir(), { autostartUserDisabled: !enabled })
                return { autostart: setAutostart(enabled, autostartDeps()) }
            },
            showMainWindow,
            quit: requestQuit
        }
    })

    // 单向通道（渲染层 → 托盘 tooltip）：惰性读 `trayHandle`，`before-quit` 置 null 后自然 no-op
    registerDesktopTrayTooltipHandler({
        ipcMain,
        isTrustedUrl,
        setTrayTooltip: (text) => trayHandle?.setTooltip(text)
    })
}

// C-57 / AC16a：单实例锁必须在创建窗口前获取（第二实例聚焦首实例后退出）。
// 理由：`(user_id, device_id)` 会话 upsert、pull 游标 RMW、`syncQueue` 单写者、
//      明文迁移竞态均假定单写者；`navigator.locks` 跨独立 Electron 进程无选主。
// 自启 + 手动启动并发：第二实例带 `--autostart` ⇒ 状态机静默忽略（AC5）
const isPrimaryInstance = enforceSingleInstance(app, {
    focusMainWindow: (cmdLine: readonly string[] = []) => lifecycle?.handleSecondInstance(cmdLine)
})

if (isPrimaryInstance) {
    app.whenReady().then(() => {
        trayHandle = createTray({
            platform: process.platform,
            env: process.env,
            iconPath: resolveTrayIconPath(),
            actions: { open: showMainWindow, quit: requestQuit },
            Tray,
            // Electron 的模板类型更宽（含 role/type 等），本模块只用到 label + click
            Menu: {
                buildFromTemplate: (template) =>
                    Menu.buildFromTemplate(template as Electron.MenuItemConstructorOptions[])
            }
        })
        trayStatus = trayHandle.status

        lifecycle = createAppLifecycle({
            platform: process.platform,
            trayStatus,
            app,
            getWindow: () => mainWindow,
            settings: {
                isTrayHintShown: () => readAppSettings(userDataDir()).trayHintShown,
                markTrayHintShown: () => {
                    writeAppSettings(userDataDir(), { trayHintShown: true })
                }
            },
            notifyTrayHint
        })

        registerIpc()
        ensureAutostartIntent()
        createWindow()

        // 休眠唤醒 ⇒ 通知渲染层补续会话（AC11：唤醒后自动补续）
        powerMonitor.on('resume', () => {
            mainWindow?.webContents.send(DESKTOP_POWER_EVENT_CHANNEL)
        })

        app.on('activate', () => {
            if (lifecycle?.handleActivate() === 'create') createWindow()
        })
    })

    // 常驻态（托盘可用）不因「窗口全关」退出；托盘不可用时回退旧行为（见状态机）
    app.on('window-all-closed', () => {
        lifecycle?.handleWindowAllClosed()
    })

    app.on('before-quit', () => {
        lifecycle?.handleQuitSignal('before-quit')
        trayHandle?.destroy()
        trayHandle = null
    })
}