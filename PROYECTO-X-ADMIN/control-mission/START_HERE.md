# ⚡ START HERE - CONTROL MISSION

## 🚀 Empezar en 2 Minutos

### Paso 1: Abrir Terminal
```bash
cd control-mission
```

### Paso 2: Iniciar
```bash
# Windows - Doble clic en start.bat
# O desde terminal:
npm start
```

### Paso 3: Abrir Dashboard
```
http://localhost:4000
```

---

## 📱 Configurar Telegram (Opcional - 3 Minutos)

### 1. Crear Bot
1. Abre Telegram
2. Busca `@BotFather`
3. Envía `/newbot`
4. Elige nombre: `Control Mission Bot`
5. Elige username: `mi_control_bot`
6. **Copia el TOKEN**

### 2. Obtener tu ID
1. Busca `@userinfobot`
2. Envía cualquier mensaje
3. **Copia tu ID**

### 3. Configurar
Edita `.env` y pega:
```
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_AUTHORIZED_USERS=123456789
```

### 4. Reiniciar
```bash
# Ctrl+C para detener
npm start
```

### 5. Iniciar Bot
En Telegram, busca tu bot y envía `/start`

---

## ✅ Tu Primera Tarea

### Desde el Dashboard
1. Clic en "Nueva Tarea"
2. Título: `Mi primera tarea`
3. Tipo: `frontend`
4. Prioridad: `medium`
5. Clic en "Lanzar Tarea"
6. ¡Mira cómo el agente trabaja!

### Desde Telegram
```
crear frontend:Mi primera tarea priority:medium
```

---

## 📚 Documentación Rápida

| Archivo | Qué contiene |
|---------|--------------|
| `QUICKSTART.md` | Guía rápida de inicio |
| `TELEGRAM_COMMANDS.md` | Todos los comandos de Telegram |
| `EXAMPLES.md` | Ejemplos de uso real |
| `README.md` | Documentación completa |

---

## 🎯 Comandos Esenciales

### Telegram
```
/start - Iniciar
/help - Ayuda
/status - Estado
/tasks - Tareas
/agents - Agentes
/stats - Estadísticas
```

### Crear Tareas
```
crear backend:API REST priority:high
crear frontend:Login form priority:medium
crear design:Mockup dashboard priority:low
```

---

## 🔧 Solución de Problemas

### Error: Puerto en uso
```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID <NUMERO> /F
```

### Error: Module not found
```bash
npm install
```

### Telegram no responde
1. Verifica `.env` con token correcto
2. Reinicia el servidor
3. Revisa `logs/control-mission.log`

---

## 🎉 ¡Listo!

Ahora tienes un sistema de agentes AI trabajando para ti.

### Próximos Pasos
1. Explora el dashboard
2. Crea varias tareas
3. Configura Telegram
4. Lee `EXAMPLES.md` para casos de uso

---

## 📊 ¿Qué Puedes Hacer?

### ✅ Automatizar
- Creación de APIs
- Componentes React/Vue
- Mockups de diseño
- Modelos de base de datos
- Tests automatizados

### 📈 Monitorear
- Progreso en tiempo real
- Estado de agentes
- Estadísticas de productividad
- Logs detallados

### 🎮 Controlar
- Desde tu computadora
- Desde Telegram (remoto)
- Vía API REST
- Dashboard web

---

## 💡 Tips Rápidos

1. **Prioridades**: Usa `high` para lo importante, `medium` para lo normal
2. **Agentes**: 6 agentes especializados listos 24/7
3. **Telegram**: Configúralo para control remoto
4. **Dashboard**: Todo en tiempo real con Socket.io
5. **Logs**: Revisa `logs/control-mission.log` para detalles

---

**🚀 CONTROL MISSION está listo. ¡A crear!**

¿Preguntas? Lee el `README.md` o la documentación completa.
