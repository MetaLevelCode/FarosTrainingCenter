// ============================================================
// FAROS — Plan Virtual: link de video → URL embebible
// El video vive fuera de Firebase (YouTube/Vimeo) — el coach solo pega
// el link normal (watch?v=, youtu.be, vimeo.com/ID); esto lo convierte
// al formato /embed/ que sirve para un <iframe>. Devuelve null si no
// reconoce el dominio — el llamador debe mostrar un link normal en ese caso.
// ============================================================

export function embedUrlFromVideoUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')

    if (host === 'youtu.be') {
      const id = u.pathname.slice(1)
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (host === 'youtube.com') {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v')
        return id ? `https://www.youtube.com/embed/${id}` : null
      }
      if (u.pathname.startsWith('/embed/')) return url
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/')[2]
        return id ? `https://www.youtube.com/embed/${id}` : null
      }
      return null
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null
    }
    if (host === 'player.vimeo.com') return url

    return null
  } catch {
    return null
  }
}
