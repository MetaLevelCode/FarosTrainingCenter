// ============================================================
// FAROS — Domain Types
// ============================================================

export type UserRole = 'alumno' | 'entrenador' | 'admin'

export interface FarosUser {
  uid: string
  email: string
  displayName: string
  role: UserRole
  photoURL?: string
  createdAt?: number
  // Alumno-specific
  plan?: 'basico' | 'pro' | 'elite'
  tier?: string
  active?: boolean
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
