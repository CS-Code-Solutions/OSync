let cacheOS = [];
let cacheColunasOS = [];
let cacheAtivosOS = [];
let cacheTiposOS = [];
let cacheManutentoresOS = [];
let osArrastadaId = null;

function formatarRotuloAtivoOS(tag, nome) {
    const t = (tag || '').trim();
    const n = (nome || 'Equipamento').trim();
    return t ? `${t} - ${n}` : n;
}

async function initOrdensServico() {
    await carregarDadosBaseOS();
    await carregarOrdensServico();

    const formNovaOS = document.getElementById('form-nova-os');
    if (formNovaOS && !formNovaOS.dataset.bound) {
        formNovaOS.addEventListener('submit', salvarNovaOS);
        formNovaOS.dataset.bound = 'true';
    }

    const formEncOS = document.getElementById('form-encerramento-os');
    if (formEncOS && !formEncOS.dataset.bound) {
        formEncOS.addEventListener('submit', encerrarOrdemServico);
        formEncOS.dataset.bound = 'true';
    }

    const params = new URLSearchParams(window.location.search);
    const osIdUrl = params.get('os');
    if (osIdUrl) {
        window.history.replaceState({}, document.title, window.location.pathname);
        abrirDetalhesOS(osIdUrl);
    }
}

async function carregarDadosBaseOS() {
    const empId = usuarioAtual.empresaId;

    const btnEditarKanban = document.getElementById('btn-editar-kanban-os');
    if (btnEditarKanban) {
        if (usuarioAtual.perfil === 'Admin' || usuarioAtual.perfil === 'SuperAdmin') {
            btnEditarKanban.classList.remove('hidden');
        } else {
            btnEditarKanban.classList.add('hidden');
        }
    }

    const [colSnap, ativoSnap, tipoSnap, manSnap] = await Promise.all([
        db.collection('kanban_colunas').where('empresaId', '==', empId).get(),
        db.collection('ativos').where('empresaId', '==', empId).get(),
        db.collection('tipos_manutencao').where('empresaId', '==', empId).get(),
        db.collection('usuarios').where('empresaId', '==', empId).where('perfil', '==', 'Manutentor').get()
    ]);

    cacheColunasOS = colSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.ordem - b.ordem);

    cacheAtivosOS = ativoSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => formatarRotuloAtivoOS(a.codigoTag, a.nome).localeCompare(formatarRotuloAtivoOS(b.codigoTag, b.nome)));

    cacheTiposOS = tipoSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.nome.localeCompare(b.nome));

    cacheManutentoresOS = manSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    const selColFiltro = document.getElementById('filtro-os-coluna');
    if (selColFiltro) {
        selColFiltro.innerHTML = '<option value="">Todos Status / Colunas</option>' +
            cacheColunasOS.map(c => `<option value="${escaparHTML(c.id)}">${escaparHTML(c.titulo)}</option>`).join('');
    }

    const selManFiltro = document.getElementById('filtro-os-manutentor');
    if (selManFiltro) {
        selManFiltro.innerHTML = '<option value="">Todos Manutentores</option>' +
            cacheManutentoresOS.map(m => `<option value="${escaparHTML(m.id)}">${escaparHTML(m.nome)}</option>`).join('');
    }
}

async function carregarOrdensServico() {
    const snap = await db.collection('ordens_servico')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .get();

    cacheOS = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.numeroOs || 0) - (a.numeroOs || 0));

    renderizarVisaoOS();
}

function obterOSFiltradas() {
    const busca = (document.getElementById('filtro-os-busca')?.value || '').toLowerCase();
    const colId = document.getElementById('filtro-os-coluna')?.value || '';
    const prio = document.getElementById('filtro-os-prioridade')?.value || '';
    const manId = document.getElementById('filtro-os-manutentor')?.value || '';

    return cacheOS.filter(os => {
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
}

function renderizarVisaoOS() {
    const listaFiltrada = obterOSFiltradas();
    renderizarMobileOS(listaFiltrada);
    renderizarKanbanOS(listaFiltrada);
    lucide.createIcons();
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

        return `
        <div onclick="abrirDetalhesOS('${osIdSeguro}')" class="osync-card p-4 active:scale-[0.99] transition cursor-pointer" style="border-left: 4px solid ${corCol}">
            <div class="flex items-center justify-between gap-2 mb-1.5">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-xs font-extrabold text-slate-500">#OS-${String(os.numeroOs || 0).padStart(4, '0')}</span>
                    ${badgeCondicao[os.condicaoMaquina] || ''}
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
        <div class="w-80 shrink-0 bg-slate-100/90 rounded-2xl border border-slate-200 flex flex-col max-h-full overflow-hidden"
            ondragover="permitirDropOS(event)" ondrop="soltarCardOS(event, '${colIdSeguro}')">
            <div class="p-3.5 bg-white rounded-t-2xl border-b border-slate-200 flex items-center justify-between shrink-0" style="border-top: 4px solid ${corCol}">
                <h3 class="font-bold text-slate-800 text-sm">${escaparHTML(col.titulo)}</h3>
                <span class="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">${cardsColuna.length}</span>
            </div>

            <div class="p-2.5 space-y-2.5 flex-1 overflow-y-auto min-h-[120px]">
                ${cardsColuna.map(os => {
                    const osIdSeguro = escaparHTML(os.id);
                    const tituloAtivo = escaparHTML(formatarRotuloAtivoOS(os.ativoTag, os.ativoNome));
                    const nomesEquipe = Array.isArray(os.manutentoresNomes) && os.manutentoresNomes.length > 0
                        ? os.manutentoresNomes.join(', ')
                        : (os.manutentorNome || 'Livre');
                    return `
                    <div draggable="true" ondragstart="iniciarDragOS(event, '${osIdSeguro}')" onclick="abrirDetalhesOS('${osIdSeguro}')"
                        class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-400 transition cursor-pointer space-y-2">
                        <div class="flex items-center justify-between gap-1">
                            <div class="flex items-center gap-1.5">
                                <span class="text-[11px] font-extrabold text-slate-400">#OS-${String(os.numeroOs || 0).padStart(4, '0')}</span>
                                ${badgeCondicao[os.condicaoMaquina] || ''}
                            </div>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${corPrioridade[os.prioridade] || 'bg-slate-100'}">${escaparHTML(os.prioridade)}</span>
                        </div>
                        <div class="font-bold text-slate-900 text-xs leading-snug">${tituloAtivo}</div>
                        <p class="text-xs text-slate-600 line-clamp-2">${escaparHTML(os.descricao)}</p>
                        <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                            <span class="truncate max-w-[140px]"><i data-lucide="users" class="w-3 h-3 inline mr-1"></i>${escaparHTML(nomesEquipe)}</span>
                            <span class="font-semibold text-blue-600">${escaparHTML(os.tipoNome || '')}</span>
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
}

function permitirDropOS(e) {
    e.preventDefault();
}

async function soltarCardOS(e, novaColunaId) {
    e.preventDefault();
    const osId = osArrastadaId || e.dataTransfer.getData('text/plain');
    if (!osId) return;

    const colDestino = cacheColunasOS.find(c => c.id === novaColunaId);
    const ehConcluida = colDestino && colDestino.titulo.toLowerCase().includes('conclu');

    if (ehConcluida) {
        abrirDetalhesOS(osId, true);
        return;
    }

    await db.collection('ordens_servico').doc(osId).update({
        colunaId: novaColunaId,
        encerrada: false
    });
    osArrastadaId = null;
    carregarOrdensServico();
}

// ==========================================
// MODAL NOVA O.S.
// ==========================================
async function abrirModalNovaOS() {
    if (cacheAtivosOS.length === 0 || cacheColunasOS.length === 0) {
        await carregarDadosBaseOS();
    }

    document.getElementById('os-ativo').innerHTML = cacheAtivosOS.map(a =>
        `<option value="${escaparHTML(a.id)}">${escaparHTML(formatarRotuloAtivoOS(a.codigoTag, a.nome))}</option>`
    ).join('');

    document.getElementById('os-tipo').innerHTML = cacheTiposOS.map(t =>
        `<option value="${escaparHTML(t.id)}">${escaparHTML(t.nome)}</option>`
    ).join('');

    document.getElementById('os-coluna-inicial').innerHTML = cacheColunasOS.map(c =>
        `<option value="${escaparHTML(c.id)}">${escaparHTML(c.titulo)}</option>`
    ).join('');

    const selMan = document.getElementById('os-manutentor');
    if (selMan) {
        selMan.innerHTML = '<option value="">Não atribuído (Livre)</option>' +
            cacheManutentoresOS.map(m =>
                `<option value="${escaparHTML(m.id)}">${escaparHTML(m.nome)}</option>`
            ).join('');

        if (usuarioAtual.perfil === 'Manutentor' && cacheManutentoresOS.some(m => m.id === usuarioAtual.uid)) {
            selMan.value = usuarioAtual.uid;
        }
    }

    document.getElementById('os-condicao-maquina').value = 'Operacional';
    document.getElementById('os-inicio-parada').value = '';
    alternarCampoParadaCriacaoOS();
    verificarTipoManutencaoCriacao();

    document.getElementById('modal-nova-os').classList.remove('hidden');
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
    document.getElementById('modal-nova-os')?.classList.add('hidden');
}

async function salvarNovaOS(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-criar-os');
    btn.disabled = true;

    try {
        const empId = usuarioAtual.empresaId;
        const empRef = db.collection('empresas').doc(empId);

        const numeroGerado = await db.runTransaction(async (tx) => {
            const doc = await tx.get(empRef);
            const atual = (doc.exists && doc.data().contadorOs) ? doc.data().contadorOs : 0;
            const proximo = atual + 1;
            tx.set(empRef, { contadorOs: proximo }, { merge: true });
            return proximo;
        });

        const ativoId = document.getElementById('os-ativo').value;
        const ativoObj = cacheAtivosOS.find(a => a.id === ativoId) || {};

        const tipoId = document.getElementById('os-tipo').value;
        const tipoObj = cacheTiposOS.find(t => t.id === tipoId) || {};

        const colunaId = document.getElementById('os-coluna-inicial').value;
        const prioridade = document.getElementById('os-prioridade').value;
        const condicaoMaquina = document.getElementById('os-condicao-maquina').value;
        const inicioParada = condicaoMaquina === 'Maquina parada'
            ? document.getElementById('os-inicio-parada').value
            : '';

        const manIdSelecionado = document.getElementById('os-manutentor')?.value || '';
        const manObj = cacheManutentoresOS.find(m => m.id === manIdSelecionado);

        const manutentoresIds = manObj ? [manObj.id] : [];
        const manutentoresNomes = manObj ? [manObj.nome] : [];

        const descricao = document.getElementById('os-descricao').value.trim();

        await db.collection('ordens_servico').add({
            empresaId: empId,
            numeroOs: numeroGerado,
            ativoId,
            ativoTag: ativoObj.codigoTag || '',
            ativoNome: ativoObj.nome || '',
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

        fecharModalNovaOS();
        e.target.reset();
        carregarOrdensServico();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync(`#OS-${String(numeroGerado).padStart(4, '0')} criada com sucesso!`, 'sucesso');
        }
    } catch (err) {
        alert('Erro ao criar O.S.: ' + err.message);
    }

    btn.disabled = false;
}

// ==========================================
// MODAL FLUTUANTE DE EDIÇÃO DO KANBAN (NA TELA DE O.S.)
// ==========================================
async function abrirModalEditarKanbanOS() {
    document.getElementById('modal-editar-kanban-os')?.classList.remove('hidden');
    cancelarEdicaoColunaModalOS();
    await renderizarColunasModalOS();
    lucide.createIcons();
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
        .sort((a, b) => a.ordem - b.ordem);

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
