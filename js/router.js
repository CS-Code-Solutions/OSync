async function navegarPara(pagina) {
    const container = document.getElementById('app-content');
    
    // Atualiza estado ativo dos botões Desktop e Mobile
    document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => btn.classList.remove('active'));
    
    if (pagina.startsWith('cad-')) {
        document.getElementById('btn-menu-cadastros')?.classList.add('active');
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

        // Inicializa o script específico da página carregada
        if (pagina === 'os' && typeof initKanbanOS === 'function') initKanbanOS();
        if (pagina === 'configuracoes' && typeof initConfiguracoes === 'function') initConfiguracoes();
        if (pagina === 'cad-ativos' && typeof initAtivos === 'function') initAtivos();
        if (pagina === 'cad-manutentores' && typeof initUsuariosCadastro === 'function') initUsuariosCadastro('Manutentor');
        if (pagina === 'cad-lideranca' && typeof initUsuariosCadastro === 'function') initUsuariosCadastro('Lideranca');
if (pagina === 'saas-empresas' && typeof initSaaSEmpresas === 'function') initSaaSEmpresas();

    } catch (err) {
        container.innerHTML = `<div class="p-8 text-center text-slate-500">Tela <b>${pagina}.html</b> em construção.</div>`;
    }
}

function abrirMenuCadastrosMobile() {
    document.getElementById('mobile-cadastros-drawer').classList.remove('hidden');
}

function fecharMenuCadastrosMobile() {
    document.getElementById('mobile-cadastros-drawer').classList.add('hidden');
}
