import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Viaje } from './viaje.entity';
import { Alerta } from './alerta.entity';

@Entity('monopatines')
export class Monopatin {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string; // Ej: 'SCOOTER-01'

  @Column({ type: 'varchar', length: 100, unique: true })
  numero_serie: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'disponible',
  })
  estado: 'disponible' | 'en uso' | 'mantenimiento' | 'bloqueado';

  @Column({ type: 'int', default: 100 })
  nivel_bateria: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0.0,
  })
  velocidad_actual: number;

  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  ubicacion: string;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @OneToMany(() => Viaje, (viaje) => viaje.monopatin)
  viajes: Viaje[];

  @OneToMany(() => Alerta, (alerta) => alerta.monopatin)
  alertas: Alerta[];
}
