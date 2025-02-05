import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js'
import { getDatabase } from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js'

const firebaseConfig = {
  apiKey: 'AIzaSyDijkIIuVzWQWk6VSkXmexrnR_Ldjro',
  authDomain: 'booking-database-86230.firebaseapp.com',
  databaseURL: 'https://booking-database-86230-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'booking-database-86230',
  storageBucket: 'booking-database-86230.appspot.com',
  messagingSenderId: '891604763798',
  appId: '1:891604763798:web:a27d3bf90c0e60563caeb7',
  measurementId: 'G-YVFPZ8RJGE',
}

const app = initializeApp(firebaseConfig)
const database = getDatabase(app)

export { app, database }
