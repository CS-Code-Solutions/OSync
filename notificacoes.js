const OSYNC_VAPID_KEY = 'BCwSWdvi1ygplErUgFDcqfFCK1gh6g-JSo2of6mU-HQxYX67SKiO8lcHVU9Eg4s-GTfMFZZ9_DcLsoy8jUjYWLY';
let messagingOSync = null;
let listenerForegroundRegistrado = false;
let unsubscribeNotificacoesRT = null;
let eventosNotificadosCache = new Set();

function jaNotificouEventoOSync(chave) {
    if (!chave) return false;
    if (eventosNotificadosCache.has(chave)) return true;
    eventosNotificadosCache.add(chave);
    if (eventosNotificadosCache.size > 100) {
        const primeiro = eventosNotificadosCache.values().next().value;
        eventosNotificadosCache.delete(primeiro);
    }
    return false;
}

function tocarSomNotificacaoOSync() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const agora = ctx.currentTime;

        [880, 1174.66].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, agora + i * 0.12);
            gain.gain.setValueAtTime(0.001, agora + i * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.25, agora + i * 0.12 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, agora + i * 0.12 + 0.25);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(agora + i * 0.12);
            osc.stop(agora + i * 0.12 + 0.26);
        });
    } catch (_) {}
}

function atualizarBotaoNotificacoesUI() {
    const btn = document.getElementById('btn-notificacoes-push');
    const icone = document.getElementById('icon-notificacoes-push');
    if (!btn) return;

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        btn.classList.add('hidden');
        return;
    }

    btn.classList.remove('hidden');
    if (Notification.permission === 'granted') {
        btn.title = 'Notificações Ativas neste Aparelho';
        btn.className = 'p-2 rounded-lg text-[#00E5B0] hover:bg-emerald-500/10 transition relative';
        if (icone) icone.setAttribute('data-lucide', 'bell-ring');
    } else if (Notification.permission === 'denied') {
        btn.title = 'Notificações Bloqueadas no Navegador';
        btn.className = 'p-2 rounded-lg text-slate-500 hover:bg-slate-800 transition relative';
        if (icone) icone.setAttribute('data-lucide', 'bell-off');
    } else {
        btn.title = 'Ativar Notificações no Celular';
        btn.className = 'p-2 rounded-lg text-amber-400 hover:bg-amber-500/10 transition relative animate-pulse';
        if (icone) icone.setAttribute('data-lucide', 'bell');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function exibirAlertaLocalOSync(titulo, corpo, url = '/', eventoId = '') {
    const chave = eventoId || `${titulo}|${corpo}`;
    if (jaNotificouEventoOSync(chave)) return;

    tocarSomNotificacaoOSync();
    if (typeof mostrarNotificacaoOSync === 'function') {
        mostrarNotificacaoOSync(`${titulo}: ${corpo}`, 'aviso');
    }

    // Com o app aberto/visível, o banner + som já avisam; só cria push do sistema se estiver minimizado
    if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(titulo, {
                body: corpo,
                icon: '/images/ico192.png',
                badge: '/images/ico.png',
                vibrate: [200, 100, 200],
                tag: `osync-${chave}`,
                data: { url }
            });
        } catch (_) {}
    }
}

function iniciarEscutaNotificacoesTempoReal(userObj) {
    if (!userObj?.empresaId || !userObj?.id) return;
    if (unsubscribeNotificacoesRT) unsubscribeNotificacoesRT();

    const inicioSessaoMs = Date.now() - 5000;

    unsubscribeNotificacoesRT = db.collection('notificacoes_realtime')
        .where('empresaId', '==', userObj.empresaId)
        .onSnapshot((snap) => {
            snap.docChanges().forEach((change) => {
                if (change.type !== 'added') return;

                const n = change.doc.data();
                if (!n || n.remetenteUid === userObj.id) return;

                const criadoMs = n.criadoEm?.toMillis ? n.criadoEm.toMillis() : (n.timestampMs || 0);
                if (criadoMs < inicioSessaoMs) return;

                const destIds = Array.isArray(n.destinatariosIds) ? n.destinatariosIds : [];
                const perfis = Array.isArray(n.perfisAlvo) ? n.perfisAlvo : [];

                const souDestinatarioDireto = destIds.includes(userObj.id);
                const souPerfilAlvo = destIds.length === 0 && perfis.includes(userObj.perfil);

                if (souDestinatarioDireto || souPerfilAlvo) {
                    exibirAlertaLocalOSync(n.titulo || 'OSync', n.corpo || '', n.urlDestino || '/', n.eventoId || change.doc.id);
                }
            });
        }, (err) => {
            console.warn('Aviso escuta realtime:', err.message);
        });
}

async function inicializarNotificacoesOSync(userObj) {
    atualizarBotaoNotificacoesUI();
    iniciarEscutaNotificacoesTempoReal(userObj);

    if (!('Notification' in window) || !('serviceWorker' in navigator) || !firebase.messaging) return;

    try {
        if (!messagingOSync) {
            messagingOSync = firebase.messaging();
        }

        if (!listenerForegroundRegistrado) {
            listenerForegroundRegistrado = true;
            messagingOSync.onMessage(async (payload) => {
                const titulo = payload?.notification?.title || payload?.data?.title || 'OSync';
                const corpo = payload?.notification?.body || payload?.data?.body || '';
                const url = payload?.data?.url || '/';
                const eventoId = payload?.data?.eventoId || '';
                await exibirAlertaLocalOSync(titulo, corpo, url, eventoId);
            });
        }

        if (Notification.permission === 'granted' && userObj?.id) {
            await registrarTokenFCMUsuario(userObj.id).catch((e) => {
                console.warn('Falha ao renovar token FCM:', e.message);
            });
        }
    } catch (err) {
        console.warn('Aviso FCM:', err.message);
    }
}

async function registrarTokenFCMUsuario(uid) {
    const reg = await navigator.serviceWorker.ready;
    const token = await messagingOSync.getToken({
        vapidKey: OSYNC_VAPID_KEY,
        serviceWorkerRegistration: reg
    });

    if (!token) {
        throw new Error('O navegador não gerou o token FCM.');
    }

    // Remove token anterior salvo neste navegador se tiver mudado
    const tokenAnterior = localStorage.getItem('osync_fcm_token_local');
    if (uid) {
        if (tokenAnterior && tokenAnterior !== token) {
            await db.collection('usuarios').doc(uid).update({
                fcmTokens: firebase.firestore.FieldValue.arrayRemove(tokenAnterior)
            }).catch(() => {});
        }
        await db.collection('usuarios').doc(uid).update({
            fcmTokens: firebase.firestore.FieldValue.arrayUnion(token)
        });
        localStorage.setItem('osync_fcm_token_local', token);
    }
    return token;
}

window.ativarNotificacoesPushOSync = async function () {
    if (!('Notification' in window)) {
        alert('Este navegador não suporta notificações push.');
        return;
    }

    if (Notification.permission === 'denied') {
        alert('As notificações estão bloqueadas nas configurações do navegador. Libere as permissões do site para receber alertas.');
        return;
    }

    try {
        const perm = await Notification.requestPermission();
        atualizarBotaoNotificacoesUI();

        if (perm === 'granted') {
            if (!messagingOSync && firebase.messaging) {
                messagingOSync = firebase.messaging();
            }
            const uid = usuarioAtual?.id || auth.currentUser?.uid;
            await registrarTokenFCMUsuario(uid);
            tocarSomNotificacaoOSync();
            if (typeof mostrarNotificacaoOSync === 'function') {
                mostrarNotificacaoOSync('Notificações e alerta sonoro ativados neste aparelho!', 'sucesso');
            }
        }
    } catch (err) {
        console.error('Erro detalhado push:', err);
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Erro ao salvar token: ' + err.message, 'erro');
        } else {
            alert('Não foi possível ativar as notificações: ' + err.message);
        }
    }
};

window.dispararPushOSync = async function (dados) {
    const empresaId = dados.empresaId || usuarioAtual?.empresaId;
    const remetenteUid = usuarioAtual?.id || auth.currentUser?.uid || '';
    if (!empresaId) return;

    const eventoId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // 1. Grava evento em tempo real no Firestore (alerta instantâneo com app aberto)
    db.collection('notificacoes_realtime').add({
        empresaId,
        remetenteUid,
        eventoId,
        tipo: dados.tipo || 'geral',
        destinatariosIds: Array.isArray(dados.destinatariosIds) ? dados.destinatariosIds : [],
        perfisAlvo: Array.isArray(dados.perfisAlvo) ? dados.perfisAlvo : [],
        titulo: dados.titulo || 'OSync',
        corpo: dados.corpo || '',
        urlDestino: dados.urlDestino || '/',
        timestampMs: Date.now(),
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});

    // 2. Dispara Push em segundo plano via Vercel (/api/notificar)
    try {
        const tokenAuth = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        const resp = await fetch('/api/notificar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(tokenAuth ? { 'Authorization': `Bearer ${tokenAuth}` } : {})
            },
            body: JSON.stringify({
                empresaId,
                remetenteUid,
                eventoId,
                ...dados
            })
        });

        const resultado = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            console.warn('Aviso API /api/notificar:', resp.status, resultado);
        }
    } catch (err) {
        console.warn('Aviso envio push:', err.message);
    }
};
