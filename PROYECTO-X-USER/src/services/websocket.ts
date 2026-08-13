export interface SocketMessage {
    id: string;
    type: string;
    timestamp: Date;
    payload: {
        description: string;
        amount?: number;
        [key: string]: any;
    };
}

export class ProyectoXSocket {
    private static instance: ProyectoXSocket;
    private subscribers: ((msg: SocketMessage) => void)[] = [];
    private interval: any;

    private constructor() {
        this.startMockFeed();
    }

    public static getInstance(): ProyectoXSocket {
        if (!ProyectoXSocket.instance) {
            ProyectoXSocket.instance = new ProyectoXSocket();
        }
        return ProyectoXSocket.instance;
    }

    public subscribe(callback: (msg: SocketMessage) => void): () => void {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    private startMockFeed() {
        this.interval = setInterval(() => {
            const types = ['PROFIT_TICK', 'NETWORK_EVENT', 'SYSTEM_STATUS'];
            const type = types[Math.floor(Math.random() * types.length)];

            const msg: SocketMessage = {
                id: Math.random().toString(36).substr(2, 9),
                type,
                timestamp: new Date(),
                payload: {
                    description: type === 'PROFIT_TICK' ? 'User ROI Distributed' : 'Node synchronization complete',
                    amount: type === 'PROFIT_TICK' ? Math.random() * 10 : undefined
                }
            };

            this.notify(msg);
        }, 5000);
    }

    private notify(msg: SocketMessage) {
        this.subscribers.forEach(cb => cb(msg));
    }
}
