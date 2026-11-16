async function initConfiguracoes() {
    carregarColunasConfig();
    carregarTiposConfig();
    carregarSetoresConfig();

    // Evento: Nova Coluna
    document.getElementById('form-add-coluna')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titulo = document.getElementById('col-titulo').value.trim();
        const ordem = parseInt(document.getElementById('col-ordem').value) || 1;
        const cor_topo = document.getElementById('col-cor').value;

        const { error } = await db.from('kanban_colunas').insert([{
            empresa_id: usuarioAtual?.empresa_id,
            titulo,
            ordem,
            cor_topo
        }]);

        if (!error) {
            e.target.reset();
            carregarColunasConfig();
        }
    });

    // Evento: Novo Tipo de Manutenção
    document.getElementById('form-add-tipo')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('tipo-nome').value.trim();
        const cor = document.getElementById('tipo-cor').value;

        const { error } = await db.from('tipos_manutencao').insert([{
            empresa_id: usuarioAtual?.empresa_id,
            nome,
            cor
        }]);

        if (!error) {
            e.target.reset();
            carregarTiposConfig();
        }
    });

    // Evento: Novo Setor Executante
    document.getElementById('form-add-setor')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('setor-nome').value.trim();

        const { error } = await db.from('setores_executantes').insert([{
            empresa_id: usuarioAtual?.empresa_id,
            nome
        }]);

        if (!error) {
            e.target.reset();
            carregarSetoresConfig();
        }
    });
}

async function carregarColunasConfig() {
    const lista = document.getElementById('lista-colunas');
    if (!lista) return;

    const { data } = await db.from('kanban_colunas').select('*').order('ordem', { ascending: true });
    lista.innerHTML = (data || []).map(col => `
        <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div class="flex items-center gap-2.5">
                <span class="w-3 h-3 rounded-full" style="background-color: ${col.cor_topo}"></span>
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

    const { data } = await db.from('tipos_manutencao').select('*').order('nome');
    lista.innerHTML = (data || []).map(t => `
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

    const { data } = await db.from('setores_executantes').select('*').order('nome');
    lista.innerHTML = (data || []).map(s => `
        <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span class="text-sm font-medium text-slate-700">${s.nome}</span>
            <button onclick="deletarItemConfig('setores_executantes', '${s.id}', carregarSetoresConfig)" class="text-slate-400 hover:text-rose-600 p-1">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('') || '<p class="text-xs text-slate-400 text-center py-4">Nenhum setor cadastrado.</p>';
    lucide.createIcons();
}

async function deletarItemConfig(tabela, id, callback) {
    if (!confirm('Deseja excluir este item?')) return;
    await db.from(tabela).delete().eq('id', id);
    callback();
}
