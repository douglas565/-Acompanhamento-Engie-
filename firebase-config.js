// ⚠️ SUBSTITUA PELA SUA CONFIGURAÇÃO DO FIREBASE
// Copie as informações do seu projeto Firebase aqui!

const firebaseConfig = {
 apiKey: process.env.FIREBASE_API_KEY || "sua_api_key_aqui",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "acompanhamento-de-product.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "acompanhamento-de-product",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "acompanhamento-de-product.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "555489855578",
  appId: process.env.FIREBASE_APP_ID || "1:555489855578:web:7f6aa79f5984fca45e7063"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Inicializar serviços
const auth = firebase.auth();
const db = firebase.firestore();

// Configurar persistência
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Configurações do Firestore
db.settings({
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});

// Habilitar cache offline
db.enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn('Múltiplas abas abertas, cache desabilitado');
    } else if (err.code == 'unimplemented') {
      console.warn('Navegador não suporta cache offline');
    }
  });

// Configurações globais
const COLLECTIONS = {
  USERS: 'users',
  PRODUCTIONS: 'productions'
};

// Estado da aplicação
let currentUser = null;
let currentUserData = null;
let allProductions = [];
let allUsers = [];
let charts = {};

console.log('🔥 Firebase configurado e inicializado!');