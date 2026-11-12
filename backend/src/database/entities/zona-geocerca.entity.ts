import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('zonas_geocercas')
export class ZonaGeocerca {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  tipo: 'normal' | 'peatonal' | 'parqueo' | 'prohibida';

  @Column({ type: 'int', default: 20 })
  limite_velocidad: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 500.0,
  })
  tarifa_minuto: number;

  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Polygon',
    srid: 4326,
  })
  poligono: string;
}
