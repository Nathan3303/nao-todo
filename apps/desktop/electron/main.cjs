const { app, BrowserWindow } = require('electron')
const path = require('node:path')

// 开发环境下渲染进程由 Vite dev server 提供
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5273'
const isDev = !app.isPackaged

/** @type {BrowserWindow | null} */
let mainWindow = null

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 960,
        minHeight: 600,
        title: 'NaoTodo',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    if (isDev) {
        mainWindow.loadURL(DEV_SERVER_URL)
        mainWindow.webContents.openDevTools({ mode: 'right' })
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    }

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
