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
exports.Monopatin = void 0;
const typeorm_1 = require("typeorm");
const viaje_entity_1 = require("./viaje.entity");
const alerta_entity_1 = require("./alerta.entity");
let Monopatin = class Monopatin {
};
exports.Monopatin = Monopatin;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], Monopatin.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, unique: true }),
    __metadata("design:type", String)
], Monopatin.prototype, "numero_serie", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: 'disponible',
    }),
    __metadata("design:type", String)
], Monopatin.prototype, "estado", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 100 }),
    __metadata("design:type", Number)
], Monopatin.prototype, "nivel_bateria", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'numeric',
        precision: 5,
        scale: 2,
        default: 0.0,
    }),
    __metadata("design:type", Number)
], Monopatin.prototype, "velocidad_actual", void 0);
__decorate([
    (0, typeorm_1.Index)({ spatial: true }),
    (0, typeorm_1.Column)({
        type: 'geometry',
        spatialFeatureType: 'Point',
        srid: 4326,
        nullable: true,
    }),
    __metadata("design:type", String)
], Monopatin.prototype, "ubicacion", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamp with time zone' }),
    __metadata("design:type", Date)
], Monopatin.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => viaje_entity_1.Viaje, (viaje) => viaje.monopatin),
    __metadata("design:type", Array)
], Monopatin.prototype, "viajes", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => alerta_entity_1.Alerta, (alerta) => alerta.monopatin),
    __metadata("design:type", Array)
], Monopatin.prototype, "alertas", void 0);
exports.Monopatin = Monopatin = __decorate([
    (0, typeorm_1.Entity)('monopatines')
], Monopatin);
//# sourceMappingURL=monopatin.entity.js.map