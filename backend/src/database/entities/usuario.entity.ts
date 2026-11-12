import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Viaje } from './viaje.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  nombre_completo: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  documento_identidad: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  correo: string;

  @Column({ type: 'varchar', length: 20 })
  telefono: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'activo',
  })
  estado: 'activo' | 'bloqueado';

  @Column({ type: 'varchar', length: 100, nullable: true })
  token_pago: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @OneToMany(() => Viaje, (viaje) => viaje.usuario)
  viajes: Viaje[];
}
