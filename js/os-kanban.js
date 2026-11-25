let cacheOrdensServico = [];
let cacheColunasOS = [];
let cacheAtivosOS = [];
let cacheTiposOS = [];
let cacheManutentoresOS = [];
let cachePlanosOS = [];
let manutentoresNovaOSSelecionados = [];
let osArrastadaId = null;
let unsubscribeOrdensOS = null;
let abaOSAtual = 'minhas'; // 'minhas' | 'todas' | 'solicitacoes'
let salvandoNovaOS = false;

function starterOcultaSolicitacoesKanban() {
    if (usuarioAtual?.perfil === 'SuperAdmin') return false;
    const planoEfetivo = typeof planoEmpresaAtual !== 'undefined' && planoEmpresaAtual
        ? planoEmpresaAtual
        : (typeof lerPlanoCacheEmpresa === 'function' ? lerPlanoCacheEmpresa(usuarioAtual?.empresaId) : null);
    return planoEfetivo === 'Starter';
}

function aplicarVisibilidadeAbaSolicitacoesKanban() {
    const ocultar = starterOcultaSolicitacoesKanban();
    const btnSol = document.getElementById('aba-os-solicitacoes');
    if (btnSol) {
        btnSol.classList.toggle('hidden', ocultar);
    }
    if (ocultar && abaOSAtual === 'solicitacoes') {
        abaOSAtual = 'minhas';
    }
}

function formatarRotuloAtivoOS(tag, nome) {
    const t = (tag || '').trim();
    const n = (nome || 'Equipamento').trim();
    return t ? `${t} - ${n}` : n;
}

function alternarPainelFiltrosOS() {
    const painel = document.getElementById('painel-filtros-os');
    const btn = document.getElementById('btn-toggle-filtros-os');
    if (!painel) return;

    const oculto = painel.classList.toggle('hidden');
    if (btn) {
        btn.classList.toggle('border-blue-600', !oculto);
        btn.classList.toggle('bg-blue-50', !oculto);
    }
}

function limparFiltrosOS() {
    const b = document.getElementById('filtro-os-busca');
    const c = document.getElementById('filtro-os-coluna');
    const p = document.getElementById('filtro-os-prioridade');
    const m = document.getElementById('filtro-os-manutentor');
    if (b) b.value = '';
    if (c) c.value = '';
    if (p) p.value = '';
    if (m) m.value = '';
    renderizarVisaoOS();
}

function selecionarAbaOS(aba) {
    if (aba === 'solicitacoes' && starterOcultaSolicitacoesKanban()) {
        aba = 'minhas';
    }
    abaOSAtual = aba;
    aplicarVisibilidadeAbaSolicitacoesKanban();

    const abas = ['minhas', 'todas', 'solicitacoes'];
    abas.forEach(nome => {
        const el = document.getElementById(`aba-os-${nome}`);
        const badge = document.getElementById(`cont-aba-${nome}`);
        if (!el) return;

        if (nome === aba) {
            el.className = 'px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl border border-b-0 border-slate-300 bg-white text-blue-700 shadow-2xs -mb-px flex items-center gap-1.5 shrink-0 transition';
            if (badge) badge.className = 'text-[11px] font-extrabold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700';
        } else {
            el.className = 'px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-xl border border-b-0 border-transparent bg-slate-200/70 text-slate-600 hover:bg-slate-200 flex items-center gap-1.5 shrink-0 transition';
            if (badge) badge.className = 'text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-slate-300/80 text-slate-700';
        }
    });

    renderizarVisaoOS();
}

function osPertenceAoUsuarioAtual(os) {
    const uid = usuarioAtual?.id || usuarioAtual?.uid || '';
    const nomeUsuario = (usuarioAtual?.nome || '').trim().toLowerCase();

    const ids = Array.isArray(os.manutentoresIds) && os.manutentoresIds.length > 0
        ? os.manutentoresIds
        : (os.manutentorId ? [os.manutentorId] : []);

    if (uid && ids.includes(uid)) return true;

    if (nomeUsuario) {
        const nomes = Array.isArray(os.manutentoresNomes) && os.manutentoresNomes.length > 0
            ? os.manutentoresNomes.map(n => String(n).trim().toLowerCase())
            : (os.manutentorNome ? String(os.manutentorNome).split(',').map(n => n.trim().toLowerCase()) : []);
        if (nomes.includes(nomeUsuario)) return true;
    }

    return false;
}

function osVeioDeSolicitacao(os) {
    return Boolean(os.solicitacaoId) || String(os.descricao || '').trim().startsWith('[Solicitação de ');
}

async function initKanbanOS() {
    abaOSAtual = 'minhas';
    aplicarVisibilidadeAbaSolicitacoesKanban();
    await carregarDadosBaseOS();
    iniciarEscutaOrdensServico();

    const formNovaOS = document.getElementById('form-nova-os');
    if (formNovaOS && !formNovaOS.dataset.bound) {
        formNovaOS.addEventListener('submit', salvarNovaOS);
        formNovaOS.dataset.bound = 'true';
    }

    const formEncOS = document.getElementById('form-encerramento-os');
    if (formEncOS && !formEncOS.dataset.bound && typeof confirmarEncerramentoOS === 'function') {
        formEncOS.addEventListener('submit', confirmarEncerramentoOS);
        formEncOS.dataset.bound = 'true';
    }

    const params = new URLSearchParams(window.location.search);
    const osIdUrl = params.get('os');
    if (osIdUrl) {
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
            if (typeof abrirDetalhesOS === 'function') abrirDetalhesOS(osIdUrl);
        }, 400);
    }
}

async function carregarDadosBaseOS() {
    aplicarVisibilidadeAbaSolicitacoesKanban();
    const empId = usuarioAtual.empresaId;
    const ehGestor = usuarioAtual.perfil === 'Admin' || usuarioAtual.perfil === 'SuperAdmin';

    const btnEditarKanban = document.getElementById('btn-editar-kanban-os');
    if (btnEditarKanban) {
        btnEditarKanban.classList.toggle('md:flex', ehGestor);
    }

    const btnLixeiraKanban = document.getElementById('btn-lixeira-kanban-os');
    if (btnLixeiraKanban) {
        btnLixeiraKanban.classList.toggle('md:flex', ehGestor);
    }

    const [colSnap, ativoSnap, tipoSnap, manSnap, planosSnap] = await Promise.all([
        db.collection('kanban_colunas').where('empresaId', '==', empId).get(),
        db.collection('ativos').where('empresaId', '==', empId).get(),
        db.collection('tipos_manutencao').where('empresaId', '==', empId).get(),
        db.collection('usuarios')
            .where('empresaId', '==', empId)
            .where('perfil', 'in', ['Manutentor', 'Admin'])
            .get(),
        db.collection('planos_manutencao').where('empresaId', '==', empId).get()
    ]);

    cacheColunasOS = colSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    cacheAtivosOS = ativoSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => formatarRotuloAtivoOS(a.codigoTag, a.nome).localeCompare(formatarRotuloAtivoOS(b.codigoTag, b.nome)));

    cacheTiposOS = tipoSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    cacheManutentoresOS = manSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.ativo !== false)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    cachePlanosOS = planosSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));

    const selColFiltro = document.getElementById('filtro-os-coluna');
    if (selColFiltro) {
        selColFiltro.innerHTML = '<option value="">Todos Status / Colunas</option>' +
            cacheColunasOS.map(c => `<option value="${escaparHTML(c.id)}">${escaparHTML(c.titulo)}</option>`).join('');
    }

    const selManFiltro = document.getElementById('filtro-os-manutentor');
    if (selManFiltro) {
        selManFiltro.innerHTML = '<option value="">Todos Manutentores / Gestão</option>' +
            cacheManutentoresOS.map(m => {
                const rotulo = m.perfil === 'Admin' ? `${m.nome} (Gestão)` : m.nome;
                return `<option value="${escaparHTML(m.id)}">${escaparHTML(rotulo)}</option>`;
            }).join('');
    }
}

function iniciarEscutaOrdensServico() {
    if (typeof unsubscribeOrdensOS === 'function') {
        unsubscribeOrdensOS();
        unsubscribeOrdensOS = null;
    }

    unsubscribeOrdensOS = db.collection('ordens_servico')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .onSnapshot((snap) => {
            cacheOrdensServico = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.numeroOs || 0) - (a.numeroOs || 0));

            if (typeof OSyncDataStore !== 'undefined') {
                OSyncDataStore.invalidarOrdens();
            }

            renderizarVisaoOS();
        }, (err) => {
            console.error('Erro ao carregar Ordens de Serviço:', err);
        });
}

function obterOSFiltradas() {
    aplicarVisibilidadeAbaSolicitacoesKanban();
    const busca = (document.getElementById('filtro-os-busca')?.value || '').toLowerCase();
    const colId = document.getElementById('filtro-os-coluna')?.value || '';
    const prio = document.getElementById('filtro-os-prioridade')?.value || '';
    const manId = document.getElementById('filtro-os-manutentor')?.value || '';

    const qtdFiltros = [busca, colId, prio, manId].filter(Boolean).length;
    const badgeFiltros = document.getElementById('badge-filtros-ativos-os');
    if (badgeFiltros) {
        if (qtdFiltros > 0) {
            badgeFiltros.textContent = qtdFiltros;
            badgeFiltros.classList.remove('hidden');
        } else {
            badgeFiltros.classList.add('hidden');
        }
    }

    const filtradasGerais = cacheOrdensServico.filter(os => {
        const numFormatado = `#os-${String(os.numeroOs || 0).padStart(4, '0')}`;
        const texto = `${numFormatado} ${os.ativoTag || ''} ${os.ativoNome || ''} ${os.descricao || ''}`.toLowerCase();
        if (busca && !texto.includes(busca)) return false;
        if (colId && os.colunaId !== colId) return false;
        if (prio && os.prioridade !== prio) return false;
        if (manId) {
            const ids = Array.isArray(os.manutentoresIds) && os.manutentoresIds.length > 0
                ? os.manutentoresIds
                : (os.manutentorId ? [os.manutentorId] : []);
            if (!ids.includes(manId)) return false;
        }
        return true;
    });

    const cMinhas = document.getElementById('cont-aba-minhas');
    const cTodas = document.getElementById('cont-aba-todas');
    const cSol = document.getElementById('cont-aba-solicitacoes');
    if (cMinhas) cMinhas.textContent = filtradasGerais.filter(osPertenceAoUsuarioAtual).length;
    if (cTodas) cTodas.textContent = filtradasGerais.length;
    if (cSol && !starterOcultaSolicitacoesKanban()) {
        cSol.textContent = filtradasGerais.filter(osVeioDeSolicitacao).length;
    }

    if (abaOSAtual === 'minhas') {
        return filtradasGerais.filter(osPertenceAoUsuarioAtual);
    }
    if (abaOSAtual === 'solicitacoes' && !starterOcultaSolicitacoesKanban()) {
        return filtradasGerais.filter(osVeioDeSolicitacao);
    }
    return filtradasGerais;
}

function renderizarVisaoOS() {
    const listaFiltrada = obterOSFiltradas();
    renderizarMobileOS(listaFiltrada);
    renderizarKanbanOS(listaFiltrada);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderizarMobileOS(ordens) {
    const container = document.getElementById('os-mobile-list');
    if (!container) return;

    if (ordens.length === 0) {
        container.innerHTML = `<div class="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-sm">Nenhuma Ordem de Serviço encontrada.</div>`;
        return;
    }

    const corPrioridade = {
        'Normal': 'bg-slate-100 text-slate-700',
        'Alta': 'bg-amber-100 text-amber-800',
        'Urgente': 'bg-rose-100 text-rose-700'
    };

    const badgeCondicao = {
        'Maquina parada': '<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-600 text-white">PARADA</span>',
        'Parcialmente funcional': '<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500 text-white">PARCIAL</span>'
    };

    container.innerHTML = ordens.map(os => {
        const col = cacheColunasOS.find(c => c.id === os.colunaId) || { titulo: 'Aberta', corTopo: '#1D4ED8' };
        const corCol = sanitizarCorHex(col.corTopo, '#1D4ED8');
        const osIdSeguro = escaparHTML(os.id);
        const tituloAtivo = escaparHTML(formatarRotuloAtivoOS(os.ativoTag, os.ativoNome));
        const nomesEquipe = Array.isArray(os.manutentoresNomes) && os.manutentoresNomes.length > 0
            ? os.manutentoresNomes.join(', ')
            : (os.manutentorNome || 'Sem técnico');

        const badgePlano = Array.isArray(os.checklistPlano) && os.checklistPlano.length > 0
            ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">PLANO (${os.checklistPlano.filter(i => i.status).length}/${os.checklistPlano.length})</span>`
            : '';

        return `
        <div onclick="abrirDetalhesOS('${osIdSeguro}')" class="osync-card p-4 active:scale-[0.99] transition cursor-pointer" style="border-left: 4px solid ${corCol}">
            <div class="flex items-center justify-between gap-2 mb-1.5">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-xs font-extrabold text-slate-500">#OS-${String(os.numeroOs || 0).padStart(4, '0')}</span>
                    ${badgeCondicao[os.condicaoMaquina] || ''}
                    ${badgePlano}
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${corPrioridade[os.prioridade] || 'bg-slate-100'}">${escaparHTML(os.prioridade)}</span>
                    <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white" style="background-color: ${corCol}">${escaparHTML(col.titulo)}</span>
                </div>
            </div>
            <h4 class="font-bold text-slate-900 text-sm">${tituloAtivo}</h4>
            <p class="text-xs text-slate-600 line-clamp-2 mt-1">${escaparHTML(os.descricao)}</p>
            <div class="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                <span class="truncate max-w-[65%]"><i data-lucide="users" class="w-3 h-3 inline mr-1"></i>${escaparHTML(nomesEquipe)}</span>
                <span class="font-semibold text-blue-600">${escaparHTML(os.tipoNome || '')}</span>
            </div>
        </div>`;
    }).join('');
}

function renderizarKanbanOS(ordens) {
    const board = document.getElementById('kanban-board');
    if (!board) return;

    if (cacheColunasOS.length === 0) {
        board.innerHTML = `<div class="bg-white p-8 rounded-xl border border-slate-200 text-slate-500">Nenhuma coluna configurada no Kanban.</div>`;
        return;
    }

    const corPrioridade = {
        'Normal': 'bg-slate-100 text-slate-600',
        'Alta': 'bg-amber-100 text-amber-800',
        'Urgente': 'bg-rose-100 text-rose-700'
    };

    const badgeCondicao = {
        'Maquina parada': '<span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-600 text-white">PARADA</span>',
        'Parcialmente funcional': '<span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500 text-white">PARCIAL</span>'
    };

    board.innerHTML = cacheColunasOS.map(col => {
        const cardsColuna = ordens.filter(o => o.colunaId === col.id);
        const corCol = sanitizarCorHex(col.corTopo, '#1D4ED8');
        const colIdSeguro = escaparHTML(col.id);
        return `
        <div class="flex-1 min-w-[230px] bg-slate-100/90 rounded-2xl border border-slate-200 flex flex-col max-h-full overflow-hidden"
            ondragover="permitirDropOS(event)" ondrop="soltarCardOS(event, '${colIdSeguro}')">
            <div class="p-3 bg-white rounded-t-2xl border-b border-slate-200 flex items-center justify-between gap-2 shrink-0" style="border-top: 4px solid ${corCol}">
                <h3 class="font-bold text-slate-800 text-sm truncate" title="${escaparHTML(col.titulo)}">${escaparHTML(col.titulo)}</h3>
                <span class="text-xs font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">${cardsColuna.length}</span>
            </div>

            <div class="p-2 space-y-2 flex-1 overflow-y-auto min-h-[120px] kanban-scroll">
                ${cardsColuna.map(os => {
                    const osIdSeguro = escaparHTML(os.id);
                    const tituloAtivo = escaparHTML(formatarRotuloAtivoOS(os.ativoTag, os.ativoNome));
                    const nomesEquipe = Array.isArray(os.manutentoresNomes) && os.manutentoresNomes.length > 0
                        ? os.manutentoresNomes.join(', ')
                        : (os.manutentorNome || 'Livre');
                    const badgePlano = Array.isArray(os.checklistPlano) && os.checklistPlano.length > 0
                        ? `<span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">PLANO ${os.checklistPlano.filter(i => i.status).length}/${os.checklistPlano.length}</span>`
                        : '';
                    return `
                    <div draggable="true" ondragstart="iniciarDragOS(event, '${osIdSeguro}')" ondragend="finalizarDragOS()" onclick="abrirDetalhesOS('${osIdSeguro}')"
                        class="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-400 transition cursor-pointer space-y-1.5">
                        <div class="flex items-center justify-between gap-1">
                            <div class="flex items-center gap-1 flex-wrap">
                                <span class="text-[11px] font-extrabold text-slate-400">#OS-${String(os.numeroOs || 0).padStart(4, '0')}</span>
                                ${badgeCondicao[os.condicaoMaquina] || ''}
                                ${badgePlano}
                            </div>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${corPrioridade[os.prioridade] || 'bg-slate-100'}">${escaparHTML(os.prioridade)}</span>
                        </div>
                        <div class="font-bold text-slate-900 text-xs leading-snug">${tituloAtivo}</div>
                        <p class="text-xs text-slate-600 line-clamp-2">${escaparHTML(os.descricao)}</p>
                        <div class="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                            <span class="truncate min-w-0"><i data-lucide="users" class="w-3 h-3 inline mr-1"></i>${escaparHTML(nomesEquipe)}</span>
                            <span class="font-semibold text-blue-600 shrink-0">${escaparHTML(os.tipoNome || '')}</span>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }).join('');
}

function iniciarDragOS(e, osId) {
    osArrastadaId = osId;
    e.dataTransfer.setData('text/plain', osId);

    const btnLixeira = document.getElementById('btn-lixeira-kanban-os');
    if (btnLixeira) {
        btnLixeira.classList.add('border-rose-400', 'text-rose-600', 'bg-rose-50/70');
    }
}

function finalizarDragOS() {
    const btnLixeira = document.getElementById('btn-lixeira-kanban-os');
    if (btnLixeira) {
        btnLixeira.classList.remove('border-rose-400', 'text-rose-600', 'bg-rose-50/70', 'bg-rose-600', 'text-white', 'scale-110');
    }
}

function permitirDropOS(e) {
    e.preventDefault();
}

async function soltarCardOS(e, novaColunaId) {
    e.preventDefault();
    const osId = osArrastadaId || e.dataTransfer.getData('text/plain');
    osArrastadaId = null;
    finalizarDragOS();
    if (!osId) return;

    const colDestino = cacheColunasOS.find(c => c.id === novaColunaId);
    const ehConcluida = colDestino && /conclu|finaliz|encerrad/i.test(colDestino.titulo || '');

    if (ehConcluida) {
        abrirDetalhesOS(osId);
        if (typeof mostrarFormularioEncerramento === 'function') {
            mostrarFormularioEncerramento();
        }
        return;
    }

    await db.collection('ordens_servico').doc(osId).update({
        colunaId: novaColunaId,
        encerrada: false
    });

    const osAtualizada = cacheOrdensServico.find(o => o.id === osId);
    if (osAtualizada && typeof dispararPushOSync === 'function') {
        const idsAlvo = Array.isArray(osAtualizada.manutentoresIds) && osAtualizada.manutentoresIds.length > 0
            ? osAtualizada.manutentoresIds
            : (osAtualizada.manutentorId ? [osAtualizada.manutentorId] : []);
        const numFmt = `#OS-${String(osAtualizada.numeroOs || 0).padStart(4, '0')}`;
        const tituloCol = colDestino?.titulo || 'Novo Status';

        dispararPushOSync({
            tipo: 'status_os',
            destinatariosIds: idsAlvo,
            perfisAlvo: idsAlvo.length === 0 ? ['Admin'] : [],
            titulo: `Status Atualizado: ${numFmt}`,
            corpo: `${formatarRotuloAtivoOS(osAtualizada.ativoTag, osAtualizada.ativoNome)} movida para "${tituloCol}".`,
            urlDestino: `/?os=${osId}`
        });
    }
}

// ==========================================
// LIXEIRA DRAG & DROP (EXCLUSÃO COM MOTIVO)
// ==========================================
function avisarUsoLixeiraOS() {
    if (typeof mostrarNotificacaoOSync === 'function') {
        mostrarNotificacaoOSync('Arraste o cartão de uma O.S. até a lixeira para excluí-la.', 'aviso');
    }
}

function permitirDropLixeiraOS(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-lixeira-kanban-os');
    if (btn) {
        btn.classList.add('bg-rose-600', 'text-white', 'border-rose-600', 'scale-110');
        btn.classList.remove('bg-white', 'text-slate-500');
    }
}

function sairDropLixeiraOS(e) {
    const btn = document.getElementById('btn-lixeira-kanban-os');
    if (btn) {
        btn.classList.remove('bg-rose-600', 'text-white', 'border-rose-600', 'scale-110');
        btn.classList.add('bg-white');
    }
}

function soltarCardNaLixeiraOS(e) {
    e.preventDefault();
    const osId = osArrastadaId || e.dataTransfer.getData('text/plain');
    osArrastadaId = null;
    finalizarDragOS();
    if (!osId) return;

    abrirModalExcluirOSLixeira(osId);
}

function abrirModalExcluirOSLixeira(osId) {
    const os = cacheOrdensServico.find(o => o.id === osId);
    if (!os) return;

    document.getElementById('excluir-os-id').value = os.id;
    document.getElementById('excluir-os-numero').textContent = `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`;
    document.getElementById('excluir-os-maquina').textContent = formatarRotuloAtivoOS(os.ativoTag, os.ativoNome);
    document.getElementById('excluir-os-motivo').value = '';

    document.getElementById('modal-excluir-os-lixeira')?.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(() => document.getElementById('excluir-os-motivo')?.focus(), 100);
}

function fecharModalExcluirOSLixeira() {
    document.getElementById('excluir-os-id').value = '';
    document.getElementById('excluir-os-motivo').value = '';
    document.getElementById('modal-excluir-os-lixeira')?.classList.add('hidden');
}

async function confirmarExclusaoOSLixeira(e) {
    e.preventDefault();
    const osId = document.getElementById('excluir-os-id').value;
    const motivo = document.getElementById('excluir-os-motivo').value.trim();
    const btn = document.getElementById('btn-confirmar-exclusao-os');

    if (!osId || !motivo) return;

    const os = cacheOrdensServico.find(o => o.id === osId);
    btn.disabled = true;
    btn.textContent = 'Excluindo...';

    try {
        if (os) {
            await db.collection('logs_exclusao_os').add({
                empresaId: usuarioAtual.empresaId,
                osId: os.id,
                numeroOs: os.numeroOs || 0,
                ativoNome: formatarRotuloAtivoOS(os.ativoTag, os.ativoNome),
                descricaoOriginal: os.descricao || '',
                motivoExclusao: motivo,
                excluidoPor: usuarioAtual.nome,
                excluidoEm: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(() => {});
        }

        await db.collection('ordens_servico').doc(osId).delete();

        fecharModalExcluirOSLixeira();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Ordem de Serviço excluída com sucesso!', 'sucesso');
        }
    } catch (err) {
        alert('Erro ao excluir O.S.: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i><span>Confirmar Exclusão</span>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// ==========================================
// MODAL NOVA O.S. (BUSCA DE MÁQUINA + PLANO DE MANUTENÇÃO + SELETOR MÚLTIPLO)
// ==========================================
function filtrarSelectAtivosNovaOS(ativoIdForcado = '') {
    const selAtivo = document.getElementById('os-ativo');
    if (!selAtivo) return;

    const termo = (document.getElementById('os-ativo-busca')?.value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    const valorAtual = ativoIdForcado || selAtivo.value;

    const filtrados = cacheAtivosOS.filter(a => {
        if (!termo) return true;
        const texto = `${a.codigoTag || ''} ${a.nome || ''} ${a.setor || ''} ${a.tipoEquipamento || ''}`
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        return texto.includes(termo);
    });

    if (filtrados.length === 0) {
        selAtivo.innerHTML = '<option value="">Nenhuma máquina encontrada...</option>';
        atualizarSelectPlanosNovaOS();
        return;
    }

    selAtivo.innerHTML = filtrados.map(a =>
        `<option value="${escaparHTML(a.id)}">${escaparHTML(formatarRotuloAtivoOS(a.codigoTag, a.nome))}</option>`
    ).join('');

    if (valorAtual && filtrados.some(a => a.id === valorAtual)) {
        selAtivo.value = valorAtual;
    }

    atualizarSelectPlanosNovaOS();
}

function atualizarSelectPlanosNovaOS() {
    const selPlano = document.getElementById('os-plano-manutencao');
    const resumoEl = document.getElementById('os-plano-resumo');
    if (!selPlano) return;

    const ativoId = document.getElementById('os-ativo')?.value || '';
    const planoAnterior = selPlano.value;

    const planosDaMaquina = cachePlanosOS.filter(p => p.ativoId && p.ativoId === ativoId);
    const planosGerais = cachePlanosOS.filter(p => !p.ativoId);

    let html = '<option value="">Nenhum plano vinculado (O.S. avulsa)</option>';

    if (planosDaMaquina.length > 0) {
        html += `<optgroup label="Planos desta Máquina">`;
        html += planosDaMaquina.map(p => {
            const qtd = Array.isArray(p.itens) ? p.itens.length : 0;
            return `<option value="${escaparHTML(p.id)}">${escaparHTML(p.titulo)} (${escaparHTML(p.periodicidade || 'Sob Demanda')} • ${qtd} itens)</option>`;
        }).join('');
        html += `</optgroup>`;
    }

    if (planosGerais.length > 0) {
        html += `<optgroup label="Planos Gerais">`;
        html += planosGerais.map(p => {
            const qtd = Array.isArray(p.itens) ? p.itens.length : 0;
            return `<option value="${escaparHTML(p.id)}">${escaparHTML(p.titulo)} (${escaparHTML(p.periodicidade || 'Sob Demanda')} • ${qtd} itens)</option>`;
        }).join('');
        html += `</optgroup>`;
    }

    selPlano.innerHTML = html;

    if (planoAnterior && [...planosDaMaquina, ...planosGerais].some(p => p.id === planoAnterior)) {
        selPlano.value = planoAnterior;
    } else {
        selPlano.value = '';
        if (resumoEl) resumoEl.classList.add('hidden');
    }
}

function aplicarPlanoSelecionadoNovaOS() {
    const planoId = document.getElementById('os-plano-manutencao')?.value || '';
    const resumoEl = document.getElementById('os-plano-resumo');
    const descEl = document.getElementById('os-descricao');
    const selTipo = document.getElementById('os-tipo');

    if (!planoId) {
        if (resumoEl) resumoEl.classList.add('hidden');
        return;
    }

    const plano = cachePlanosOS.find(p => p.id === planoId);
    if (!plano) return;

    const qtd = Array.isArray(plano.itens) ? plano.itens.length : 0;
    if (resumoEl) {
        resumoEl.textContent = `Checklist com ${qtd} ${qtd === 1 ? 'item' : 'itens'} será anexado à O.S.`;
        resumoEl.classList.remove('hidden');
    }

    if (selTipo) {
        const tipoPreventiva = cacheTiposOS.find(t => /preventiv/i.test(t.nome || ''));
        if (tipoPreventiva) selTipo.value = tipoPreventiva.id;
    }

    if (descEl && !descEl.value.trim()) {
        descEl.value = `Execução do Plano: ${plano.titulo} (${plano.periodicidade || 'Preventiva'}).`;
    }
}

function resetarFormularioNovaOS() {
    const formNova = document.getElementById('form-nova-os');
    if (formNova) formNova.reset();

    manutentoresNovaOSSelecionados = [];

    const buscaAtivoEl = document.getElementById('os-ativo-busca');
    if (buscaAtivoEl) buscaAtivoEl.value = '';

    const resumoPlanoEl = document.getElementById('os-plano-resumo');
    if (resumoPlanoEl) resumoPlanoEl.classList.add('hidden');

    const descEl = document.getElementById('os-descricao');
    if (descEl) descEl.value = '';

    const prioEl = document.getElementById('os-prioridade');
    if (prioEl) prioEl.value = 'Normal';

    const condEl = document.getElementById('os-condicao-maquina');
    if (condEl) condEl.value = 'Operacional';

    const paradaEl = document.getElementById('os-inicio-parada');
    if (paradaEl) paradaEl.value = '';

    const boxParada = document.getElementById('box-os-inicio-parada');
    if (boxParada) boxParada.classList.add('hidden');

    renderizarManutentoresNovaOS();
}

function renderizarManutentoresNovaOS() {
    const selMan = document.getElementById('os-manutentor-select');
    const chipsBox = document.getElementById('os-manutentores-chips');

    if (selMan) {
        const disponiveis = cacheManutentoresOS.filter(m => !manutentoresNovaOSSelecionados.some(sel => sel.id === m.id));
        const textoPadrao = manutentoresNovaOSSelecionados.length > 0
            ? '+ Adicionar outro responsável...'
            : 'Não atribuído (Livre) — Toque para escolher';

        selMan.innerHTML = `<option value="">${textoPadrao}</option>` +
            disponiveis.map(m => {
                const rotulo = m.perfil === 'Admin' ? `${m.nome} (Gestão)` : m.nome;
                return `<option value="${escaparHTML(m.id)}">${escaparHTML(rotulo)}</option>`;
            }).join('');
        selMan.value = '';
    }

    if (chipsBox) {
        if (manutentoresNovaOSSelecionados.length === 0) {
            chipsBox.innerHTML = '';
        } else {
            chipsBox.innerHTML = manutentoresNovaOSSelecionados.map(m => `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                    <span>${escaparHTML(m.nome)}</span>
                    <button type="button" onclick="removerManutentorNovaOS('${escaparHTML(m.id)}')" class="text-blue-500 hover:text-rose-600 font-extrabold leading-none">×</button>
                </span>
            `).join('');
        }
    }
}

function adicionarManutentorNovaOS() {
    const selMan = document.getElementById('os-manutentor-select');
    const manId = selMan?.value || '';
    if (!manId) return;

    const manObj = cacheManutentoresOS.find(m => m.id === manId);
    if (manObj && !manutentoresNovaOSSelecionados.some(s => s.id === manObj.id)) {
        manutentoresNovaOSSelecionados.push({ id: manObj.id, nome: manObj.nome });
    }
    renderizarManutentoresNovaOS();
}

function removerManutentorNovaOS(manId) {
    manutentoresNovaOSSelecionados = manutentoresNovaOSSelecionados.filter(m => m.id !== manId);
    renderizarManutentoresNovaOS();
}

async function abrirModalNovaOS() {
    resetarFormularioNovaOS();

    if (cacheAtivosOS.length === 0 || cacheColunasOS.length === 0 || cacheManutentoresOS.length === 0) {
        await carregarDadosBaseOS();
    } else {
        try {
            const planosSnap = await db.collection('planos_manutencao')
                .where('empresaId', '==', usuarioAtual.empresaId)
                .get();
            cachePlanosOS = planosSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
        } catch (err) {}
    }

    filtrarSelectAtivosNovaOS();

    document.getElementById('os-tipo').innerHTML = cacheTiposOS.map(t =>
        `<option value="${escaparHTML(t.id)}">${escaparHTML(t.nome)}</option>`
    ).join('');

    document.getElementById('os-coluna-inicial').innerHTML = cacheColunasOS.map(c =>
        `<option value="${escaparHTML(c.id)}">${escaparHTML(c.titulo)}</option>`
    ).join('');

    if (usuarioAtual.perfil === 'Manutentor' || usuarioAtual.perfil === 'Admin') {
        const uidAtual = usuarioAtual.id || usuarioAtual.uid;
        const proprio = cacheManutentoresOS.find(m => m.id === uidAtual);
        if (proprio) {
            manutentoresNovaOSSelecionados.push({ id: proprio.id, nome: proprio.nome });
        }
    }
    renderizarManutentoresNovaOS();

    alternarCampoParadaCriacaoOS();
    verificarTipoManutencaoCriacao();

    document.getElementById('modal-nova-os').classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function alternarCampoParadaCriacaoOS() {
    const condicao = document.getElementById('os-condicao-maquina')?.value;
    const boxParada = document.getElementById('box-os-inicio-parada');
    const inputInicioParada = document.getElementById('os-inicio-parada');
    if (!boxParada || !inputInicioParada) return;

    if (condicao === 'Maquina parada') {
        boxParada.classList.remove('hidden');
        inputInicioParada.required = true;
        if (!inputInicioParada.value) {
            const agora = new Date();
            agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
            inputInicioParada.value = agora.toISOString().slice(0, 16);
        }
    } else {
        boxParada.classList.add('hidden');
        inputInicioParada.required = false;
        inputInicioParada.value = '';
    }
}

function verificarTipoManutencaoCriacao() {
    const selTipo = document.getElementById('os-tipo');
    const textoTipo = selTipo?.options[selTipo.selectedIndex]?.text || '';
    if (textoTipo.toLowerCase().includes('externa')) {
        document.getElementById('os-prioridade').value = 'Alta';
    }
}

function fecharModalNovaOS() {
    resetarFormularioNovaOS();
    document.getElementById('modal-nova-os')?.classList.add('hidden');
}

async function salvarNovaOS(e) {
    e.preventDefault();
    if (salvandoNovaOS) return;

    const btn = document.getElementById('btn-criar-os');
    salvandoNovaOS = true;
    if (btn) btn.disabled = true;

    try {
        const empId = usuarioAtual.empresaId;
        const empRef = db.collection('empresas').doc(empId);

        const ativoId = document.getElementById('os-ativo').value;
        if (!ativoId) {
            alert('Selecione uma máquina válida na lista.');
            return;
        }
        const ativoObj = cacheAtivosOS.find(a => a.id === ativoId) || {};

        const numeroGerado = await db.runTransaction(async (tx) => {
            const doc = await tx.get(empRef);
            const atual = (doc.exists && doc.data().contadorOs) ? doc.data().contadorOs : 0;
            const proximo = atual + 1;
            tx.set(empRef, { contadorOs: proximo }, { merge: true });
            return proximo;
        });

        const planoId = document.getElementById('os-plano-manutencao')?.value || '';
        const planoObj = planoId ? cachePlanosOS.find(p => p.id === planoId) : null;
        const checklistPlano = planoObj && Array.isArray(planoObj.itens)
            ? planoObj.itens.map((it, idx) => ({
                ordem: it.ordem || idx + 1,
                descricao: it.descricao || '',
                status: '',
                motivo: ''
            }))
            : [];

        const tipoId = document.getElementById('os-tipo').value;
        const tipoObj = cacheTiposOS.find(t => t.id === tipoId) || {};

        const colunaId = document.getElementById('os-coluna-inicial').value;
        const prioridade = document.getElementById('os-prioridade').value;
        const condicaoMaquina = document.getElementById('os-condicao-maquina').value;
        const inicioParada = condicaoMaquina === 'Maquina parada'
            ? document.getElementById('os-inicio-parada').value
            : '';

        const manutentoresIds = manutentoresNovaOSSelecionados.map(m => m.id);
        const manutentoresNomes = manutentoresNovaOSSelecionados.map(m => m.nome);

        const descricao = document.getElementById('os-descricao').value.trim();

        const novaOSRef = await db.collection('ordens_servico').add({
            empresaId: empId,
            numeroOs: numeroGerado,
            ativoId,
            ativoTag: ativoObj.codigoTag || '',
            ativoNome: ativoObj.nome || '',
            planoId: planoObj ? planoObj.id : '',
            planoTitulo: planoObj ? (planoObj.titulo || '') : '',
            planoInstrucoes: planoObj ? (planoObj.instrucoes || '') : '',
            checklistPlano,
            tipoId,
            tipoNome: tipoObj.nome || '',
            colunaId,
            prioridade,
            condicaoMaquina,
            inicioParada,
            terminoParada: '',
            tempoParadaMinutos: 0,
            manutentorId: manutentoresIds[0] || '',
            manutentorNome: manutentoresNomes.join(', '),
            manutentoresIds,
            manutentoresNomes,
            descricao,
            encerrada: false,
            custoTotal: 0,
            itensCusto: [],
            anexos: [],
            criadoPor: usuarioAtual.nome,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (condicaoMaquina === 'Maquina parada' && ativoId) {
            await db.collection('ativos').doc(ativoId).update({ status: 'Parada' }).catch(() => {});
        } else if (condicaoMaquina === 'Parcialmente funcional' && ativoId) {
            await db.collection('ativos').doc(ativoId).update({ status: 'Manutencao' }).catch(() => {});
        }

        if (manutentoresIds.length > 0 && typeof dispararPushOSync === 'function') {
            dispararPushOSync({
                tipo: 'nova_os',
                destinatariosIds: manutentoresIds,
                titulo: `Nova O.S. Atribuída: #OS-${String(numeroGerado).padStart(4, '0')}`,
                corpo: `${formatarRotuloAtivoOS(ativoObj.codigoTag, ativoObj.nome)} (${prioridade}) - ${descricao.slice(0, 80)}`,
                urlDestino: `/?os=${novaOSRef.id}`
            });
        }

        fecharModalNovaOS();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync(`#OS-${String(numeroGerado).padStart(4, '0')} criada com sucesso!`, 'sucesso');
        }
    } catch (err) {
        alert('Erro ao criar O.S.: ' + err.message);
    } finally {
        salvandoNovaOS = false;
        if (btn) btn.disabled = false;
    }
}

// ==========================================
// MODAL FLUTUANTE DE EDIÇÃO DO KANBAN (NA TELA DE O.S.)
// ==========================================
async function abrirModalEditarKanbanOS() {
    document.getElementById('modal-editar-kanban-os')?.classList.remove('hidden');
    cancelarEdicaoColunaModalOS();
    await renderizarColunasModalOS();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function fecharModalEditarKanbanOS() {
    document.getElementById('modal-editar-kanban-os')?.classList.add('hidden');
}

async function renderizarColunasModalOS() {
    const lista = document.getElementById('lista-colunas-modal-os');
    if (!lista) return;

    const snap = await db.collection('kanban_colunas')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .get();

    cacheColunasOS = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    const selColFiltro = document.getElementById('filtro-os-coluna');
    if (selColFiltro) {
        const valorAtual = selColFiltro.value;
        selColFiltro.innerHTML = '<option value="">Todos Status / Colunas</option>' +
            cacheColunasOS.map(c => `<option value="${escaparHTML(c.id)}">${escaparHTML(c.titulo)}</option>`).join('');
        selColFiltro.value = valorAtual;
    }

    const inputOrdem = document.getElementById('os-col-ordem');
    const editId = document.getElementById('os-col-edit-id')?.value;
    if (inputOrdem && !editId) {
        const maiorOrdem = cacheColunasOS.reduce((max, c) => Math.max(max, Number(c.ordem) || 0), 0);
        inputOrdem.value = maiorOrdem + 1;
    }

    lista.innerHTML = cacheColunasOS.map((col, idx) => {
        const corCol = sanitizarCorHex(col.corTopo, '#1D4ED8');
        const colIdSeguro = escaparHTML(col.id);
        return `
        <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 gap-2">
            <div class="flex items-center gap-2 min-w-0">
                <span class="w-3 h-3 rounded-full shrink-0" style="background-color: ${corCol}"></span>
                <span class="text-xs font-bold text-slate-400 shrink-0">#${Number(col.ordem) || 0}</span>
                <span class="text-sm font-medium text-slate-700 truncate">${escaparHTML(col.titulo)}</span>
            </div>

            <div class="flex items-center gap-0.5 shrink-0">
                <button type="button" onclick="moverColunaModalOS(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Mover para cima"
                    class="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-25 transition">
                    <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>
                </button>
                <button type="button" onclick="moverColunaModalOS(${idx}, 1)" ${idx === cacheColunasOS.length - 1 ? 'disabled' : ''} title="Mover para baixo"
                    class="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-25 transition">
                    <i data-lucide="arrow-down" class="w-3.5 h-3.5"></i>
                </button>
                <button type="button" onclick="prepararEdicaoColunaModalOS('${colIdSeguro}')" title="Editar coluna"
                    class="p-1.5 rounded text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition">
                    <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                </button>
                <button type="button" onclick="excluirColunaModalOS('${colIdSeguro}')" title="Excluir coluna"
                    class="p-1.5 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        </div>`;
    }).join('') || '<p class="text-xs text-slate-400 text-center py-4">Nenhuma coluna cadastrada.</p>';

    renderizarVisaoOS();
}

async function salvarColunaModalOS(e) {
    e.preventDefault();
    const editId = document.getElementById('os-col-edit-id').value;
    const titulo = document.getElementById('os-col-titulo').value.trim();
    const ordem = parseInt(document.getElementById('os-col-ordem').value) || 1;
    const corTopo = sanitizarCorHex(document.getElementById('os-col-cor').value, '#1D4ED8');

    if (editId) {
        await db.collection('kanban_colunas').doc(editId).update({ titulo, ordem, corTopo });
        cancelarEdicaoColunaModalOS();
    } else {
        await db.collection('kanban_colunas').add({
            empresaId: usuarioAtual.empresaId,
            titulo,
            ordem,
            corTopo
        });
        document.getElementById('form-kanban-modal-os').reset();
    }

    await renderizarColunasModalOS();
}

async function moverColunaModalOS(indexAtual, direcao) {
    const novoIndex = indexAtual + direcao;
    if (novoIndex < 0 || novoIndex >= cacheColunasOS.length) return;

    const listaReordenada = [...cacheColunasOS];
    const [itemMovido] = listaReordenada.splice(indexAtual, 1);
    listaReordenada.splice(novoIndex, 0, itemMovido);

    const batch = db.batch();
    listaReordenada.forEach((col, i) => {
        batch.update(db.collection('kanban_colunas').doc(col.id), { ordem: i + 1 });
    });

    await batch.commit();
    await renderizarColunasModalOS();
}

function prepararEdicaoColunaModalOS(colId) {
    const col = cacheColunasOS.find(c => c.id === colId);
    if (!col) return;

    document.getElementById('os-col-edit-id').value = col.id;
    document.getElementById('os-col-titulo').value = col.titulo;
    document.getElementById('os-col-ordem').value = col.ordem;
    document.getElementById('os-col-cor').value = sanitizarCorHex(col.corTopo, '#1D4ED8');

    const btnSalvar = document.getElementById('btn-os-salvar-coluna');
    btnSalvar.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i><span>Salvar Alteração</span>';
    btnSalvar.className = 'flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 rounded-lg text-xs transition flex items-center justify-center gap-1.5';

    document.getElementById('btn-os-cancelar-edit-coluna').classList.remove('hidden');
    document.getElementById('os-col-titulo').focus();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function cancelarEdicaoColunaModalOS() {
    document.getElementById('os-col-edit-id').value = '';
    document.getElementById('form-kanban-modal-os')?.reset();

    const btnSalvar = document.getElementById('btn-os-salvar-coluna');
    if (btnSalvar) {
        btnSalvar.innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i><span>Adicionar Coluna</span>';
        btnSalvar.className = 'flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-xs transition flex items-center justify-center gap-1.5';
    }

    document.getElementById('btn-os-cancelar-edit-coluna')?.classList.add('hidden');

    const maiorOrdem = cacheColunasOS.reduce((max, c) => Math.max(max, Number(c.ordem) || 0), 0);
    const inputOrdem = document.getElementById('os-col-ordem');
    if (inputOrdem) inputOrdem.value = maiorOrdem + 1;
}

async function excluirColunaModalOS(colId) {
    const confirmado = await confirmarAcaoOSync(
        'Deseja excluir esta coluna do quadro Kanban?',
        { titulo: 'Excluir Coluna', textoConfirmar: 'Excluir' }
    );
    if (!confirmado) return;

    await db.collection('kanban_colunas').doc(colId).delete();

    const restantes = cacheColunasOS.filter(c => c.id !== colId);
    const batch = db.batch();
    restantes.forEach((col, i) => {
        batch.update(db.collection('kanban_colunas').doc(col.id), { ordem: i + 1 });
    });
    await batch.commit();

    if (document.getElementById('os-col-edit-id').value === colId) {
        cancelarEdicaoColunaModalOS();
    }
    await renderizarColunasModalOS();
}


let anexosOSAtual = [];
let itensCustoOSAtual = [];
let checklistOSAtual = [];
let cacheCentrosCustoOS = [];
let cacheManutentoresDetalhesOS = [];
let manutentoresDetalhesOSAtual = [];
let osAtualEhExterna = false;
let osAtualTeveParada = false;

function sanitizarURLImagem(url) {
    const str = String(url || '').trim();
    if (/^https?:\/\//i.test(str) || /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(str)) {
        return escaparHTML(str);
    }
    return '';
}

function selecionarAbaDetalhesOS(aba) {
    const painelDados = document.getElementById('painel-det-os-dados');
    const painelChecklist = document.getElementById('painel-det-os-checklist');
    const tabDados = document.getElementById('tab-det-os-dados');
    const tabChecklist = document.getElementById('tab-det-os-checklist');

    if (!painelDados || !painelChecklist) return;

    const classeAtiva = 'px-4 py-2 text-xs font-bold rounded-t-xl border border-b-0 border-slate-300 bg-white text-blue-700 shadow-2xs -mb-px flex items-center gap-1.5 shrink-0 transition';
    const classeInativa = 'px-4 py-2 text-xs font-semibold rounded-t-xl border border-b-0 border-transparent bg-slate-200/80 text-slate-600 hover:bg-slate-200 flex items-center gap-1.5 shrink-0 transition';

    if (aba === 'checklist' && checklistOSAtual.length > 0) {
        painelDados.classList.add('hidden');
        painelChecklist.classList.remove('hidden');
        if (tabDados) tabDados.className = classeInativa;
        if (tabChecklist) tabChecklist.className = classeAtiva;
    } else {
        painelChecklist.classList.add('hidden');
        painelDados.classList.remove('hidden');
        if (tabDados) tabDados.className = classeAtiva;
        if (tabChecklist) tabChecklist.className = classeInativa;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function atualizarContadorChecklistPlano() {
    const total = checklistOSAtual.length;
    const respondidos = checklistOSAtual.filter(i => i.status === 'OK' || i.status === 'NAO_OK').length;
    const texto = `${respondidos}/${total}`;

    const badgeAba = document.getElementById('det-checklist-progresso');
    const badgeInterno = document.getElementById('det-checklist-progresso-interno');

    if (badgeAba) {
        badgeAba.textContent = texto;
        badgeAba.className = (total > 0 && respondidos === total)
            ? 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700'
            : 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-300/80 text-slate-700';
    }

    if (badgeInterno) {
        badgeInterno.textContent = `${texto} verificados`;
        badgeInterno.className = (total > 0 && respondidos === total)
            ? 'text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700'
            : 'text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800';
    }
}

function renderizarChecklistPlanoOS() {
    const container = document.getElementById('det-lista-checklist-plano');
    if (!container) return;

    atualizarContadorChecklistPlano();

    if (checklistOSAtual.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = checklistOSAtual.map((item, idx) => {
        const isOK = item.status === 'OK';
        const isNaoOK = item.status === 'NAO_OK';

        const bordaCard = isOK
            ? 'border-emerald-300 bg-emerald-50/40'
            : (isNaoOK ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200 bg-white');

        return `
        <div class="p-3 rounded-xl border ${bordaCard} space-y-2 transition">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div class="text-xs text-slate-800 font-semibold flex items-start gap-2">
                    <span class="font-mono font-bold text-slate-400 shrink-0">${idx + 1}.</span>
                    <span>${escaparHTML(item.descricao || '')}</span>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="marcarItemChecklistOS(${idx}, 'OK')"
                        class="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition ${isOK ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs' : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-500 hover:text-emerald-700'}">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i>
                        <span>OK</span>
                    </button>

                    <button type="button" onclick="marcarItemChecklistOS(${idx}, 'NAO_OK')"
                        class="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition ${isNaoOK ? 'bg-rose-600 text-white border-rose-600 shadow-2xs' : 'bg-white text-slate-600 border-slate-300 hover:border-rose-500 hover:text-rose-700'}">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        <span>Não OK</span>
                    </button>
                </div>
            </div>

            ${isNaoOK ? `
            <div class="pt-1">
                <label class="block text-[11px] font-bold text-rose-700 mb-1">Motivo da não conformidade *</label>
                <input type="text" value="${escaparHTML(item.motivo || '')}"
                    onchange="atualizarMotivoChecklistOS(${idx}, this.value)"
                    placeholder="Descreva o problema encontrado neste item..."
                    class="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs text-slate-800 outline-none focus:border-rose-600">
            </div>` : ''}
        </div>`;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function marcarItemChecklistOS(idx, novoStatus) {
    if (!checklistOSAtual[idx]) return;

    checklistOSAtual[idx].status = novoStatus;
    if (novoStatus === 'OK') {
        checklistOSAtual[idx].motivo = '';
    }

    renderizarChecklistPlanoOS();
    await salvarChecklistPlanoNoFirestore();
}

async function atualizarMotivoChecklistOS(idx, valorMotivo) {
    if (!checklistOSAtual[idx]) return;
    checklistOSAtual[idx].motivo = String(valorMotivo || '').trim();
    await salvarChecklistPlanoNoFirestore();
}

async function salvarChecklistPlanoNoFirestore() {
    const osId = document.getElementById('det-os-id')?.value;
    if (!osId) return;

    try {
        await db.collection('ordens_servico').doc(osId).update({
            checklistPlano: checklistOSAtual
        });
    } catch (err) {
        console.warn('Erro ao salvar progresso do checklist:', err);
    }
}

function obterColunaConclusaoOS() {
    if (!Array.isArray(cacheColunasOS) || cacheColunasOS.length === 0) return null;
    const ordenadas = [...cacheColunasOS].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    return (
        ordenadas.find(c => /conclu|finaliz|encerrad/i.test(c.titulo || '')) ||
        ordenadas[ordenadas.length - 1]
    );
}

function calcularMinutosParadaEntreDatas(inicioISO, terminoISO) {
    if (!inicioISO || !terminoISO) return 0;
    const d1 = new Date(inicioISO);
    const d2 = new Date(terminoISO);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 60000));
}

function recalcularTempoParadaEncerramento() {
    const ini = document.getElementById('enc-inicio-parada')?.value || '';
    const fim = document.getElementById('enc-termino-parada')?.value || '';
    const badge = document.getElementById('enc-tempo-parada-calculado');
    if (!badge) return;

    const mins = calcularMinutosParadaEntreDatas(ini, fim);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    badge.textContent = `${h}h ${String(m).padStart(2, '0')}m`;
}

function recalcularTempoTrabalhoEncerramento() {
    const ini = document.getElementById('enc-inicio-trabalho')?.value || '';
    const fim = document.getElementById('enc-data-hora')?.value || '';
    const badge = document.getElementById('enc-tempo-trabalho-calculado');
    if (!badge) return;

    const mins = calcularMinutosParadaEntreDatas(ini, fim);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    badge.textContent = `${h}h ${String(m).padStart(2, '0')}m`;
}

function resetarEstadoModalDetalhesOS() {
    anexosOSAtual = [];
    itensCustoOSAtual = [];
    checklistOSAtual = [];
    manutentoresDetalhesOSAtual = [];
    osAtualEhExterna = false;
    osAtualTeveParada = false;

    const barraAbas = document.getElementById('det-os-abas-excel');
    if (barraAbas) barraAbas.classList.add('hidden');

    selecionarAbaDetalhesOS('dados');

    const formEnc = document.getElementById('form-encerramento-os');
    if (formEnc) {
        formEnc.reset();
        formEnc.classList.add('hidden');
    }

    const boxAbrir = document.getElementById('box-botao-abrir-encerramento');
    if (boxAbrir) boxAbrir.classList.remove('hidden');

    const camposTexto = [
        'det-os-id',
        'enc-servico-realizado',
        'enc-observacoes',
        'item-custo-desc',
        'item-custo-valor',
        'enc-inicio-trabalho',
        'enc-data-hora',
        'enc-inicio-parada',
        'enc-termino-parada'
    ];
    camposTexto.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const inputFotos = document.getElementById('enc-input-fotos');
    if (inputFotos) inputFotos.value = '';

    const uploadStatus = document.getElementById('enc-upload-status');
    if (uploadStatus) uploadStatus.classList.add('hidden');

    const badgeTrab = document.getElementById('enc-tempo-trabalho-calculado');
    if (badgeTrab) badgeTrab.textContent = '0h 00m';

    const badgeParada = document.getElementById('enc-tempo-parada-calculado');
    if (badgeParada) badgeParada.textContent = '0h 00m';

    const listaAnexos = document.getElementById('enc-lista-anexos');
    if (listaAnexos) listaAnexos.innerHTML = '<span class="text-[11px] text-slate-400">Nenhuma foto anexada.</span>';

    const listaCustos = document.getElementById('enc-lista-custos');
    if (listaCustos) listaCustos.innerHTML = '<p class="text-[11px] text-slate-400">Nenhum item de custo lançado.</p>';

    const totalLabel = document.getElementById('enc-custo-total-label');
    if (totalLabel) totalLabel.textContent = '0,00';
}

function renderizarManutentoresDetalhesOS() {
    const selMan = document.getElementById('det-os-manutentor-select');
    const chipsBox = document.getElementById('det-os-manutentores-chips');

    if (selMan) {
        const disponiveis = cacheManutentoresDetalhesOS.filter(m => !manutentoresDetalhesOSAtual.some(sel => sel.id === m.id));
        const textoPadrao = manutentoresDetalhesOSAtual.length > 0
            ? '+ Adicionar parceria / responsável...'
            : 'Sem técnico — Toque para escolher';

        selMan.innerHTML = `<option value="">${textoPadrao}</option>` +
            disponiveis.map(m => {
                const rotulo = m.perfil === 'Admin' ? `${m.nome} (Gestão)` : m.nome;
                return `<option value="${escaparHTML(m.id)}">${escaparHTML(rotulo)}</option>`;
            }).join('');
        selMan.value = '';
    }

    if (chipsBox) {
        if (manutentoresDetalhesOSAtual.length === 0) {
            chipsBox.innerHTML = '';
        } else {
            chipsBox.innerHTML = manutentoresDetalhesOSAtual.map(m => `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                    <span>${escaparHTML(m.nome)}</span>
                    <button type="button" onclick="removerManutentorDetalhesOS('${escaparHTML(m.id)}')" class="text-blue-500 hover:text-rose-600 font-extrabold leading-none">×</button>
                </span>
            `).join('');
        }
    }
}

async function adicionarManutentorDetalhesOS() {
    const selMan = document.getElementById('det-os-manutentor-select');
    const manId = selMan?.value || '';
    if (!manId) return;

    const manObj = cacheManutentoresDetalhesOS.find(m => m.id === manId);
    if (manObj && !manutentoresDetalhesOSAtual.some(s => s.id === manObj.id)) {
        manutentoresDetalhesOSAtual.push({ id: manObj.id, nome: manObj.nome });
    }
    renderizarManutentoresDetalhesOS();
    await atualizarManutentorRapidoOS();
}

async function removerManutentorDetalhesOS(manId) {
    manutentoresDetalhesOSAtual = manutentoresDetalhesOSAtual.filter(m => m.id !== manId);
    renderizarManutentoresDetalhesOS();
    await atualizarManutentorRapidoOS();
}

async function abrirDetalhesOS(osId) {
    const os = cacheOrdensServico.find(o => o.id === osId);
    if (!os) return;

    resetarEstadoModalDetalhesOS();

    const coluna = cacheColunasOS.find(c => c.id === os.colunaId) || { titulo: 'Aberta', corTopo: '#00E5B0' };
    osAtualEhExterna = (os.tipoNome || '').trim().toLowerCase() === 'manutenção externa';
    osAtualTeveParada = os.condicaoMaquina === 'Maquina parada' || os.maquinaParada === true || Boolean(os.inicioParada);

    document.getElementById('det-os-id').value = os.id;
    document.getElementById('det-os-numero').textContent = `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`;

    const badge = document.getElementById('det-os-status-badge');
    badge.textContent = coluna.titulo;
    badge.style.backgroundColor = sanitizarCorHex(coluna.corTopo, '#00E5B0');

    const condBadge = document.getElementById('det-os-condicao-badge');
    if (condBadge) {
        if (osAtualTeveParada) {
            condBadge.textContent = 'Máquina Parada';
            condBadge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-600 text-white';
            condBadge.classList.remove('hidden');
        } else if (os.condicaoMaquina === 'Parcialmente funcional') {
            condBadge.textContent = 'Parcialmente Funcional';
            condBadge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500 text-white';
            condBadge.classList.remove('hidden');
        } else {
            condBadge.classList.add('hidden');
        }
    }

    const tituloMaquina = (os.ativoTag || '').trim() ? `${os.ativoTag} - ${os.ativoNome}` : (os.ativoNome || 'Equipamento');
    document.getElementById('det-os-maquina').textContent = tituloMaquina;
    document.getElementById('det-os-tipo').textContent = os.tipoNome || 'Manutenção';
    document.getElementById('det-os-prioridade').textContent = `Prioridade: ${os.prioridade || 'Normal'}`;
    document.getElementById('det-os-descricao').textContent = os.descricao;

    // Carrega Checklist do Plano e controla Abas Estilo Excel
    checklistOSAtual = Array.isArray(os.checklistPlano)
        ? os.checklistPlano.map(it => ({ ...it }))
        : [];

    const barraAbas = document.getElementById('det-os-abas-excel');
    if (checklistOSAtual.length > 0) {
        if (barraAbas) barraAbas.classList.remove('hidden');
        const tituloPlanoEl = document.getElementById('det-plano-titulo');
        if (tituloPlanoEl) tituloPlanoEl.textContent = os.planoTitulo || 'Plano de Manutenção';

        const instPlanoEl = document.getElementById('det-plano-instrucoes');
        if (instPlanoEl) {
            if ((os.planoInstrucoes || '').trim()) {
                instPlanoEl.textContent = os.planoInstrucoes;
                instPlanoEl.classList.remove('hidden');
            } else {
                instPlanoEl.classList.add('hidden');
            }
        }
        renderizarChecklistPlanoOS();
    } else {
        if (barraAbas) barraAbas.classList.add('hidden');
    }
    selecionarAbaDetalhesOS('dados');

    const selCol = document.getElementById('det-os-coluna-select');
    selCol.innerHTML = cacheColunasOS.map(c =>
        `<option value="${escaparHTML(c.id)}" ${c.id === os.colunaId ? 'selected' : ''}>${escaparHTML(c.titulo)}</option>`
    ).join('');

    const [manutSnap, ativosSnap] = await Promise.all([
        db.collection('usuarios')
            .where('empresaId', '==', usuarioAtual.empresaId)
            .where('perfil', 'in', ['Manutentor', 'Admin'])
            .get(),
        db.collection('ativos').where('empresaId', '==', usuarioAtual.empresaId).get()
    ]);

    cacheManutentoresDetalhesOS = manutSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.ativo !== false)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    const idsSelecionados = Array.isArray(os.manutentoresIds) && os.manutentoresIds.length > 0
        ? os.manutentoresIds
        : (os.manutentorId ? [os.manutentorId] : []);

    const nomesSelecionados = Array.isArray(os.manutentoresNomes) && os.manutentoresNomes.length > 0
        ? os.manutentoresNomes
        : (os.manutentorNome ? [os.manutentorNome] : []);

    manutentoresDetalhesOSAtual = idsSelecionados.map((id, idx) => {
        const encontrado = cacheManutentoresDetalhesOS.find(m => m.id === id);
        return {
            id,
            nome: encontrado ? encontrado.nome : (nomesSelecionados[idx] || 'Técnico')
        };
    });

    renderizarManutentoresDetalhesOS();

    cacheCentrosCustoOS = ativosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const selCC = document.getElementById('item-custo-cc');
    if (selCC) {
        const labelPadraoOS = escaparHTML(tituloMaquina);
        selCC.innerHTML = cacheCentrosCustoOS.map(a => {
            const rotulo = (a.codigoTag || '').trim() ? `${a.codigoTag} - ${a.nome}` : a.nome;
            const label = escaparHTML(rotulo);
            const selecionado = a.id === os.ativoId ? 'selected' : '';
            return `<option value="${label}" ${selecionado}>${label}</option>`;
        }).join('') || `<option value="${labelPadraoOS}" selected>${labelPadraoOS}</option>`;
    }

    aplicarLayoutCustosPorTipo(osAtualEhExterna);

    anexosOSAtual = Array.isArray(os.anexos) ? [...os.anexos] : [];
    itensCustoOSAtual = Array.isArray(os.itensCusto) ? [...os.itensCusto] : [];

    document.getElementById('enc-servico-realizado').value = os.servicoRealizado || '';
    document.getElementById('enc-observacoes').value = os.observacoes || '';

    const agora = new Date();
    agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
    const agoraISO = agora.toISOString().slice(0, 16);

    let inicioPadraoOS = os.inicioExecucao || os.inicioParada || '';
    if (!inicioPadraoOS && os.criadoEm?.toDate) {
        const dCriado = os.criadoEm.toDate();
        dCriado.setMinutes(dCriado.getMinutes() - dCriado.getTimezoneOffset());
        inicioPadraoOS = dCriado.toISOString().slice(0, 16);
    }

    const inpIniTrab = document.getElementById('enc-inicio-trabalho');
    if (inpIniTrab) inpIniTrab.value = os.inicioExecucao || '';

    const inpEncerramento = document.getElementById('enc-data-hora');
    if (inpEncerramento) inpEncerramento.value = os.dataHoraEncerramento || '';

    recalcularTempoTrabalhoEncerramento();

    const blocoParada = document.getElementById('bloco-encerramento-parada');
    const inpIniParada = document.getElementById('enc-inicio-parada');
    const inpFimParada = document.getElementById('enc-termino-parada');
    if (blocoParada && inpIniParada && inpFimParada) {
        if (osAtualTeveParada) {
            blocoParada.classList.remove('hidden');
            inpIniParada.required = true;
            inpFimParada.required = true;

            inpIniParada.value = os.inicioParada || inicioPadraoOS || agoraISO;
            inpFimParada.value = os.terminoParada || agoraISO;
            recalcularTempoParadaEncerramento();
        } else {
            blocoParada.classList.add('hidden');
            inpIniParada.required = false;
            inpFimParada.required = false;
            inpIniParada.value = '';
            inpFimParada.value = '';
        }
    }

    renderizarAnexosOS();
    renderizarItensCustoOS();

    if (os.encerrada) {
        mostrarFormularioEncerramento();
    } else {
        document.getElementById('form-encerramento-os').classList.add('hidden');
        document.getElementById('box-botao-abrir-encerramento').classList.remove('hidden');
    }

    document.getElementById('modal-detalhes-os').classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function aplicarLayoutCustosPorTipo(ehExterna) {
    const tituloCustos = document.getElementById('label-titulo-custos');
    const inputDesc = document.getElementById('item-custo-desc');
    const selCC = document.getElementById('item-custo-cc');
    const inputValor = document.getElementById('item-custo-valor');
    const wrapperValor = inputValor?.parentElement;

    if (!inputDesc || !selCC || !inputValor || !wrapperValor) return;

    if (ehExterna) {
        if (tituloCustos) {
            tituloCustos.innerHTML = `<i data-lucide="briefcase" class="w-4 h-4 text-purple-600"></i><span>Serviço Terceirizado & Valor</span>`;
        }
        inputDesc.placeholder = 'Descrição do serviço externo / Fornecedor';
        inputDesc.className = 'sm:col-span-7 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-purple-600';

        selCC.classList.add('hidden');

        wrapperValor.className = 'sm:col-span-5 flex gap-1.5';
        inputValor.placeholder = 'Valor do Serviço (R$)';
    } else {
        if (tituloCustos) {
            tituloCustos.innerHTML = `<i data-lucide="dollar-sign" class="w-4 h-4 text-emerald-600"></i><span>Peças, Materiais & Custos</span>`;
        }
        inputDesc.placeholder = 'Item / Peça utilizada';
        inputDesc.className = 'sm:col-span-5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none';

        selCC.classList.remove('hidden');
        selCC.className = 'sm:col-span-4 px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none';

        wrapperValor.className = 'sm:col-span-3 flex gap-1.5';
        inputValor.placeholder = 'R$ 0,00';
    }
}

function fecharModalDetalhesOS() {
    resetarEstadoModalDetalhesOS();
    document.getElementById('modal-detalhes-os').classList.add('hidden');
}

function mostrarFormularioEncerramento() {
    document.getElementById('box-botao-abrir-encerramento').classList.add('hidden');
    document.getElementById('form-encerramento-os').classList.remove('hidden');
    recalcularTempoTrabalhoEncerramento();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function atualizarStatusRapidoOS() {
    const osId = document.getElementById('det-os-id').value;
    const novaColId = document.getElementById('det-os-coluna-select').value;
    const os = cacheOrdensServico.find(o => o.id === osId);

    const colunaConclusao = obterColunaConclusaoOS();
    const ehColunaFinal = colunaConclusao && colunaConclusao.id === novaColId;

    if (ehColunaFinal && os && !os.encerrada) {
        document.getElementById('det-os-coluna-select').value = os.colunaId;
        mostrarFormularioEncerramento();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Preencha os dados abaixo e clique em Confirmar Encerramento.', 'aviso');
        }
        return;
    }

    await db.collection('ordens_servico').doc(osId).update({
        colunaId: novaColId,
        encerrada: ehColunaFinal ? true : false
    });

    const col = cacheColunasOS.find(c => c.id === novaColId);
    if (col) {
        const badge = document.getElementById('det-os-status-badge');
        badge.textContent = col.titulo;
        badge.style.backgroundColor = sanitizarCorHex(col.corTopo, '#00E5B0');
    }

    if (os && col && typeof dispararPushOSync === 'function') {
        const idsAlvo = Array.isArray(os.manutentoresIds) && os.manutentoresIds.length > 0
            ? os.manutentoresIds
            : (os.manutentorId ? [os.manutentorId] : []);
        const numFmt = `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`;
        dispararPushOSync({
            tipo: 'status_os',
            destinatariosIds: idsAlvo,
            perfisAlvo: ['Admin'],
            titulo: `Status Atualizado: ${numFmt}`,
            corpo: `${os.ativoNome || 'Equipamento'} agora está em "${col.titulo}".`,
            urlDestino: `/?os=${osId}`
        });
    }
}

async function atualizarManutentorRapidoOS() {
    const osId = document.getElementById('det-os-id').value;
    const manutentoresIds = manutentoresDetalhesOSAtual.map(m => m.id);
    const manutentoresNomes = manutentoresDetalhesOSAtual.map(m => m.nome);

    await db.collection('ordens_servico').doc(osId).update({
        manutentorId: manutentoresIds[0] || '',
        manutentorNome: manutentoresNomes.join(', '),
        manutentoresIds,
        manutentoresNomes
    });
}

async function processarUploadFotosOS(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const osId = document.getElementById('det-os-id').value;
    const statusEl = document.getElementById('enc-upload-status');
    if (statusEl) statusEl.classList.remove('hidden');

    try {
        for (const file of files) {
            const url = await compactarEEnviarImagemOS(file, usuarioAtual.empresaId, osId);
            if (url) anexosOSAtual.push(url);
        }
        renderizarAnexosOS();
    } catch (err) {
        alert('Erro ao processar imagem: ' + err.message);
    } finally {
        if (statusEl) statusEl.classList.add('hidden');
        event.target.value = '';
    }
}

function renderizarAnexosOS() {
    const container = document.getElementById('enc-lista-anexos');
    if (!container) return;

    if (anexosOSAtual.length === 0) {
        container.innerHTML = '<span class="text-[11px] text-slate-400">Nenhuma foto anexada.</span>';
        return;
    }

    container.innerHTML = anexosOSAtual.map((url, idx) => {
        const urlSegura = sanitizarURLImagem(url);
        if (!urlSegura) return '';
        return `
        <div class="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-slate-300 bg-white">
            <a href="${urlSegura}" target="_blank" rel="noopener noreferrer">
                <img src="${urlSegura}" class="w-full h-full object-cover">
            </a>
            <button type="button" onclick="removerAnexoOS(${idx})"
                class="absolute top-0.5 right-0.5 bg-rose-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">×</button>
        </div>`;
    }).join('');
}

function removerAnexoOS(idx) {
    anexosOSAtual.splice(idx, 1);
    renderizarAnexosOS();
}

function adicionarItemCustoOS() {
    const osId = document.getElementById('det-os-id').value;
    const os = cacheOrdensServico.find(o => o.id === osId);
    const padraoMaquina = os
        ? ((os.ativoTag || '').trim() ? `${os.ativoTag} - ${os.ativoNome}` : os.ativoNome)
        : 'Máquina';

    const descInput = document.getElementById('item-custo-desc');
    const desc = descInput.value.trim() || (osAtualEhExterna ? 'Serviço de Manutenção Externa' : '');
    const cc = osAtualEhExterna ? padraoMaquina : (document.getElementById('item-custo-cc')?.value || padraoMaquina);
    const valor = parseFloat(document.getElementById('item-custo-valor').value) || 0;

    if (!desc) {
        alert('Informe o nome do item ou peça.');
        return;
    }

    if (valor <= 0 && osAtualEhExterna) {
        alert('Informe o valor do serviço externo.');
        return;
    }

    itensCustoOSAtual.push({
        descricao: desc,
        centroCusto: cc,
        valor,
        tipoCusto: osAtualEhExterna ? 'Serviço Externo' : 'Peça/Material'
    });

    descInput.value = '';
    document.getElementById('item-custo-valor').value = '';
    renderizarItensCustoOS();
}

function removerItemCustoOS(idx) {
    itensCustoOSAtual.splice(idx, 1);
    renderizarItensCustoOS();
}

function renderizarItensCustoOS() {
    const lista = document.getElementById('enc-lista-custos');
    const totalLabel = document.getElementById('enc-custo-total-label');

    const total = itensCustoOSAtual.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
    if (totalLabel) totalLabel.textContent = total.toFixed(2).replace('.', ',');

    if (!lista) return;

    if (itensCustoOSAtual.length === 0) {
        lista.innerHTML = `<p class="text-[11px] text-slate-400">${osAtualEhExterna ? 'Nenhum valor de serviço lançado.' : 'Nenhum item de custo lançado.'}</p>`;
        return;
    }

    lista.innerHTML = itensCustoOSAtual.map((item, idx) => `
        <div class="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <div class="min-w-0 pr-2">
                <span class="font-bold text-slate-800">${escaparHTML(item.descricao)}</span>
                <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 ml-1">${escaparHTML(item.centroCusto)}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <span class="font-bold text-emerald-700">R$ ${Number(item.valor).toFixed(2).replace('.', ',')}</span>
                <button type="button" onclick="removerItemCustoOS(${idx})" class="text-rose-500 hover:text-rose-700 font-bold px-1">×</button>
            </div>
        </div>
    `).join('');
}

async function confirmarEncerramentoOS(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-confirmar-encerramento');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        // Valida Checklist do Plano antes de encerrar
        if (checklistOSAtual.length > 0) {
            const pendentes = checklistOSAtual.filter(i => i.status !== 'OK' && i.status !== 'NAO_OK');
            if (pendentes.length > 0) {
                selecionarAbaDetalhesOS('checklist');
                alert(`Responda todos os itens do Checklist do Plano (OK ou Não OK) antes de encerrar. Faltam ${pendentes.length} item(ns).`);
                btn.disabled = false;
                btn.textContent = 'Confirmar Encerramento';
                return;
            }

            const semMotivo = checklistOSAtual.filter(i => i.status === 'NAO_OK' && !(i.motivo || '').trim());
            if (semMotivo.length > 0) {
                selecionarAbaDetalhesOS('checklist');
                alert('Informe o motivo em todos os itens do Checklist marcados como "Não OK".');
                btn.disabled = false;
                btn.textContent = 'Confirmar Encerramento';
                return;
            }
        }

        const osId = document.getElementById('det-os-id').value;
        const os = cacheOrdensServico.find(o => o.id === osId);
        const padraoMaquina = os
            ? ((os.ativoTag || '').trim() ? `${os.ativoTag} - ${os.ativoNome}` : os.ativoNome)
            : 'Máquina';

        let inicioParada = '';
        let terminoParada = '';
        let tempoParadaMinutos = 0;

        if (osAtualTeveParada) {
            inicioParada = document.getElementById('enc-inicio-parada')?.value || '';
            terminoParada = document.getElementById('enc-termino-parada')?.value || '';
            if (!inicioParada || !terminoParada) {
                alert('Informe a data/hora de início e término da parada da máquina.');
                btn.disabled = false;
                btn.textContent = 'Confirmar Encerramento';
                return;
            }
            if (new Date(terminoParada) < new Date(inicioParada)) {
                alert('O término da parada não pode ser anterior ao início da parada.');
                btn.disabled = false;
                btn.textContent = 'Confirmar Encerramento';
                return;
            }
            tempoParadaMinutos = calcularMinutosParadaEntreDatas(inicioParada, terminoParada);
        }

        const inicioExecucao = document.getElementById('enc-inicio-trabalho')?.value || '';
        const dataHoraEncerramento = document.getElementById('enc-data-hora')?.value || '';
        if (inicioExecucao && dataHoraEncerramento && new Date(dataHoraEncerramento) < new Date(inicioExecucao)) {
            alert('A data/hora do encerramento não pode ser anterior ao início do trabalho.');
            btn.disabled = false;
            btn.textContent = 'Confirmar Encerramento';
            return;
        }
        const tempoTrabalhoMinutos = (inicioExecucao && dataHoraEncerramento)
            ? calcularMinutosParadaEntreDatas(inicioExecucao, dataHoraEncerramento)
            : 0;

        const descPendente = document.getElementById('item-custo-desc')?.value.trim();
        const valorPendente = parseFloat(document.getElementById('item-custo-valor')?.value) || 0;
        if (valorPendente > 0) {
            itensCustoOSAtual.push({
                descricao: descPendente || (osAtualEhExterna ? 'Serviço de Manutenção Externa' : 'Material / Peça'),
                centroCusto: osAtualEhExterna ? padraoMaquina : (document.getElementById('item-custo-cc')?.value || padraoMaquina),
                valor: valorPendente,
                tipoCusto: osAtualEhExterna ? 'Serviço Externo' : 'Peça/Material'
            });
        }

        const servicoRealizado = document.getElementById('enc-servico-realizado').value.trim();
        const observacoes = document.getElementById('enc-observacoes').value.trim();
        const custoTotal = itensCustoOSAtual.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);

        const manutentoresIds = manutentoresDetalhesOSAtual.map(m => m.id);
        const manutentoresNomes = manutentoresDetalhesOSAtual.map(m => m.nome);

        if (!Array.isArray(cacheColunasOS) || cacheColunasOS.length === 0) {
            const colSnap = await db.collection('kanban_colunas')
                .where('empresaId', '==', usuarioAtual.empresaId)
                .get();
            cacheColunasOS = colSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        }

        const colunaConclusao = obterColunaConclusaoOS();

        const dadosAtualizacao = {
            servicoRealizado,
            checklistPlano: checklistOSAtual,
            anexos: anexosOSAtual,
            itensCusto: itensCustoOSAtual,
            custoTotal,
            centroCustoId: os?.ativoId || '',
            centroCustoNome: padraoMaquina,
            inicioExecucao,
            dataHoraEncerramento,
            tempoTrabalhoMinutos,
            manutentorId: manutentoresIds[0] || '',
            manutentorNome: manutentoresNomes.join(', '),
            manutentoresIds,
            manutentoresNomes,
            observacoes,
            encerrada: true,
            encerradoPor: usuarioAtual.nome,
            encerradaEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (osAtualTeveParada) {
            dadosAtualizacao.inicioParada = inicioParada;
            dadosAtualizacao.terminoParada = terminoParada;
            dadosAtualizacao.tempoParadaMinutos = tempoParadaMinutos;
        }

        if (colunaConclusao && colunaConclusao.id) {
            dadosAtualizacao.colunaId = colunaConclusao.id;
        }

        await db.collection('ordens_servico').doc(osId).update(dadosAtualizacao);

        if (os?.ativoId) {
            await db.collection('ativos').doc(os.ativoId).update({ status: 'Operacional' }).catch(() => {});
        }

        const payloadSolicitacaoEncerrada = {
            status: 'Encerrada',
            osId: osId,
            numeroOs: os?.numeroOs || 0,
            servicoRealizado,
            encerradoPor: usuarioAtual.nome,
            dataHoraEncerramento,
            encerradaEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        const idsSolicitacoesAtualizar = new Set();
        if (os?.solicitacaoId) idsSolicitacoesAtualizar.add(os.solicitacaoId);

        try {
            const solSnap = await db.collection('solicitacoes')
                .where('empresaId', '==', usuarioAtual.empresaId)
                .get();

            solSnap.docs.forEach(docSol => {
                const s = docSol.data();
                if (
                    s.osId === osId ||
                    (os?.numeroOs && Number(s.numeroOs) === Number(os.numeroOs)) ||
                    (s.status === 'Convertida em O.S.' && s.ativoId === os?.ativoId && (os?.descricao || '').includes(s.problema || '___'))
                ) {
                    idsSolicitacoesAtualizar.add(docSol.id);
                }
            });

            for (const solIdVinc of idsSolicitacoesAtualizar) {
                await db.collection('solicitacoes').doc(solIdVinc).update(payloadSolicitacaoEncerrada).catch(() => {});
            }
        } catch (errSol) {
            console.warn('Solicitações vinculadas não atualizadas:', errSol.message);
        }

        if (os && typeof dispararPushOSync === 'function') {
            const idsAlvo = Array.isArray(os.manutentoresIds) && os.manutentoresIds.length > 0
                ? os.manutentoresIds
                : (os.manutentorId ? [os.manutentorId] : []);
            const numFmt = `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`;
            dispararPushOSync({
                tipo: 'status_os',
                destinatariosIds: idsAlvo,
                perfisAlvo: ['Admin'],
                titulo: `O.S. Concluída: ${numFmt}`,
                corpo: `${os.ativoNome || 'Equipamento'} foi encerrada por ${usuarioAtual.nome}.`,
                urlDestino: `/?os=${osId}`
            });
        }

        fecharModalDetalhesOS();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('O.S. encerrada com sucesso!', 'sucesso');
        }
    } catch (err) {
        alert('Erro ao encerrar O.S.: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar Encerramento';
    }
}
