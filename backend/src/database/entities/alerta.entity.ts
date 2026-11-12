import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Monopatin } from './monopatin.entity';

@Entity('alertas')
export class Alerta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  monopatin_id: string;

  @Column({
    type: 'varchar',
    length: 30,
  })
  tipo_alerta: 'bateria_baja' | 'caida' | 'robo' | 'fuera_perimetro';

  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  ubicacion: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pendiente',
  })
  estado: 'pendiente' | 'atendida';

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ManyToOne(() => Monopatin, (monopatin) => monopatin.alertas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'monopatin_id' })
  monopatin: Monopatin;
}
