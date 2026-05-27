// Gmail Service para ALAN AI
// Maneja OAuth, lectura y envío de correos

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
]

export interface EmailSummary {
  id: string
  from: string
  subject: string
  date: string
  snippet: string
  unread: boolean
}

export interface GmailCredentials {
  client_id: string
  client_secret: string
  redirect_uri: string
}

// Cargar credenciales desde el archivo JSON
export function loadCredentials(): GmailCredentials | null {
  // Credenciales hardcodeadas para beta
  return {
    client_id: "127414173642-gfv9inp09aru051vevt8au718cg3q9sr.apps.googleusercontent.com",
    client_secret: "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",
    redirect_uri: "http://localhost:3000/callback"
  };
  // eslint-disable-next-line no-unreachable
  try {
    // En Electron, leer el archivo desde el sistema
    const creds = (window as any).gmailCreds
    if (creds) return creds
    return null
  } catch(_) { return null }
}

// Generar URL de autorización OAuth
export function getAuthUrl(credentials: GmailCredentials): string {
  const params = new URLSearchParams({
    client_id: credentials.client_id,
    redirect_uri: 'http://localhost:3000/callback',
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent'
  })
  return `https://accounts.google.com/o/oauth2/auth?${params.toString()}`
}

// Intercambiar código por tokens
export async function exchangeCodeForTokens(
  code: string,
  credentials: GmailCredentials
): Promise<any> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      redirect_uri: 'http://localhost:3000/callback',
      grant_type: 'authorization_code'
    })
  })
  if (!res.ok) throw new Error('Error al obtener tokens')
  return await res.json()
}

// Guardar tokens en localStorage
export function saveTokens(tokens: any) {
  localStorage.setItem('alan_gmail_tokens', JSON.stringify(tokens))
}

// Cargar tokens guardados
export function loadTokens(): any | null {
  try {
    const t = localStorage.getItem('alan_gmail_tokens')
    return t ? JSON.parse(t) : null
  } catch(_) { return null }
}

// Refrescar access token si expiró
export async function refreshAccessToken(credentials: GmailCredentials, refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      grant_type: 'refresh_token'
    })
  })
  if (!res.ok) throw new Error('Error al refrescar token')
  const data = await res.json()
  return data.access_token
}

// Obtener access token válido
export async function getValidAccessToken(credentials: GmailCredentials): Promise<string | null> {
  const tokens = loadTokens()
  if (!tokens) return null

  // Si el token no ha expirado
  if (tokens.expiry_date && Date.now() < tokens.expiry_date - 60000) {
    return tokens.access_token
  }

  // Refrescar si hay refresh token
  if (tokens.refresh_token) {
    try {
      const newToken = await refreshAccessToken(credentials, tokens.refresh_token)
      tokens.access_token = newToken
      tokens.expiry_date = Date.now() + 3600000
      saveTokens(tokens)
      return newToken
    } catch(_) { return null }
  }

  return tokens.access_token
}

// Leer correos no leídos
export async function getUnreadEmails(accessToken: string, maxResults = 5): Promise<EmailSummary[]> {
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=is:unread`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  )
  if (!listRes.ok) throw new Error('Error al obtener correos')
  const listData = await listRes.json()
  const messages = listData.messages || []
  const emails: EmailSummary[] = []

  for (const msg of messages.slice(0, maxResults)) {
    const detailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )
    if (!detailRes.ok) continue
    const detail = await detailRes.json()
    const headers = detail.payload?.headers || []
    const getH = (name: string) => headers.find((h: any) => h.name === name)?.value || ''

    emails.push({
      id: msg.id,
      from: getH('From'),
      subject: getH('Subject'),
      date: getH('Date'),
      snippet: detail.snippet || '',
      unread: true
    })
  }
  return emails
}

// Enviar correo
export async function sendEmail(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body
  ].join('\r\n')

  const encoded = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encoded })
    }
  )
  return res.ok
}

// Formatear emails para mostrar a ALAN
export function formatEmailsForAlan(emails: EmailSummary[]): string {
  if (emails.length === 0) return "No tienes correos sin leer."
  return emails.map((e, i) =>
    `${i+1}. De: ${e.from}\n   Asunto: ${e.subject}\n   ${e.snippet}`
  ).join('\n\n')
}