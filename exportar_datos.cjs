const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

// 1. Carga tus credenciales (Asegúrate de tener el serviceAccountKey.json en la misma carpeta)
const serviceAccount = require('./serviceAccountKey.json');

// 2. Inicializa la app con el formato modular nuevo
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// Formatea tipos de datos específicos de Firebase para que sean legibles en texto
function formatearValor(value) {
  if (typeof value === 'object' && value !== null) {
    if (value._seconds) { // Timestamps
      return new Date(value._seconds * 1000).toISOString();
    } else if (value._latitude) { // GeoPoints
      return `[GeoPoint: Lat ${value._latitude}, Lng ${value._longitude}]`;
    } else if (value._path) { // Referencias a otros documentos
      return `[Referencia: ${value._path.segments.join('/')}]`;
    }
    return JSON.stringify(value);
  }
  return value;
}

// Función recursiva para navegar colecciones y subcolecciones
async function exportarColeccion(collectionRef, nivelIndentacion) {
  let texto = '';
  const indent = ' '.repeat(nivelIndentacion * 2);
  
  texto += `\n${indent}📦 COLECCIÓN: ${collectionRef.id}\n`;
  texto += `${indent}${'='.repeat(40)}\n`;

  const snapshot = await collectionRef.get();

  if (snapshot.empty) {
    texto += `${indent}  (Vacía)\n`;
    return texto;
  }

  for (const doc of snapshot.docs) {
    texto += `\n${indent}  📄 DOCUMENTO: ${doc.id}\n`;
    const data = doc.data();

    // Extraer campos del documento
    for (const [key, value] of Object.entries(data)) {
      texto += `${indent}    - ${key}: ${formatearValor(value)}\n`;
    }

    // Buscar subcolecciones dentro de este documento
    const subcolecciones = await doc.ref.listCollections();
    for (const subCol of subcolecciones) {
      texto += await exportarColeccion(subCol, nivelIndentacion + 2);
    }
  }
  
  return texto;
}

async function extraerTodaLaBaseDeDatos() {
  console.log('Iniciando rastreo completo de la base de datos...');
  let textoFinal = '=== ESTRUCTURA COMPLETA DE FIRESTORE ===\n';
  
  // Obtener todas las colecciones raíz (el nivel principal)
  const coleccionesRaiz = await db.listCollections();
  
  for (const coleccion of coleccionesRaiz) {
    console.log(`Leyendo colección: ${coleccion.id}...`);
    textoFinal += await exportarColeccion(coleccion, 0);
  }

  // Guardar el bloque de texto completo
  fs.writeFileSync('base_de_datos_completa.txt', textoFinal);
  console.log('\n¡Extracción terminada! Todo quedó en el archivo: base_de_datos_completa.txt');
}

extraerTodaLaBaseDeDatos();