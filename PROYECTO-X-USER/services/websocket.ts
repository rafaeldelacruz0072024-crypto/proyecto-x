
import { TransactionType, TransactionStatus } from '../src/types';

export type SocketMessageType = 'PROFIT_TICK' | 'NETWORK_EVENT' | 'SYSTEM_SYNC';

export interface SocketMessage {
  id: string;
  type: SocketMessageType;
  timestamp: Date;
  payload: {
    amount?: number;
    description: string;
    level?: number;
  };
}

type MessageCallback = (msg: SocketMessage) => void;

class ProyectoXSocketService {
  private listeners: MessageCallback[] = [];
  private interval: any = null;

  connect(onMessage: MessageCallback) {
    this.listeners.push(onMessage);
    
    // Iniciar el flujo de datos si no está iniciado
    if (!this.interval) {
      this.startStreaming();
    }
  }

  private startStreaming() {
    const emit = () => {
      const types: SocketMessageType[] = ['PROFIT_TICK', 'PROFIT_TICK', 'NETWORK_EVENT', 'SYSTEM_SYNC'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      let msg: SocketMessage = {
        id: `ws_${Math.random().toString(36).substr(2, 9)}`,
        type,
        timestamp: new Date(),
        payload: {
          description: ''
        }
      };

      switch (type) {
        case 'PROFIT_TICK':
          msg.payload.amount = Number((Math.random() * 0.8 + 0.1).toFixed(2));
          msg.payload.description = `Arbitrage Pulse: Node #${Math.floor(Math.random()*9000)+1000} liquidation profit.`;
          break;
        case 'NETWORK_EVENT':
          msg.payload.level = Math.floor(Math.random() * 5) + 1;
          msg.payload.description = `New node activation detected at L${msg.payload.level}. Volume increasing.`;
          break;
        case 'SYSTEM_SYNC':
          msg.payload.description = `Immutable Ledger sync complete. Block #${Math.floor(Math.random()*1000000)} verified.`;
          break;
      }

      this.listeners.forEach(cb => cb(msg));
      
      // Programar el siguiente mensaje con un intervalo aleatorio (8-20 segundos)
      const nextDelay = Math.floor(Math.random() * 12000) + 8000;
      this.interval = setTimeout(emit, nextDelay);
    };

    emit();
  }

  disconnect(callback: MessageCallback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }
}

export const ProyectoXSocket = new ProyectoXSocketService();
