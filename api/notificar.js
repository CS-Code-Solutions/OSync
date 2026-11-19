const admin = require('firebase-admin');

if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '{}';
    const serviceAccount = JSON.parse(raw);
    if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
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
            const decoded = await admin.auth().verifyIdToken(idToken);
            uidAutenticado = decoded.uid;
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

        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
                title: String(titulo),
                body: String(corpo)
            },
            data: {
                url: String(urlDestino || '/'),
                tipo: String(tipo || 'geral'),
                title: String(titulo),
                body: String(corpo)
            },
            webpush: {
                headers: { Urgency: 'high' },
                notification: {
                    title: String(titulo),
                    body: String(corpo),
                    icon: '/images/ico192.png',
                    badge: '/images/ico.png',
                    vibrate: [200, 100, 200],
                    tag: `osync-${tipo || 'alerta'}-${Date.now()}`
                },
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
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensInvalidos)
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
