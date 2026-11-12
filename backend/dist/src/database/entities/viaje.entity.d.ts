import { Usuario } from './usuario.entity';
import { Monopatin } from './monopatin.entity';
import { Pago } from './pago.entity';
export declare class Viaje {
    id: string;
    usuario_id: string;
    monopatin_id: string;
    inicio_viaje: Date;
    fin_viaje: Date;
    duracion_minutos: number;
    costo_total: number;
    foto_evidencia_url: string;
    estado: 'activo' | 'finalizado' | 'cancelado';
    usuario: Usuario;
    monopatin: Monopatin;
    pagos: Pago[];
}
