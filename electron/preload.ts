import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('alan', {
  // Perfil
  saveProfile: (profile: any) => ipcRenderer.invoke('save-profile', profile),
  loadProfile: () => ipcRenderer.invoke('load-profile'),

  // Gmail OAuth
  gmailOpenAuth: (authUrl: string) => ipcRenderer.invoke('gmail-open-auth', authUrl),
  gmailStartServer: () => ipcRenderer.invoke('gmail-start-server'),
  onGmailCode: (callback: (code: string) => void) => {
    ipcRenderer.on('gmail-auth-code', (_event, code) => callback(code))
  },
})