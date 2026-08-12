# 🔧 CAMBIOS EXACTOS PARA App.tsx

## CAMBIO 1: Líneas 38-54 (BORRAR Y REEMPLAZAR)

**BUSCA ESTO (líneas 38-54):**
```typescript
const INITIAL_NETWORK: NetworkNode = {
  id: 'root',
  name: 'Investor Node',
  level: 0,
  totalVolume: 85000,
  children: [
    {
      id: 'sub1',
      name: 'Maria V.',
      level: 1,
      totalVolume: 45000,
      children: [
        { id: 'sub1a', name: 'John D.', level: 2, totalVolume: 12000, children: [] },
      ]
    }
  ]
};
```

**BORRA TODO ESO Y REEMPLAZA CON:**
```typescript
// Red vacía - se llenará con datos reales cuando se implemente backend de referidos
const EMPTY_NETWORK: NetworkNode = {
  id: 'root',
  name: 'My Node',
  level: 0,
  totalVolume: 0,
  children: []
};
```

---

## CAMBIO 2: Línea 61

**BUSCA:**
```typescript
const [network, setNetwork] = useState<NetworkNode>(INITIAL_NETWORK);
```

**REEMPLAZA CON:**
```typescript
const [network, setNetwork] = useState<NetworkNode>(EMPTY_NETWORK);
```

---

## CAMBIO 3: Línea 493

**BUSCA:**
```typescript
<SalaryPanel 
  teamVolume={network.totalVolume}
```

**REEMPLAZA CON:**
```typescript
<SalaryPanel 
  teamVolume={0}
```

---

## CAMBIO 4: Línea 532

**BUSCA:**
```typescript
<NetworkVisualization data={network} />
```

**REEMPLAZA CON:**
```typescript
<NetworkVisualization data={network} totalVolume={0} />
```

---

## 📝 RESUMEN:
- ✅ 4 cambios en total
- ✅ Elimina INITIAL_NETWORK con datos fake
- ✅ Crea EMPTY_NETWORK vacío
- ✅ teamVolume = 0
- ✅ totalVolume = 0

Guarda el archivo después de hacer estos 4 cambios.
