const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

console.log('--- Firestore Local Connection Test ---');

try {
    // Attempt using Application Default Credentials (from .env/GOOGLE_APPLICATION_CREDENTIALS)
    console.log('Using Application Default Credentials...');
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'robbit-ramadan'
    });

    const db = admin.firestore();
    console.log('Attempting to fetch "settings/ramadan" doc...');

    db.collection('settings').doc('ramadan').get()
        .then(doc => {
            if (doc.exists) {
                console.log('✅ Connection Successful!');
                console.log('Data:', doc.data());
            } else {
                console.log('✅ Connected, but document not found.');
            }
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Firestore Error:', err.message);
            console.error('Stack:', err.stack);
            process.exit(1);
        });

} catch (e) {
    console.error('❌ Script Error:', e.message);
    process.exit(1);
}
