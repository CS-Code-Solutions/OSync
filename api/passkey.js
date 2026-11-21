const crypto = require('crypto');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
            })
        });
    }
}

const db = admin.firestore();

function base64UrlToBuffer(b64url) {
    const b64 = String(b64url || '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    return Buffer.from(b64 + pad, 'base64');
}

function bufferToBase64Url(buf) {
    return Buffer.from(buf)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function obterOrigemEsperada(req) {
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
    return `${proto}://${host}`;
}

function extrairRpId(req) {
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0];
    return host || 'osync.vercel.app';
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    try {
        const { action } = req.body || {};
        const rpId = extrairRpId(req);
        const expectedOrigin = obterOrigemEsperada(req);

        // ============================================================
        // 1. GERAR DESAFIO (CHALLENGE) PARA REGISTRO OU AUTENTICAÇÃO
        // ============================================================
        if (action === 'challenge') {
            const challenge = bufferToBase64Url(crypto.randomBytes(32));
            const expiraEm = Date.now() + 5 * 60 * 1000; // 5 minutos

            await db.collection('passkey_challenges').doc(challenge).set({
                challenge,
                rpId,
                expiraEm,
                criadoEm: admin.firestore.FieldValue.serverTimestamp()
            });

            return res.status(200).json({ challenge, rpId });
        }

        // ============================================================
        // 2. REGISTRAR NOVA PASSKEY (EXIGE USUÁRIO LOGADO COM ID TOKEN)
        // ============================================================
        if (action === 'register') {
            const authHeader = req.headers.authorization || '';
            const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
            if (!idToken) {
                return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
            }

            const decoded = await admin.auth().verifyIdToken(idToken);
            const uid = decoded.uid;

            const { credentialId, publicKeySpki, clientDataJSON, dispositivo } = req.body || {};
            if (!credentialId || !publicKeySpki || !clientDataJSON) {
                return res.status(400).json({ error: 'Dados da credencial biométrica incompletos.' });
            }

            // Valida desafio no clientDataJSON
            const clientData = JSON.parse(base64UrlToBuffer(clientDataJSON).toString('utf8'));
            if (clientData.type !== 'webauthn.create') {
                return res.status(400).json({ error: 'Tipo de operação WebAuthn inválido.' });
            }
            if (clientData.origin !== expectedOrigin) {
                return res.status(400).json({ error: 'Origem da requisição não autorizada.' });
            }

            const challengeRef = db.collection('passkey_challenges').doc(clientData.challenge);
            const challengeSnap = await challengeRef.get();
            if (!challengeSnap.exists || challengeSnap.data().expiraEm < Date.now()) {
                return res.status(400).json({ error: 'Desafio expirado. Tente novamente.' });
            }
            await challengeRef.delete();

            // Verifica se usuário está ativo
            const userDoc = await db.collection('usuarios').doc(uid).get();
            if (!userDoc.exists || userDoc.data().ativo === false) {
                return res.status(403).json({ error: 'Usuário inativo ou sem permissão.' });
            }

            // Salva a chave pública no Firestore (coleção protegida contra acesso direto)
            await db.collection('passkeys').doc(credentialId).set({
                uid,
                empresaId: userDoc.data().empresaId || '',
                email: userDoc.data().email || '',
                nome: userDoc.data().nome || '',
                credentialId,
                publicKeySpki,
                counter: 0,
                dispositivo: String(dispositivo || 'Dispositivo Móvel / Navegador').slice(0, 120),
                criadoEm: admin.firestore.FieldValue.serverTimestamp(),
                ultimoUsoEm: admin.firestore.FieldValue.serverTimestamp()
            });

            return res.status(200).json({ ok: true, credentialId });
        }

        // ============================================================
        // 3. AUTENTICAR VIA PASSKEY E EMITIR FIREBASE CUSTOM TOKEN
        // ============================================================
        if (action === 'authenticate') {
            const { credentialId, clientDataJSON, authenticatorData, signature } = req.body || {};
            if (!credentialId || !clientDataJSON || !authenticatorData || !signature) {
                return res.status(400).json({ error: 'Assinatura biométrica incompleta.' });
            }

            const clientDataBuf = base64UrlToBuffer(clientDataJSON);
            const clientData = JSON.parse(clientDataBuf.toString('utf8'));

            if (clientData.type !== 'webauthn.get') {
                return res.status(400).json({ error: 'Tipo de autenticação inválido.' });
            }
            if (clientData.origin !== expectedOrigin) {
                return res.status(400).json({ error: 'Origem da requisição inválida.' });
            }

            // Valida e consome o desafio (proteção contra replay attack)
            const challengeRef = db.collection('passkey_challenges').doc(clientData.challenge);
            const challengeSnap = await challengeRef.get();
            if (!challengeSnap.exists || challengeSnap.data().expiraEm < Date.now()) {
                return res.status(400).json({ error: 'Sessão de biometria expirada. Tente novamente.' });
            }
            await challengeRef.delete();

            // Busca a chave pública da Passkey
            const passkeyRef = db.collection('passkeys').doc(credentialId);
            const passkeySnap = await passkeyRef.get();
            if (!passkeySnap.exists) {
                return res.status(404).json({ error: 'Biometria não encontrada ou revogada neste dispositivo.' });
            }

            const passkeyData = passkeySnap.data();
            const authDataBuf = base64UrlToBuffer(authenticatorData);
            const sigBuf = base64UrlToBuffer(signature);

            // Verifica hash do RP ID (primeiros 32 bytes de authenticatorData)
            const expectedRpIdHash = crypto.createHash('sha256').update(rpId).digest();
            const rpIdHash = authDataBuf.subarray(0, 32);
            if (!crypto.timingSafeEqual(expectedRpIdHash, rpIdHash)) {
                return res.status(401).json({ error: 'Domínio da chave biométrica incompatível.' });
            }

            // Verifica flag User Present (bit 0 do byte 32)
            const flags = authDataBuf[32];
            if ((flags & 0x01) === 0) {
                return res.status(401).json({ error: 'Presença do usuário não confirmada.' });
            }

            // Reconstrói o payload assinado: authenticatorData + SHA256(clientDataJSON)
            const clientDataHash = crypto.createHash('sha256').update(clientDataBuf).digest();
            const signedData = Buffer.concat([authDataBuf, clientDataHash]);

            // Importa a chave pública SPKI salva no registro
            const publicKeyObj = crypto.createPublicKey({
                key: base64UrlToBuffer(passkeyData.publicKeySpki),
                format: 'der',
                type: 'spki'
            });

            const assinaturaValida = crypto.verify('sha256', signedData, publicKeyObj, sigBuf);
            if (!assinaturaValida) {
                return res.status(401).json({ error: 'Assinatura biométrica inválida.' });
            }

            // Verifica contador anti-clonagem (quando suportado pelo autenticador)
            const newCounter = authDataBuf.readUInt32BE(33);
            if (passkeyData.counter > 0 && newCounter > 0 && newCounter <= passkeyData.counter) {
                return res.status(401).json({ error: 'Alerta de segurança: contador da chave inválido.' });
            }

            // Verifica se o usuário e a empresa continuam ativos no Firestore
            const userDoc = await db.collection('usuarios').doc(passkeyData.uid).get();
            if (!userDoc.exists) {
                return res.status(403).json({ error: 'Cadastro de usuário não encontrado.' });
            }
            const userData = userDoc.data();
            if (userData.statusAcesso === 'pendente') {
                return res.status(403).json({ error: 'Seu acesso ainda está aguardando aprovação do gestor.' });
            }
            if (userData.ativo === false) {
                return res.status(403).json({ error: 'Seu acesso foi desativado pelo administrador.' });
            }

            await passkeyRef.update({
                counter: newCounter,
                ultimoUsoEm: admin.firestore.FieldValue.serverTimestamp()
            });

            // Emite o Custom Token oficial do Firebase Auth
            const customToken = await admin.auth().createCustomToken(passkeyData.uid);
            return res.status(200).json({ customToken });
        }

        // ============================================================
        // 4. REVOGAR / REMOVER PASSKEY DO DISPOSITIVO ATUAL
        // ============================================================
        if (action === 'revoke') {
            const authHeader = req.headers.authorization || '';
            const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
            if (!idToken) {
                return res.status(401).json({ error: 'Não autenticado.' });
            }

            const decoded = await admin.auth().verifyIdToken(idToken);
            const { credentialId } = req.body || {};
            if (!credentialId) {
                return res.status(400).json({ error: 'Credencial não informada.' });
            }

            const passkeyRef = db.collection('passkeys').doc(credentialId);
            const snap = await passkeyRef.get();
            if (snap.exists && snap.data().uid === decoded.uid) {
                await passkeyRef.delete();
            }

            return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: 'Ação inválida.' });
    } catch (err) {
        console.error('Erro em /api/passkey:', err);
        return res.status(500).json({ error: err.message || 'Erro interno ao processar biometria.' });
    }
};
