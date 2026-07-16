'use client'

// ============================================================
// FAROS — Water Caustic Background (performance-hardened + fallback safe)
// - Renders at capped resolution (max 1x DPR, max 1280px wide)
// - 30fps throttled loop, low-power GPU hint
// - Guaranteed dark background fallback if WebGL fails
// ============================================================

import { useEffect, useRef } from 'react'

const VERTEX = `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`

const FRAGMENT = `precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

float caustic(vec2 p, float t) {
  float v = 0.0;
  v += sin(p.x * 2.1 + t * 0.38) * cos(p.y * 1.9 + t * 0.29);
  v += sin(p.x * 1.4 + p.y * 1.7 + t * 0.31) * 0.7;
  v += sin((p.x - p.y) * 2.8 + t * 0.47) * cos(p.x * 0.9 + t * 0.19) * 0.5;
  v += sin(p.x * 3.7 + t * 0.22) * cos(p.y * 3.1 + t * 0.35) * 0.3;
  v += sin(length(p) * 4.0 - t * 0.6) * 0.2;
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 mouse = u_mouse / u_resolution;
  float t = u_time;
  vec2 p = (uv - 0.5) * 3.5;

  float mdist = distance(uv, mouse);
  float ripple = sin(mdist * 22.0 - t * 4.5) * smoothstep(0.35, 0.0, mdist) * 0.18;
  p += normalize(uv - mouse + 0.001) * ripple;

  float c1 = caustic(p * 1.0, t);
  float c2 = caustic(p * 1.8 + vec2(1.7, 2.3), t * 1.15);
  float combined = (c1 + c2) * 0.5;
  float highlight = pow(clamp(combined * 0.5 + 0.5, 0.0, 1.0), 4.0);

  vec3 base = vec3(0.018, 0.019, 0.024);
  vec3 yellow = vec3(0.902, 1.0, 0.0);
  float vignette = 1.0 - length(uv - 0.5) * 0.8;
  vec3 color = base + yellow * highlight * 0.055 * vignette;

  gl_FragColor = vec4(color, 1.0);
}`

const MAX_RENDER_WIDTH = 1280
const TARGET_FPS = 30

export function WaterBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const gl = canvas.getContext('webgl', {
      powerPreference: 'low-power',
      antialias: false,
      depth: false,
      stencil: false,
      alpha: false,
    }) as WebGLRenderingContext | null

    if (!gl) {
      // Fallback: WebGL not available, just keep the solid background.
      // The container div will provide the dark color.
      return
    }

    let destroyed = false
    let raf = 0

    function syncSize() {
      const cw = canvas!.clientWidth || 1280
      const ch = canvas!.clientHeight || 720
      const scale = Math.min(1, MAX_RENDER_WIDTH / cw)
      const w = Math.round(cw * scale)
      const h = Math.round(ch * scale)
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w
        canvas!.height = h
      }
    }

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(syncSize)
      ro.observe(canvas)
    }
    syncSize()

    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!
      gl!.shaderSource(s, src)
      gl!.compileShader(s)
      return s
    }

    let prog: WebGLProgram | null = null
    let uTime: WebGLUniformLocation | null = null
    let uRes: WebGLUniformLocation | null = null
    let uMouse: WebGLUniformLocation | null = null

    function setupProgram() {
      prog = gl!.createProgram()!
      gl!.attachShader(prog, compile(gl!.VERTEX_SHADER, VERTEX))
      gl!.attachShader(prog, compile(gl!.FRAGMENT_SHADER, FRAGMENT))
      gl!.linkProgram(prog)
      gl!.useProgram(prog)

      const buf = gl!.createBuffer()
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buf)
      gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl!.STATIC_DRAW)
      const pos = gl!.getAttribLocation(prog, 'a_position')
      gl!.enableVertexAttribArray(pos)
      gl!.vertexAttribPointer(pos, 2, gl!.FLOAT, false, 0, 0)

      uTime = gl!.getUniformLocation(prog, 'u_time')
      uRes = gl!.getUniformLocation(prog, 'u_resolution')
      uMouse = gl!.getUniformLocation(prog, 'u_mouse')
    }
    setupProgram()

    const mouse = { x: canvas.width / 2, y: canvas.height / 2 }
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width && rect.height) {
        mouse.x = ((e.clientX - rect.left) / rect.width) * canvas.width
        mouse.y = (1 - (e.clientY - rect.top) / rect.height) * canvas.height
      }
    }
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (finePointer && !reduced) {
      window.addEventListener('mousemove', onMove, { passive: true })
    }

    const onLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf) }
    const onRestored = () => { if (!destroyed) { setupProgram(); loop(performance.now()) } }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)

    const frameInterval = 1000 / TARGET_FPS
    let lastFrame = 0
    let running = true

    function draw(t: number) {
      gl!.viewport(0, 0, canvas!.width, canvas!.height)
      if (uTime) gl!.uniform1f(uTime, t * 0.001)
      if (uRes) gl!.uniform2f(uRes, canvas!.width, canvas!.height)
      if (uMouse) gl!.uniform2f(uMouse, mouse.x, mouse.y)
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
    }

    function loop(t: number) {
      if (!running || destroyed) return
      if (t - lastFrame >= frameInterval) {
        lastFrame = t
        draw(t)
      }
      raf = requestAnimationFrame(loop)
    }

    if (reduced) {
      draw(0)
    } else {
      raf = requestAnimationFrame(loop)
    }

    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!running && !reduced) {
        running = true
        lastFrame = 0
        raf = requestAnimationFrame(loop)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      destroyed = true
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      ro?.disconnect()
      const ext = gl.getExtension('WEBGL_lose_context')
      ext?.loseContext()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 -z-10"
      style={{
        backgroundColor: '#050505',
        backgroundImage:
          'radial-gradient(circle at center, rgba(14,14,20,0.5) 0%, rgba(5,5,5,1) 100%)',
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          imageRendering: 'auto',
          // Fallback: ensure canvas always has dark background
          backgroundColor: '#050505',
        }}
      />
    </div>
  )
}
