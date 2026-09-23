import { join } from 'node:path'
import { BrowserWindow, app, shell } from 'electron'
import { enforceSingleInstance } from './single-instance'

/**
 * Windows toast 通知依赖 AppUserModelID，未设置则打包版系统通知不显示
 */
app.setAppUserModelId('space.nathanao.todo')

const isDev = !app.isPackaged

const createWindow = () => {
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
            sandbox: false
        }
    })

    win.on('ready-to-show', () => win.show())

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
}

// C-57 / AC16a：单实例锁必须在创建窗口前获取（第二实例聚焦首实例后退出）。
// 理由：`(user_id, device_id)` 会话 upsert、pull 游标 RMW、`syncQueue` 单写者、
//      明文迁移竞态均假定单写者；`navigator.locks` 跨独立 Electron 进程无选主。
const isPrimaryInstance = enforceSingleInstance(app, {
    focusMainWindow: () => {
        const [win] = BrowserWindow.getAllWindows()
        if (!win) return
        if (win.isMinimized()) win.restore()
        win.focus()
    }
})

if (isPrimaryInstance) {
    app.whenReady().then(() => {
        createWindow()

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow()
        })
    })

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit()
    })
}