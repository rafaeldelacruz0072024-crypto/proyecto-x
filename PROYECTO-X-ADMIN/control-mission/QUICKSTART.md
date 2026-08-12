# 🚀 GUÍA RÁPIDA DE INICIO - CONTROL MISSION

## Instalación en 3 Pasos

### Paso 1: Instalar Dependencias
```bash
cd control-mission
npm install
```

### Paso 2: Configurar Telegram (Opcional pero Recomendado)
1. Abre Telegram y busca `@BotFather`
2. Envía `/newbot` y sigue las instrucciones
3. Copia el token que te da
4. Busca `@userinfobot` para obtener tu ID de usuario
5. Edita el archivo `.env` y pega tu token:
```
TELEGRAM_BOT_TOKEN=tu_token_aqui
TELEGRAM_AUTHORIZED_USERS=tu_id_aqui
```

### Paso 3: Iniciar el Sistema
```bash
npm start
```

¡Listo! Abre tu navegador en http://localhost:4000

---

## Comandos Esenciales de Telegram

### Crear Tarea
```
crear backend:Crear API de usuarios priority:high
```

### Ver Estado
```
/status
```

### Ver Tareas
```
/tasks
```

### Ver Agentes
```
/agents
```

### Ayuda
```
/help
```

---

## Primeros Pasos en el Dashboard

1. **Observa los Agentes**: Verás 6 agentes especializados listos
2. **Crea tu Primera Tarea**: 
   - Clic en "Nueva Tarea"
   - Título: "Crear página de inicio"
   - Tipo: Frontend
   - Prioridad: Medium
   - Clic en "Lanzar Tarea"
3. **Mira el Progreso**: Observa cómo el agente trabaja en tiempo real
4. **Revisa los Logs**: Ve la sección de logs para ver el detalle

---

## Tipos de Tareas

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `backend` | APIs, servidores, bases de datos | `crear backend:API REST` |
| `frontend` | Interfaces, componentes React/Vue | `crear frontend:Login form` |
| `design` | Mockups, UI/UX, wireframes | `crear design:Dashboard mockup` |
| `database` | Modelado, migraciones, SQL | `crear database:Esquema usuarios` |
| `fullstack` | Proyectos completos | `crear fullstack:App tareas` |
| `testing` | Tests, QA, automatización | `crear testing:Tests API` |

---

## Niveles de Prioridad

- **low**: Tareas no urgentes, mejoras
- **medium**: Tareas normales del día a día
- **high**: Tareas importantes, deadlines cercanos
- **critical**: Urgente, producción caída, bugs críticos

---

## Atajos Útiles

### Ver Logs en Tiempo Real
Los logs se actualizan automáticamente en el dashboard. También puedes ver el archivo:
```bash
# En otra terminal
tail -f logs/control-mission.log
```

### Reiniciar un Agente
1. En el dashboard, busca el agente
2. Clic en "Reiniciar"
3. El agente volverá a estado "idle"

### Cancelar una Tarea
- Desde Telegram: `cancel <id-de-tarea>`
- Desde Dashboard: Clic en el botón rojo de "Stop"

---

## Problemas Comunes

### "Puerto ya en uso"
```bash
# Windows - Matar proceso en puerto 4000
netstat -ano | findstr :4000
taskkill /PID <PID> /F
```

### "Telegram no responde"
1. Verifica tu token en `.env`
2. Reinicia el servidor
3. Revisa `logs/control-mission.log`

### "Agentes no trabajan"
1. Verifica que estén en estado "idle" (verde)
2. Si están "offline", reinícialos desde el dashboard

---

## Siguiente Nivel

Una vez domines lo básico:

1. **Configura múltiples usuarios autorizados** en `.env`
2. **Crea plantillas de tareas** para tu flujo de trabajo
3. **Monitorea las estadísticas** para optimizar
4. **Integra con tu CI/CD** usando la API REST

---

## API REST Rápida

```bash
# Crear tarea con curl
curl -X POST http://localhost:4000/api/tasks \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Mi Tarea\",\"type\":\"backend\",\"priority\":\"high\"}"

# Ver todas las tareas
curl http://localhost:4000/api/tasks

# Ver estado del sistema
curl http://localhost:4000/api/status
```

---

**¡Ahora estás listo para usar CONTROL MISSION como un profesional! 🚀**

Para documentación completa, lee el `README.md`.
