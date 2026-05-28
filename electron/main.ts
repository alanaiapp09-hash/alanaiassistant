import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.commandLine.appendSwitch('use-fake-ui-for-media-stream')
app.commandLine.appendSwitch('enable-speech-input')

process.env.APP_ROOT = path.join(__dirname, '..')
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

const PROFILE_PATH = path.join(app.getPath('userData'), 'alan-profile.json')

let win: BrowserWindow | null = null
let oauthServer: any = null
let pendingDeepLink: string | null = null

function sendDeepLink(url: string) {
  if (win?.webContents) {
    win.webContents.send('deep-link', url)
  } else {
    pendingDeepLink = url
  }
}

function getDeepLinkFromArgv(argv: string[]) {
  return argv.find((arg) => arg.startsWith('alan://')) || null
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg: string) => arg.startsWith('alan://'))
    if (url) sendDeepLink(url)
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  sendDeepLink(url)
})

function createWindow() {
  win = new BrowserWindow({
    icon: VITE_DEV_SERVER_URL
      ? path.join(process.env.APP_ROOT as string, 'public', 'icon.png')
      : path.join(RENDERER_DIST, 'icon.png'),
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.webContents.setAudioMuted(false)

  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['media', 'microphone', 'audioCapture', 'notifications'].includes(permission))
  })

  win.webContents.session.setPermissionCheckHandler((_wc, permission) => {
    return ['media', 'microphone', 'audioCapture'].includes(permission)
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())

    const credsPath = path.join(process.env.APP_ROOT as string, 'google-credentials.json')
    if (existsSync(credsPath)) {
      try {
        const creds = JSON.parse(readFileSync(credsPath, 'utf-8'))
        const installed = creds.installed || creds.web
        win?.webContents.executeJavaScript(`
          window.gmailCreds = ${JSON.stringify({
            client_id: installed.client_id,
            client_secret: installed.client_secret,
            redirect_uri: 'http://localhost:3000/callback'
          })};
        `)
      } catch(_) {}
    }

    if (pendingDeepLink) {
      sendDeepLink(pendingDeepLink)
      pendingDeepLink = null
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

ipcMain.handle('save-profile', (_event, profile: any) => {
  try {
    writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2), 'utf-8')
    return { success: true }
  } catch(e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('load-profile', () => {
  try {
    if (existsSync(PROFILE_PATH)) {
      return JSON.parse(readFileSync(PROFILE_PATH, 'utf-8'))
    }
    return null
  } catch(_) { return null }
})

ipcMain.handle('gmail-open-auth', (_event, authUrl: string) => {
  shell.openExternal(authUrl)
  return true
})

// TODO: migrar Gmail OAuth a deep link alan://gmail y eliminar localhost:3000
ipcMain.handle('gmail-start-server', () => {
  return new Promise((resolve) => {
    if (oauthServer) { oauthServer.close(); oauthServer = null }
    oauthServer = createServer((req, res) => {
      const url = new URL(req.url || '', 'http://localhost:3000')
      const code = url.searchParams.get('code')
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<html><body style="background:#05020f;color:#00d2ff;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>✅ ALAN AI conectado a Gmail</h2><p>Puedes cerrar esta ventana.</p></div></body></html>`)
        win?.webContents.send('gmail-auth-code', code)
        setTimeout(() => { oauthServer?.close(); oauthServer = null }, 2000)
        resolve({ success: true, code })
      } else {
        res.writeHead(400); res.end('Error')
        resolve({ success: false })
      }
    })
    oauthServer.listen(3000, () => resolve({ success: true, listening: true }))
    oauthServer.on('error', () => resolve({ success: false, error: 'Puerto 3000 ocupado' }))
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { app.quit(); win = null }
})

app.whenReady().then(() => {
  const initialDeepLink = getDeepLinkFromArgv(process.argv)
  if (initialDeepLink) {
    pendingDeepLink = initialDeepLink
  }

  if (process.platform === 'darwin') {
    app.setAsDefaultProtocolClient('alan')
  } else {
    app.setAsDefaultProtocolClient('alan', process.execPath, [path.resolve(process.argv[1] || '')])
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

export { MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL }
