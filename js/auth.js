let usuarioAtual = null;

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'pages/login.html';
        return;
    }

    try {
        const doc = await db.collection('usuarios').doc(user.uid).get();
        usuarioAtual = doc.exists
            ? { id: doc.id, ...doc.data() }
            : { id: user.uid, nome: user.email.split('@')[0], perfil: 'Admin', empresaId: 'default' };
    } catch (err) {
        console.warn('Aviso ao buscar perfil no Firestore:', err.message);
        usuarioAtual = { id: user.uid, nome: user.email.split('@')[0], perfil: 'Admin', empresaId: 'default' };
    }

    document.getElementById('header-user-name').textContent = usuarioAtual.nome;
    document.getElementById('header-user-role').textContent = usuarioAtual.perfil;

    atualizarStatusNuvem(true);
    document.body.classList.remove('auth-loading');

    if (typeof navegarPara === 'function') {
        navegarPara('os');
    }
});

async function sairDoSistema() {
    await auth.signOut();
    window.location.href = 'pages/login.html';
}
