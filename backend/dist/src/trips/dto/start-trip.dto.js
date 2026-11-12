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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartTripDto = void 0;
const class_validator_1 = require("class-validator");
class StartTripDto {
}
exports.StartTripDto = StartTripDto;
__decorate([
    (0, class_validator_1.IsUUID)('4', { message: 'El usuarioId debe ser un UUID v4 válido' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'El usuarioId es obligatorio' }),
    __metadata("design:type", String)
], StartTripDto.prototype, "usuarioId", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'El scooterId debe ser una cadena de texto' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'El scooterId es obligatorio (ej: SCOOTER-01)' }),
    __metadata("design:type", String)
], StartTripDto.prototype, "scooterId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)({ message: 'forzarCierreAnterior debe ser booleano' }),
    __metadata("design:type", Boolean)
], StartTripDto.prototype, "forzarCierreAnterior", void 0);
//# sourceMappingURL=start-trip.dto.js.map