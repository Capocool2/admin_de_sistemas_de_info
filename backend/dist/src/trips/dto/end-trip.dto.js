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
exports.EndTripDto = void 0;
const class_validator_1 = require("class-validator");
class EndTripDto {
}
exports.EndTripDto = EndTripDto;
__decorate([
    (0, class_validator_1.IsUUID)('4', { message: 'El viajeId debe ser un UUID v4 válido' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'El viajeId es obligatorio' }),
    __metadata("design:type", String)
], EndTripDto.prototype, "viajeId", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'La URL de la foto de evidencia debe ser una cadena válida' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'La foto de evidencia es obligatoria para validar el parqueo adecuado' }),
    __metadata("design:type", String)
], EndTripDto.prototype, "fotoEvidenciaUrl", void 0);
//# sourceMappingURL=end-trip.dto.js.map