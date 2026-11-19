/**
 * ============================================================================
 * OSync — Cadastro e Gestão de Planos de Manutenção (Checklists)
 * ============================================================================
 */

let cachePlanosManutencao = [];
let cacheAtivosPlanos = [];

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
    try {
        const snap = await db.collection('ativos')
            .where('empresaId', '==', usuarioAtual.empresaId)
            .get();

        cacheAtivosPlanos = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

        const opcoes = cacheAtivosPlanos.map(a => {
            const rotulo = (a.codigoTag || '').trim() ? `${a.codigoTag} - ${a.nome}` : a.nome;
            return `<option value="${escaparHTML(a.id)}">${escaparHTML(rotulo)}</option>`;
        }).join('');

        const selFiltro = document.getElementById('filtro-plano-ativo');
        if (selFiltro) {
            selFiltro.innerHTML = `<option value="">Todas as Máquinas / Gerais</option><option value="__GERAL__">Somente Planos Gerais</option>` + opcoes;
        }

        const selModal = document.getElementById('plano-ativo-id');
        if (selModal) {
            selModal.innerHTML = `<option value="">Geral (Disponível para qualquer máquina)</option>` + opcoes;
        }
    } catch (err) {
        console.error('Erro ao carregar ativos para planos:', err);
    }
}

async function carregarPlanosManutencao() {
    const grid = document.getElementById('grid-planos-manutencao');
    if (!grid) return;

    try {
        const snap = await db.collection('planos_manutencao')
            .where('empresaId', '==', usuarioAtual.empresaId)
            .get();

        cachePlanosManutencao = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));

        renderizarGridPlanosManutencao(cachePlanosManutencao);
    } catch (err) {
        console.error('Erro ao carregar planos:', err);
        grid.innerHTML = `<div class="col-span-full bg-white p-8 rounded-xl border border-rose-200 text-center text-rose-600 text-sm">Erro ao carregar planos de manutenção.</div>`;
    }
}

function filtrarPlanosManutencao() {
    const termo = (document.getElementById('busca-plano')?.value || '').toLowerCase();
    const filtroAtivo = document.getElementById('filtro-plano-ativo')?.value || '';

    const filtrados = cachePlanosManutencao.filter(p => {
        const bateTexto =
            (p.titulo || '').toLowerCase().includes(termo) ||
            (p.ativoNome || '').toLowerCase().includes(termo) ||
            (p.periodicidade || '').toLowerCase().includes(termo);

        if (!bateTexto) return false;
        if (filtroAtivo === '__GERAL__') return !p.ativoId;
        if (filtroAtivo) return p.ativoId === filtroAtivo;
        return true;
    });

    renderizarGridPlanosManutencao(filtrados);
}

function renderizarGridPlanosManutencao(lista) {
    const grid = document.getElementById('grid-planos-manutencao');
    if (!grid) return;

    if (lista.length === 0) {
        grid.innerHTML = `<div class="col-span-full bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400">Nenhum plano de manutenção encontrado.</div>`;
        return;
    }

    grid.innerHTML = lista.map(p => {
        const pIdSeguro = escaparHTML(p.id);
        const tituloSeguro = escaparHTML(p.titulo || 'Plano sem título');
        const itens = Array.isArray(p.itens) ? p.itens : [];
        const maquinaTexto = p.ativoNome
            ? `${p.ativoTag ? `${p.ativoTag} - ` : ''}${p.ativoNome}`
            : 'Geral (Qualquer máquina)';

        const previewItens = itens.slice(0, 3).map((it, idx) =>
            `<li class="text-xs text-slate-600 truncate"><span class="font-mono text-slate-400 mr-1">${idx + 1}.</span>${escaparHTML(it.descricao || '')}</li>`
        ).join('');

        return `
        <div class="osync-card p-5 flex flex-col justify-between gap-4">
            <div>
                <div class="flex items-start justify-between gap-2 mb-2">
                    <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        ${escaparHTML(p.periodicidade || 'Sob Demanda')}
                    </span>
                    <div class="flex items-center gap-1 shrink-0">
                        <button onclick="abrirModalEditarPlano('${pIdSeguro}')" title="Editar Plano"
                            class="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition">
                            <i data-lucide="pencil" class="w-4 h-4"></i>
                        </button>
                        <button data-titulo="${tituloSeguro}" onclick="excluirPlanoManutencao('${pIdSeguro}', this.getAttribute('data-titulo'))" title="Excluir Plano"
                            class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>

                <h3 class="font-bold text-slate-900 text-base">${tituloSeguro}</h3>
                <p class="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <i data-lucide="cpu" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
                    <span class="truncate">${escaparHTML(maquinaTexto)}</span>
                </p>

                <div class="mt-3 pt-3 border-t border-slate-100">
                    <span class="text-[11px] font-bold uppercase text-slate-400 block mb-1.5">${itens.length} ${itens.length === 1 ? 'item' : 'itens'} de verificação</span>
                    <ul class="space-y-1">${previewItens}</ul>
                    ${itens.length > 3 ? `<p class="text-[11px] text-blue-600 font-semibold mt-1">+ ${itens.length - 3} itens...</p>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function abrirModalNovoPlano() {
    document.getElementById('form-plano-manutencao')?.reset();
    document.getElementById('plano-edit-id').value = '';

    const tituloModal = document.getElementById('modal-plano-titulo');
    if (tituloModal) {
        tituloModal.innerHTML = `<i data-lucide="clipboard-check" class="w-5 h-5 text-[#00E5B0]"></i><span>Novo Plano de Manutenção</span>`;
    }

    const container = document.getElementById('container-itens-plano');
    if (container) {
        container.innerHTML = '';
        adicionarCampoItemPlano('');
        adicionarCampoItemPlano('');
    }

    document.getElementById('modal-plano-manutencao')?.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function abrirModalEditarPlano(planoId) {
    const p = cachePlanosManutencao.find(item => item.id === planoId);
    if (!p) return;

    document.getElementById('plano-edit-id').value = p.id;
    document.getElementById('plano-titulo').value = p.titulo || '';
    document.getElementById('plano-periodicidade').value = p.periodicidade || 'Mensal';
    document.getElementById('plano-ativo-id').value = p.ativoId || '';
    document.getElementById('plano-instrucoes').value = p.instrucoes || '';

    const tituloModal = document.getElementById('modal-plano-titulo');
    if (tituloModal) {
        tituloModal.innerHTML = `<i data-lucide="pencil" class="w-5 h-5 text-[#00E5B0]"></i><span>Editar Plano de Manutenção</span>`;
    }

    const container = document.getElementById('container-itens-plano');
    if (container) {
        container.innerHTML = '';
        const itens = Array.isArray(p.itens) && p.itens.length > 0 ? p.itens : [{ descricao: '' }];
        itens.forEach(it => adicionarCampoItemPlano(it.descricao || ''));
    }

    document.getElementById('modal-plano-manutencao')?.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function fecharModalPlano() {
    document.getElementById('modal-plano-manutencao')?.classList.add('hidden');
}

function adicionarCampoItemPlano(valorInicial = '') {
    const container = document.getElementById('container-itens-plano');
    if (!container) return;

    const index = container.children.length + 1;
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 item-plano-row';
    div.innerHTML = `
        <span class="text-xs font-mono font-bold text-slate-400 w-5 text-right shrink-0 item-plano-num">${index}.</span>
        <input type="text" required value="${escaparHTML(valorInicial)}" placeholder="Descreva o ponto de verificação..."
            class="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 item-plano-input">
        <button type="button" onclick="removerCampoItemPlano(this)" title="Remover item"
            class="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition shrink-0">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
    `;
    container.appendChild(div);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function removerCampoItemPlano(btn) {
    const container = document.getElementById('container-itens-plano');
    if (!container) return;
    if (container.children.length <= 1) {
        alert('O plano deve ter pelo menos 1 item de verificação.');
        return;
    }
    btn.closest('.item-plano-row')?.remove();
    Array.from(container.querySelectorAll('.item-plano-num')).forEach((el, i) => {
        el.textContent = `${i + 1}.`;
    });
}

async function salvarPlanoManutencao(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-plano');
    const editId = document.getElementById('plano-edit-id').value;
    const titulo = document.getElementById('plano-titulo').value.trim();
    const periodicidade = document.getElementById('plano-periodicidade').value;
    const ativoId = document.getElementById('plano-ativo-id').value;
    const instrucoes = document.getElementById('plano-instrucoes').value.trim();

    const inputsItens = Array.from(document.querySelectorAll('.item-plano-input'));
    const itens = inputsItens
        .map((inp, idx) => ({
            ordem: idx + 1,
            descricao: inp.value.trim()
        }))
        .filter(it => it.descricao.length > 0);

    if (itens.length === 0) {
        alert('Adicione pelo menos um item válido ao checklist.');
        return;
    }

    const ativoObj = cacheAtivosPlanos.find(a => a.id === ativoId) || null;

    const dadosPlano = {
        titulo,
        periodicidade,
        ativoId: ativoObj ? ativoObj.id : '',
        ativoTag: ativoObj ? (ativoObj.codigoTag || '') : '',
        ativoNome: ativoObj ? (ativoObj.nome || '') : '',
        instrucoes,
        itens
    };

    try {
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        if (editId) {
            await db.collection('planos_manutencao').doc(editId).update({
                ...dadosPlano,
                atualizadoPor: usuarioAtual.nome,
                atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (typeof mostrarNotificacaoOSync === 'function') {
                mostrarNotificacaoOSync('Plano de manutenção atualizado!', 'sucesso');
            }
        } else {
            await db.collection('planos_manutencao').add({
                empresaId: usuarioAtual.empresaId,
                ...dadosPlano,
                criadoPor: usuarioAtual.nome,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (typeof mostrarNotificacaoOSync === 'function') {
                mostrarNotificacaoOSync('Plano de manutenção cadastrado!', 'sucesso');
            }
        }

        fecharModalPlano();
        await carregarPlanosManutencao();
    } catch (err) {
        alert('Erro ao salvar plano: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar Plano';
    }
}

async function excluirPlanoManutencao(planoId, tituloPlano) {
    const confirmado = await confirmarAcaoOSync(
        `Deseja realmente excluir o plano <strong>"${escaparHTML(tituloPlano)}"</strong>?`,
        { titulo: 'Excluir Plano de Manutenção', textoConfirmar: 'Excluir' }
    );
    if (!confirmado) return;

    try {
        await db.collection('planos_manutencao').doc(planoId).delete();
        await carregarPlanosManutencao();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Plano excluído com sucesso!', 'sucesso');
        }
    } catch (err) {
        alert('Erro ao excluir plano: ' + err.message);
    }
}
