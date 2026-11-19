/**
 * ============================================================================
 * OSync — Roteador SPA Modular (js/router.js)
 * ============================================================================
 */

const ROTAS_VALIDAS = [
    'dashboard',
    'os',
    'solicitacoes',
    'cad-manutentores',
    'cad-lideranca',
    'cad-ativos',
    'planos-manutencao',
    'relatorios',
    'empresas'
];

let paginaAtual = null;

/**
 * Navega para uma rota interna do App Shell
 */
async function navegarPara(pagina, atualizarHash = true) {
    if (!window.usuarioLogado) return;

    // Verifica permissão RBAC antes de carregar
    let paginaSegura = pagina;
    if (!ROTAS_VALIDAS.includes(paginaSegura) || !usuarioPodeAcessarPagina(paginaSegura)) {
        paginaSegura = obterPaginaInicialPermitida();
    }

    const container = document.getElementById('app-content');
    if (!container) return;

    // Estado de carregamento suave
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-slate-400">
            <i data-lucide="loader-2" class="w-8 h-8 animate-spin mb-3 text-slate-600"></i>
            <p class="text-sm font-medium">Carregando módulo...</p>
        </div>
    `;
    if (window.lucide) lucide.createIcons();

    try {
        const resposta = await fetch(`pages/${paginaSegura}.html?v=${Date.now()}`);
        if (!resposta.ok) {
            throw new Error(`Erro HTTP ${resposta.status} ao carregar pages/${paginaSegura}.html`);
        }

        const html = await resposta.text();
        container.innerHTML = html;
        paginaAtual = paginaSegura;

        if (atualizarHash) {
            window.history.replaceState(null, '', `#${paginaSegura}`);
        }

        atualizarDestaqueMenu(paginaSegura);

        if (window.lucide) lucide.createIcons();

        // Inicializa o controlador JS específico de cada módulo
        if (paginaSegura === 'dashboard' && typeof initDashboard === 'function') {
            await initDashboard();
        } else if (paginaSegura === 'os' && typeof initOS === 'function') {
            await initOS();
        } else if (paginaSegura === 'solicitacoes' && typeof initSolicitacoes === 'function') {
            await initSolicitacoes();
        } else if (paginaSegura === 'cad-manutentores' && typeof initCadastros === 'function') {
            await initCadastros('manutentores');
        } else if (paginaSegura === 'cad-lideranca' && typeof initCadastros === 'function') {
            await initCadastros('lideranca');
        } else if (paginaSegura === 'cad-ativos' && typeof initCadastros === 'function') {
            await initCadastros('ativos');
        } else if (paginaSegura === 'planos-manutencao' && typeof initPlanosManutencao === 'function') {
            await initPlanosManutencao();
        } else if (paginaSegura === 'relatorios' && typeof initRelatorios === 'function') {
            await initRelatorios();
        } else if (paginaSegura === 'empresas' && typeof initEmpresas === 'function') {
            await initEmpresas();
        }

    } catch (erro) {
        console.error('Erro ao navegar para página:', erro);
        container.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-2xl p-6 text-center max-w-md mx-auto my-12">
                <i data-lucide="alert-triangle" class="w-8 h-8 text-red-500 mx-auto mb-2"></i>
                <h3 class="text-base font-bold text-red-800">Falha ao carregar o módulo</h3>
                <p class="text-xs text-red-600 mt-1">${erro.message}</p>
                <button onclick="navegarPara('${paginaSegura}')" class="mt-4 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg">
                    Tentar Novamente
                </button>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }
}

/**
 * Destaca o botão ativo na barra superior e na gaveta mobile
 */
function atualizarDestaqueMenu(paginaSegura) {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('bg-slate-900', 'text-white', 'bg-indigo-600', 'active-nav');
        if (btn.dataset.nav === 'empresas') {
            btn.classList.add('text-indigo-600');
        } else {
            btn.classList.add('text-slate-600');
        }
    });

    // Destaca os botões correspondentes à rota atual
    document.querySelectorAll(`.nav-item[data-nav="${paginaSegura}"]`).forEach(btn => {
        btn.classList.remove('text-slate-600', 'text-indigo-600', 'hover:bg-slate-100', 'hover:bg-slate-50');
        if (paginaSegura === 'empresas') {
            btn.classList.add('bg-indigo-600', 'text-white', 'active-nav');
        } else {
            btn.classList.add('bg-slate-900', 'text-white', 'active-nav');
        }
    });

    // Se for uma subpágina de Cadastros, destaca o botão pai "Cadastros" no desktop
    if (paginaSegura.startsWith('cad-') || paginaSegura === 'planos-manutencao') {
        const btnPai = document.getElementById('btn-dropdown-cadastros');
        if (btnPai) {
            btnPai.classList.remove('text-slate-600');
            btnPai.classList.add('bg-slate-900', 'text-white', 'active-nav');
        }
    }
}

/* ============================================================================
   CONTROLES DE UI DO APP SHELL (DROPDOWN DESKTOP & DRAWER MOBILE)
   ============================================================================ */

function toggleDropdownCadastros(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('dropdown-cadastros-menu');
    if (menu) menu.classList.toggle('hidden');
}

function fecharDropdownCadastros() {
    const menu = document.getElementById('dropdown-cadastros-menu');
    if (menu) menu.classList.add('hidden');
}

document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('dropdown-cadastros-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        fecharDropdownCadastros();
    }
});

function abrirDrawerMobile() {
    const overlay = document.getElementById('mobile-drawer-overlay');
    const drawer = document.getElementById('mobile-drawer');
    if (overlay) overlay.classList.remove('hidden');
    if (drawer) drawer.classList.remove('translate-x-full');
}

function fecharDrawerMobile() {
    const overlay = document.getElementById('mobile-drawer-overlay');
    const drawer = document.getElementById('mobile-drawer');
    if (overlay) overlay.classList.add('hidden');
    if (drawer) drawer.classList.add('translate-x-full');
}

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && hash !== paginaAtual) {
        navegarPara(hash, false);
    }
});
