# ALAN AI — Contexto del Proyecto

## Descripción
ALAN AI es un asistente personal de escritorio con IA, voz y personalidad real.
No es un chatbot genérico — conoce al usuario, recuerda todo y ejecuta acciones.
Objetivo: superar a los Jarvis del mercado.

## Stack
- Frontend: React + TypeScript + Vite
- Desktop: Tauri (migrado desde Electron)
- Backend: Supabase (auth + DB + Edge Functions)
- Pagos: LemonSqueezy + PayPal
- IA: DeepSeek (beta) → Gemini (Free) / Claude Haiku/Sonnet/Opus (planes pagos)
- Voz: Web Speech API (voz Jorge, es-ES)
- Micrófono: getUserMedia + Whisper (Groq)

## Archivos clave
- src/components/Chat.tsx — interfaz principal, lógica IA, voz, micrófono
- src/components/Onboarding.tsx — 7 secciones, buildSystemPrompt, saveMemory
- src/gmailService.ts — OAuth Gmail completo
- src/supabase.ts — cliente Supabase
- src-tauri/tauri.conf.json — configuración Tauri
- src-tauri/entitlements.plist — permisos Mac (micrófono)

## Planes
| Plan | Precio | Mensajes | IA |
|------|--------|----------|----|
| Free | $0 | 10/día | Gemini |
| Core | $9.99 | 300/día | Claude Haiku |
| Advanced | $19.99 | 300/mes | Claude Sonnet |
| Quantum | $49.99 | Ilimitado | Claude Opus |

## Funciones por implementar (orden de prioridad)
1. Supabase Edge Functions para Claude API
2. Login/registro con Supabase Auth
3. Sistema de planes con límites automáticos
4. Gmail enviar correos
5. Leer PDF
6. Ver/crear imágenes
7. Excel avanzado
8. Control de escritorio
9. Escucha continua + wake word "ALAN"
10. Modo reunión (transcripción + resumen)
11. WhatsApp Business (Quantum)

## APIs y credenciales (solo para desarrollo)
- DeepSeek: sk-7a1dd11acc2a43a09e7db6b7581255a6
- Groq: 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
- Supabase URL: https://xwbrohzybbtkhusxlrty.supabase.co
- Supabase Key: sb_publishable_UEE5PS_oU4UHQunrTFeJkA_FJATszEr

## Contexto personal
- Usuario: Jay (Jayssam Mokded), Madrid, España
- Cuenta Jay = plan Quantum ilimitado (hardcodear con email)
- 4 beta testers = plan Quantum de por vida
- Empresa: Nexus LLC (en proceso de registro)
- Dominio: alanaiassistant.app

## Decisiones de arquitectura
- Claude API solo via Supabase Edge Functions (evitar CORS)
- Credenciales IA nunca en el frontend
- Perfil en localStorage + sincronizar con Supabase
- Tauri para todas las funciones de sistema (archivos, micrófono, escritorio)
