/**
 * ============================================================================
 * OSync — Autenticação, Sessão Multi-Tenant, RBAC & LGPD (js/auth.js)
 * ============================================================================
 */

window.usuarioLogado = null;
window.empresaAtual = null;

// Mapa de páginas padrão por perfil (fallback caso o doc não tenha array explícito)
const PAGINAS_PADRAO_PERFIL = {
    SuperAdmin: ['dashboard', 'os', 'solicitacoes', 'cad-manutentores', 'cad-lideranca', 'cad-ativos', 'planos-manutencao', 'relatorios', 'empresas'],
    Admin: ['dashboard', 'os', 'solicitacoes', 'cad-manutentores', 'cad-lideranca', 'cad-ativos', 'planos-manutencao', 'relatorios'],
    Manutentor: ['os'],
    Lideranca: ['solicitacoes']
};

/**
 * Monitora o estado de autenticação do Firebase
 */
auth.onAuthStateChanged(async (user) => {
    const isLoginPage = window.location.pathname.endsWith('login.html');

    if (!user) {
        localStorage.removeItem('osync_user_cache');
        if (!isLoginPage) {
            window.location.replace('login.html');
        }
        return;
    }

    try {
        const userDoc = await db.collection('usuarios').doc(user.uid).get();

        if (!userDoc.exists) {
            await auth.signOut();
            localStorage.removeItem('osync_user_cache');
            if (!isLoginPage) window.location.replace('login.html?erro=sem_perfil');
            return;
        }

        const dadosUsuario = { uid: user.uid, ...userDoc.data() };

        // Verifica se o usuário está ativo
        if (dadosUsuario.ativo === false) {
            await auth.signOut();
            localStorage.removeItem('osync_user_cache');
            if (!isLoginPage) window.location.replace('login.html?erro=inativo');
            return;
        }

        // Carrega os dados da empresa (Tenant) se não for SuperAdmin sem empresa fixa
        let dadosEmpresa = { id: dadosUsuario.empresaId || 'master', nome: 'OSync Master', status: 'Ativa' };
        if (dadosUsuario.empresaId) {
            const empDoc = await db.collection('empresas').doc(dadosUsuario.empresaId).get();
            if (empDoc.exists) {
                dadosEmpresa = { id: empDoc.id, ...empDoc.data() };
            }
        }

        // Bloqueia acesso se a empresa estiver suspensa (exceto SuperAdmin)
        if (dadosUsuario.perfil !== 'SuperAdmin' && dadosEmpresa.status === 'Suspensa') {
            await auth.signOut();
            localStorage.removeItem('osync_user_cache');
            if (!isLoginPage) window.location.replace('login.html?erro=empresa_suspensa');
            return;
        }

        // Normaliza as páginas permitidas
        if (!Array.isArray(dadosUsuario.paginasPermitidas) || dadosUsuario.paginasPermitidas.length === 0) {
            dadosUsuario.paginasPermitidas = PAGINAS_PADRAO_PERFIL[dadosUsuario.perfil] || ['os'];
        }

        // Blindagem: ninguém além de SuperAdmin pode ter 'empresas'
        if (dadosUsuario.perfil !== 'SuperAdmin') {
            dadosUsuario.paginasPermitidas = dadosUsuario.paginasPermitidas.filter(p => p !== 'empresas');
        }

        window.usuarioLogado = dadosUsuario;
        window.empresaAtual = dadosEmpresa;

        // Salva cache seguro para o script Anti-FOUC do próximo carregamento
        localStorage.setItem('osync_user_cache', JSON.stringify({
            uid: dadosUsuario.uid,
            nome: dadosUsuario.nome,
            perfil: dadosUsuario.perfil,
            empresaId: dadosUsuario.empresaId,
            ativo: dadosUsuario.ativo,
            paginasPermitidas: dadosUsuario.paginasPermitidas
        }));

        // Se estiver na tela de login já autenticado, vai para o app
        if (isLoginPage) {
            window.location.replace('index.html');
            return;
        }

        // Atualiza UI do App Shell e aplica RBAC
        atualizarHeaderUsuario();
        aplicarPermissoesRBAC();

        // Libera a visibilidade da tela (fim do Anti-FOUC)
        document.documentElement.classList.remove('auth-loading');
        if (window.lucide) lucide.createIcons();

        // Verifica aceite obrigatório da LGPD
        if (!dadosUsuario.lgpdAceito) {
            const modalLgpd = document.getElementById('modal-lgpd');
            if (modalLgpd) modalLgpd.classList.remove('hidden');
        }

        // Define rota inicial
        const hashRota = window.location.hash.replace('#', '').trim();
        const rotaInicial = (hashRota && usuarioPodeAcessarPagina(hashRota))
            ? hashRota
            : obterPaginaInicialPermitida();

        navegarPara(rotaInicial);

    } catch (erro) {
        console.error('Erro crítico na inicialização de sessão:', erro);
        document.documentElement.classList.remove('auth-loading');
    }
});

/**
 * Preenche nome, perfil, iniciais e nome da empresa na Topbar e Drawer Mobile
 */
function atualizarHeaderUsuario() {
    const u = window.usuarioLogado;
    const emp = window.empresaAtual;
    if (!u) return;

    const iniciais = (u.nome || 'US')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(p => p[0].toUpperCase())
        .join('');

    const labelPerfil = {
        SuperAdmin: 'Super Admin SaaS',
        Admin: 'Gestor / Admin',
        Manutentor: 'Manutentor',
        Lideranca: 'Liderança / Solicitante'
    }[u.perfil] || u.perfil;

    const idsTexto = [
        ['topbar-empresa-nome', emp?.nome || 'Empresa'],
        ['drawer-empresa-nome', emp?.nome || 'Empresa'],
        ['topbar-user-nome', u.nome],
        ['drawer-user-nome', u.nome],
        ['topbar-user-perfil', labelPerfil],
        ['drawer-user-perfil', labelPerfil],
        ['topbar-user-avatar', iniciais],
        ['drawer-user-avatar', iniciais]
    ];

    idsTexto.forEach(([id, valor]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = valor;
    });
}

/**
 * Aplica dinamicamente a visibilidade dos menus com base em paginasPermitidas
 */
function aplicarPermissoesRBAC() {
    const u = window.usuarioLogado;
    if (!u) return;

    // Remove folha de estilo temporária do cache se existir
    const oldStyle = document.getElementById('anti-fouc-rbac');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'anti-fouc-rbac';
    let cssRules = '';

    const todasPaginas = ['dashboard', 'os', 'solicitacoes', 'cad-manutentores', 'cad-lideranca', 'cad-ativos', 'planos-manutencao', 'relatorios', 'empresas'];

    todasPaginas.forEach(pagina => {
        if (usuarioPodeAcessarPagina(pagina)) {
            cssRules += `[data-page="${pagina}"] { display: flex !important; }\n`;
        } else {
            cssRules += `[data-page="${pagina}"] { display: none !important; }\n`;
        }
    });

    style.textContent = cssRules;
    document.head.appendChild(style);

    // Exibe ou oculta o grupo pai "Cadastros" no desktop e no mobile
    const rotasCadastros = ['cad-manutentores', 'cad-lideranca', 'cad-ativos', 'planos-manutencao'];
    const temAlgumCadastro = rotasCadastros.some(r => usuarioPodeAcessarPagina(r));

    const btnDropdownCadastros = document.getElementById('btn-dropdown-cadastros');
    const drawerGroupCadastros = document.getElementById('drawer-group-cadastros');

    if (btnDropdownCadastros) {
        if (temAlgumCadastro) {
            btnDropdownCadastros.classList.remove('hidden');
            btnDropdownCadastros.classList.add('flex');
        } else {
            btnDropdownCadastros.classList.add('hidden');
            btnDropdownCadastros.classList.remove('flex');
        }
    }

    if (drawerGroupCadastros) {
        if (temAlgumCadastro) {
            drawerGroupCadastros.classList.remove('hidden');
        } else {
            drawerGroupCadastros.classList.add('hidden');
        }
    }
}

/**
 * Verifica se o usuário tem permissão para acessar uma rota específica
 */
function usuarioPodeAcessarPagina(pagina) {
    const u = window.usuarioLogado;
    if (!u) return false;
    if (u.perfil === 'SuperAdmin') return true;
    if (pagina === 'empresas') return false;
    if (u.perfil === 'Admin') return true;
    return Array.isArray(u.paginasPermitidas) && u.paginasPermitidas.includes(pagina);
}

/**
 * Retorna a primeira página válida para redirecionamento automático
 */
function obterPaginaInicialPermitida() {
    const u = window.usuarioLogado;
    if (!u) return 'os';
    if (u.perfil === 'SuperAdmin' || u.perfil === 'Admin') return 'dashboard';
    if (Array.isArray(u.paginasPermitidas) && u.paginasPermitidas.length > 0) {
        return u.paginasPermitidas[0];
    }
    return u.perfil === 'Lideranca' ? 'solicitacoes' : 'os';
}

/**
 * Registra o aceite dos Termos de Uso / LGPD no Firestore
 */
async function registrarAceiteLGPD() {
    const u = window.usuarioLogado;
    const btn = document.getElementById('btn-aceitar-lgpd');
    if (!u) return;

    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Registrando...';
        }

        await db.collection('usuarios').doc(u.uid).update({
            lgpdAceito: true,
            lgpdAceitoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.usuarioLogado.lgpdAceito = true;
        const modal = document.getElementById('modal-lgpd');
        if (modal) modal.classList.add('hidden');

    } catch (erro) {
        console.error('Erro ao registrar aceite LGPD:', erro);
        alert('Não foi possível registrar o aceite. Tente novamente.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Li e Aceito os Termos';
        }
    }
}

/**
 * Encerra a sessão com segurança
 */
async function sairDoSistema() {
    try {
        localStorage.removeItem('osync_user_cache');
        await auth.signOut();
        window.location.replace('login.html');
    } catch (erro) {
        console.error('Erro ao sair:', erro);
    }
}
