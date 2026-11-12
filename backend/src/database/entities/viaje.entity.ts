import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { Monopatin } from './monopatin.entity';
import { Pago } from './pago.entity';

@Entity('viajes')
export class Viaje {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  usuario_id: string;

  @Column({ type: 'varchar', length: 50 })
  monopatin_id: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  inicio_viaje: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  fin_viaje: Date;

  @Column({ type: 'int', nullable: true })
  duracion_minutos: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  costo_total: number;

  @Column({ type: 'text', nullable: true })
  foto_evidencia_url: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'activo',
  })
  estado: 'activo' | 'finalizado' | 'cancelado';

  @ManyToOne(() => Usuario, (usuario) => usuario.viajes, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @ManyToOne(() => Monopatin, (monopatin) => monopatin.viajes, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'monopatin_id' })
  monopatin: Monopatin;

  @OneToMany(() => Pago, (pago) => pago.viaje)
  pagos: Pago[];
}
