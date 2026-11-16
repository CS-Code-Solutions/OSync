async function initConfiguracoes() {
    carregarColunasConfig();
    carregarTiposConfig();
    carregarSetoresConfig();

    // Adicionar Coluna
    document.getElementById('form-add-coluna')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titulo = document.getElementById('col-titulo').value.trim();
        const ordem = parseInt(document.getElementById('col-ordem').value) || 1;
        const corTopo = document.getElementById('col-cor').value;

        await db.collection('kanban_colunas').add({
            empresaId: usuarioAtual.empresaId,
            titulo,
            ordem,
            corTopo
        });

        e.target.reset();
        carregarColunasConfig();
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

async function carregarColunasConfig() {
    const lista = document.getElementById('lista-colunas');
    if (!lista) return;

    const snap = await db.collection('kanban_colunas')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .get();

    const colunas = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.ordem - b.ordem);

    lista.innerHTML = colunas.map(col => `
        <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div class="flex items-center gap-2.5">
                <span class="w-3 h-3 rounded-full" style="background-color: ${col.corTopo}"></span>
                <span class="text-xs font-bold text-slate-400">#${col.ordem}</span>
                <span class="text-sm font-medium text-slate-700">${col.titulo}</span>
            </div>
            <button onclick="deletarItemConfig('kanban_colunas', '${col.id}', carregarColunasConfig)" class="text-slate-400 hover:text-rose-600 p-1">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('') || '<p class="text-xs text-slate-400 text-center py-4">Nenhuma coluna cadastrada.</p>';
    lucide.createIcons();
}

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
