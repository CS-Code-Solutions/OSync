let usuarioAtual = null;
let unsubscribePerfilAtual = null;

function aplicarPermissoesInterface(perfil) {
    const isGestor = perfil === 'Admin' || perfil === 'SuperAdmin';

    // Esconde Cadastros e Configurações de Manutentores e Líderes
    if (!isGestor) {
        document.getElementById('nav-cadastros-group')?.classList.add('hidden');
        document.getElementById('nav-configuracoes')?.classList.add('hidden');
        document.getElementById('mob-cadastros')?.classList.add('hidden');
        document.getElementById('mob-configuracoes')?.classList.add('hidden');
    }

    // Líder não acessa o quadro Kanban de O.S., apenas Solicitações
    if (perfil === 'Lideranca') {
        document.getElementById('nav-os')?.classList.add('hidden');
        document.getElementById('mob-os')?.classList.add('hidden');
    }

      // Painel Master SaaS exclusivo para SuperAdmin (Desktop + Mobile)
    if (perfil === 'SuperAdmin') {
        document.getElementById('btn-menu-saas')?.classList.remove('hidden');
        document.getElementById('mob-saas')?.classList.remove('hidden');
    }

}

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        if (unsubscribePerfilAtual) unsubscribePerfilAtual();
        window.location.href = 'pages/login.html';
        return;
    }

    if (unsubscribePerfilAtual) unsubscribePerfilAtual();

    unsubscribePerfilAtual = db.collection('usuarios').doc(user.uid).onSnapshot(async (doc) => {
        if (!doc.exists || doc.data().ativo === false) {
            alert('Seu acesso foi revogado ou está pendente de aprovação pelo gestor.');
            await auth.signOut();
            window.location.href = 'pages/login.html';
            return;
        }

        const primeiraCarga = !usuarioAtual;
        usuarioAtual = { id: doc.id, ...doc.data() };

        document.getElementById('header-user-name').textContent = usuarioAtual.nome;
        document.getElementById('header-user-role').textContent = usuarioAtual.perfil;

        if (primeiraCarga) {
            aplicarPermissoesInterface(usuarioAtual.perfil);
            atualizarStatusNuvem(true);
            document.body.classList.remove('auth-loading');

            if (usuarioAtual.perfil === 'Lideranca') {
                navegarPara('solicitacoes');
            } else if (usuarioAtual.perfil === 'SuperAdmin') {
                navegarPara('saas-empresas');
            } else {
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
