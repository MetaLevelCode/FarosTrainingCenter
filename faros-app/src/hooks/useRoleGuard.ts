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
  estudiante: '/dashboard',
  profesor: '/portal',
  admin: '/admin',
}

export function useRoleGuard(allowed: UserRole[]) {
  const { user, loading } = useAuth()
  const router = useRouter()

  const allowedKey = allowed.join(',')

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
    } else if (!allowedKey.split(',').includes(user.rol)) {
      router.replace(ROLE_HOME[user.rol])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, allowedKey, router])

  return {
    user,
    loading,
    authorized: !!user && allowedKey.split(',').includes(user.rol),
  }
}
