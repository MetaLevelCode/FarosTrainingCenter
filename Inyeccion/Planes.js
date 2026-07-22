import { initializeApp } from "firebase/app"

import { getFirestore, collection, addDoc, Timestamp } from "firebase/firestore"


// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
apiKey: "AIzaSyDjNKDQYfoDs7pggy9BRvff3r7uke-2jGM",
authDomain: "faros-training-center.firebaseapp.com",
projectId: "faros-training-center",
storageBucket: "faros-training-center.firebasestorage.app",
messagingSenderId: "951817703141",
appId: "1:951817703141:web:0d714a4c94c862fc10ce0c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app)

async function inyectarDatos (){
    try{
        console.log("Ey mama huevo estamos creando datos");

        //Ahora somos programadores de verdad, asi que ahora documentamos el codigo 
        // Insertar clase 

        const docRef = await addDoc(collection(db, "usuarios"), {
            Nombre: "Clase de mariposa",
            EntrenadorId: "od0SAbL1GnyQR9Nqf5wK",
            EntrenadorNombre: "Juancho",
            Fecha: Timestamp.fromDate(new Date("2026-06-15T08:00:00")),
            CupoMaximo: 20,
            CuposDisponibles: 20,
            Observaciones: "",
            Asistentes: []
    });

    console.log("Papi coronamos, se inyectaron los datos")
}
   catch (error) {
        console.
        error("Hubo un error inyectando los datos: ", error);
      }
    }


inyectarDatos() 