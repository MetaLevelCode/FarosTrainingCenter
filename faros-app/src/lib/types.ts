// ============================================================
// FAROS — Domain Types
// ============================================================

import type { PlanAsignado } from './planes'

export type UserRole = 'alumno' | 'entrenador' | 'admin'

export type TipoDocumento = 'CC' | 'TI' | 'CE'

export interface ContactoEmergencia {
  nombre: string
  parentesco: string
  telefono: string
}

export interface FarosUser {
  uid: string
  email: string
  displayName: string
  role: UserRole
  photoURL?: string
  createdAt?: number
  // Alumno-specific — el plan contratado real (ver lib/planes.ts).
  // Reemplaza los antiguos `plan: 'basico'|'pro'|'elite'` y `tier`,
  // que no correspondían al sistema de planes del club.
  planActivo?: PlanAsignado
  active?: boolean
  // Datos personales — estándar Colombia
  tipoDocumento?: TipoDocumento
  documento?: string
  fechaNacimiento?: string
  genero?: string
  telefono?: string
  ciudad?: string
  departamento?: string
  // Salud y seguridad
  eps?: string
  rh?: string
  contactoEmergencia?: ContactoEmergencia
}

export interface TrainingPlan {
  id: string
  title: string
  type: 'grupal' | 'personal'
  coachId: string
  coachName: string
  day: string
  time: string
  capacity: number
  enrolled: number
  active: boolean
  description?: string
}

export interface Attendance {
  id: string
  userId: string
  classId: string
  date: number
  status: 'present' | 'absent' | 'cancelled' | 'pending'
}

export interface RankingEntry {
  userId: string
  displayName: string
  attendances: number
  rating: number
  points: number
  position: number
}

export interface Transaction {
  id: string
  userId: string
  userName: string
  plan: string
  amount: number
  type: 'income' | 'expense'
  status: 'pending' | 'approved'
  date: number
}
