'use client'

// ============================================================
// FAROS — Root redirect
// Sends users to their role home, or to login if unauthenticated.
// ============================================================

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner, FarosLogo } from '@/components/ui'

const ROLE_HOME: Record<string, string> = {
  alumno: '/dashboard',
  entrenador: '/portal',
  admin: '/admin',
}

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (user) router.replace(ROLE_HOME[user.role] ?? '/dashboard')
    else router.replace('/login')
  }, [user, loading, router])

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6" style={{ background: '#050505' }}>
      <FarosLogo size={48} />
      <Spinner size="lg" />
    </div>
  )
}
