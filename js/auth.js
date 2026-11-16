let usuarioAtual = null;

async function verificarSessao() {
    const { data: { session }, error } = await db.auth.getSession();

    if (error || !session) {
        window.location.href = 'pages/login.html';
        return;
    }

    // Busca os dados do perfil na tabela usuarios
    const { data: perfil } = await db
        .from('usuarios')
        .select('*')
        .eq('id', session.user.id)
        .single();

    usuarioAtual = perfil || { nome: session.user.email.split('@')[0], perfil: 'Admin', empresa_id: null };

    document.getElementById('header-user-name').textContent = usuarioAtual.nome;
    document.getElementById('header-user-role').textContent = usuarioAtual.perfil;
    
    atualizarStatusNuvem(true);
    document.body.classList.remove('auth-loading');
    
    // Carrega a tela inicial padrão (O.S.)
    navegarPara('os');
}

async function sairDoSistema() {
    await db.auth.signOut();
    window.location.href = 'pages/login.html';
}

document.addEventListener('DOMContentLoaded', verificarSessao);
