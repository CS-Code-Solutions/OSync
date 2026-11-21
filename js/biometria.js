// ==========================================
// MÓDULO WEBAUTHN / PASSKEY (DIGITAL / FACE ID)
// ==========================================

const CHAVE_LOCAL_PASSKEY = 'osync_passkey_meta';

function bufferParaBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binario = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binario += String.fromCharCode(bytes[i]);
    }
    return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlParaUint8Array(base64url) {
    const base64 = String(base64url || '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4 ? '='.repeat(4 - (base64.length % 4)) : '';
    const binario = atob(base64 + pad);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) {
        bytes[i] = binario.charCodeAt(i);
    }
    return bytes;
}

window.obterPasskeyLocal = function () {
    try {
        const bruto = localStorage.getItem(CHAVE_LOCAL_PASSKEY);
        return bruto ? JSON.parse(bruto) : null;
    } catch (_) {
        return null;
    }
};

window.atualizarIconeBiometriaHeader = function () {
    const btn = document.getElementById('btn-biometria-passkey');
    if (!btn) return;

    if (!window.PublicKeyCredential) {
        btn.classList.add('hidden');
        return;
    }

    btn.classList.remove('hidden');
    const meta = obterPasskeyLocal();
    const ativaParaUsuarioAtual = meta && usuarioAtual && meta.uid === usuarioAtual.id;

    if (ativaParaUsuarioAtual) {
        btn.classList.remove('text-slate-300', 'hover:bg-slate-800');
        btn.classList.add('text-[#00E5B0]', 'bg-[#00E5B0]/10', 'border', 'border-[#00E5B0]/30');
        btn.title = 'Login com Digital / Face ID Ativo neste dispositivo (Clique para gerenciar)';
    } else {
        btn.classList.remove('text-[#00E5B0]', 'bg-[#00E5B0]/10', 'border', 'border-[#00E5B0]/30');
        btn.classList.add('text-slate-300', 'hover:bg-slate-800');
        btn.title = 'Ativar Login com Digital / Face ID neste dispositivo';
    }
};

window.gerenciarBiometriaOSync = async function () {
    if (!window.PublicKeyCredential) {
        alert('Este navegador ou dispositivo não suporta autenticação biométrica (Passkey).');
        return;
    }

    const user = auth.currentUser;
    if (!user || !usuarioAtual) {
        alert('Aguarde o carregamento do seu perfil para configurar a biometria.');
        return;
    }

    const meta = obterPasskeyLocal();
    const jaAtiva = meta && meta.uid === user.uid && meta.credentialId;

    if (jaAtiva) {
        const confirmarDesativar = confirm(
            `O login rápido com Digital / Face ID já está ATIVO neste dispositivo para ${usuarioAtual.nome}.\n\nDeseja DESATIVAR a biometria neste aparelho?`
        );
        if (!confirmarDesativar) return;

        try {
            const idToken = await user.getIdToken();
            await fetch('/api/passkey', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    action: 'revoke',
                    credentialId: meta.credentialId
                })
            });
            localStorage.removeItem(CHAVE_LOCAL_PASSKEY);
            atualizarIconeBiometriaHeader();
            alert('Biometria desativada neste dispositivo.');
        } catch (err) {
            alert('Erro ao desativar biometria: ' + err.message);
        }
        return;
    }

    const confirmarAtivar = confirm(
        `Deseja ativar o login rápido com Digital / Face ID neste dispositivo para ${usuarioAtual.nome}?\n\nNa próxima vez que entrar no OSync, não precisará digitar e-mail nem senha.`
    );
    if (!confirmarAtivar) return;

    try {
        // 1. Solicita desafio criptográfico ao servidor
        const respChallenge = await fetch('/api/passkey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'challenge' })
        });
        const dadosChallenge = await respChallenge.json();
        if (!respChallenge.ok) throw new Error(dadosChallenge.error || 'Falha ao iniciar desafio biométrico.');

        // 2. Cria credencial biométrica nativa no dispositivo
        const userIdBytes = new TextEncoder().encode(user.uid);
        const credencial = await navigator.credentials.create({
            publicKey: {
                challenge: base64UrlParaUint8Array(dadosChallenge.challenge),
                rp: {
                    name: 'OSync - Gestão de Manutenção',
                    id: dadosChallenge.rpId
                },
                user: {
                    id: userIdBytes,
                    name: usuarioAtual.email || user.email,
                    displayName: usuarioAtual.nome || 'Usuário OSync'
                },
                pubKeyCredParams: [
                    { type: 'public-key', alg: -7 },   // ES256 (ECDSA P-256)
                    { type: 'public-key', alg: -257 }  // RS256 (RSA)
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required',
                    residentKey: 'preferred'
                },
                timeout: 60000,
                attestation: 'none'
            }
        });

        if (!credencial) throw new Error('Cadastro biométrico cancelado.');

        const spkiBuffer = credencial.response.getPublicKey();
        if (!spkiBuffer) {
            throw new Error('Seu navegador não exportou a chave pública SPKI. Atualize o navegador e tente novamente.');
        }

        const credentialId = bufferParaBase64Url(credencial.rawId);
        const publicKeySpki = bufferParaBase64Url(spkiBuffer);
        const clientDataJSON = bufferParaBase64Url(credencial.response.clientDataJSON);

        // 3. Registra chave pública no servidor
        const idToken = await user.getIdToken();
        const respReg = await fetch('/api/passkey', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                action: 'register',
                credentialId,
                publicKeySpki,
                clientDataJSON,
                dispositivo: navigator.userAgent
            })
        });

        const dadosReg = await respReg.json();
        if (!respReg.ok) throw new Error(dadosReg.error || 'Erro ao salvar biometria no servidor.');

        localStorage.setItem(CHAVE_LOCAL_PASSKEY, JSON.stringify({
            uid: user.uid,
            nome: usuarioAtual.nome,
            email: usuarioAtual.email || user.email,
            credentialId
        }));

        atualizarIconeBiometriaHeader();
        alert('Digital / Face ID ativado com sucesso! Na próxima vez, basta tocar no botão de biometria na tela de login.');
    } catch (err) {
        if (err.name === 'NotAllowedError') {
            alert('Operação cancelada ou tempo esgotado na leitura biométrica.');
        } else {
            alert('Não foi possível ativar a biometria: ' + err.message);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(atualizarIconeBiometriaHeader, 800);
});
