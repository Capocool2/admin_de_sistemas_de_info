import { HttpStatus } from '@nestjs/common';
import { TripsService } from './trips.service';
import { StartTripDto } from './dto/start-trip.dto';
import { EndTripDto } from './dto/end-trip.dto';
export declare class TripsController {
    private readonly tripsService;
    constructor(tripsService: TripsService);
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
    getActiveTrip(usuarioId: string): Promise<{
        statusCode: HttpStatus;
        hasActiveTrip: boolean;
        data: import("../database/entities/viaje.entity").Viaje;
    }>;
    forceCancel(viajeId: string): Promise<{
        statusCode: number;
        message: string;
    }>;
    resetDev(): Promise<{
        statusCode: number;
        message: string;
    }>;
    getScooters(): Promise<{
        statusCode: HttpStatus;
        total: any;
        data: any;
    }>;
    getAllTrips(): Promise<{
        statusCode: HttpStatus;
        total: number;
        data: import("../database/entities/viaje.entity").Viaje[];
    }>;
}
