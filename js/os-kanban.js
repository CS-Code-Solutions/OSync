/**
 * ============================================================================
 * OSync — Quadro Kanban e Criação de Ordens de Serviço (js/os-kanban.js)
 * ============================================================================
 */

let listaOrdensServico = [];
let cacheAtivosOS = [];
let cacheManutentoresOS = [];
let cachePlanosOS = [];

/**
 * Inicializa o módulo de Ordens de Serviço
 */
async function initOS() {
    await Promise.all([
        carregarAtivosEManutentoresOS(),
        carregarOrdensServico()
    ]);
    if (window.lucide) lucide.createIcons();
}

/**
 * Carrega ativos e manutentores da empresa para os selects e filtros
 */
async function carregarAtivosEManutentoresOS() {
    const empresaId = window.empresaAtual?.id;
    if (!empresaId) return;

    try {
        const [snapAtivos, snapUsers] = await Promise.all([
            db.collection('ativos').where('empresaId', '==', empresaId).get(),
            db.collection('usuarios').where('empresaId', '==', empresaId).where('ativo', '==', true).get()
        ]);

        cacheAtivosOS = snapAtivos.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.tag || a.nome || '').localeCompare(b.tag || b.nome || ''));

        cacheManutentoresOS = snapUsers.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(u => u.perfil === 'Manutentor' || u.perfil === 'Admin')
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

        // Preenche filtro de responsáveis no Kanban
        const selFiltroResp = document.getElementById('filtro-os-responsavel');
        if (selFiltroResp) {
            selFiltroResp.innerHTML = `<option value="">Todos os Responsáveis</option>` +
                cacheManutentoresOS.map(m => `<option value="${m.id}">${escapeHTML(m.nome)}</option>`).join('');
        }
    } catch (erro) {
        console.error('Erro ao carregar ativos/manutentores:', erro);
    }
}

/**
 * Carrega os Planos de Manutenção da empresa para o modal de Nova O.S.
 */
async function carregarPlanosParaNovaOS() {
    const empresaId = window.empresaAtual?.id;
    if (!empresaId) return;

    try {
        const snap = await db.collection('planos_manutencao')
            .where('empresaId', '==', empresaId)
            .get();

        cachePlanosOS = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(p => p.ativo !== false)
            .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
    } catch (erro) {
        console.error('Erro ao carregar planos de manutenção:', erro);
        cachePlanosOS = [];
    }
}

/**
 * Exibe ou oculta o seletor de plano de manutenção no Modal de Nova O.S.
 */
function alternarSeletorPlanoNovaOS() {
    const usar = document.getElementById('os-usar-plano')?.value === 'sim';
    const box = document.getElementById('box-os-seletor-plano');
    const sel = document.getElementById('os-plano-id');
    const info = document.getElementById('os-plano-info-qtd');
    if (!box) return;

    if (usar) {
        box.classList.remove('hidden');
        atualizarOpcoesPlanosNovaOS();
    } else {
        box.classList.add('hidden');
        if (sel) sel.value = '';
        if (info) info.textContent = '';
    }
}

/**
 * Filtra os planos compatíveis com o ativo selecionado (planos da máquina ou planos gerais)
 */
function atualizarOpcoesPlanosNovaOS() {
    const selPlano = document.getElementById('os-plano-id');
    const info = document.getElementById('os-plano-info-qtd');
    const ativoId = document.getElementById('os-ativo')?.value || '';
    if (!selPlano) return;

    const valorAtual = selPlano.value;
    const planosCompat = cachePlanosOS.filter(p => !p.ativoId || p.ativoId === ativoId);

    selPlano.innerHTML = `<option value="">Selecione um plano...</option>` +
        planosCompat.map(p => {
            const qtdItens = Array.isArray(p.itens) ? p.itens.length : 0;
            const escopo = p.ativoNome ? `[${p.ativoNome}]` : '[Geral]';
            return `<option value="${p.id}">${escapeHTML(p.titulo || 'Plano')} ${escopo} (${qtdItens} itens)</option>`;
        }).join('');

    if (planosCompat.some(p => p.id === valorAtual)) {
        selPlano.value = valorAtual;
    }

    if (info) {
        info.textContent = planosCompat.length === 0
            ? 'Nenhum plano de manutenção cadastrado para este ativo.'
            : `${planosCompat.length} plano(s) disponível(is).`;
    }
}

/**
 * Carrega todas as Ordens de Serviço da empresa
 */
async function carregarOrdensServico() {
    const empresaId = window.empresaAtual?.id;
    if (!empresaId) return;

    try {
        const snap = await db.collection('ordens_servico')
            .where('empresaId', '==', empresaId)
            .get();

        listaOrdensServico = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => {
                const tA = a.criadaEm?.toMillis ? a.criadaEm.toMillis() : 0;
                const tB = b.criadaEm?.toMillis ? b.criadaEm.toMillis() : 0;
                return tB - tA;
            });

        renderizarKanbanOS();
    } catch (erro) {
        console.error('Erro ao carregar O.S.:', erro);
    }
}

/**
 * Renderiza os cards nas 3 colunas do Kanban aplicando os filtros ativos
 */
function renderizarKanbanOS() {
    const busca = (document.getElementById('filtro-os-busca')?.value || '').toLowerCase();
    const tipo = document.getElementById('filtro-os-tipo')?.value || '';
    const prioridade = document.getElementById('filtro-os-prioridade')?.value || '';
    const responsavelId = document.getElementById('filtro-os-responsavel')?.value || '';

    const filtradas = listaOrdensServico.filter(os => {
        const matchBusca = !busca ||
            (os.numeroOs || '').toLowerCase().includes(busca) ||
            (os.titulo || '').toLowerCase().includes(busca) ||
            (os.ativoNome || '').toLowerCase().includes(busca) ||
            (os.ativoTag || '').toLowerCase().includes(busca);
        const matchTipo = !tipo || os.tipo === tipo;
        const matchPrio = !prioridade || os.prioridade === prioridade;
        const matchResp = !responsavelId || os.responsavelId === responsavelId;
        return matchBusca && matchTipo && matchPrio && matchResp;
    });

    const colunas = {
        Aberta: document.getElementById('col-os-aberta'),
        'Em Execução': document.getElementById('col-os-execucao'),
        Encerrada: document.getElementById('col-os-encerrada')
    };

    const contadores = {
        Aberta: 0,
        'Em Execução': 0,
        Encerrada: 0
    };

    Object.values(colunas).forEach(col => {
        if (col) col.innerHTML = '';
    });

    filtradas.forEach(os => {
        const status = colunas[os.status] ? os.status : 'Aberta';
        contadores[status]++;
        if (colunas[status]) {
            colunas[status].insertAdjacentHTML('beforeend', criarCardOSHTML(os));
        }
    });

    const elCountAberta = document.getElementById('count-os-aberta');
    const elCountExec = document.getElementById('count-os-execucao');
    const elCountEnc = document.getElementById('count-os-encerrada');
    if (elCountAberta) elCountAberta.textContent = contadores.Aberta;
    if (elCountExec) elCountExec.textContent = contadores['Em Execução'];
    if (elCountEnc) elCountEnc.textContent = contadores.Encerrada;

    Object.entries(colunas).forEach(([status, col]) => {
        if (col && contadores[status] === 0) {
            col.innerHTML = `<div class="border border-dashed border-slate-300/80 rounded-xl p-6 text-center text-xs text-slate-400">Nenhuma O.S. nesta etapa</div>`;
        }
    });

    if (window.lucide) lucide.createIcons();
}

/**
 * Monta o HTML de um card individual no Kanban
 */
function criarCardOSHTML(os) {
    const prioBadge = {
        Urgente: 'bg-red-100 text-red-700 border-red-200',
        Alta: 'bg-orange-100 text-orange-700 border-orange-200',
        Media: 'bg-blue-100 text-blue-700 border-blue-200',
        Baixa: 'bg-slate-100 text-slate-600 border-slate-200'
    }[os.prioridade] || 'bg-slate-100 text-slate-600';

    const isGestor = window.usuarioLogado?.perfil === 'Admin' || window.usuarioLogado?.perfil === 'SuperAdmin';
    const custoTotal = Number(os.custoTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const qtdChecklist = Array.isArray(os.checklistPlano) ? os.checklistPlano.length : 0;

    return `
        <div onclick="abrirDetalhesOS('${os.id}')"
            class="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group space-y-2.5">
            <div class="flex items-center justify-between gap-2">
                <span class="font-mono text-[11px] font-bold text-slate-500">${escapeHTML(os.numeroOs || 'OS')}</span>
                <div class="flex items-center gap-1.5">
                    <span class="px-2 py-0.5 text-[10px] font-bold rounded-full border ${prioBadge}">${escapeHTML(os.prioridade || 'Média')}</span>
                    ${isGestor ? `
                        <button onclick="event.stopPropagation(); excluirOSComAuditoria('${os.id}', '${escapeHTML(os.numeroOs || '')}')"
                            title="Excluir O.S. (com auditoria)"
                            class="p-1 text-slate-300 hover:text-red-600 rounded transition-colors">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    ` : ''}
                </div>
            </div>

            <div>
                <h3 class="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2">${escapeHTML(os.titulo || 'Sem título')}</h3>
                <p class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                    <i data-lucide="cpu" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
                    <span class="truncate">${escapeHTML(os.ativoTag ? `${os.ativoTag} — ${os.ativoNome}` : (os.ativoNome || 'Ativo não informado'))}</span>
                </p>
            </div>

            <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">${escapeHTML(os.tipo || 'Corretiva')}</span>
                    ${qtdChecklist > 0 ? `
                        <span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium flex items-center gap-1">
                            <i data-lucide="clipboard-check" class="w-3 h-3"></i>
                            <span>${qtdChecklist}</span>
                        </span>
                    ` : ''}
                </div>
                <span class="font-semibold text-slate-700">${custoTotal}</span>
            </div>

            ${os.responsavelNome ? `
                <div class="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <i data-lucide="wrench" class="w-3 h-3 text-slate-400"></i>
                    <span class="truncate">${escapeHTML(os.responsavelNome)}</span>
                </div>
            ` : ''}
        </div>
    `;
}

/* ============================================================================
   MODAL NOVA O.S.
   ============================================================================ */

async function abrirModalNovaOS(dadosPrePreenchidos = null) {
    const modal = document.getElementById('modal-nova-os');
    const form = document.getElementById('form-nova-os');
    if (!modal || !form) return;

    form.reset();

    await carregarPlanosParaNovaOS();

    const selUsarPlano = document.getElementById('os-usar-plano');
    if (selUsarPlano) selUsarPlano.value = 'nao';
    alternarSeletorPlanoNovaOS();

    const selAtivo = document.getElementById('os-ativo');
    if (selAtivo) {
        selAtivo.innerHTML = `<option value="">Selecione o equipamento...</option>` +
            cacheAtivosOS.map(a => `<option value="${a.id}">${escapeHTML(a.tag ? `${a.tag} — ${a.nome}` : a.nome)}</option>`).join('');
    }

    const selResp = document.getElementById('os-responsavel');
    if (selResp) {
        selResp.innerHTML = `<option value="">A definir / Fila geral</option>` +
            cacheManutentoresOS.map(m => `<option value="${m.id}">${escapeHTML(m.nome)}</option>`).join('');
    }

    if (dadosPrePreenchidos) {
        if (dadosPrePreenchidos.titulo) document.getElementById('os-titulo').value = dadosPrePreenchidos.titulo;
        if (dadosPrePreenchidos.descricao) document.getElementById('os-descricao').value = dadosPrePreenchidos.descricao;
        if (dadosPrePreenchidos.ativoId && selAtivo) {
            selAtivo.value = dadosPrePreenchidos.ativoId;
            atualizarOpcoesPlanosNovaOS();
        }
        if (dadosPrePreenchidos.prioridade) document.getElementById('os-prioridade').value = dadosPrePreenchidos.prioridade;
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function fecharModalNovaOS() {
    const modal = document.getElementById('modal-nova-os');
    if (modal) modal.classList.add('hidden');
}

async function salvarNovaOS(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-nova-os');
    const empresaId = window.empresaAtual?.id;
    const u = window.usuarioLogado;

    const titulo = document.getElementById('os-titulo').value.trim();
    const tipo = document.getElementById('os-tipo').value;
    const prioridade = document.getElementById('os-prioridade').value;
    const ativoId = document.getElementById('os-ativo').value;
    const responsavelId = document.getElementById('os-responsavel').value;
    const descricao = document.getElementById('os-descricao').value.trim();

    const usarPlano = document.getElementById('os-usar-plano')?.value === 'sim';
    const planoIdSel = usarPlano ? (document.getElementById('os-plano-id')?.value || '') : '';
    const planoObj = planoIdSel ? cachePlanosOS.find(p => p.id === planoIdSel) : null;

    if (usarPlano && !planoObj) {
        alert('Selecione um Plano de Manutenção ou marque "Não".');
        return;
    }

    const checklistPlano = planoObj && Array.isArray(planoObj.itens)
        ? planoObj.itens.map((it, idx) => ({
            id: it.id || `chk_${idx + 1}`,
            descricao: typeof it === 'string' ? it : (it.descricao || it.texto || `Item ${idx + 1}`),
            status: '', // 'OK' | 'NAO_OK'
            motivo: ''
        }))
        : [];

    const ativoObj = cacheAtivosOS.find(a => a.id === ativoId) || {};
    const respObj = cacheManutentoresOS.find(m => m.id === responsavelId) || null;

    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Salvando...';
        }

        // Gera número sequencial amigável baseado no total atual + timestamp curto
        const numeroOs = `OS-${String(listaOrdensServico.length + 1).padStart(4, '0')}`;

        await db.collection('ordens_servico').add({
            empresaId,
            numeroOs,
            titulo,
            tipo,
            prioridade,
            status: 'Aberta',
            ativoId: ativoObj.id || '',
            ativoTag: ativoObj.tag || '',
            ativoNome: ativoObj.nome || '',
            ativoSetor: ativoObj.setor || '',
            planoId: planoObj ? planoObj.id : '',
            planoTitulo: planoObj ? (planoObj.titulo || '') : '',
            planoInstrucoes: planoObj ? (planoObj.instrucoes || '') : '',
            checklistPlano,
            responsavelId: respObj ? respObj.id : '',
            responsavelNome: respObj ? respObj.nome : '',
            descricao,
            itensCusto: [],
            totalHoras: 0,
            custoMaoDeObra: 0,
            custoMateriais: 0,
            custoTotal: 0,
            criadaPorId: u.uid,
            criadaPorNome: u.nome,
            criadaEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        fecharModalNovaOS();
        await carregarOrdensServico();

    } catch (erro) {
        console.error('Erro ao criar O.S.:', erro);
        alert('Erro ao criar Ordem de Serviço: ' + erro.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Criar Ordem de Serviço';
        }
    }
}

/**
 * Exclusão exclusiva para Gestores com registro obrigatório na coleção logs_exclusao_os
 */
async function excluirOSComAuditoria(osId, numeroOs) {
    const motivo = prompt(`Informe o motivo obrigatório para excluir a ${numeroOs}:`);
    if (!motivo || motivo.trim().length < 5) {
        alert('Exclusão cancelada. É obrigatório informar um motivo válido (mínimo 5 caracteres).');
        return;
    }

    const empresaId = window.empresaAtual?.id;
    const u = window.usuarioLogado;
    const osObj = listaOrdensServico.find(o => o.id === osId) || {};

    try {
        await db.collection('logs_exclusao_os').add({
            empresaId,
            osId,
            numeroOs: osObj.numeroOs || numeroOs,
            tituloOs: osObj.titulo || '',
            motivoExclusao: motivo.trim(),
            excluidoPorId: u.uid,
            excluidoPorNome: u.nome,
            excluidoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('ordens_servico').doc(osId).delete();
        await carregarOrdensServico();
    } catch (erro) {
        console.error('Erro ao excluir O.S.:', erro);
        alert('Erro ao excluir Ordem de Serviço: ' + erro.message);
    }
}
