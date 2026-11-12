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
exports.Alerta = void 0;
const typeorm_1 = require("typeorm");
const monopatin_entity_1 = require("./monopatin.entity");
let Alerta = class Alerta {
};
exports.Alerta = Alerta;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Alerta.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], Alerta.prototype, "monopatin_id", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 30,
    }),
    __metadata("design:type", String)
], Alerta.prototype, "tipo_alerta", void 0);
__decorate([
    (0, typeorm_1.Index)({ spatial: true }),
    (0, typeorm_1.Column)({
        type: 'geometry',
        spatialFeatureType: 'Point',
        srid: 4326,
        nullable: true,
    }),
    __metadata("design:type", String)
], Alerta.prototype, "ubicacion", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: 'pendiente',
    }),
    __metadata("design:type", String)
], Alerta.prototype, "estado", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamp with time zone' }),
    __metadata("design:type", Date)
], Alerta.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => monopatin_entity_1.Monopatin, (monopatin) => monopatin.alertas, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'monopatin_id' }),
    __metadata("design:type", monopatin_entity_1.Monopatin)
], Alerta.prototype, "monopatin", void 0);
exports.Alerta = Alerta = __decorate([
    (0, typeorm_1.Entity)('alertas')
], Alerta);
//# sourceMappingURL=alerta.entity.js.map