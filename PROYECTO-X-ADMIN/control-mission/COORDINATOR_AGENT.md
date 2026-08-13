# 👑 COORDINATOR AGENT - El Coordinador que Nunca Duerme

## 🌟 Descripción General

El **Coordinator Agent** es un agente especial que supervisa todos los demás agentes y el sistema completo las **24 horas, los 7 días de la semana, sin descanso**.

---

## 🎯 Funciones Principales

### 1. 👁️ Monitoreo Constante
- Revisa el estado de todos los agentes cada **5 segundos**
- Verifica la salud del sistema continuamente
- Detecta problemas antes de que se vuelvan críticos

### 2. ⚡ Optimización de Carga
- Distribuye tareas equitativamente entre agentes
- Reasigna tareas de agentes sobrecargados
- Balancea el trabajo automáticamente

### 3. 🔄 Reasignación Automática
- Detecta tareas estancadas (>30 minutos)
- Libera agentes bloqueados
- Reencola tareas para mejor distribución

### 4. 🚨 Alertas Tempranas
- Genera alertas **info**, **warning**, y **critical**
- Notifica problemas en tiempo real
- Envía alertas críticas por Telegram

### 5. 📊 Reportes Automáticos
- Genera reportes cada **hora**
- Incluye métricas avanzadas
- Muestra eficiencia del sistema

### 6. ♻️ Recuperación de Tareas
- Detecta tareas estancadas (>1 hora)
- Marca tareas como fallidas recuperables
- Libera recursos bloqueados

---

## 🎨 Apariencia en el Dashboard

El Coordinador se muestra de forma única:

- **Color Dorado** (#FFD700) - Borde brillante
- **Badge "NUNCA DUERME"** - Esquina superior derecha
- **Animación especial** - Glow dorado pulsante
- **Estado "Siempre Activo"** - Nunca está inactivo
- **Botón "Ver Estado"** - Muestra métricas completas

---

## 📊 Métricas que Supervisa

### Tareas
- Total supervisadas
- Completadas hoy
- Tasa de éxito
- Tiempo promedio de completado

### Agentes
- Activos vs Totales
- Eficiencia individual
- Carga de trabajo
- Estado de salud

### Sistema
- Cola de tareas
- Alertas generadas
- Optimizaciones realizadas
- Uptime continuo

---

## 🔧 Configuración

### Intervalos
```javascript
checkInterval: 5000,        // Monitoreo cada 5 segundos
reportInterval: 3600000,    // Reporte cada hora (60 minutos)
optimizationThreshold: 3    // Tareas para optimizar
```

### Umbrales de Alerta
```javascript
maxTaskTime: 30 * 60000,    // 30 minutos máximo por tarea
stuckThreshold: 60 * 60000, // 1 hora para considerar estancada
pendingAlert: 20,           // Alertar si hay >20 tareas pendientes
```

---

## 🚨 Niveles de Alerta

### ℹ️ Info
- Agente offline temporalmente
- Tarea completada con advertencias
- Optimización menor realizada

### ⚠️ Warning
- Agente con tarea por >30 minutos
- Cola de tareas saturada (>20 pendientes)
- Múltiples tareas fallidas

### 🚨 Critical
- No hay agentes disponibles
- Tarea estancada por >1 hora
- Error crítico del sistema

---

## 📱 Integración con Telegram

El Coordinador envía alertas automáticamente:

```
🚨 ALERTA CRÍTICA

No hay agentes disponibles para tareas pendientes
Pendientes: 25
Timestamp: 2026-03-16 14:30:00
```

---

## 🦾 Acciones Automáticas

### 1. Monitoreo de Agentes
```javascript
// Verifica cada 5 segundos
- Estado del agente
- Tiempo en tarea actual
- Si está bloqueado
- Si necesita ayuda
```

### 2. Optimización de Carga
```javascript
// Si hay desbalance
- Agente A: 3 tareas
- Agente B: 0 tareas
→ Reasigna 1 tarea de A a B
```

### 3. Recuperación de Tareas
```javascript
// Tarea estancada >1 hora
1. Marcar como fallida
2. Liberar agente
3. Notificar a clientes
4. Registrar en logs
```

---

## 📈 Ejemplo de Reporte

```
📊 REPORTE DEL COORDINADOR
Timestamp: 2026-03-16 15:00:00

RESUMEN:
- Tareas Totales: 150
- Completadas Hoy: 45
- Tasa de Éxito: 94%
- Tiempo Promedio: 12.5 min
- Agentes Activos: 6/6

AGENTES:
- Backend Agent: 25 tareas, 96% eficiencia
- Frontend Agent: 30 tareas, 94% eficiencia
- Design Agent: 20 tareas, 98% eficiencia
- Database Agent: 15 tareas, 92% eficiencia
- FullStack Agent: 35 tareas, 95% eficiencia
- Testing Agent: 25 tareas, 97% eficiencia

MÉTRICAS DEL COORDINADOR:
- Tareas Supervisadas: 150
- Optimizaciones: 12
- Alertas: 3
- Reportes: 24
- Uptime: 5d 12h
```

---

## 🛠️ Comandos Relacionados

### Ver Estado del Coordinador
```javascript
// En el dashboard
Clic en "👑 Ver Estado" en la tarjeta del Coordinador
```

### Ver Alertas
```javascript
// En los logs
Buscar mensajes con [ALERTA]
```

### Ver Reportes
```javascript
// En los logs
Buscar mensajes con "📊 Reporte Generado"
```

---

## 🔍 Eventos de Socket.io

El Coordinador emite los siguientes eventos:

```javascript
coordinator:started       // Cuando inicia
coordinator:alert         // Nueva alerta generada
coordinator:report        // Reporte periódico
coordinator:alert:ack     // Alerta reconocida
task:reassigned          // Tarea reasignada
task:recovered           // Tarea recuperada
```

---

## 💡 Casos de Uso

### 1. Prevención de Cuellos de Botella
**Problema:** Un agente tiene 5 tareas mientras otros están libres.

**Solución del Coordinador:**
- Detecta el desbalance
- Reasigna 3 tareas a agentes libres
- Notifica la optimización

### 2. Recuperación de Tarea Bloqueada
**Problema:** Tarea lleva 2 horas en "En Progreso".

**Solución del Coordinador:**
- Marca la tarea como estancada
- Libera el agente
- Reencola la tarea
- Genera alerta crítica

### 3. Alerta Temprana de Saturación
**Problema:** 25 tareas en cola esperando.

**Solución del Coordinador:**
- Genera alerta warning
- Notifica por Telegram
- Sugiere agregar más agentes

---

## 🎯 Ventajas del Coordinador

| Sin Coordinador | Con Coordinador |
|-----------------|-----------------|
| Tareas estancadas horas | Detectadas en 5 segundos |
| Agentes sobrecargados | Balance automático |
| Problemas no detectados | Alertas tempranas |
| Sin reportes automáticos | Reportes cada hora |
| Intervención manual requerida | Automatizado 100% |

---

## 🔧 Personalización

### Cambiar Intervalo de Monitoreo
```javascript
// En coordinator-agent.js
this.checkInterval = 10000; // Cada 10 segundos
```

### Cambiar Frecuencia de Reportes
```javascript
// En coordinator-agent.js
this.reportInterval = 1800000; // Cada 30 minutos
```

### Ajustar Umbrales
```javascript
// En coordinator-agent.js
this.optimizationThreshold = 5; // 5 tareas para optimizar
```

---

## 📊 API del Coordinador

### Métodos Públicos

```javascript
// Obtener estado
coordinator.getStatus()

// Obtener alertas
coordinator.getAlerts(limit = 20)

// Reconocer alerta
coordinator.acknowledgeAlert(alertId)

// Generar reporte
coordinator.generateReport()

// Detener (temporal)
coordinator.stop()
```

---

## 🚀 Inicio del Coordinador

El Coordinador inicia automáticamente con el servidor:

```javascript
// En server.js
const coordinator = new CoordinatorAgent(io, db, logger, agentManager, taskQueue);
coordinator.start();
```

**Mensaje de inicio:**
```
👑 Coordinator Agent iniciado - Nunca Duerme
👁️ Monitoreo constante iniciado
📊 Reportes automáticos iniciados
```

---

## 🎉 ¡El Coordinador Nunca Duerme!

Mientras tú descansas, el Coordinador:
- ✅ Monitorea agentes
- ✅ Optimiza tareas
- ✅ Genera alertas
- ✅ Previene problemas
- ✅ Mantiene el sistema saludable

**¡Productividad 24/7 garantizada!**

---

*Documento creado: 2026-03-16*
*Versión: 1.0.0*
*Autor: NOVA DIGITAL-ADMIN*
