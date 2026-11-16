let cacheOrdens = [];
let cacheColunas = [];
let canalRealtimeOS = null;

async function initKanbanOS() {
    await carregarDadosKanban();
    iniciarSincronizacaoTempoReal();

    document.getElementById('form-nova-os')?.addEventListener('submit', salvarNovaOS);
}

async function carregarDadosKanban() {
    const board = document.getElementById('kanban-board');
    if (!board) return;

    // 1. Busca Colunas configuradas
    const { data: colunas } = await db.from('kanban_colunas').select('*').order('ordem', { ascending: true });
    cacheColunas = colunas || [];

    // 2. Busca Ordens de Serviço com relacionamentos
    const { data: ordens } = await db
        .from('ordens_servico')
        .select(`
            *,
            ativos (codigo_tag, nome),
            tipos_manutencao (nome, cor),
            usuarios (id, nome)
        `)
        .order('criado_em', { ascending: false });

    cacheOrdens = ordens || [];

    // Popula filtro de manutentores
    const selectFiltroManut = document.getElementById('filtro-manutentor-os');
    if (selectFiltroManut && selectFiltroManut.options.length <= 1) {
        const { data: manutentores } = await db.from('usuarios').select('id, nome').eq('perfil', 'Manutentor');
        (manutentores || []).forEach(m => {
            selectFiltroManut.innerHTML += `<option value="${m.id}">${m.nome}</option>`;
        });
    }

    renderizarQuadroKanban(cacheOrdens);
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
        const cardsDaColuna = listaOS.filter(os => os.coluna_id === col.id);

        return `
        <div class="w-80 shrink-0 bg-slate-200/70 rounded-xl border border-slate-200 flex flex-col">
            <div class="bg-white p-3.5 rounded-t-xl border-b border-slate-200 flex items-center justify-between" style="border-top: 3px solid ${col.cor_topo}">
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
    const corTipo = os.tipos_manutencao?.cor || '#1D4ED8';

    return `
    <div class="osync-card kanban-card p-3.5 select-none" draggable="true" data-os-id="${os.id}" style="border-left-color: ${corTipo}">
        <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-extrabold text-slate-400">#OS-${String(os.numero_os).padStart(4, '0')}</span>
            <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${badgePrio}">${os.prioridade}</span>
        </div>
        <div class="font-bold text-sm text-slate-900 leading-snug">
            ${os.ativos ? `${os.ativos.codigo_tag} - ${os.ativos.nome}` : 'Ativo não vinculado'}
        </div>
        <p class="text-xs text-slate-500 mt-1 line-clamp-2">${os.descricao}</p>
        
        <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span class="font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                ${os.tipos_manutencao?.nome || 'Geral'}
            </span>
            <span class="flex items-center gap-1 font-medium">
                <i data-lucide="user" class="w-3 h-3 text-blue-600"></i>
                ${os.usuarios?.nome || 'Sem técnico'}
            </span>
        </div>
    </div>`;
}

function ativarDragAndDrop() {
    const cards = document.querySelectorAll('.kanban-card');
    const colunas = document.querySelectorAll('.kanban-col-body');

    cards.forEach(card => {
        card.addEventListener('dragstart', () => card.classList.add('dragging'));
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

            // Atualiza contadores visuais imediatamente
            document.querySelectorAll('.kanban-col-body').forEach(c => {
                c.parentElement.querySelector('.col-counter').textContent = c.querySelectorAll('.kanban-card').length;
            });

            // Salva no Supabase
            const { error } = await db
                .from('ordens_servico')
                .update({ coluna_id: novaColunaId })
                .eq('id', osId);

            if (error) {
                alert('Erro ao mover O.S.');
                carregarDadosKanban();
            }
        });
    });
}

function filtrarCardsOS() {
    const termo = document.getElementById('filtro-busca-os').value.toLowerCase();
    const prio = document.getElementById('filtro-prioridade-os').value;
    const manut = document.getElementById('filtro-manutentor-os').value;

    const filtradas = cacheOrdens.filter(os => {
        const textoCard = `${os.numero_os} ${os.descricao} ${os.ativos?.nome || ''} ${os.ativos?.codigo_tag || ''}`.toLowerCase();
        const matchTexto = !termo || textoCard.includes(termo);
        const matchPrio = !prio || os.prioridade === prio;
        const matchManut = !manut || os.manutentor_id === manut;
        return matchTexto && matchPrio && matchManut;
    });

    renderizarQuadroKanban(filtradas);
}

// Modal Nova O.S.
async function abrirModalNovaOS() {
    document.getElementById('modal-nova-os').classList.remove('hidden');

    const [ativos, tipos, setores, manutentores] = await Promise.all([
        db.from('ativos').select('id, codigo_tag, nome'),
        db.from('tipos_manutencao').select('id, nome'),
        db.from('setores_executantes').select('id, nome'),
        db.from('usuarios').select('id, nome').eq('perfil', 'Manutentor')
    ]);

    document.getElementById('os-ativo').innerHTML = (ativos.data || []).map(a => `<option value="${a.id}">${a.codigo_tag} - ${a.nome}</option>`).join('');
    document.getElementById('os-tipo').innerHTML = (tipos.data || []).map(t => `<option value="${t.id}">${t.nome}</option>`).join('');
    document.getElementById('os-setor').innerHTML = '<option value="">Selecione...</option>' + (setores.data || []).map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
    document.getElementById('os-manutentor').innerHTML = '<option value="">Não direcionado</option>' + (manutentores.data || []).map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
    document.getElementById('os-coluna').innerHTML = cacheColunas.map(c => `<option value="${c.id}">${c.titulo}</option>`).join('');
}

function fecharModalNovaOS() {
    document.getElementById('modal-nova-os').classList.add('hidden');
}

async function salvarNovaOS(e) {
    e.preventDefault();
    const payload = {
        empresa_id: usuarioAtual?.empresa_id,
        ativo_id: document.getElementById('os-ativo').value,
        tipo_manutencao_id: document.getElementById('os-tipo').value,
        setor_executante_id: document.getElementById('os-setor').value || null,
        manutentor_id: document.getElementById('os-manutentor').value || null,
        coluna_id: document.getElementById('os-coluna').value,
        prioridade: document.getElementById('os-prioridade').value,
        descricao: document.getElementById('os-descricao').value.trim()
    };

    const { error } = await db.from('ordens_servico').insert([payload]);
    if (!error) {
        fecharModalNovaOS();
        e.target.reset();
        carregarDadosKanban();
    } else {
        alert('Erro ao criar O.S.: ' + error.message);
    }
}

// Sincronização em Tempo Real (Supabase Realtime)
function iniciarSincronizacaoTempoReal() {
    if (canalRealtimeOS) db.removeChannel(canalRealtimeOS);

    canalRealtimeOS = db
        .channel('osync-kanban-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => {
            carregarDadosKanban();
        })
        .subscribe((status) => {
            atualizarStatusNuvem(status === 'SUBSCRIBED');
        });
}
