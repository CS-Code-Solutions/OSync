let cacheOrdens = [];
let cacheColunas = [];
let unsubscribeOS = null;

async function initKanbanOS() {
    await carregarColunasKanban();
    iniciarListenerTempoRealOS();

    document.getElementById('form-nova-os')?.addEventListener('submit', salvarNovaOS);
}

async function carregarColunasKanban() {
    const snap = await db.collection('kanban_colunas')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .get();

    cacheColunas = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.ordem - b.ordem);

    // Popula filtro de manutentores
    const selectFiltroManut = document.getElementById('filtro-manutentor-os');
    if (selectFiltroManut && selectFiltroManut.options.length <= 1) {
        const snapManut = await db.collection('usuarios')
            .where('empresaId', '==', usuarioAtual.empresaId)
            .where('perfil', '==', 'Manutentor')
            .get();

        snapManut.docs.forEach(d => {
            const m = d.data();
            selectFiltroManut.innerHTML += `<option value="${d.id}">${m.nome}</option>`;
        });
    }
}

function iniciarListenerTempoRealOS() {
    if (unsubscribeOS) unsubscribeOS();

    unsubscribeOS = db.collection('ordens_servico')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .onSnapshot((snapshot) => {
            atualizarStatusNuvem(true);
            cacheOrdens = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.numeroOs || 0) - (a.numeroOs || 0));

            filtrarCardsOS();
        }, () => {
            atualizarStatusNuvem(false);
        });
}

function renderizarQuadroKanban(listaOS) {
    const board = document.getElementById('kanban-board');
    if (!board) return;

    if (cacheColunas.length === 0) {
        board.innerHTML = `
            <div class="w-full bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center">
                <p class="text-slate-600 font-medium mb-2">Nenhuma coluna configurada no Kanban.</p>
                <button onclick="navegarPara('configuracoes')" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-semibold">
                    Ir para Configurações e Criar Colunas
                </button>
            </div>`;
        return;
    }

    board.innerHTML = cacheColunas.map(col => {
        const cardsDaColuna = listaOS.filter(os => os.colunaId === col.id);

        return `
        <div class="w-80 shrink-0 bg-slate-200/70 rounded-xl border border-slate-200 flex flex-col">
            <div class="bg-white p-3.5 rounded-t-xl border-b border-slate-200 flex items-center justify-between" style="border-top: 3px solid ${col.corTopo}">
                <span class="font-bold text-sm text-slate-800">${col.titulo}</span>
                <span class="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-0.5 rounded-full col-counter">${cardsDaColuna.length}</span>
            </div>
            <div class="p-2.5 space-y-2.5 kanban-col-body" data-coluna-id="${col.id}">
                ${cardsDaColuna.map(os => gerarHTMLCardOS(os)).join('')}
            </div>
        </div>`;
    }).join('');

    ativarDragAndDrop();
    lucide.createIcons();
}

function gerarHTMLCardOS(os) {
    const coresPrioridade = {
        'Urgente': 'bg-rose-100 text-rose-700',
        'Alta': 'bg-amber-100 text-amber-700',
        'Normal': 'bg-blue-100 text-blue-700',
        'Baixa': 'bg-slate-100 text-slate-600'
    };

    const badgePrio = coresPrioridade[os.prioridade] || coresPrioridade['Normal'];
    const corTipo = os.tipoCor || '#1D4ED8';

    return `
    <div onclick="abrirModalExecucaoOS('${os.id}')" class="osync-card kanban-card p-3.5 select-none" draggable="true" data-os-id="${os.id}" style="border-left-color: ${corTipo}">
        <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-extrabold text-slate-400">#OS-${String(os.numeroOs || 0).padStart(4, '0')}</span>
            <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${badgePrio}">${os.prioridade}</span>
        </div>
        <div class="font-bold text-sm text-slate-900 leading-snug">
            ${os.ativoTag ? `${os.ativoTag} - ${os.ativoNome}` : 'Ativo não vinculado'}
        </div>
        <p class="text-xs text-slate-500 mt-1 line-clamp-2">${os.descricao}</p>
        
        <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span class="font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                ${os.tipoNome || 'Geral'}
            </span>
            <span class="flex items-center gap-1 font-medium">
                <i data-lucide="user" class="w-3 h-3 text-blue-600"></i>
                ${os.manutentorNome || 'Sem técnico'}
            </span>
        </div>
    </div>`;
}

function ativarDragAndDrop() {
    const cards = document.querySelectorAll('.kanban-card');
    const colunas = document.querySelectorAll('.kanban-col-body');

    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });

    colunas.forEach(col => {
        col.addEventListener('dragover', (e) => {
            e.preventDefault();
            col.classList.add('drag-over');
            const dragging = document.querySelector('.dragging');
            if (dragging) col.appendChild(dragging);
        });

        col.addEventListener('dragleave', () => col.classList.remove('drag-over'));

        col.addEventListener('drop', async (e) => {
            e.preventDefault();
            col.classList.remove('drag-over');
            const cardArrastado = document.querySelector('.dragging');
            if (!cardArrastado) return;

            const osId = cardArrastado.getAttribute('data-os-id');
            const novaColunaId = col.getAttribute('data-coluna-id');

            document.querySelectorAll('.kanban-col-body').forEach(c => {
                c.parentElement.querySelector('.col-counter').textContent = c.querySelectorAll('.kanban-card').length;
            });

            await db.collection('ordens_servico').doc(osId).update({
                colunaId: novaColunaId
            });
        });
    });
}

function filtrarCardsOS() {
    const termo = (document.getElementById('filtro-busca-os')?.value || '').toLowerCase();
    const prio = document.getElementById('filtro-prioridade-os')?.value || '';
    const manut = document.getElementById('filtro-manutentor-os')?.value || '';

    const filtradas = cacheOrdens.filter(os => {
        const textoCard = `${os.numeroOs} ${os.descricao} ${os.ativoNome || ''} ${os.ativoTag || ''}`.toLowerCase();
        const matchTexto = !termo || textoCard.includes(termo);
        const matchPrio = !prio || os.prioridade === prio;
        const matchManut = !manut || os.manutentorId === manut;
        return matchTexto && matchPrio && matchManut;
    });

    renderizarQuadroKanban(filtradas);
}

async function abrirModalNovaOS() {
    document.getElementById('modal-nova-os').classList.remove('hidden');

    const [ativosSnap, tiposSnap, setoresSnap, manutSnap] = await Promise.all([
        db.collection('ativos').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('tipos_manutencao').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('setores_executantes').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('usuarios').where('empresaId', '==', usuarioAtual.empresaId).where('perfil', '==', 'Manutentor').get()
    ]);

    document.getElementById('os-ativo').innerHTML = ativosSnap.docs.map(d => {
        const a = d.data();
        return `<option value="${d.id}" data-tag="${a.codigoTag}" data-nome="${a.nome}">${a.codigoTag} - ${a.nome}</option>`;
    }).join('');

    document.getElementById('os-tipo').innerHTML = tiposSnap.docs.map(d => {
        const t = d.data();
        return `<option value="${d.id}" data-nome="${t.nome}" data-cor="${t.cor}">${t.nome}</option>`;
    }).join('');

    document.getElementById('os-setor').innerHTML = '<option value="">Selecione...</option>' + setoresSnap.docs.map(d => {
        const s = d.data();
        return `<option value="${d.id}">${s.nome}</option>`;
    }).join('');

    document.getElementById('os-manutentor').innerHTML = '<option value="">Não direcionado</option>' + manutSnap.docs.map(d => {
        const m = d.data();
        return `<option value="${d.id}" data-nome="${m.nome}">${m.nome}</option>`;
    }).join('');

    document.getElementById('os-coluna').innerHTML = cacheColunas.map(c => `<option value="${c.id}">${c.titulo}</option>`).join('');
}

function fecharModalNovaOS() {
    document.getElementById('modal-nova-os').classList.add('hidden');
}

async function salvarNovaOS(e) {
    e.preventDefault();

    const selAtivo = document.getElementById('os-ativo');
    const optAtivo = selAtivo.options[selAtivo.selectedIndex];

    const selTipo = document.getElementById('os-tipo');
    const optTipo = selTipo.options[selTipo.selectedIndex];

    const selManut = document.getElementById('os-manutentor');
    const optManut = selManut.options[selManut.selectedIndex];

    // Gera numeração sequencial simples baseada na maior O.S. atual
    const maiorNumero = cacheOrdens.reduce((max, item) => Math.max(max, item.numeroOs || 0), 0);

    try {
        await db.collection('ordens_servico').add({
            empresaId: usuarioAtual.empresaId,
            numeroOs: maiorNumero + 1,
            ativoId: selAtivo.value,
            ativoTag: optAtivo?.getAttribute('data-tag') || '',
            ativoNome: optAtivo?.getAttribute('data-nome') || '',
            tipoManutencaoId: selTipo.value,
            tipoNome: optTipo?.getAttribute('data-nome') || 'Geral',
            tipoCor: optTipo?.getAttribute('data-cor') || '#1D4ED8',
            setorExecutanteId: document.getElementById('os-setor').value || null,
            manutentorId: selManut.value || null,
            manutentorNome: selManut.value ? (optManut?.getAttribute('data-nome') || '') : '',
            colunaId: document.getElementById('os-coluna').value,
            prioridade: document.getElementById('os-prioridade').value,
            descricao: document.getElementById('os-descricao').value.trim(),
            parecerTecnico: '',
            custoTotal: 0,
            encerrada: false,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        fecharModalNovaOS();
        e.target.reset();
    } catch (err) {
        alert('Erro ao criar O.S.: ' + err.message);
    }
}
