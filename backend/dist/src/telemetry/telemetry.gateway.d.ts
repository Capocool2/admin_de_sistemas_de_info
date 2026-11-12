import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DataSource } from 'typeorm';
import { TelemetryUpdateDto } from './dto/telemetry-update.dto';
export declare class TelemetryGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly dataSource;
    server: Server;
    private readonly logger;
    constructor(dataSource: DataSource);
    afterInit(): void;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleJoinRoom(client: Socket, payload: {
        room: string;
        scooterId?: string;
    }): {
        status: string;
        joined: string;
    };
    handleTelemetryUpdate(client: Socket, data: TelemetryUpdateDto): Promise<{
        status: string;
        zone: string;
        message?: undefined;
    } | {
        status: string;
        message: any;
        zone?: undefined;
    }>;
    sendUnlockCommand(scooterId: string): void;
    sendLockCommand(scooterId: string): void;
    sendEmergencyStop(scooterId: string, reason: string): void;
}
