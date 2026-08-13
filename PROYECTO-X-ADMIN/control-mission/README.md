# 🚀 CONTROL MISSION

**Sistema Avanzado de Gestión de Agentes AI para Desarrollo de Software**

Control Mission es un sistema revolucionario que permite automatizar tareas de desarrollo de software mediante agentes de IA especializados que trabajan en conjunto. Incluye un dashboard visual en tiempo real y integración con Telegram para control remoto.

---

## 📋 Características

### 🤖 Agentes Especializados
- **Backend Agent** - Node.js, Express, APIs REST, GraphQL, bases de datos
- **Frontend Agent** - React, Vue, Angular, TypeScript, CSS, Tailwind
- **Design Agent** - UI/UX, mockups, wireframes, diseño responsive
- **Database Agent** - SQL, NoSQL, modelado de datos, optimización
- **FullStack Agent** - Desarrollo completo, arquitectura, integración
- **Testing Agent** - Tests unitarios, e2e, integración, QA

### 📊 Dashboard Visual
- Visualización en tiempo real del estado de agentes
- Seguimiento de tareas con progreso en vivo
- Logs en tiempo real
- Estadísticas del sistema
- Interfaz moderna con TailwindCSS

### 📱 Integración con Telegram
- Crear tareas desde Telegram
- Recibir reportes de progreso
- Comandos para consultar estado
- Notificaciones de tareas completadas/fallidas

### ⚡ Características Técnicas
- Socket.io para comunicación en tiempo real
- Express.js como servidor backend
- LowDB para almacenamiento local
- Sistema de colas de tareas
- Asignación automática de agentes

---

## 🚀 Instalación

### Requisitos Previos
- Node.js >= 16.0.0
- npm >= 7.0.0
- Token de Telegram Bot (opcional)

### Pasos de Instalación

1. **Navega al directorio del proyecto**
```bash
cd control-mission
```

2. **Instala las dependencias**
```bash
npm install
```

3. **Configura las variables de entorno**
```bash
# Copia el archivo de ejemplo
copy .env.example .env

# Edita .env y configura tu token de Telegram
TELEGRAM_BOT_TOKEN=tu_token_aqui
TELEGRAM_AUTHORIZED_USERS=tu_id_de_usuario
```

4. **Inicia el servidor**
```bash
# Producción
npm start

# Desarrollo (con auto-reload)
npm run dev
```

5. **Abre el dashboard**
```
http://localhost:4000
```

---

## 📱 Configuración de Telegram

### Crear un Bot
1. Abre Telegram y busca a `@BotFather`
2. Envía el comando `/newbot`
3. Sigue las instrucciones para crear tu bot
4. Copia el token que te proporciona

### Obtener tu ID de Usuario
1. Busca a `@userinfobot` en Telegram
2. Envía cualquier mensaje
3. El bot te responderá con tu ID

### Configurar en .env
```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_AUTHORIZED_USERS=123456789
```

---

## 💻 Comandos de Telegram

### Comandos de Información
```
/start - Mensaje de bienvenida
/help - Lista de comandos disponibles
/status - Estado del sistema
/tasks - Lista de tareas recientes
/agents - Agentes disponibles
/stats - Estadísticas del sistema
/logs - Últimos logs
```

### Crear Tareas
```
crear backend:Crear API REST priority:high
crear frontend:Diseñar login form priority:medium
crear design:Mockup dashboard priority:low
crear database:Modelo de usuarios priority:high
```

### Gestionar Tareas
```
task <id> - Ver detalle de tarea
cancel <id> - Cancelar tarea
```

---

## 🎯 Uso del Dashboard

### Crear una Tarea
1. Haz clic en "Nueva Tarea"
2. Completa el formulario:
   - Título de la tarea
   - Descripción detallada
   - Tipo (Backend, Frontend, Design, etc.)
   - Prioridad (Low, Medium, High, Critical)
3. Haz clic en "Lanzar Tarea"

### Monitorear Progreso
- Las tarjetas de agentes muestran el estado en tiempo real
- Las tareas muestran una barra de progreso
- Los logs se actualizan automáticamente

### Filtrar Tareas
- Usa los botones para filtrar por estado
- Todas, Pendientes, En Progreso, Completadas

---

## 📁 Estructura del Proyecto

```
control-mission/
├── backend/
│   ├── server.js           # Servidor principal
│   ├── agent-manager.js    # Gestor de agentes
│   ├── task-queue.js       # Cola de tareas
│   ├── telegram-bot.js     # Bot de Telegram
│   ├── database.js         # Base de datos local
│   └── logger.js           # Sistema de logs
├── frontend/
│   ├── index.html          # Dashboard HTML
│   └── app.js              # Lógica del frontend
├── config/
│   └── db.json             # Base de datos JSON
├── logs/
│   └── control-mission.log # Archivo de logs
├── .env                    # Variables de entorno
├── .env.example            # Ejemplo de configuración
├── package.json            # Dependencias
└── README.md               # Este archivo
```

---

## 🔌 API REST

### Endpoints Disponibles

#### `GET /api/status`
Obtiene el estado del sistema

#### `GET /api/tasks`
Lista todas las tareas

#### `GET /api/tasks/:id`
Obtiene una tarea específica

#### `POST /api/tasks`
Crea una nueva tarea
```json
{
  "title": "Crear API REST",
  "description": "API para gestión de usuarios",
  "type": "backend",
  "priority": "high"
}
```

#### `POST /api/tasks/:id/cancel`
Cancela una tarea

#### `GET /api/logs`
Obtiene los últimos logs

---

## 🔧 Configuración Avanzada

### Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `4000` |
| `TELEGRAM_BOT_TOKEN` | Token del bot | - |
| `TELEGRAM_AUTHORIZED_USERS` | IDs autorizados (separados por coma) | - |
| `API_SECRET_KEY` | Clave secreta de API | - |
| `LOG_LEVEL` | Nivel de logs (info, warn, error, debug) | `info` |
| `LOG_FILE` | Ruta del archivo de logs | `logs/control-mission.log` |
| `MAX_CONCURRENT_TASKS` | Máximo de tareas simultáneas | `5` |
| `AGENT_TIMEOUT_MINUTES` | Timeout de agentes | `30` |
| `DB_FILE` | Ruta de la base de datos | `config/db.json` |

---

## 🛠️ Desarrollo

### Scripts Disponibles

```bash
# Iniciar en modo producción
npm start

# Iniciar en modo desarrollo (auto-reload)
npm run dev

# Solo el dashboard
npm run dashboard

# Instalar todas las dependencias
npm run install-all
```

---

## 📊 Métricas y Estadísticas

El dashboard muestra:
- Total de tareas creadas
- Tareas en progreso
- Tareas completadas
- Tareas fallidas
- Agentes activos
- Eficiencia por agente
- Logs en tiempo real

---

## 🔐 Seguridad

- Rate limiting en todas las rutas API
- Helmet.js para cabeceras de seguridad
- Usuarios autorizados en Telegram
- Logs de todas las operaciones

---

## 🐛 Solución de Problemas

### El bot de Telegram no responde
1. Verifica que el token sea correcto
2. Asegúrate de que tu ID esté en `TELEGRAM_AUTHORIZED_USERS`
3. Revisa los logs en `logs/control-mission.log`

### El dashboard no carga
1. Verifica que el servidor esté corriendo
2. Abre la consola del navegador para ver errores
3. Revisa que el puerto 4000 no esté en uso

### Los agentes no procesan tareas
1. Verifica el estado de los agentes en el dashboard
2. Revisa los logs para errores
3. Reinicia los agentes desde el dashboard

---

## 📝 Licencia

MIT License - PROYECTO X-ADMIN © 2026

---

## 🤝 Soporte

Para soporte, reporta de bugs o sugerencias, contacta al equipo de PROYECTO X-ADMIN.

---

**🚀 CONTROL MISSION - Potenciado por AI Agents**
