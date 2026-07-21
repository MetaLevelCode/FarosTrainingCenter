'use client'

// ============================================================
// FAROS — UI Components (Stitch "Kinetic Performance" aesthetic)
// ============================================================

import { motion, HTMLMotionProps } from 'motion/react'
import { forwardRef, ReactNode, useId } from 'react'

// ── BUTTON ──
type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, fullWidth, children, className = '', disabled, ...props },
  ref,
) {
  const sizes: Record<ButtonSize, string> = {
    sm: 'px-4 py-2 text-[11px]',
    md: 'px-7 py-3.5 text-[12px]',
    lg: 'px-10 py-5 text-[13px]',
  }
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-[var(--color-primary-fixed)] text-[var(--color-on-primary)] hover:shadow-[0_0_35px_rgba(230,255,0,0.5)]',
    outline: 'bg-transparent text-[var(--color-primary-fixed)] border-2 border-[var(--color-primary-fixed)] hover:bg-[rgba(230,255,0,0.08)]',
    ghost: 'bg-white/5 text-[var(--color-on-surface-variant)] border border-white/5 hover:text-[var(--color-primary-fixed)] hover:border-[rgba(230,255,0,0.3)]',
    danger: 'bg-[var(--color-danger-crimson)] text-white hover:opacity-90',
  }

  return (
    <motion.button
      ref={ref}
      disabled={disabled || loading}
      whileTap={{ scale: disabled || loading ? 1 : 0.96 }}
      transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
      className={`
        inline-flex items-center justify-center gap-2
        font-body font-extrabold uppercase tracking-widest
        rounded-2xl cursor-pointer select-none
        transition-[background,box-shadow,border-color,color] duration-300
        disabled:opacity-40 disabled:cursor-not-allowed
        ${sizes[size]} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}
      `}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : children}
    </motion.button>
  )
})

// ── CARD (liquid glass) ──
interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ children, className = '', hover = false, padding = 'md' }: CardProps) {
  const paddings = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-10' }
  return (
    <div className={`liquid-glass rounded-2xl ${paddings[padding]} ${hover ? 'cursor-pointer' : ''} ${className}`}>
      <div className="relative z-10">{children}</div>
    </div>
  )
}

// ── BADGE / DATA CHIP ──
type BadgeVariant = 'default' | 'primary' | 'success' | 'danger'

export function Badge({ children, variant = 'default', className = '' }: {
  children: ReactNode; variant?: BadgeVariant; className?: string
}) {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-white/10 text-[var(--color-on-surface-variant)]',
    primary: 'bg-[var(--color-primary-fixed)] text-black',
    success: 'bg-[rgba(16,185,129,0.15)] text-[var(--color-success-emerald)]',
    danger: 'bg-[rgba(239,68,68,0.15)] text-[var(--color-danger-crimson)]',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full label-caps text-[10px] ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}

// ── INPUT ──
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id: idProp, className = '', ...props }, ref,
) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={id} className="label-caps text-[10px] text-[var(--color-on-surface-variant)]">{label}</label>
      )}
      <input
        ref={ref}
        id={id}
        className={`
          w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4
          text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/30
          focus:border-[rgba(230,255,0,0.5)] focus:outline-none
          transition-colors duration-300
          ${error ? 'border-[var(--color-danger-crimson)]' : ''} ${className}
        `}
        {...props}
      />
      {error && <p className="text-[11px] text-[var(--color-danger-crimson)]">{error}</p>}
    </div>
  )
})

// ── SPINNER ──
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-6 h-6 border-2', lg: 'w-8 h-8 border-[3px]' }
  return (
    <span
      className={`inline-block rounded-full border-white/15 border-t-[var(--color-primary-fixed)] animate-spin ${sizes[size]}`}
      style={{ animationDuration: '0.6s' }}
      role="status"
      aria-label="Cargando"
    />
  )
}

// ── FAROS LOGO (concentric diamond lighthouse) ──
export function FarosLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="Faros">
      <path d="M16 2 L28 11 L28 24 L16 30 L4 24 L4 11 Z" stroke="#e6ff00" strokeWidth="1.5" strokeLinejoin="round" fill="none" opacity="0.35" />
      <path d="M16 6 L25 13 L25 22 L16 27 L7 22 L7 13 Z" stroke="#e6ff00" strokeWidth="1.2" strokeLinejoin="round" fill="none" opacity="0.6" />
      <path d="M16 10 L22 15 L22 21 L16 24 L10 21 L10 15 Z" stroke="#e6ff00" strokeWidth="1" strokeLinejoin="round" fill="none" opacity="0.9" />
      <ellipse cx="16" cy="19" rx="3.5" ry="6" fill="#e6ff00" opacity="0.95" />
      <ellipse cx="16" cy="16" rx="2.5" ry="2.5" fill="#050505" />
    </svg>
  )
}

// ── WORDMARK ──
export function FarosWordmark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const textSize = size === 'sm' ? 'text-base' : 'text-lg'
  return (
    <div className="flex items-center gap-2.5">
      <FarosLogo size={size === 'sm' ? 22 : 28} />
      <span className={`font-display font-extrabold tracking-tighter text-white uppercase ${textSize}`}>
        Faros <span className="text-[var(--color-primary-fixed)]">Training</span>
      </span>
    </div>
  )
}
