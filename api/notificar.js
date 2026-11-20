const admin = require('firebase-admin');

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

        let uidAutenticado = remetenteUid || '';
        if (tipo !== 'novo_cadastro') {
            if (!idToken) return res.status(401).json({ error: 'Não autorizado.' });
            const decoded = await fbAdmin.auth().verifyIdToken(idToken);
            uidAutenticado = decoded.uid;
        }

        // Para novos cadastros (onde o usuário ainda está pendente no cliente), grava o alerta realtime pelo Admin SDK
        if (tipo === 'novo_cadastro') {
            const agora = Date.now();
            await db.collection('notificacoes_realtime').add({
                empresaId: String(empresaId),
                remetenteUid: String(uidAutenticado),
                eventoId: `evt_cad_${agora}_${Math.random().toString(36).slice(2, 7)}`,
                tipo: 'novo_cadastro',
                destinatariosIds: [],
                perfisAlvo: ['Admin'],
                titulo: String(titulo),
                corpo: String(corpo),
                urlDestino: String(urlDestino || '/?page=configuracoes'),
                timestampMs: agora,
                criadoEm: fbAdmin.firestore.FieldValue.serverTimestamp()
            }).catch(() => {});
        }

        const tokensSet = new Set();
        const refsUsuarios = [];

        if (Array.isArray(destinatariosIds) && destinatariosIds.length > 0) {
            const unicos = [...new Set(destinatariosIds)].filter(uid => uid && uid !== uidAutenticado);
            for (const uid of unicos) {
                const doc = await db.collection('usuarios').doc(uid).get();
                if (doc.exists && doc.data().empresaId === empresaId && doc.data().ativo !== false) {
                    refsUsuarios.push(doc);
                }
            }
        } else if (Array.isArray(perfisAlvo) && perfisAlvo.length > 0) {
            const snap = await db.collection('usuarios')
                .where('empresaId', '==', empresaId)
                .where('perfil', 'in', perfisAlvo)
                .get();

            snap.docs.forEach(doc => {
                if (doc.id !== uidAutenticado && doc.data().ativo !== false) {
                    refsUsuarios.push(doc);
                }
            });
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
                url: String(urlDestino || '/'),
                tipo: String(tipo || 'geral'),
                title: String(titulo),
                body: String(corpo),
                eventoId: eventoTag
            },
            webpush: {
                headers: { Urgency: 'high' },
                fcmOptions: {
                    link: String(urlDestino || '/')
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
