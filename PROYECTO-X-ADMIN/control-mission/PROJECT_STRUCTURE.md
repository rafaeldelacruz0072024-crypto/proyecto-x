# 📁 ESTRUCTURA DEL PROYECTO - CONTROL MISSION

```
control-mission/
│
├── 📄 START_HERE.md                    # ¡EMPIEZA AQUÍ!
├── 📄 QUICKSTART.md                    # Guía rápida de inicio
├── 📄 README.md                        # Documentación completa
├── 📄 EXAMPLES.md                      # Ejemplos de uso real
├── 📄 TELEGRAM_COMMANDS.md             # Comandos de Telegram
├── 📄 PROJECT_STRUCTURE.md             # Este archivo
│
├── 🔧 start.bat                        # Script de inicio (Windows)
├── 📦 package.json                     # Dependencias y scripts
├── 🔒 .env.example                     # Ejemplo de variables de entorno
├── 🔒 .env                             # Configuración (crear desde ejemplo)
├── 🚫 .gitignore                       # Archivos ignorados por Git
│
├── 📂 backend/                         # Servidor y lógica principal
│   ├── 📄 server.js                    # ⭐ Servidor principal (Express + Socket.io)
│   ├── 📄 agent-manager.js             # Gestor de agentes AI
│   ├── 📄 task-queue.js                # Cola de tareas
│   ├── 📄 telegram-bot.js              # Bot de Telegram
│   ├── 📄 database.js                  # Base de datos local (LowDB)
│   └── 📄 logger.js                    # Sistema de logs
│
├── 📂 frontend/                        # Interfaz web
│   ├── 📄 index.html                   # Dashboard HTML
│   ├── 📄 app.js                       # Lógica del frontend (Socket.io)
│   └── 📄 styles.css                   # Estilos (TailwindCSS via CDN)
│
├── 📂 agents/                          # Agentes especializados (futuro)
│   └── (archivos de agentes adicionales)
│
├── 📂 config/                          # Configuración
│   ├── 📄 db.json                      # Base de datos JSON (auto-generado)
│   └── 📄 agents.config.json           # Configuración avanzada de agentes
│
├── 📂 logs/                            # Logs del sistema
│   └── 📄 control-mission.log          # Archivo de logs (auto-generado)
│
└── 📂 public/                          # Archivos estáticos
    └── (archivos públicos adicionales)
```

---

## 🔍 Descripción de Archivos

### Archivos Principales (Raíz)

| Archivo | Propósito | ¿Editar? |
|---------|-----------|----------|
| `START_HERE.md` | Primeros pasos | ❌ Solo leer |
| `QUICKSTART.md` | Guía rápida | ❌ Solo leer |
| `README.md` | Documentación completa | ❌ Solo leer |
| `EXAMPLES.md` | Ejemplos de uso | ❌ Solo leer |
| `TELEGRAM_COMMANDS.md` | Comandos Telegram | ❌ Solo leer |
| `start.bat` | Script inicio Windows | ⚠️ Solo si es necesario |
| `package.json` | Dependencias | ⚠️ Solo para agregar packages |
| `.env.example` | Ejemplo de configuración | ❌ No, usa `.env` |
| `.env` | **Tu configuración** | ✅ **SÍ, configura aquí** |
| `.gitignore` | Git ignore | ⚠️ Opcional |

---

### Backend (`backend/`)

| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `server.js` | Servidor Express + Socket.io | ~150 |
| `agent-manager.js` | Crea y gestiona agentes | ~250 |
| `task-queue.js` | Cola y procesamiento de tareas | ~200 |
| `telegram-bot.js` | Integración con Telegram | ~300 |
| `database.js` | CRUD LowDB | ~120 |
| `logger.js` | Sistema de logging | ~80 |

**Total Backend:** ~1100 líneas de código

---

### Frontend (`frontend/`)

| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `index.html` | Dashboard UI | ~350 |
| `app.js` | Lógica + Socket.io | ~400 |

**Total Frontend:** ~750 líneas de código

---

### Configuración (`config/`)

| Archivo | Propósito | ¿Editar? |
|---------|-----------|----------|
| `db.json` | Datos (tareas, agentes, logs) | ❌ Auto-generado |
| `agents.config.json` | Configuración avanzada | ✅ Para personalizar |

---

## 🔄 Flujo de Datos

```
┌──────────────┐
│   Telegram   │
│   (Comandos) │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────┐
│         backend/server.js               │
│  (Express + Socket.io + Middlewares)    │
└─────┬──────────────┬──────────────┬─────┘
      │              │              │
      ▼              ▼              ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│ Telegram  │  │   Task    │  │  Agent    │
│    Bot    │  │   Queue   │  │  Manager  │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │              │              │
      └──────────────┼──────────────┘
                     │
                     ▼
              ┌───────────┐
              │ Database  │
              │ (LowDB)   │
              └─────┬─────┘
                    │
                    ▼
              ┌───────────┐
              │  Logger   │
              └───────────┘
                    │
                    ▼
              ┌───────────┐
              │ Socket.io │
              └─────┬─────┘
                    │
                    ▼
         ┌─────────────────────┐
         │   frontend/app.js   │
         │   (Dashboard UI)    │
         └─────────────────────┘
```

---

## 📊 Base de Datos (db.json)

Estructura del archivo `config/db.json`:

```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string",
      "type": "backend|frontend|design|database|fullstack|testing",
      "priority": "low|medium|high|critical",
      "status": "pending|in_progress|completed|failed|cancelled",
      "assignedAgent": "string",
      "progress": 0-100,
      "createdAt": "ISO date",
      "completedAt": "ISO date",
      "result": "object",
      "logs": []
    }
  ],
  "agents": [
    {
      "id": "string",
      "name": "string",
      "type": "string",
      "status": "idle|busy|offline",
      "currentTask": "string|null",
      "tasksCompleted": 0,
      "tasksFailed": 0,
      "metadata": {}
    }
  ],
  "logs": [
    {
      "timestamp": "ISO date",
      "level": "info|warn|error|debug",
      "message": "string"
    }
  ],
  "config": {
    "maxConcurrentTasks": 5,
    "agentTimeoutMinutes": 30
  }
}
```

---

## 🎯 Puntos de Extensión

### Para Agregar Nuevos Agentes

1. Edita `backend/agent-manager.js`
2. Agrega definición en `getAgentDefinitions()`
3. (Opcional) Configura en `config/agents.config.json`

### Para Agregar Nuevos Comandos de Telegram

1. Edita `backend/telegram-bot.js`
2. Agrega handler en `setupEventHandlers()`
3. Agrega lógica en `processCommand()`

### Para Modificar el Dashboard

1. Edita `frontend/index.html` para UI
2. Edita `frontend/app.js` para lógica
3. Los cambios se ven al recargar (dev mode)

### Para Agregar Endpoints API

1. Edita `backend/server.js`
2. Agrega ruta después de las existentes
3. Implementa lógica usando `db`, `logger`, etc.

---

## 🔧 Configuración por Ambiente

### Desarrollo
```bash
npm run dev
# Auto-reload con nodemon
# Puerto: 4000
```

### Producción
```bash
npm start
# Node puro
# Puerto: 4000
```

### Dashboard Only
```bash
npm run dashboard
# Solo frontend estático
# Puerto: 3000
```

---

## 📈 Métricas del Proyecto

| Métrica | Valor |
|---------|-------|
| **Total Archivos** | 15+ |
| **Líneas de Código** | ~2000 |
| **Dependencias** | 12 |
| **Agentes** | 6 |
| **Comandos Telegram** | 15+ |
| **Endpoints API** | 6 |
| **Documentación** | 6 archivos |

---

## 🚀 Próximos Pasos

1. **Lee `START_HERE.md`** para comenzar
2. **Configura `.env`** con tu token de Telegram
3. **Ejecuta `start.bat`** o `npm start`
4. **Explora el dashboard** en http://localhost:4000
5. **Crea tu primera tarea**
6. **Lee `EXAMPLES.md`** para casos de uso

---

**📁 Ahora conoces cada archivo del proyecto. ¡A explorar!**
