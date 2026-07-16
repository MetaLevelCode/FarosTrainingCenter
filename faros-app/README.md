# Faros Training — PWA

Plataforma de entrenamiento de natación de élite. Next.js 15 + Firebase + Motion.

## Correr localmente

```bash
npm install
npm run dev
```

Abre http://localhost:3000

**Sin configurar Firebase, la app corre en MODO DEMO** con estos usuarios:

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| Alumno | alumno@faros.com | 123456 |
| Entrenador | entrenador@faros.com | 123456 |
| Admin | admin@faros.com | 123456 |

## Conectar Firebase (cuando estés listo)

1. Crea un proyecto en https://console.firebase.google.com
2. Activa **Authentication** → método Email/Password
3. Crea una base **Firestore** en modo producción
4. Copia `.env.local.example` a `.env.local` y pega tus credenciales
   (Project Settings → General → Your apps → SDK setup)
5. En Firestore, crea la colección `users`. Cada documento (ID = uid del usuario)
   debe tener al menos: `{ displayName, email, role }`
   donde `role` es `"alumno"`, `"entrenador"` o `"admin"`

En cuanto haya API key en `.env.local`, la app deja el modo demo y usa Firebase real.

## Estructura

```
src/
├── app/                    # Rutas (App Router)
│   ├── login/              # Inicio de sesión
│   ├── dashboard/          # Vista Alumno
│   ├── portal/             # Vista Entrenador
│   └── admin/              # Vista Admin
├── components/
│   ├── ui/                 # Botones, cards, inputs (estética Stitch)
│   ├── layout/AppShell     # Shell con FAB de navegación por rol
│   └── shared/             # WaterBackground (shader), SW register
├── contexts/AuthContext    # Auth Firebase + modo mock
├── hooks/useRoleGuard      # Protección de rutas por rol
└── lib/                    # firebase.ts, types.ts
```

## Diseño

Sistema "Kinetic Performance" de Stitch: negro obsidiana `#050505` + amarillo eléctrico
`#e6ff00`, Montserrat (display) + Hanken Grotesk (body). Shader de agua caustica de fondo,
liquid-glass en cards, animaciones con curvas de Emil Kowalski.
