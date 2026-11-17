let cacheColunasConfig = [];

async function initConfiguracoes() {
    carregarSolicitacoesAcesso();
    carregarColunasConfig();
    carregarTiposConfig();
    carregarSetoresConfig();
    carregarCentrosCustoConfig();
    // Adicionar ou Editar Coluna
    document.getElementById('form-add-coluna')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('col-edit-id').value;
        const titulo = document.getElementById('col-titulo').value.trim();
        const ordem = parseInt(document.getElementById('col-ordem').value) || 1;
        const corTopo = document.getElementById('col-cor').value;

        if (editId) {
            await db.collection('kanban_colunas').doc(editId).update({
                titulo,
                ordem,
                corTopo
            });
            cancelarEdicaoColuna();
        } else {
            await db.collection('kanban_colunas').add({
                empresaId: usuarioAtual.empresaId,
                titulo,
                ordem,
                corTopo
            });
            e.target.reset();
        }

        await carregarColunasConfig();
    });

    // Adicionar Tipo de Manutenção
    document.getElementById('form-add-tipo')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('tipo-nome').value.trim();
        const cor = document.getElementById('tipo-cor').value;

        await db.collection('tipos_manutencao').add({
            empresaId: usuarioAtual.empresaId,
            nome,
            cor
        });

        e.target.reset();
        carregarTiposConfig();
    });

    // Adicionar Setor Executante
    document.getElementById('form-add-setor')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('setor-nome').value.trim();

        await db.collection('setores_executantes').add({
            empresaId: usuarioAtual.empresaId,
            nome
        });

        e.target.reset();
        carregarSetoresConfig();
    });
}

// ==========================================
// CÓDIGO DA EMPRESA E APROVAÇÕES PENDENTES
// ==========================================
function copiarCodigoEmpresa() {
    const input = document.getElementById('config-codigo-empresa');
    if (!input) return;
    input.select();
    navigator.clipboard.writeText(input.value);
    alert('Código da empresa copiado!');
}

async function carregarSolicitacoesAcesso() {
    const inputCodigo = document.getElementById('config-codigo-empresa');
    if (inputCodigo && usuarioAtual?.empresaId) {
        inputCodigo.value = usuarioAtual.empresaId;
    }

    const lista = document.getElementById('lista-acessos-pendentes');
    const badge = document.getElementById('badge-qtd-pendentes');
    if (!lista) return;

    const snap = await db.collection('usuarios')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .where('statusAcesso', '==', 'pendente')
        .get();

    const pendentes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (badge) badge.textContent = pendentes.length;

    if (pendentes.length === 0) {
        lista.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Nenhuma solicitação de cadastro pendente.</p>';
        return;
    }

    lista.innerHTML = pendentes.map(u => `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs">
            <div>
                <div class="font-bold text-slate-900 text-sm">${u.nome} <span class="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700 ml-1">${u.perfil}</span></div>
                <div class="text-slate-600 mt-0.5">${u.email} • Setor: <strong>${u.setor}</strong></div>
            </div>
            <div class="flex items-center gap-2 self-end sm:self-center">
                <button onclick="aprovarAcessoUsuario('${u.id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1 transition">
                    <i data-lucide="check" class="w-3.5 h-3.5"></i> Liberar
                </button>
                <button onclick="recusarAcessoUsuario('${u.id}', '${u.nome}')" class="px-3 py-1.5 bg-rose-100 hover:bg-rose-600 text-rose-700 hover:text-white font-bold rounded-lg flex items-center gap-1 transition">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i> Recusar
                </button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

async function aprovarAcessoUsuario(userId) {
    await db.collection('usuarios').doc(userId).update({
        ativo: true,
        statusAcesso: 'aprovado'
    });
    carregarSolicitacoesAcesso();
}

async function recusarAcessoUsuario(userId, nome) {
    if (!confirm(`Recusar e excluir o pedido de "${nome}"?`)) return;
    await db.collection('usuarios').doc(userId).delete();
    carregarSolicitacoesAcesso();
}

// ==========================================
// COLUNAS DO KANBAN (ORDEM AUTOMÁTICA, SETAS E EDIÇÃO)
// ==========================================
async function carregarColunasConfig() {
    const lista = document.getElementById('lista-colunas');
    if (!lista) return;

    const snap = await db.collection('kanban_colunas')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .get();

    cacheColunasConfig = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.ordem - b.ordem);

    // Define automaticamente o próximo número disponível no input de ordem
    const inputOrdem = document.getElementById('col-ordem');
    const editId = document.getElementById('col-edit-id')?.value;
    if (inputOrdem && !editId) {
        const maiorOrdem = cacheColunasConfig.reduce((max, c) => Math.max(max, Number(c.ordem) || 0), 0);
        inputOrdem.value = maiorOrdem + 1;
    }

    lista.innerHTML = cacheColunasConfig.map((col, idx) => `
        <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 gap-2">
            <div class="flex items-center gap-2 min-w-0">
                <span class="w-3 h-3 rounded-full shrink-0" style="background-color: ${col.corTopo}"></span>
                <span class="text-xs font-bold text-slate-400 shrink-0">#${col.ordem}</span>
                <span class="text-sm font-medium text-slate-700 truncate">${col.titulo}</span>
            </div>
            
            <div class="flex items-center gap-0.5 shrink-0">
                <button type="button" onclick="moverColunaConfig(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Mover para cima"
                    class="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-25 disabled:pointer-events-none transition">
                    <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>
                </button>
                <button type="button" onclick="moverColunaConfig(${idx}, 1)" ${idx === cacheColunasConfig.length - 1 ? 'disabled' : ''} title="Mover para baixo"
                    class="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-25 disabled:pointer-events-none transition">
                    <i data-lucide="arrow-down" class="w-3.5 h-3.5"></i>
                </button>
                <button type="button" onclick="prepararEdicaoColuna('${col.id}')" title="Editar coluna"
                    class="p-1.5 rounded text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition">
                    <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                </button>
                <button type="button" onclick="excluirColunaConfig('${col.id}')" title="Excluir coluna"
                    class="p-1.5 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        </div>
    `).join('') || '<p class="text-xs text-slate-400 text-center py-4">Nenhuma coluna cadastrada.</p>';
    
    lucide.createIcons();
}

async function moverColunaConfig(indexAtual, direcao) {
    const novoIndex = indexAtual + direcao;
    if (novoIndex < 0 || novoIndex >= cacheColunasConfig.length) return;

    // Troca a posição dos itens na lista
    const listaReordenada = [...cacheColunasConfig];
    const [itemMovido] = listaReordenada.splice(indexAtual, 1);
    listaReordenada.splice(novoIndex, 0, itemMovido);

    // Atualiza a numeração sequencial (1, 2, 3...) no Firestore em lote
    const batch = db.batch();
    listaReordenada.forEach((col, i) => {
        const ref = db.collection('kanban_colunas').doc(col.id);
        batch.update(ref, { ordem: i + 1 });
    });

    await batch.commit();
    await carregarColunasConfig();
}

function prepararEdicaoColuna(colId) {
    const col = cacheColunasConfig.find(c => c.id === colId);
    if (!col) return;

    document.getElementById('col-edit-id').value = col.id;
    document.getElementById('col-titulo').value = col.titulo;
    document.getElementById('col-ordem').value = col.ordem;
    document.getElementById('col-cor').value = col.corTopo || '#1D4ED8';

    const btnSalvar = document.getElementById('btn-salvar-coluna');
    btnSalvar.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i><span>Salvar Alteração</span>';
    btnSalvar.className = 'flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 rounded-lg text-xs transition flex items-center justify-center gap-1.5';

    document.getElementById('btn-cancelar-edit-coluna').classList.remove('hidden');
    document.getElementById('col-titulo').focus();
    lucide.createIcons();
}

function cancelarEdicaoColuna() {
    document.getElementById('col-edit-id').value = '';
    document.getElementById('form-add-coluna').reset();

    const btnSalvar = document.getElementById('btn-salvar-coluna');
    btnSalvar.innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i><span>Adicionar Coluna</span>';
    btnSalvar.className = 'flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-xs transition flex items-center justify-center gap-1.5';

    document.getElementById('btn-cancelar-edit-coluna').classList.add('hidden');

    const maiorOrdem = cacheColunasConfig.reduce((max, c) => Math.max(max, Number(c.ordem) || 0), 0);
    document.getElementById('col-ordem').value = maiorOrdem + 1;
    lucide.createIcons();
}

async function excluirColunaConfig(colId) {
    if (!confirm('Deseja excluir esta coluna?')) return;
    await db.collection('kanban_colunas').doc(colId).delete();

    // Reordena automaticamente as restantes para não ficar buraco na numeração
    const restantes = cacheColunasConfig.filter(c => c.id !== colId);
    const batch = db.batch();
    restantes.forEach((col, i) => {
        batch.update(db.collection('kanban_colunas').doc(col.id), { ordem: i + 1 });
    });
    await batch.commit();

    if (document.getElementById('col-edit-id').value === colId) {
        cancelarEdicaoColuna();
    }
    await carregarColunasConfig();
}

// ==========================================
// TIPOS DE MANUTENÇÃO E SETORES EXECUTANTES
// ==========================================
async function carregarTiposConfig() {
    const lista = document.getElementById('lista-tipos');
    if (!lista) return;

    const snap = await db.collection('tipos_manutencao')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .get();

    const tipos = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.nome.localeCompare(b.nome));

    lista.innerHTML = tipos.map(t => `
        <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div class="flex items-center gap-2.5">
                <span class="w-3 h-3 rounded-full" style="background-color: ${t.cor}"></span>
                <span class="text-sm font-medium text-slate-700">${t.nome}</span>
            </div>
            <button onclick="deletarItemConfig('tipos_manutencao', '${t.id}', carregarTiposConfig)" class="text-slate-400 hover:text-rose-600 p-1">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('') || '<p class="text-xs text-slate-400 text-center py-4">Nenhum tipo cadastrado.</p>';
    lucide.createIcons();
}

async function carregarSetoresConfig() {
    const lista = document.getElementById('lista-setores');
    if (!lista) return;

    const snap = await db.collection('setores_executantes')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .get();

    const setores = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.nome.localeCompare(b.nome));

    lista.innerHTML = setores.map(s => `
        <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span class="text-sm font-medium text-slate-700">${s.nome}</span>
            <button onclick="deletarItemConfig('setores_executantes', '${s.id}', carregarSetoresConfig)" class="text-slate-400 hover:text-rose-600 p-1">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('') || '<p class="text-xs text-slate-400 text-center py-4">Nenhum setor cadastrado.</p>';
    lucide.createIcons();
}

async function deletarItemConfig(colecao, id, callback) {
    if (!confirm('Deseja excluir este item?')) return;
    await db.collection(colecao).doc(id).delete();
    callback();
}
// Listener dentro de initConfiguracoes():
document.getElementById('form-add-centro-custo')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = document.getElementById('cc-codigo').value.trim().toUpperCase();
    const nome = document.getElementById('cc-nome').value.trim();

    await db.collection('centros_custo').add({
        empresaId: usuarioAtual.empresaId,
        codigo,
        nome
    });

    e.target.reset();
    carregarCentrosCustoConfig();
});

async function carregarCentrosCustoConfig() {
    const lista = document.getElementById('lista-centros-custo');
    if (!lista) return;

    const snap = await db.collection('centros_custo')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .get();

    const centros = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));

    lista.innerHTML = centros.map(cc => `
        <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div class="flex items-center gap-2 min-w-0">
                <span class="text-xs font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">${cc.codigo}</span>
                <span class="text-sm font-medium text-slate-700 truncate">${cc.nome}</span>
            </div>
            <button onclick="deletarItemConfig('centros_custo', '${cc.id}', carregarCentrosCustoConfig)" class="text-slate-400 hover:text-rose-600 p-1">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('') || '<p class="text-xs text-slate-400 text-center py-4">Nenhum centro de custo cadastrado.</p>';
    lucide.createIcons();
}
