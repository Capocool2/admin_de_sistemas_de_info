import { Monopatin } from './monopatin.entity';
export declare class Alerta {
    id: string;
    monopatin_id: string;
    tipo_alerta: 'bateria_baja' | 'caida' | 'robo' | 'fuera_perimetro';
    ubicacion: string;
    estado: 'pendiente' | 'atendida';
    created_at: Date;
    monopatin: Monopatin;
}
