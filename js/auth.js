let usuarioAtual = null;
let unsubscribePerfilAtual = null;

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        if (unsubscribePerfilAtual) unsubscribePerfilAtual();
        window.location.href = 'pages/login.html';
        return;
    }

    // Monitora o perfil em tempo real: se o Admin excluir ou desativar, o usuário é expulso na hora
    if (unsubscribePerfilAtual) unsubscribePerfilAtual();

    unsubscribePerfilAtual = db.collection('usuarios').doc(user.uid).onSnapshot(async (doc) => {
        if (!doc.exists || doc.data().ativo === false) {
            alert('Seu acesso foi revogado ou desativado pelo administrador.');
            await auth.signOut();
            window.location.href = 'pages/login.html';
            return;
        }

        const primeiraCarga = !usuarioAtual;
        usuarioAtual = { id: doc.id, ...doc.data() };

        document.getElementById('header-user-name').textContent = usuarioAtual.nome;
        document.getElementById('header-user-role').textContent = usuarioAtual.perfil;
if (usuarioAtual.perfil === 'SuperAdmin') {
    document.getElementById('btn-menu-saas')?.classList.remove('hidden');
}

        if (primeiraCarga) {
            atualizarStatusNuvem(true);
            document.body.classList.remove('auth-loading');

            if (typeof navegarPara === 'function') {
                navegarPara('os');
            }
        }
    }, async (err) => {
        console.error('Erro ao validar permissão:', err);
        await auth.signOut();
        window.location.href = 'pages/login.html';
    });
});

async function sairDoSistema() {
    if (unsubscribePerfilAtual) unsubscribePerfilAtual();
    await auth.signOut();
    window.location.href = 'pages/login.html';
}
