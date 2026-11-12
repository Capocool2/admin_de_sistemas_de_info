import { Repository, DataSource } from 'typeorm';
import { Viaje } from '../database/entities/viaje.entity';
import { Monopatin } from '../database/entities/monopatin.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { Pago } from '../database/entities/pago.entity';
import { Alerta } from '../database/entities/alerta.entity';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';
import { StartTripDto } from './dto/start-trip.dto';
import { EndTripDto } from './dto/end-trip.dto';
export declare class TripsService {
    private readonly viajeRepo;
    private readonly monopatinRepo;
    private readonly usuarioRepo;
    private readonly pagoRepo;
    private readonly alertaRepo;
    private readonly dataSource;
    private readonly telemetryGateway;
    private readonly logger;
    private readonly DEFAULT_RATE_PER_MINUTE;
    constructor(viajeRepo: Repository<Viaje>, monopatinRepo: Repository<Monopatin>, usuarioRepo: Repository<Usuario>, pagoRepo: Repository<Pago>, alertaRepo: Repository<Alerta>, dataSource: DataSource, telemetryGateway: TelemetryGateway);
    startTrip(dto: StartTripDto): Promise<{
        statusCode: number;
        message: string;
        data: {
            viajeId: any;
            scooterId: string;
            inicioViaje: any;
            tarifaMinutoCOP: number;
            estado: any;
        };
    }>;
    endTrip(dto: EndTripDto): Promise<{
        statusCode: number;
        message: string;
        data: {
            viajeId: string;
            scooterId: string;
            estacionParqueo: string;
            inicioViaje: Date;
            finViaje: Date;
            duracionMinutos: number;
            tarifaMinutoCOP: number;
            costoTotalCOP: number;
            pago: {
                id: any;
                referencia: any;
                estado: any;
                monto: any;
            };
            scooterEstadoActual: any;
        };
    }>;
    getActiveTripByUserId(usuarioId: string): Promise<Viaje>;
    forceCancelTrip(viajeId: string): Promise<{
        statusCode: number;
        message: string;
    }>;
    resetDevState(): Promise<{
        statusCode: number;
        message: string;
    }>;
    getAllScooters(): Promise<any>;
    getAllTrips(): Promise<Viaje[]>;
}
