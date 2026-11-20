// backend/src/database/entities/usuario.entity.ts
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
    length: 30,
    default: 'pendiente_verificacion',
  })
  estado: 'pendiente_verificacion' | 'activo' | 'dado_de_baja' | 'bloqueado';

  @Column({
    type: 'varchar',
    length: 20,
    default: 'turista',
  })
  rol: 'turista' | 'admin';

  @Column({ type: 'varchar', length: 255, select: false })
  password_hash: string;

  @Column({ type: 'boolean', default: false })
  email_verificado: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  codigo_verificacion: string | null;

  @Column({ type: 'timestamp', nullable: true })
  codigo_expira_en: Date | null;

  @Column({ type: 'int', default: 0 })
  infracciones_perimetro: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  token_pago: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @OneToMany(() => Viaje, (viaje) => viaje.usuario)
  viajes: Viaje[];
}
