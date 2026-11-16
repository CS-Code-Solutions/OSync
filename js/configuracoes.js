async function initConfiguracoes() {
    carregarSolicitacoesAcesso();
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
// COLUNAS DO KANBAN, TIPOS E SETORES
// ==========================================
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
