import { Viaje } from './viaje.entity';
export declare class Pago {
    id: string;
    viaje_id: string;
    monto: number;
    estado: 'aprobado' | 'pendiente' | 'rechazado';
    referencia_transaccion: string;
    created_at: Date;
    viaje: Viaje;
}
