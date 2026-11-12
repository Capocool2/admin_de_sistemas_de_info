import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Viaje } from './viaje.entity';

@Entity('pagos')
export class Pago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  viaje_id: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  monto: number;

  @Column({
    type: 'varchar',
    length: 20,
  })
  estado: 'aprobado' | 'pendiente' | 'rechazado';

  @Column({ type: 'varchar', length: 100, unique: true })
  referencia_transaccion: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ManyToOne(() => Viaje, (viaje) => viaje.pagos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'viaje_id' })
  viaje: Viaje;
}
