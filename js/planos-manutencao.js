let cachePlanosManutencao = [];
let cacheAtivosPlanos = [];
let itensChecklistPlanoTemp = [];

async function initPlanosManutencao() {
    await Promise.all([
        carregarAtivosParaPlanos(),
        carregarPlanosManutencao()
    ]);

    const form = document.getElementById('form-plano-manutencao');
    if (form && !form.dataset.bound) {
        form.addEventListener('submit', salvarPlanoManutencao);
        form.dataset.bound = 'true';
    }
}

async function carregarAtivosParaPlanos() {
    const snap = await db.collection('ativos')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .get();

    cacheAtivosPlanos = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
            const rotA = (a.codigoTag || '').trim() ? `${a.codigoTag} - ${a.nome}` : (a.nome || '');
            const rotB = (b.codigoTag || '').trim() ? `${b.codigoTag} - ${b.nome}` : (b.nome || '');
            return rotA.localeCompare(rotB);
        });
}

async function carregarPlanosManutencao() {
    const grid = document.getElementById('lista-planos-manutencao');
    if (!grid) return;

    const snap = await db.collection('planos_manutencao')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .get();

    cachePlanosManutencao = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));

    filtrarPlanosManutencao();
}

function filtrarPlanosManutencao() {
    const termo = (document.getElementById('busca-planos')?.value || '').toLowerCase();
    const escopo = document.getElementById('filtro-escopo-plano')?.value || '';

    const filtrados = cachePlanosManutencao.filter(p => {
        if (escopo && p.escopo !== escopo) return false;
        const itensTexto = Array.isArray(p.itens) ? p.itens.map(i => i.descricao || i).join(' ') : '';
        const alvo = `${p.titulo || ''} ${p.ativoNome || ''} ${p.periodicidade || ''} ${itensTexto}`.toLowerCase();
        return !termo || alvo.includes(termo);
    });

    renderizarListaPlanosManutencao(filtrados);
}

function renderizarListaPlanosManutencao(planos) {
    const grid = document.getElementById('lista-planos-manutencao');
    if (!grid) return;

    if (planos.length === 0) {
        grid.innerHTML = `<div class="col-span-full bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-sm">Nenhum plano de manutenção cadastrado ainda.</div>`;
        return;
    }

    grid.innerHTML = planos.map(p => {
        const pId = escaparHTML(p.id);
        const titulo = escaparHTML(p.titulo || 'Plano');
        const ehPadrao = p.escopo !== 'maquina';
        const itens = Array.isArray(p.itens) ? p.itens : [];

        return `
        <div class="osync-card p-4 flex flex-col justify-between gap-3">
            <div class="space-y-2">
                <div class="flex items-start justify-between gap-2">
                    <div class="space-y-1 min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            ${ehPadrao
                                ? `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">PROCEDIMENTO PADRÃO</span>`
                                : `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">MÁQUINA ESPECÍFICA</span>`}
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">${escaparHTML(p.periodicidade || 'Sob Demanda')}</span>
                        </div>
                        <h3 class="font-bold text-slate-900 text-base leading-snug">${titulo}</h3>
                    </div>

                    <div class="flex items-center gap-1 shrink-0">
                        <button onclick="abrirModalEditarPlano('${pId}')" title="Editar Plano" class="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition">
                            <i data-lucide="pencil" class="w-4 h-4"></i>
                        </button>
                        <button data-nome="${titulo}" onclick="excluirPlanoManutencao('${pId}', this.getAttribute('data-nome'))" title="Excluir Plano" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>

                ${!ehPadrao && p.ativoNome ? `
                    <div class="text-xs font-semibold text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
                        <i data-lucide="cpu" class="w-3.5 h-3.5 text-blue-600 shrink-0"></i>
                        <span class="truncate">${escaparHTML(p.ativoNome)}</span>
                    </div>
                ` : ''}

                ${p.instrucoes ? `<p class="text-xs text-slate-500 line-clamp-2">${escaparHTML(p.instrucoes)}</p>` : ''}
            </div>

            <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span class="font-semibold text-slate-700 flex items-center gap-1">
                    <i data-lucide="list-checks" class="w-3.5 h-3.5 text-[#00a881]"></i>
                    ${itens.length} ${itens.length === 1 ? 'item de inspeção' : 'itens de inspeção'}
                </span>
                <span class="text-[11px] text-slate-400">Checklist OK / Não OK</span>
            </div>
        </div>`;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function alternarEscopoPlano() {
    const escopo = document.querySelector('input[name="plano-escopo"]:checked')?.value || 'padrao';
    const box = document.getElementById('box-plano-maquina-especifica');
    const sel = document.getElementById('plano-ativo-id');
    if (!box || !sel) return;

    if (escopo === 'maquina') {
        box.classList.remove('hidden');
        sel.required = true;
    } else {
        box.classList.add('hidden');
        sel.required = false;
    }
}

function renderizarItensConstrutorPlano() {
    const lista = document.getElementById('lista-itens-construtor-plano');
    const qtdEl = document.getElementById('plano-qtd-itens');
    if (qtdEl) qtdEl.textContent = `${itensChecklistPlanoTemp.length} ${itensChecklistPlanoTemp.length === 1 ? 'item' : 'itens'}`;
    if (!lista) return;

    if (itensChecklistPlanoTemp.length === 0) {
        lista.innerHTML = `<p class="text-[11px] text-slate-400 text-center py-3">Adicione acima os passos de verificação deste plano.</p>`;
        return;
    }

    lista.innerHTML = itensChecklistPlanoTemp.map((item, idx) => `
        <div class="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs">
            <div class="flex items-center gap-2 min-w-0">
                <span class="font-extrabold text-slate-400 shrink-0">${idx + 1}.</span>
                <span class="text-slate-800 font-medium">${escaparHTML(item.descricao)}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button type="button" onclick="moverItemChecklistPlano(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} class="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-25">
                    <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>
                </button>
                <button type="button" onclick="moverItemChecklistPlano(${idx}, 1)" ${idx === itensChecklistPlanoTemp.length - 1 ? 'disabled' : ''} class="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-25">
                    <i data-lucide="arrow-down" class="w-3.5 h-3.5"></i>
                </button>
                <button type="button" onclick="removerItemChecklistPlano(${idx})" class="p-1 text-slate-400 hover:text-rose-600">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        </div>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function adicionarItemChecklistPlano() {
    const input = document.getElementById('novo-item-checklist-input');
    const texto = (input?.value || '').trim();
    if (!texto) return;

    itensChecklistPlanoTemp.push({
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        descricao: texto
    });

    input.value = '';
    input.focus();
    renderizarItensConstrutorPlano();
}

function moverItemChecklistPlano(idx, direcao) {
    const novoIdx = idx + direcao;
    if (novoIdx < 0 || novoIdx >= itensChecklistPlanoTemp.length) return;
    const [movido] = itensChecklistPlanoTemp.splice(idx, 1);
    itensChecklistPlanoTemp.splice(novoIdx, 0, movido);
    renderizarItensConstrutorPlano();
}

function removerItemChecklistPlano(idx) {
    itensChecklistPlanoTemp.splice(idx, 1);
    renderizarItensConstrutorPlano();
}

function popularSelectAtivosPlano(ativoIdSelecionado = '') {
    const sel = document.getElementById('plano-ativo-id');
    if (!sel) return;

    sel.innerHTML = '<option value="">Selecione a máquina...</option>' +
        cacheAtivosPlanos.map(a => {
            const rotulo = (a.codigoTag || '').trim() ? `${a.codigoTag} - ${a.nome}` : a.nome;
            return `<option value="${escaparHTML(a.id)}">${escaparHTML(rotulo)}</option>`;
        }).join('');

    if (ativoIdSelecionado) sel.value = ativoIdSelecionado;
}

async function abrirModalNovoPlano() {
    if (cacheAtivosPlanos.length === 0) await carregarAtivosParaPlanos();

    document.getElementById('form-plano-manutencao')?.reset();
    document.getElementById('plano-edit-id').value = '';
    document.getElementById('modal-plano-titulo').innerHTML = `<i data-lucide="clipboard-check" class="w-5 h-5 text-[#00E5B0]"></i><span>Novo Plano de Manutenção</span>`;
    document.getElementById('btn-salvar-plano').textContent = 'Salvar Plano';

    itensChecklistPlanoTemp = [];
    popularSelectAtivosPlano('');

    const radioPadrao = document.querySelector('input[name="plano-escopo"][value="padrao"]');
    if (radioPadrao) radioPadrao.checked = true;
    alternarEscopoPlano();
    renderizarItensConstrutorPlano();

    document.getElementById('modal-plano-manutencao')?.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function abrirModalEditarPlano(planoId) {
    const p = cachePlanosManutencao.find(item => item.id === planoId);
    if (!p) return;

    if (cacheAtivosPlanos.length === 0) await carregarAtivosParaPlanos();

    document.getElementById('plano-edit-id').value = p.id;
    document.getElementById('modal-plano-titulo').innerHTML = `<i data-lucide="pencil" class="w-5 h-5 text-[#00E5B0]"></i><span>Editar Plano de Manutenção</span>`;
    document.getElementById('btn-salvar-plano').textContent = 'Salvar Alterações';

    document.getElementById('plano-titulo').value = p.titulo || '';
    document.getElementById('plano-periodicidade').value = p.periodicidade || 'Sob Demanda';
    document.getElementById('plano-instrucoes').value = p.instrucoes || '';

    const escopo = p.escopo === 'maquina' ? 'maquina' : 'padrao';
    const radio = document.querySelector(`input[name="plano-escopo"][value="${escopo}"]`);
    if (radio) radio.checked = true;

    popularSelectAtivosPlano(p.ativoId || '');
    alternarEscopoPlano();

    itensChecklistPlanoTemp = Array.isArray(p.itens)
        ? p.itens.map((it, idx) => ({
            id: it.id || `item_${idx}_${Date.now()}`,
            descricao: typeof it === 'string' ? it : (it.descricao || '')
        }))
        : [];

    renderizarItensConstrutorPlano();
    document.getElementById('modal-plano-manutencao')?.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function fecharModalPlano() {
    document.getElementById('modal-plano-manutencao')?.classList.add('hidden');
}

async function salvarPlanoManutencao(e) {
    e.preventDefault();
    if (itensChecklistPlanoTemp.length === 0) {
        alert('Adicione pelo menos 1 item de inspeção no checklist do plano.');
        return;
    }

    const btn = document.getElementById('btn-salvar-plano');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        const editId = document.getElementById('plano-edit-id').value;
        const titulo = document.getElementById('plano-titulo').value.trim();
        const periodicidade = document.getElementById('plano-periodicidade').value;
        const escopo = document.querySelector('input[name="plano-escopo"]:checked')?.value || 'padrao';
        const instrucoes = document.getElementById('plano-instrucoes').value.trim();

        let ativoId = '';
        let ativoNome = '';
        if (escopo === 'maquina') {
            ativoId = document.getElementById('plano-ativo-id').value;
            if (!ativoId) {
                alert('Selecione a máquina específica para este plano.');
                btn.disabled = false;
                btn.textContent = editId ? 'Salvar Alterações' : 'Salvar Plano';
                return;
            }
            const ativoObj = cacheAtivosPlanos.find(a => a.id === ativoId);
            ativoNome = ativoObj
                ? ((ativoObj.codigoTag || '').trim() ? `${ativoObj.codigoTag} - ${ativoObj.nome}` : ativoObj.nome)
                : '';
        }

        const payload = {
            empresaId: usuarioAtual.empresaId,
            titulo,
            periodicidade,
            escopo,
            ativoId,
            ativoNome,
            instrucoes,
            itens: itensChecklistPlanoTemp,
            atualizadoPor: usuarioAtual.nome,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editId) {
            await db.collection('planos_manutencao').doc(editId).update(payload);
        } else {
            payload.criadoPor = usuarioAtual.nome;
            payload.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('planos_manutencao').add(payload);
        }

        fecharModalPlano();
        await carregarPlanosManutencao();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Plano de manutenção salvo com sucesso!', 'sucesso');
        }
    } catch (err) {
        alert('Erro ao salvar plano: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar Plano';
    }
}

async function excluirPlanoManutencao(planoId, titulo) {
    if (!await confirmarAcaoOSync(`Deseja excluir o plano <strong>"${escaparHTML(titulo)}"</strong>?`, { titulo: 'Excluir Plano', textoConfirmar: 'Excluir' })) return;
    await db.collection('planos_manutencao').doc(planoId).delete();
    await carregarPlanosManutencao();
}
