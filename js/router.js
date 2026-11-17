async function navegarPara(pagina) {
    const container = document.getElementById('app-content');
    const perfil = usuarioAtual?.perfil;
    const isGestor = perfil === 'Admin' || perfil === 'SuperAdmin';

    // Travas de Permissão por Perfil
    if (!isGestor && (pagina.startsWith('cad-') || pagina === 'configuracoes' || pagina === 'saas-empresas' || pagina === 'centros-custo')) {
        alert('Acesso restrito aos gestores da manutenção.');
        return;
    }

    if (perfil === 'Lideranca' && pagina === 'os') {
        pagina = 'solicitacoes';
    }

    // Atualiza estado ativo dos botões Desktop e Mobile
    document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => btn.classList.remove('active'));

    if (pagina.startsWith('cad-')) {
        document.getElementById('btn-menu-cadastros')?.classList.add('active');
        document.querySelector('.mobile-nav-btn[data-page="cadastros"]')?.classList.add('active');
    } else if (pagina === 'centros-custo') {
        document.querySelectorAll(`[data-page="centros-custo"]`).forEach(btn => btn.classList.add('active'));
        document.querySelector('.mobile-nav-btn[data-page="cadastros"]')?.classList.add('active');
    } else {
        document.querySelectorAll(`[data-page="${pagina}"]`).forEach(btn => btn.classList.add('active'));
    }

    try {
        const resposta = await fetch(`pages/${pagina}.html`);
        if (!resposta.ok) throw new Error('Página não encontrada');
        const html = await resposta.text();
        container.innerHTML = html;
        lucide.createIcons();

        // Inicializa o controlador específico da tela carregada
        if (pagina === 'os' && typeof initKanbanOS === 'function') initKanbanOS();
        if (pagina === 'solicitacoes' && typeof initSolicitacoes === 'function') initSolicitacoes();
        if (pagina === 'configuracoes' && typeof initConfiguracoes === 'function') initConfiguracoes();
        if (pagina === 'saas-empresas' && typeof initSaaSEmpresas === 'function') initSaaSEmpresas();
        if (pagina === 'centros-custo' && typeof initCentrosCusto === 'function') initCentrosCusto();
        if (pagina === 'cad-ativos' && typeof initAtivos === 'function') initAtivos();
        if (pagina === 'cad-manutentores' && typeof initUsuariosCadastro === 'function') initUsuariosCadastro('Manutentor');
        if (pagina === 'cad-lideranca' && typeof initUsuariosCadastro === 'function') initUsuariosCadastro('Lideranca');

    } catch (err) {
        container.innerHTML = `<div class="p-8 text-center text-slate-500">Tela <b>${pagina}.html</b> não encontrada.</div>`;
    }
}

function abrirMenuCadastrosMobile() {
    document.getElementById('mobile-cadastros-drawer')?.classList.remove('hidden');
}

function fecharMenuCadastrosMobile() {
    document.getElementById('mobile-cadastros-drawer')?.classList.add('hidden');
}
