// ============================================================
// One-off: crea perfiles_publicos/{uid} para cada usuario con
// rol=='profesor' que YA existe hoy. Después de esta corrida, el
// sync queda automático vía POST /api/admin/usuarios/[uid]/rol
// (ver ese archivo) para cualquier cambio de rol futuro.
//
// Uso (Node 20.6+):
//   node --env-file=.env.local scripts/backfill-perfiles-publicos.mjs
//
// Si tu Node es más viejo, exporta FIREBASE_SERVICE_ACCOUNT_KEY a mano
// antes de correr el script (mismo valor que .env.local).
// ============================================================

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
const app = initializeApp(
  key ? { credential: cert(JSON.parse(key)) } : { credential: applicationDefault() },
)
const db = getFirestore(app)

const snap = await db.collection('usuarios').where('rol', '==', 'profesor').get()
console.log(`Encontrados ${snap.size} profesores.`)

let creados = 0
const batch = db.batch()
for (const doc of snap.docs) {
  const u = doc.data()
  batch.set(db.collection('perfiles_publicos').doc(doc.id), {
    nombres: u.nombres ?? '',
    apellidos: u.apellidos ?? '',
    rol: 'profesor',
  })
  creados++
}
if (creados > 0) await batch.commit()

console.log(`perfiles_publicos sincronizados: ${creados}`)
