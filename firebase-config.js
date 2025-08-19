// ⚠️ SUBSTITUA PELA SUA CONFIGURAÇÃO DO FIREBASE
// Copie as informações do seu projeto Firebase aqui!

const firebaseConfig = {
  apiKey: "AIzaSyDWyV39MzgpvJz4y61HgfO2AeKjoXg2IrE",
  authDomain: "acompanhamento-de-product.firebaseapp.com",
  projectId: "acompanhamento-de-product",
  storageBucket: "acompanhamento-de-product.firebasestorage.app",
  messagingSenderId: "555489855578",
  appId: "1:555489855578:web:7f6aa79f5984fca45e7063"
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
