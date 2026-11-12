import { Viaje } from './viaje.entity';
import { Alerta } from './alerta.entity';
export declare class Monopatin {
    id: string;
    numero_serie: string;
    estado: 'disponible' | 'en uso' | 'mantenimiento' | 'bloqueado';
    nivel_bateria: number;
    velocidad_actual: number;
    ubicacion: string;
    updated_at: Date;
    viajes: Viaje[];
    alertas: Alerta[];
}
