import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('alan', {
  loadProfile: () => ipcRenderer.invoke('load-profile'),
  saveProfile: (profile: any) => ipcRenderer.invoke('save-profile', profile),
  gmailOpenAuth: (url: string) => ipcRenderer.invoke('gmail-open-auth', url),
  gmailStartServer: () => ipcRenderer.invoke('gmail-start-server'),
  onGmailCode: (callback: (code: string) => void) =>
    ipcRenderer.on('gmail-auth-code', (_event, code) => callback(code)),
  onMainMessage: (callback: (msg: string) => void) =>
    ipcRenderer.on('main-process-message', (_event, msg) => callback(msg)),
  onDeepLink: (callback: (url: string) => void) =>
    ipcRenderer.on('deep-link', (_event, url) => callback(url)),
})
