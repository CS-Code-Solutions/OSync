let cacheColunasOS = [];
let cacheOrdensServico = [];
let unsubscribeOS = null;

async function initKanbanOS() {
    await carregarColunasEModaisOS();
    iniciarListenerOrdensServico();

    document.getElementById('form-nova-os')?.addEventListener('submit', salvarNovaOS);
    document.getElementById('form-encerramento-os')?.addEventListener('submit', confirmarEncerramentoOS);
}

async function carregarColunasEModaisOS() {
    const [colSnap, manutSnap] = await Promise.all([
        db.collection('kanban_colunas').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('usuarios').where('empresaId', '==', usuarioAtual.empresaId).where('perfil', '==', 'Manutentor').get()
    ]);

    cacheColunasOS = colSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.ordem - b.ordem);

    const filtroCol = document.getElementById('filtro-os-coluna');
    if (filtroCol) {
        filtroCol.innerHTML = '<option value="">Todos Status / Colunas</option>' +
            cacheColunasOS.map(c => `<option value="${c.id}">${c.titulo}</option>`).join('');
    }

    const filtroManut = document.getElementById('filtro-os-manutentor');
    if (filtroManut) {
        filtroManut.innerHTML = '<option value="">Todos Manutentores</option>' +
            manutSnap.docs.map(d => `<option value="${d.id}">${d.data().nome}</option>`).join('');
    }
}

function iniciarListenerOrdensServico() {
    if (unsubscribeOS) unsubscribeOS();

    unsubscribeOS = db.collection('ordens_servico')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .onSnapshot((snap) => {
            cacheOrdensServico = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.numeroOs || 0) - (a.numeroOs || 0));

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
        if (manutId && os.manutentorId !== manutId) return false;
        if (busca) {
            const texto = `${os.numeroOs} ${os.ativoTag} ${os.ativoNome} ${os.descricao} ${os.tipoNome}`.toLowerCase();
            if (!texto.includes(busca)) return false;
        }
        return true;
    });
}

function renderizarVisaoOS() {
    const filtradas = obterOrdensFiltradas();
    renderizarCardsMobile(filtradas);
    renderizarKanbanDesktop(filtradas);
    lucide.createIcons();
}

// ==========================================
// VISÃO MOBILE: CARDS LIMPÍSSIMOS SEM ARRASTAR
// ==========================================
function renderizarCardsMobile(ordens) {
    const container = document.getElementById('os-mobile-list');
    if (!container) return;

    if (ordens.length === 0) {
        container.innerHTML = `<div class="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-sm">Nenhuma Ordem de Serviço encontrada.</div>`;
        return;
    }

    container.innerHTML = ordens.map(os => {
        const coluna = cacheColunasOS.find(c => c.id === os.colunaId) || { titulo: 'Aberta', corTopo: '#00E5B0' };
        const corStatus = coluna.corTopo || '#00E5B0';
        const numFormatado = `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`;

        return `
        <div onclick="abrirDetalhesOS('${os.id}')" class="osync-card p-4 active:scale-[0.99] transition cursor-pointer" style="border-left-color: ${corStatus}">
            <div class="flex items-center justify-between gap-2 mb-2">
                <span class="text-xs font-extrabold text-slate-500">${numFormatado}</span>
                <!-- Identificação do Status na mesma cor escolhida para a coluna -->
                <span class="text-[11px] font-extrabold px-3 py-0.5 rounded-full text-white shadow-2xs" style="background-color: ${corStatus}">
                    ${coluna.titulo}
                </span>
            </div>

            <!-- Máquina -->
            <h3 class="font-bold text-slate-900 text-base leading-snug">
                ${os.ativoTag || ''} - ${os.ativoNome || 'Equipamento'}
            </h3>

            <!-- Tipo e Manutentor Selecionado (se houver) -->
            <div class="flex flex-wrap items-center gap-2 mt-2.5 text-xs">
                <span class="inline-flex items-center gap-1 font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    <span class="w-2 h-2 rounded-full" style="background-color: ${os.tipoCor || '#1D4ED8'}"></span>
                    ${os.tipoNome || 'Manutenção'}
                </span>

                ${os.manutentorNome ? `
                <span class="inline-flex items-center gap-1 font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                    <i data-lucide="wrench" class="w-3 h-3"></i>
                    ${os.manutentorNome}
                </span>` : `
                <span class="inline-flex items-center gap-1 text-slate-400 italic">
                    Sem técnico definido
                </span>`}
            </div>
        </div>`;
    }).join('');
}

// ==========================================
// VISÃO DESKTOP: QUADRO KANBAN COM DRAG & DROP
// ==========================================
function renderizarKanbanDesktop(ordens) {
    const board = document.getElementById('os-kanban-board');
    if (!board) return;

    if (cacheColunasOS.length === 0) {
        board.innerHTML = `<div class="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-slate-500 w-full text-center">Configure as colunas do Kanban na aba Configurações.</div>`;
        return;
    }

    board.innerHTML = cacheColunasOS.map(col => {
        const cardsColuna = ordens.filter(o => o.colunaId === col.id);
        return `
        <div class="kanban-column rounded-xl p-3 flex flex-col gap-3 shrink-0" style="border-top: 4px solid ${col.corTopo}"
             ondragover="event.preventDefault()" ondrop="soltarCardKanban(event, '${col.id}')">
            <div class="flex items-center justify-between px-1">
                <h3 class="font-bold text-sm text-slate-800">${col.titulo}</h3>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">${cardsColuna.length}</span>
            </div>

            <div class="space-y-2.5 min-h-[120px]">
                ${cardsColuna.map(os => `
                <div draggable="true" ondragstart="event.dataTransfer.setData('osId', '${os.id}')" onclick="abrirDetalhesOS('${os.id}')"
                     class="osync-card p-3.5 cursor-pointer" style="border-left-color: ${col.corTopo}">
                    <div class="flex items-center justify-between text-[11px] mb-1">
                        <span class="font-extrabold text-slate-500">#OS-${String(os.numeroOs || 0).padStart(4, '0')}</span>
                        <span class="font-bold px-2 py-0.5 rounded text-white" style="background-color: ${col.corTopo}">${col.titulo}</span>
                    </div>
                    <h4 class="font-bold text-slate-900 text-sm">${os.ativoTag} - ${os.ativoNome}</h4>
                    <p class="text-xs text-slate-500 line-clamp-2 mt-1">${os.descricao}</p>
                    <div class="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[11px]">
                        <span class="font-semibold text-slate-600">${os.tipoNome || 'Geral'}</span>
                        <span class="font-semibold text-blue-700">${os.manutentorNome || 'Sem técnico'}</span>
                    </div>
                </div>`).join('')}
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

    // Identifica se o destino é a última coluna configurada (coluna de encerramento/conclusão)
    const ultimaColuna = cacheColunasOS[cacheColunasOS.length - 1];
    const ehColunaFinal = ultimaColuna && ultimaColuna.id === novaColunaId;

    if (ehColunaFinal && !os.encerrada) {
        // Abre o modal de detalhes e já expande o formulário de encerramento/execução
        await abrirDetalhesOS(osId);
        mostrarFormularioEncerramento();
        mostrarNotificacaoOSync('Preencha o serviço realizado, custos e anexos para concluir a O.S.', 'aviso');
        return;
    }

    // Para colunas intermediárias, apenas atualiza a etapa normalmente
    await db.collection('ordens_servico').doc(osId).update({ colunaId: novaColunaId });
    const colDestino = cacheColunasOS.find(c => c.id === novaColunaId);
    if (colDestino) {
        mostrarNotificacaoOSync(`O.S. movida para "${colDestino.titulo}".`, 'info');
    }
}


async function abrirModalNovaOS() {
    document.getElementById('modal-nova-os').classList.remove('hidden');

    const [ativosSnap, tiposSnap, manutSnap] = await Promise.all([
        db.collection('ativos').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('tipos_manutencao').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('usuarios').where('empresaId', '==', usuarioAtual.empresaId).where('perfil', '==', 'Manutentor').get()
    ]);

    document.getElementById('os-ativo').innerHTML = ativosSnap.docs.map(d => {
        const a = d.data();
        return `<option value="${d.id}" data-tag="${a.codigoTag}" data-nome="${a.nome}">${a.codigoTag} - ${a.nome}</option>`;
    }).join('');

    document.getElementById('os-tipo').innerHTML = tiposSnap.docs.map(d => {
        const t = d.data();
        return `<option value="${t.nome}" data-cor="${t.cor}">${t.nome}</option>`;
    }).join('');

    document.getElementById('os-coluna-inicial').innerHTML = cacheColunasOS.map(c =>
        `<option value="${c.id}">${c.titulo}</option>`
    ).join('');

    const selectManut = document.getElementById('os-manutentor');
    if (usuarioAtual.perfil === 'Manutentor') {
        selectManut.innerHTML = `<option value="${usuarioAtual.id}" data-nome="${usuarioAtual.nome}" selected>${usuarioAtual.nome}</option>`;
        selectManut.disabled = true;
    } else {
        selectManut.disabled = false;
        selectManut.innerHTML = '<option value="">-- Não atribuído --</option>' +
            manutSnap.docs.map(d => `<option value="${d.id}" data-nome="${d.data().nome}">${d.data().nome}</option>`).join('');
    }
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

        const selManut = document.getElementById('os-manutentor');
        const optManut = selManut.options[selManut.selectedIndex];

        const maiorNum = cacheOrdensServico.reduce((max, o) => Math.max(max, o.numeroOs || 0), 0);

        await db.collection('ordens_servico').add({
            empresaId: usuarioAtual.empresaId,
            numeroOs: maiorNum + 1,
            ativoId: selAtivo.value,
            ativoTag: optAtivo?.getAttribute('data-tag') || '',
            ativoNome: optAtivo?.getAttribute('data-nome') || '',
            tipoNome: selTipo.value,
            tipoCor: optTipo?.getAttribute('data-cor') || '#1D4ED8',
            colunaId: document.getElementById('os-coluna-inicial').value,
            prioridade: document.getElementById('os-prioridade').value,
            manutentorId: selManut.value || '',
            manutentorNome: selManut.value ? (optManut?.getAttribute('data-nome') || '') : '',
            descricao: document.getElementById('os-descricao').value.trim(),
            custoTotal: 0,
            encerrada: false,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        fecharModalNovaOS();
        e.target.reset();
    } catch (err) {
        alert('Erro ao criar O.S.: ' + err.message);
    }

    btn.disabled = false;
    btn.textContent = 'Criar O.S.';
}
