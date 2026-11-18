let cacheColunasOS = [];
let cacheOrdensServico = [];
let unsubscribeOS = null;

function obterDataHoraLocalInput(dateObj = new Date()) {
    const d = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
}

function formatarDuracaoParadaOS(minutos) {
    const mins = Math.max(0, Math.round(Number(minutos) || 0));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
}

// Helper para formatar TAG + Nome sem sobrar hífen quando a TAG for vazia
function formatarRotuloAtivoOS(tag, nome) {
    const tagLimpa = (tag || '').trim();
    const nomeLimpo = (nome || 'Equipamento').trim();
    return tagLimpa ? `${tagLimpa} - ${nomeLimpo}` : nomeLimpo;
}

// Helper universal para obter lista de manutentores (compatível com O.S. antigas e múltiplas)
function obterManutentoresDaOS(os) {
    if (Array.isArray(os?.manutentoresIds) && os.manutentoresIds.length > 0) {
        const nomes = Array.isArray(os.manutentoresNomes) ? os.manutentoresNomes : [];
        return os.manutentoresIds.map((id, idx) => ({
            id,
            nome: nomes[idx] || os.manutentorNome || 'Técnico'
        }));
    }
    if (os?.manutentorId) {
        return [{ id: os.manutentorId, nome: os.manutentorNome || 'Técnico' }];
    }
    return [];
}

function formatarNomesManutentoresOS(os) {
    const lista = obterManutentoresDaOS(os);
    if (lista.length === 0) return '';
    return lista.map(m => m.nome).join(', ');
}

function ajustarLarguraContainerKanban(expandir) {
    const main = document.getElementById('app-content');
    if (!main) return;

    if (expandir) {
        main.classList.remove('max-w-7xl', 'md:p-6');
        main.classList.add('max-w-[1720px]', 'md:px-4', 'md:py-4');
    } else {
        main.classList.remove('max-w-[1720px]', 'md:px-4', 'md:py-4');
        main.classList.add('max-w-7xl', 'md:p-6');
    }
}

async function initKanbanOS() {
    ajustarLarguraContainerKanban(true);

    const isGestor = usuarioAtual?.perfil === 'Admin' || usuarioAtual?.perfil === 'SuperAdmin';
    if (isGestor && window.innerWidth >= 768) {
        document.getElementById('btn-editar-kanban-os')?.classList.remove('hidden');
    }

    await carregarColunasEModaisOS();
    iniciarListenerOrdensServico();

    document.getElementById('form-nova-os')?.addEventListener('submit', salvarNovaOS);
    document.getElementById('form-encerramento-os')?.addEventListener('submit', confirmarEncerramentoOS);
}

async function carregarColunasEModaisOS() {
    try {
        const [colSnap, manutSnap] = await Promise.all([
            db.collection('kanban_colunas').where('empresaId', '==', usuarioAtual.empresaId).get(),
            db.collection('usuarios').where('empresaId', '==', usuarioAtual.empresaId).where('perfil', '==', 'Manutentor').get()
        ]);

        cacheColunasOS = colSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

        const filtroCol = document.getElementById('filtro-os-coluna');
        if (filtroCol) {
            filtroCol.innerHTML = '<option value="">Todos Status / Colunas</option>' +
                cacheColunasOS.map(c => `<option value="${escaparHTML(c.id)}">${escaparHTML(c.titulo)}</option>`).join('');
        }

        const filtroManut = document.getElementById('filtro-os-manutentor');
        if (filtroManut) {
            filtroManut.innerHTML = '<option value="">Todos Manutentores</option>' +
                manutSnap.docs.map(d => `<option value="${escaparHTML(d.id)}">${escaparHTML(d.data().nome)}</option>`).join('');
        }
    } catch (err) {
        console.error('Erro ao carregar colunas:', err);
    }
}

function iniciarListenerOrdensServico() {
    if (unsubscribeOS) unsubscribeOS();

    unsubscribeOS = db.collection('ordens_servico')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .onSnapshot((snap) => {
            if (!document.getElementById('kanban-board')) {
                ajustarLarguraContainerKanban(false);
                if (unsubscribeOS) {
                    unsubscribeOS();
                    unsubscribeOS = null;
                }
                return;
            }

            cacheOrdensServico = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.numeroOs || 0) - (a.numeroOs || 0));

            if (typeof OSyncDataStore !== 'undefined') {
                OSyncDataStore.invalidarOrdens();
                OSyncDataStore.invalidarAtivos();
            }

            renderizarVisaoOS();
        });
}

function obterOrdensFiltradas() {
    const busca = (document.getElementById('filtro-os-busca')?.value || '').toLowerCase();
    const colId = document.getElementById('filtro-os-coluna')?.value || '';
    const prio = document.getElementById('filtro-os-prioridade')?.value || '';
    const manutId = document.getElementById('filtro-os-manutentor')?.value || '';

    return cacheOrdensServico.filter(os => {
        if (colId && os.colunaId !== colId) return false;
        if (prio && os.prioridade !== prio) return false;
        if (manutId) {
            const listaManut = obterManutentoresDaOS(os);
            if (!listaManut.some(m => m.id === manutId)) return false;
        }
        if (busca) {
            const nomesTecnicos = formatarNomesManutentoresOS(os);
            const texto = `${os.numeroOs} ${os.ativoTag || ''} ${os.ativoNome} ${os.descricao} ${os.tipoNome} ${nomesTecnicos}`.toLowerCase();
            if (!texto.includes(busca)) return false;
        }
        return true;
    });
}

function renderizarVisaoOS() {
    const filtradas = obterOrdensFiltradas();
    renderizarCardsMobile(filtradas);
    renderizarKanbanDesktop(filtradas);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderizarCardsMobile(ordens) {
    const container = document.getElementById('os-mobile-list');
    if (!container) return;

    if (ordens.length === 0) {
        container.innerHTML = `<div class="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-sm">Nenhuma Ordem de Serviço encontrada.</div>`;
        return;
    }

    container.innerHTML = ordens.map(os => {
        const coluna = cacheColunasOS.find(c => c.id === os.colunaId) || { titulo: 'Aberta', corTopo: '#00E5B0' };
        const corStatus = sanitizarCorHex(coluna.corTopo, '#00E5B0');
        const corTipo = sanitizarCorHex(os.tipoCor, '#1D4ED8');
        const osIdSeguro = escaparHTML(os.id);
        const numFormatado = `#OS-${String(Number(os.numeroOs) || 0).padStart(4, '0')}`;
        const ehParada = os.condicaoMaquina === 'Maquina parada' || os.maquinaParada === true;
        const ehParcial = os.condicaoMaquina === 'Parcialmente funcional';
        const nomesTecnicos = formatarNomesManutentoresOS(os);
        const qtdTecnicos = obterManutentoresDaOS(os).length;
        const tituloAtivo = escaparHTML(formatarRotuloAtivoOS(os.ativoTag, os.ativoNome));

        return `
        <div onclick="abrirDetalhesOS('${osIdSeguro}')" class="osync-card p-4 active:scale-[0.99] transition cursor-pointer" style="border-left-color: ${corStatus}">
            <div class="flex items-center justify-between gap-2 mb-2">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-xs font-extrabold text-slate-500">${numFormatado}</span>
                    ${ehParada ? `<span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-rose-600 text-white">Parada${os.tempoParadaMinutos ? ` (${formatarDuracaoParadaOS(os.tempoParadaMinutos)})` : ''}</span>` : ''}
                    ${ehParcial ? `<span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500 text-white">Parcial</span>` : ''}
                </div>
                <span class="text-[11px] font-extrabold px-3 py-0.5 rounded-full text-white shadow-2xs" style="background-color: ${corStatus}">
                    ${escaparHTML(coluna.titulo)}
                </span>
            </div>

            <h3 class="font-bold text-slate-900 text-base leading-snug">
                ${tituloAtivo}
            </h3>

            <div class="flex flex-wrap items-center gap-2 mt-2.5 text-xs">
                <span class="inline-flex items-center gap-1 font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    <span class="w-2 h-2 rounded-full" style="background-color: ${corTipo}"></span>
                    ${escaparHTML(os.tipoNome || 'Manutenção')}
                </span>

                ${nomesTecnicos ? `
                <span class="inline-flex items-center gap-1 font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                    <i data-lucide="${qtdTecnicos > 1 ? 'users' : 'wrench'}" class="w-3 h-3"></i>
                    ${escaparHTML(nomesTecnicos)}
                </span>` : `
                <span class="text-slate-400 italic">Sem técnico definido</span>`}
            </div>
        </div>`;
    }).join('');
}

function renderizarKanbanDesktop(ordens) {
    const board = document.getElementById('os-kanban-board') || document.getElementById('kanban-board');
    if (!board) return;

    board.className = 'hidden md:flex items-stretch gap-3 overflow-x-auto pb-3 h-[calc(100vh-190px)] min-h-[520px] kanban-scroll';

    if (cacheColunasOS.length === 0) {
        board.innerHTML = `<div class="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-slate-500 w-full text-center flex items-center justify-center">Clique em "Editar Kanban" no topo para criar suas colunas.</div>`;
        return;
    }

    board.innerHTML = cacheColunasOS.map(col => {
        const cardsColuna = ordens.filter(o => o.colunaId === col.id);
        const corCol = sanitizarCorHex(col.corTopo, '#00E5B0');
        const colIdSeguro = escaparHTML(col.id);
        const tituloColSeguro = escaparHTML(col.titulo);

        return `
        <div class="kanban-column flex-1 basis-0 min-w-[245px] max-w-[350px] h-full bg-slate-200/75 rounded-2xl border border-slate-300/80 flex flex-col overflow-hidden"
             ondragover="event.preventDefault()" ondrop="soltarCardKanban(event, '${colIdSeguro}')">

            <div class="px-3 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0"
                 style="border-top: 4px solid ${corCol}">
                <h3 class="font-bold text-[13px] text-slate-800 truncate" title="${tituloColSeguro}">${tituloColSeguro}</h3>
                <span class="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">${cardsColuna.length}</span>
            </div>

            <div class="p-2.5 space-y-2 flex-1 overflow-y-auto kanban-scroll">
                ${cardsColuna.length > 0 ? cardsColuna.map(os => {
                    const osIdSeguro = escaparHTML(os.id);
                    const ehParada = os.condicaoMaquina === 'Maquina parada' || os.maquinaParada === true;
                    const ehParcial = os.condicaoMaquina === 'Parcialmente funcional';
                    const nomesTecnicos = formatarNomesManutentoresOS(os) || 'Sem técnico';
                    const tituloAtivo = escaparHTML(formatarRotuloAtivoOS(os.ativoTag, os.ativoNome));
                    return `
                <div draggable="true" ondragstart="event.dataTransfer.setData('osId', '${osIdSeguro}')" onclick="abrirDetalhesOS('${osIdSeguro}')"
                     class="osync-card p-3 cursor-pointer hover:shadow-md transition" style="border-left-color: ${corCol}">
                    <div class="flex items-center justify-between text-[10.5px] mb-1 gap-1.5">
                        <span class="font-extrabold text-slate-500 shrink-0">#OS-${String(Number(os.numeroOs) || 0).padStart(4, '0')}</span>
                        <span class="font-bold px-2 py-0.5 rounded text-white truncate max-w-[130px]" style="background-color: ${corCol}" title="${tituloColSeguro}">${tituloColSeguro}</span>
                    </div>
                    <h4 class="font-bold text-slate-900 text-[13px] leading-snug">${tituloAtivo}</h4>
                    ${ehParada ? `<span class="inline-block mt-1 text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">Máquina Parada${os.tempoParadaMinutos ? ` • ${formatarDuracaoParadaOS(os.tempoParadaMinutos)}` : ''}</span>` : ''}
                    ${ehParcial ? `<span class="inline-block mt-1 text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">Parcialmente Funcional</span>` : ''}
                    <p class="text-[11.5px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">${escaparHTML(os.descricao)}</p>
                    <div class="flex items-center justify-between gap-1.5 mt-2.5 pt-2 border-t border-slate-100 text-[10.5px]">
                        <span class="font-semibold text-slate-600 truncate shrink-0">${escaparHTML(os.tipoNome || 'Geral')}</span>
                        <span class="font-semibold text-blue-700 truncate text-right" title="${escaparHTML(nomesTecnicos)}">${escaparHTML(nomesTecnicos)}</span>
                    </div>
                </div>`;
                }).join('') : `
                <div class="h-28 border-2 border-dashed border-slate-300/80 rounded-xl flex items-center justify-center text-[11px] text-slate-400 select-none text-center px-2">
                    Arraste uma O.S. para cá
                </div>`}
            </div>
        </div>`;
    }).join('');
}

async function soltarCardKanban(event, novaColunaId) {
    event.preventDefault();
    const osId = event.dataTransfer.getData('osId');
    if (!osId) return;

    const os = cacheOrdensServico.find(o => o.id === osId);
    if (!os || os.colunaId === novaColunaId) return;

    const ultimaColuna = cacheColunasOS[cacheColunasOS.length - 1];
    const ehColunaFinal = ultimaColuna && ultimaColuna.id === novaColunaId;

    if (ehColunaFinal && !os.encerrada) {
        await abrirDetalhesOS(osId);
        mostrarFormularioEncerramento();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Preencha o serviço realizado, custos e anexos para concluir a O.S.', 'aviso');
        }
        return;
    }

    await db.collection('ordens_servico').doc(osId).update({ colunaId: novaColunaId });
}

// ==========================================
// MODAL FLUTUANTE DE EDIÇÃO DO KANBAN (NA TELA DE O.S.)
// ==========================================
function abrirModalEditarKanbanOS() {
    document.getElementById('modal-editar-kanban-os')?.classList.remove('hidden');
    cancelarEdicaoColunaModalOS();
    renderizarListaColunasModalOS();
}

function fecharModalEditarKanbanOS() {
    document.getElementById('modal-editar-kanban-os')?.classList.add('hidden');
    renderizarVisaoOS();
}

function renderizarListaColunasModalOS() {
    const lista = document.getElementById('lista-colunas-modal-os');
    if (!lista) return;

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

    lucide.createIcons();
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
        e.target.reset();
    }

    await carregarColunasEModaisOS();
    renderizarListaColunasModalOS();
    renderizarVisaoOS();
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
    await carregarColunasEModaisOS();
    renderizarListaColunasModalOS();
    renderizarVisaoOS();
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
    lucide.createIcons();
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
    if (document.getElementById('os-col-ordem')) {
        document.getElementById('os-col-ordem').value = maiorOrdem + 1;
    }
    lucide.createIcons();
}

async function excluirColunaModalOS(colId) {
    if (!await confirmarAcaoOSync('Deseja excluir esta coluna do Kanban?', { titulo: 'Excluir Coluna', textoConfirmar: 'Excluir' })) return;

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
    await carregarColunasEModaisOS();
    renderizarListaColunasModalOS();
    renderizarVisaoOS();
}

// ==========================================
// MODAL NOVA O.S. (COM MÚLTIPLOS MANUTENTORES)
// ==========================================
function verificarTipoManutencaoCriacao() {}

function alternarCampoParadaCriacaoOS() {
    const condicao = document.getElementById('os-condicao-maquina')?.value || 'Operacional';
    const box = document.getElementById('box-os-inicio-parada');
    const input = document.getElementById('os-inicio-parada');
    if (!box || !input) return;

    if (condicao === 'Maquina parada') {
        box.classList.remove('hidden');
        input.required = true;
        if (!input.value) {
            input.value = obterDataHoraLocalInput();
        }
    } else {
        box.classList.add('hidden');
        input.required = false;
        input.value = '';
    }
}

function atualizarContadorManutentoresNovaOS() {
    const marcados = document.querySelectorAll('input[name="os-manutentor-check"]:checked').length;
    const badge = document.getElementById('os-manutentores-contador');
    if (badge) {
        badge.textContent = `${marcados} selecionado${marcados === 1 ? '' : 's'}`;
    }
}

async function abrirModalNovaOS() {
    document.getElementById('modal-nova-os').classList.remove('hidden');

    const condSel = document.getElementById('os-condicao-maquina');
    if (condSel) condSel.value = 'Operacional';
    alternarCampoParadaCriacaoOS();

    const [ativosSnap, tiposSnap, manutSnap] = await Promise.all([
        db.collection('ativos').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('tipos_manutencao').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('usuarios').where('empresaId', '==', usuarioAtual.empresaId).where('perfil', '==', 'Manutentor').get()
    ]);

    const ativosOrdenados = ativosSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => formatarRotuloAtivoOS(a.codigoTag, a.nome).localeCompare(formatarRotuloAtivoOS(b.codigoTag, b.nome)));

    document.getElementById('os-ativo').innerHTML = ativosOrdenados.map(a => {
        const tag = (a.codigoTag || '').trim();
        const rotulo = formatarRotuloAtivoOS(tag, a.nome);
        return `<option value="${escaparHTML(a.id)}" data-tag="${escaparHTML(tag)}" data-nome="${escaparHTML(a.nome)}">${escaparHTML(rotulo)}</option>`;
    }).join('');

    document.getElementById('os-tipo').innerHTML = tiposSnap.docs.map(d => {
        const t = d.data();
        const cor = sanitizarCorHex(t.cor, '#1D4ED8');
        return `<option value="${escaparHTML(t.nome)}" data-cor="${cor}">${escaparHTML(t.nome)}</option>`;
    }).join('');

    document.getElementById('os-coluna-inicial').innerHTML = cacheColunasOS.map(c =>
        `<option value="${escaparHTML(c.id)}">${escaparHTML(c.titulo)}</option>`
    ).join('');

    const listaManut = document.getElementById('os-manutentores-lista');
    const ehManutentorLogado = usuarioAtual.perfil === 'Manutentor';
    const manutentoresOrdenados = manutSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    if (manutentoresOrdenados.length === 0) {
        listaManut.innerHTML = '<span class="text-xs text-slate-400 col-span-2 p-1">Nenhum manutentor cadastrado.</span>';
    } else {
        listaManut.innerHTML = manutentoresOrdenados.map(m => {
            const idSeg = escaparHTML(m.id);
            const nomeSeg = escaparHTML(m.nome);
            const proprioManut = ehManutentorLogado && m.id === usuarioAtual.id;
            return `
            <label class="flex items-center gap-2 px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-blue-400 text-xs select-none">
                <input type="checkbox" name="os-manutentor-check" value="${idSeg}" data-nome="${nomeSeg}"
                    ${proprioManut ? 'checked' : ''}
                    onchange="atualizarContadorManutentoresNovaOS()"
                    class="w-3.5 h-3.5 accent-blue-600 rounded shrink-0">
                <span class="font-semibold text-slate-800 truncate">${nomeSeg}</span>
            </label>`;
        }).join('');
    }
    atualizarContadorManutentoresNovaOS();
}

function fecharModalNovaOS() {
    document.getElementById('modal-nova-os').classList.add('hidden');
}

async function salvarNovaOS(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-criar-os');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        const selAtivo = document.getElementById('os-ativo');
        const optAtivo = selAtivo.options[selAtivo.selectedIndex];

        const selTipo = document.getElementById('os-tipo');
        const optTipo = selTipo.options[selTipo.selectedIndex];

        const checksManut = Array.from(document.querySelectorAll('input[name="os-manutentor-check"]:checked'));
        const manutentoresIds = checksManut.map(c => c.value);
        const manutentoresNomes = checksManut.map(c => c.getAttribute('data-nome') || '');

        const condicaoMaquina = document.getElementById('os-condicao-maquina')?.value || 'Operacional';
        const ehMaquinaParada = condicaoMaquina === 'Maquina parada';
        const inicioParada = ehMaquinaParada ? (document.getElementById('os-inicio-parada')?.value || obterDataHoraLocalInput()) : '';
        const inicioExecucao = obterDataHoraLocalInput();

        const maiorNum = cacheOrdensServico.reduce((max, o) => Math.max(max, o.numeroOs || 0), 0);

        await db.collection('ordens_servico').add({
            empresaId: usuarioAtual.empresaId,
            numeroOs: maiorNum + 1,
            ativoId: selAtivo.value,
            ativoTag: (optAtivo?.getAttribute('data-tag') || '').trim(),
            ativoNome: (optAtivo?.getAttribute('data-nome') || '').trim(),
            tipoNome: selTipo.value,
            tipoCor: sanitizarCorHex(optTipo?.getAttribute('data-cor'), '#1D4ED8'),
            colunaId: document.getElementById('os-coluna-inicial').value,
            prioridade: document.getElementById('os-prioridade').value,
            condicaoMaquina,
            maquinaParada: ehMaquinaParada,
            inicioParada,
            terminoParada: '',
            tempoParadaMinutos: 0,
            inicioExecucao,
            tempoTrabalhoMinutos: 0,
            // Compatibilidade com O.S. antigas + suporte a múltiplos manutentores
            manutentorId: manutentoresIds[0] || '',
            manutentorNome: manutentoresNomes.join(', '),
            manutentoresIds,
            manutentoresNomes,
            abertoPorId: usuarioAtual.id || '',
            abertoPorNome: usuarioAtual.nome || '',
            descricao: document.getElementById('os-descricao').value.trim(),
            custoTotal: 0,
            encerrada: false,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (selAtivo.value) {
            const novoStatusAtivo = ehMaquinaParada
                ? 'Parada'
                : (condicaoMaquina === 'Parcialmente funcional' ? 'Manutencao' : 'Operacional');
            await db.collection('ativos').doc(selAtivo.value).update({ status: novoStatusAtivo });
        }

        fecharModalNovaOS();
        e.target.reset();
        alternarCampoParadaCriacaoOS();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Ordem de Serviço criada com sucesso!', 'sucesso');
        }
    } catch (err) {
        alert('Erro ao criar O.S.: ' + err.message);
    }

    btn.disabled = false;
    btn.textContent = 'Criar O.S.';
}
