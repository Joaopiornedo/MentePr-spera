// ═══════════════════════════════════════════════════════════════
//  FIREBASE CONFIG — Calculadora da Virada
//  ↓ SUBSTITUI estes valores pelos do teu projecto Firebase ↓
//  Console: https://console.firebase.google.com
//  Projecto → Configurações → Apps Web → firebaseConfig
// ═══════════════════════════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey:            "SUBSTITUI_AQUI",
  authDomain:        "SUBSTITUI_AQUI.firebaseapp.com",
  projectId:         "SUBSTITUI_AQUI",
  storageBucket:     "SUBSTITUI_AQUI.appspot.com",
  messagingSenderId: "SUBSTITUI_AQUI",
  appId:             "SUBSTITUI_AQUI"
};

// Regras Firestore recomendadas (cola no console Firebase → Firestore → Regras):
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Cada utilizador só lê/escreve os seus próprios dados
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
*/
