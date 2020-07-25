const admin = require('firebase-admin')
require('dotenv/config')

admin.initializeApp({
    databaseURL: process.env.DATABASE_URL, // nome do database
    storageBucket: process.env.STORAGE_BUCKET // nome do bucket onde vai ficar salvo as fotos
});

// database do firebase
const db = admin.firestore()

module.exports = {admin, db}