import { Viaje } from './viaje.entity';
export declare class Usuario {
    id: string;
    nombre_completo: string;
    documento_identidad: string;
    correo: string;
    telefono: string;
    estado: 'activo' | 'bloqueado';
    token_pago: string;
    created_at: Date;
    viajes: Viaje[];
}
