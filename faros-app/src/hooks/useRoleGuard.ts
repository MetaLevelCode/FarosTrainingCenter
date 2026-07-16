'use client'

// ============================================================
// FAROS — Role Guard Hook
// Redirects unauthenticated users to /login and wrong-role
// users to their own home.
// ============================================================

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import type { UserRole } from '@/lib/types'

const ROLE_HOME: Record<UserRole, string> = {
  alumno: '/dashboard',
  entrenador: '/portal',
  admin: '/admin',
}

export function useRoleGuard(allowed: UserRole[]) {
  const { user, loading } = useAuth()
  const router = useRouter()

  // Serialize the array so the effect only re-runs when the
  // actual allowed roles change — not on every render (which
  // caused an infinite redirect loop).
  const allowedKey = allowed.join(',')

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
    } else if (!allowedKey.split(',').includes(user.role)) {
      router.replace(ROLE_HOME[user.role])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, allowedKey, router])

  return {
    user,
    loading,
    authorized: !!user && allowedKey.split(',').includes(user.role),
  }
}
