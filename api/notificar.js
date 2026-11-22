const admin = require('firebase-admin');

const ORIGENS_PERMITIDAS = [
    'https://osync.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
];

function getFirebaseAdmin() {
    if (!admin.apps.length) {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!raw) {
            throw new Error('Variável FIREBASE_SERVICE_ACCOUNT não configurada na Vercel.');
        }
        const serviceAccount = JSON.parse(raw);
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    return admin;
}

module.exports = async (req, res) => {
    const origin = req.headers.origin || '';
    if (origin && !ORIGENS_PERMITIDAS.includes(origin)) {
        return res.status(403).json({ error: 'Origem não autorizada.' });
    }
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        const fbAdmin = getFirebaseAdmin();
        const db = fbAdmin.firestore();

        const authHeader = req.headers.authorization || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

        const {
            tipo,
            empresaId,
            destinatariosIds,
            perfisAlvo,
            titulo,
            corpo,
            urlDestino,
            remetenteUid
        } = req.body || {};

        if (!empresaId || !titulo || !corpo) {
            return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes.' });
        }

        let uidAutenticado = String(remetenteUid || '').trim();

        if (tipo === 'novo_cadastro') {
            // Valida se o solicitante realmente existe no Firestore como pendente daquela empresa (bloqueia spam externo)
            if (!uidAutenticado) {
                return res.status(401).json({ error: 'Identificador do solicitante ausente.' });
            }
            const novoUserDoc = await db.collection('usuarios').doc(uidAutenticado).get();
            if (
                !novoUserDoc.exists ||
                novoUserDoc.data().empresaId !== String(empresaId) ||
                novoUserDoc.data().statusAcesso !== 'pendente'
            ) {
                return res.status(403).json({ error: 'Solicitação de cadastro inválida ou já processada.' });
            }

            const agora = Date.now();
            await db.collection('notificacoes_realtime').add({
                empresaId: String(empresaId),
                remetenteUid: uidAutenticado,
                eventoId: `evt_cad_${agora}_${Math.random().toString(36).slice(2, 7)}`,
                tipo: 'novo_cadastro',
                destinatariosIds: [],
                perfisAlvo: ['Admin'],
                titulo: String(titulo).slice(0, 120),
                corpo: String(corpo).slice(0, 300),
                urlDestino: String(urlDestino || '/?page=configuracoes').slice(0, 200),
                timestampMs: agora,
                criadoEm: fbAdmin.firestore.FieldValue.serverTimestamp()
            }).catch(() => {});
        } else {
            if (!idToken) return res.status(401).json({ error: 'Não autorizado.' });
            const decoded = await fbAdmin.auth().verifyIdToken(idToken);
            uidAutenticado = decoded.uid;

            // Garante isolamento multi-tenant: remetente precisa pertencer à empresaId (ou ser SuperAdmin)
            const remetenteDoc = await db.collection('usuarios').doc(uidAutenticado).get();
            if (!remetenteDoc.exists || remetenteDoc.data().ativo === false) {
                return res.status(403).json({ error: 'Usuário inativo ou não encontrado.' });
            }
            const dadosRemetente = remetenteDoc.data();
            if (dadosRemetente.perfil !== 'SuperAdmin' && dadosRemetente.empresaId !== String(empresaId)) {
                return res.status(403).json({ error: 'Acesso negado para esta empresa.' });
            }
        }

        const tokensSet = new Set();
        const refsUsuarios = [];

        if (Array.isArray(destinatariosIds) && destinatariosIds.length > 0) {
            const unicos = [...new Set(destinatariosIds)].filter(uid => uid && uid !== uidAutenticado).slice(0, 100);
            for (const uid of unicos) {
                const doc = await db.collection('usuarios').doc(String(uid)).get();
                if (doc.exists && doc.data().empresaId === String(empresaId) && doc.data().ativo !== false) {
                    refsUsuarios.push(doc);
                }
            }
        } else if (Array.isArray(perfisAlvo) && perfisAlvo.length > 0) {
            const perfisValidos = perfisAlvo.filter(p => typeof p === 'string').slice(0, 10);
            if (perfisValidos.length > 0) {
                const snap = await db.collection('usuarios')
                    .where('empresaId', '==', String(empresaId))
                    .where('perfil', 'in', perfisValidos)
                    .get();

                snap.docs.forEach(doc => {
                    if (doc.id !== uidAutenticado && doc.data().ativo !== false) {
                        refsUsuarios.push(doc);
                    }
                });
            }
        }

        refsUsuarios.forEach(doc => {
            const lista = doc.data().fcmTokens;
            if (Array.isArray(lista)) {
                lista.forEach(t => { if (t) tokensSet.add(t); });
            }
        });

        const tokens = [...tokensSet];
        if (tokens.length === 0) {
            return res.status(200).json({ enviados: 0, motivo: 'Nenhum aparelho inscrito.' });
        }

        const eventoTag = `osync-${String(titulo).trim()}-${String(corpo).trim()}`
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '_')
            .slice(0, 80);

        const response = await fbAdmin.messaging().sendEachForMulticast({
            tokens,
            data: {
                url: String(urlDestino || '/').slice(0, 200),
                tipo: String(tipo || 'geral').slice(0, 50),
                title: String(titulo).slice(0, 120),
                body: String(corpo).slice(0, 300),
                eventoId: eventoTag
            },
            webpush: {
                headers: { Urgency: 'high' },
                fcmOptions: {
                    link: String(urlDestino || '/').slice(0, 200)
                }
            }
        });

        const tokensInvalidos = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const code = resp.error?.code || '';
                if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
                    tokensInvalidos.push(tokens[idx]);
                }
            }
        });

        if (tokensInvalidos.length > 0) {
            for (const doc of refsUsuarios) {
                await doc.ref.update({
                    fcmTokens: fbAdmin.firestore.FieldValue.arrayRemove(...tokensInvalidos)
                }).catch(() => {});
            }
        }

        return res.status(200).json({
            enviados: response.successCount,
            falhas: response.failureCount
        });
    } catch (err) {
        console.error('Erro /api/notificar:', err);
        return res.status(500).json({ error: err.message });
    }
};
