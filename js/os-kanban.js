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
    abaOSAtual = aba;

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
    if (cSol) cSol.textContent = filtradasGerais.filter(osVeioDeSolicitacao).length;

    if (abaOSAtual === 'minhas') {
        return filtradasGerais.filter(osPertenceAoUsuarioAtual);
    }
    if (abaOSAtual === 'solicitacoes') {
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
