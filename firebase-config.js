const firebaseConfig = {
    apiKey: "AIzaSyAAvE0Ag4Tx04KayQvlTCYTj4ncCFHl4Fo",
    authDomain: "osync-saas.firebaseapp.com",
    projectId: "osync-saas",
    storageBucket: "osync-saas.firebasestorage.app",
    messagingSenderId: "277448647968",
    appId: "1:277448647968:web:5bb8f05a4f2a15e143e345"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Monitora conexão em tempo real com os servidores do Firebase
db.collection('.info/connected');
function atualizarStatusNuvem(online) {
    const dot = document.getElementById('cloud-dot');
    const label = document.getElementById('cloud-label');
    const container = document.getElementById('cloud-badge');
    if (!container) return;

    if (online && navigator.onLine) {
        container.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-[#00E5B0] border border-[#00E5B0]/30';
        dot.className = 'w-2 h-2 rounded-full bg-[#00E5B0] animate-pulse';
        label.textContent = 'Online';
    } else {
        container.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30';
        dot.className = 'w-2 h-2 rounded-full bg-rose-500';
        label.textContent = 'Offline';
    }
}

window.addEventListener('online', () => atualizarStatusNuvem(true));
window.addEventListener('offline', () => atualizarStatusNuvem(false));
