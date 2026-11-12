"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TripsController = void 0;
const common_1 = require("@nestjs/common");
const trips_service_1 = require("./trips.service");
const start_trip_dto_1 = require("./dto/start-trip.dto");
const end_trip_dto_1 = require("./dto/end-trip.dto");
let TripsController = class TripsController {
    constructor(tripsService) {
        this.tripsService = tripsService;
    }
    async startTrip(dto) {
        return this.tripsService.startTrip(dto);
    }
    async endTrip(dto) {
        return this.tripsService.endTrip(dto);
    }
    async getActiveTrip(usuarioId) {
        const trip = await this.tripsService.getActiveTripByUserId(usuarioId);
        return {
            statusCode: common_1.HttpStatus.OK,
            hasActiveTrip: !!trip,
            data: trip || null,
        };
    }
    async forceCancel(viajeId) {
        return this.tripsService.forceCancelTrip(viajeId);
    }
    async resetDev() {
        return this.tripsService.resetDevState();
    }
    async getScooters() {
        const scooters = await this.tripsService.getAllScooters();
        return {
            statusCode: common_1.HttpStatus.OK,
            total: scooters.length,
            data: scooters,
        };
    }
    async getAllTrips() {
        const trips = await this.tripsService.getAllTrips();
        return {
            statusCode: common_1.HttpStatus.OK,
            total: trips.length,
            data: trips,
        };
    }
};
exports.TripsController = TripsController;
__decorate([
    (0, common_1.Post)('start'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [start_trip_dto_1.StartTripDto]),
    __metadata("design:returntype", Promise)
], TripsController.prototype, "startTrip", null);
__decorate([
    (0, common_1.Post)('end'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [end_trip_dto_1.EndTripDto]),
    __metadata("design:returntype", Promise)
], TripsController.prototype, "endTrip", null);
__decorate([
    (0, common_1.Get)('active/:usuarioId'),
    __param(0, (0, common_1.Param)('usuarioId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TripsController.prototype, "getActiveTrip", null);
__decorate([
    (0, common_1.Post)('force-cancel/:viajeId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('viajeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TripsController.prototype, "forceCancel", null);
__decorate([
    (0, common_1.Post)('reset-dev'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TripsController.prototype, "resetDev", null);
__decorate([
    (0, common_1.Get)('scooters'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TripsController.prototype, "getScooters", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TripsController.prototype, "getAllTrips", null);
exports.TripsController = TripsController = __decorate([
    (0, common_1.Controller)('api/trips'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    __metadata("design:paramtypes", [trips_service_1.TripsService])
], TripsController);
//# sourceMappingURL=trips.controller.js.map