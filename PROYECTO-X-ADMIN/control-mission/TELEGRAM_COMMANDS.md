# 📱 COMANDOS DE TELEGRAM - CONTROL MISSION

## Configuración de Comandos en @BotFather

Envía estos comandos a @BotFather para configurar el menú de tu bot:

```
/start - Iniciar el bot y ver mensaje de bienvenida
/help - Mostrar lista de comandos disponibles
/status - Ver estado actual del sistema
/tasks - Listar tareas recientes
/agents - Ver agentes disponibles y su estado
/stats - Mostrar estadísticas del sistema
/logs - Ver últimos logs del sistema
```

### Cómo configurar:

1. Abre Telegram y busca `@BotFather`
2. Envía `/setcommands`
3. Selecciona tu bot
4. Copia y pega la siguiente lista:

```
start - Iniciar el bot
help - Mostrar comandos
status - Estado del sistema
tasks - Listar tareas
agents - Ver agentes
stats - Estadísticas
logs - Últimos logs
```

---

## Comandos para Usuarios

### 📊 Comandos de Información

#### `/start`
Inicia el bot y muestra mensaje de bienvenida.

#### `/help`
Muestra todos los comandos disponibles con ejemplos.

#### `/status`
Muestra el estado actual del sistema:
- Total de tareas
- Tareas pendientes, en progreso, completadas, fallidas
- Agentes activos

#### `/tasks`
Lista las últimas 10 tareas con:
- Estado (emoji)
- Título
- Prioridad
- ID de tarea

#### `/agents`
Muestra todos los agentes registrados:
- Nombre y tipo
- Estado (activo/inactivo)
- Tarea actual (si tiene)

#### `/stats`
Estadísticas detalladas:
- Total de tareas
- Tasa de éxito
- Completadas hoy
- Agentes activos
- Tareas de alta prioridad

#### `/logs`
Últimos 10 logs del sistema con timestamp.

---

### ➕ Crear Tareas

#### Formato General:
```
crear <tipo>:<descripción> priority:<prioridad>
```

#### Tipos Disponibles:
- `backend` - APIs, servidores, bases de datos
- `frontend` - Interfaces, componentes web
- `design` - Mockups, UI/UX, wireframes
- `database` - Modelado, migraciones, SQL
- `fullstack` - Proyectos completos
- `testing` - Tests, QA, automatización

#### Prioridades:
- `low` - Baja
- `medium` - Media (default)
- `high` - Alta
- `critical` - Crítica

---

### Ejemplos de Comandos

#### Backend
```
crear backend:Crear API REST para usuarios priority:high
crear backend:Implementar autenticación JWT priority:high
crear backend:API de productos con CRUD priority:medium
crear backend:Microservicio de notificaciones priority:medium
```

#### Frontend
```
crear frontend:Diseñar login form con validación priority:high
crear frontend:Componente de dashboard con gráficas priority:medium
crear frontend:Tabla de usuarios con paginación priority:medium
crear frontend:Formulario de registro paso a paso priority:low
```

#### Diseño
```
crear design:Mockup para landing page priority:high
crear design:Wireframe de dashboard administrativo priority:medium
crear design:Rediseño de página de inicio priority:low
crear design:Prototipo para app móvil priority:medium
```

#### Database
```
crear database:Modelo de datos para e-commerce priority:high
crear database:Migración de usuarios a nueva tabla priority:medium
crear database:Índices para optimizar consultas priority:medium
crear database:Esquema para sistema de blog priority:low
```

#### Fullstack
```
crear fullstack:Sistema completo de gestión de tareas priority:high
crear fullstack:App de chat en tiempo real priority:high
crear fullstack:Plataforma de e-commerce básica priority:critical
```

#### Testing
```
crear testing:Tests unitarios para API de usuarios priority:medium
crear testing:Tests e2e para flujo de checkout priority:high
crear testing:Tests de integración para autenticación priority:medium
```

---

### 🔧 Gestión de Tareas

#### Ver detalle de tarea:
```
task <id-de-tarea>
```
Ejemplo: `task 123e4567-e89b-12d3-a456-426614174000`

#### Cancelar tarea:
```
cancel <id-de-tarea>
```
Ejemplo: `cancel 123e4567-e89b-12d3-a456-426614174000`

---

## Flujo de Trabajo Recomendado

### 1. Verificar Estado Antes de Crear
```
/status
/agents
```

### 2. Crear Tarea con Prioridad Adecuada
```
crear backend:API de usuarios priority:high
```

### 3. Monitorear Progreso
```
/tasks
```

### 4. Verificar Completado
```
/stats
```

---

## Consejos de Uso

### ✅ Mejores Prácticas

1. **Sé específico en la descripción**
   - ❌ `crear backend:API`
   - ✅ `crear backend:API REST para gestión de usuarios con CRUD completo`

2. **Usa prioridades correctamente**
   - `critical`: Solo para emergencias reales
   - `high`: Tareas importantes del día
   - `medium`: Tareas normales
   - `low`: Mejoras, refactorización

3. **Verifica agentes disponibles**
   - Usa `/agents` antes de crear tareas críticas

4. **Monitorea el progreso**
   - Usa `/tasks` periódicamente

5. **Cancela tareas innecesarias**
   - Libera agentes para otras tareas

### ⚠️ Evita

1. Crear múltiples tareas idénticas
2. Usar prioridad `critical` para todo
3. Cancelar tareas constantemente
4. Crear tareas sin descripción clara

---

## Notificaciones Automáticas

El bot te notificará automáticamente cuando:

- ✅ Una tarea se completa
- ❌ Una tarea falla
- 📊 Reporte diario (si está configurado)

---

## Solución de Problemas

### El bot no responde
1. Verifica que el servidor esté corriendo
2. Revisa que tu ID esté en `TELEGRAM_AUTHORIZED_USERS`
3. Verifica el token en `.env`

### Comando no reconocido
1. Asegúrate de usar el formato exacto
2. Verifica que el tipo de tarea sea válido
3. Usa `/help` para ver comandos disponibles

### Tarea no se crea
1. Verifica el formato: `crear tipo:descripción priority:nivel`
2. Revisa los logs para errores
3. Usa `/status` para verificar el sistema

---

## Atajos Rápidos

### Crear tarea rápida (prioridad media por defecto):
```
crear backend:Mi tarea nueva
```

### Ver solo tareas en progreso:
```
/tasks
```
(Luego busca las que dicen "En Progreso")

### Reiniciar agente específico:
(Desde el dashboard, no disponible por Telegram)

---

**¿Necesitas más ayuda? Revisa el README.md o la documentación completa.**
