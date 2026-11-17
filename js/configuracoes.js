let cacheColunasConfig = [];

async function initConfiguracoes() {
    await garantirTiposESetoresPadrao();
    carregarSolicitacoesAcesso();
    carregarColunasConfig();
    carregarTiposConfig();
    carregarSetoresConfig();
    carregarCentrosCustoConfig();

    document.getElementById('form-add-coluna')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('col-edit-id').value;
        const titulo = document.getElementById('col-titulo').value.trim();
        const ordem = parseInt(document.getElementById('col-ordem').value) || 1;
        const corTopo = sanitizarCorHex(document.getElementById('col-cor').value, '#1D4ED8');

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

    document.getElementById('form-add-tipo')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('tipo-nome').value.trim();
        const cor = sanitizarCorHex(document.getElementById('tipo-cor').value, '#1D4ED8');

        await db.collection('tipos_manutencao').add({
            empresaId: usuarioAtual.empresaId,
            nome,
            cor
        });

        e.target.reset();
        carregarTiposConfig();
    });

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
}

// ==========================================
// GARANTIR TIPOS E SETORES FIXOS PADRÃO
// ==========================================
async function garantirTiposESetoresPadrao() {
    if (!usuarioAtual?.empresaId) return;

    const tiposPadrao = [
        { nome: 'Corretiva', cor: '#EF4444' },
        { nome: 'Preventiva', cor: '#3B82F6' },
        { nome: 'Programada', cor: '#10B981' },
        { nome: 'Manutenção Externa', cor: '#8B5CF6' }
    ];

    for (const tipo of tiposPadrao) {
        const snap = await db.collection('tipos_manutencao')
            .where('empresaId', '==', usuarioAtual.empresaId)
            .where('nome', '==', tipo.nome)
            .get();

        if (snap.empty) {
            await db.collection('tipos_manutencao').add({
                empresaId: usuarioAtual.empresaId,
                nome: tipo.nome,
                cor: tipo.cor
            });
        }
    }

    const setoresPadrao = ['Mecânica', 'Elétrica'];

    for (const nomeSetor of setoresPadrao) {
        const snap = await db.collection('setores_executantes')
            .where('empresaId', '==', usuarioAtual.empresaId)
            .where('nome', '==', nomeSetor)
            .get();

        if (snap.empty) {
            await db.collection('setores_executantes').add({
                empresaId: usuarioAtual.empresaId,
                nome: nomeSetor
            });
        }
    }
}

// ==========================================
// CÓDIGO DA EMPRESA E APROVAÇÕES PENDENTES
// ==========================================
function copiarCodigoEmpresa() {
    const input = document.getElementById('config-codigo-empresa');
    if (!input) return;
    input.select();
    navigator.clipboard.writeText(input.value);
    mostrarNotificacaoOSync('Código da empresa copiado!', 'sucesso');
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

    lista.innerHTML = pendentes.map(u => {
        const uIdSeguro = escaparHTML(u.id);
        const uNomeSeguro = escaparHTML(u.nome);
        return `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs">
            <div>
                <div class="font-bold text-slate-900 text-sm">${uNomeSeguro} <span class="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700 ml-1">${escaparHTML(u.perfil)}</span></div>
                <div class="text-slate-600 mt-0.5">${escaparHTML(u.email)} • Setor: <strong>${escaparHTML(u.setor)}</strong></div>
            </div>
            <div class="flex items-center gap-2 self-end sm:self-center">
                <button onclick="aprovarAcessoUsuario('${uIdSeguro}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1 transition">
                    <i data-lucide="check" class="w-3.5 h-3.5"></i> Liberar
                </button>
                <button data-nome="${uNomeSeguro}" onclick="recusarAcessoUsuario('${uIdSeguro}', this.getAttribute('data-nome'))" class="px-3 py-1.5 bg-rose-100 hover:bg-rose-600 text-rose-700 hover:text-white font-bold rounded-lg flex items-center gap-1 transition">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i> Recusar
                </button>
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

async function aprovarAcessoUsuario(userId) {
    await db.collection('usuarios').doc(userId).update({
        ativo: true,
        statusAcesso: 'aprovado'
    });
    mostrarNotificacaoOSync('Acesso do colaborador liberado!', 'sucesso');
    carregarSolicitacoesAcesso();
}

async function recusarAcessoUsuario(userId, nome) {
    const confirmado = await confirmarAcaoOSync(
        `Recusar e excluir o pedido de cadastro de <strong>"${escaparHTML(nome)}"</strong>?`,
        { titulo: 'Recusar Solicitação', textoConfirmar: 'Recusar e Excluir' }
    );
    if (!confirmado) return;

    await db.collection('usuarios').doc(userId).delete();
    mostrarNotificacaoOSync('Solicitação recusada e removida.', 'info');
    carregarSolicitacoesAcesso();
}

// ==========================================
// COLUNAS DO KANBAN
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

    const inputOrdem = document.getElementById('col-ordem');
    const editId = document.getElementById('col-edit-id')?.value;
    if (inputOrdem && !editId) {
        const maiorOrdem = cacheColunasConfig.reduce((max, c) => Math.max(max, Number(c.ordem) || 0), 0);
        inputOrdem.value = maiorOrdem + 1;
    }

    lista.innerHTML = cacheColunasConfig.map((col, idx) => {
        const corCol = sanitizarCorHex(col.corTopo, '#1D4ED8');
        const colIdSeguro = escaparHTML(col.id);
        return `
        <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 gap-2">
            <div class="flex items-center gap-2 min-w-0">
                <span class="w-3 h-3 rounded-full shrink-0" style="background-color: ${corCol}"></span>
                <span class="text-xs font-bold text-slate-400 shrink-0">#${Number(col.ordem) || 0}</span>
                <span class="text-sm font-medium text-slate-700 truncate">${escaparHTML(col.titulo)}</span>
            </div>
            
            <div class="flex items-center gap-0.5 shrink-0">
                <button type="button" onclick="moverColunaConfig(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Mover para cima"
                    class="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-25 transition">
                    <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>
                </button>
                <button type="button" onclick="moverColunaConfig(${idx}, 1)" ${idx === cacheColunasConfig.length - 1 ? 'disabled' : ''} title="Mover para baixo"
                    class="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-25 transition">
                    <i data-lucide="arrow-down" class="w-3.5 h-3.5"></i>
                </button>
                <button type="button" onclick="prepararEdicaoColuna('${colIdSeguro}')" title="Editar coluna"
                    class="p-1.5 rounded text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition">
                    <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                </button>
                <button type="button" onclick="excluirColunaConfig('${colIdSeguro}')" title="Excluir coluna"
                    class="p-1.5 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        </div>`;
    }).join('') || '<p class="text-xs text-slate-400 text-center py-4">Nenhuma coluna cadastrada.</p>';
    
    lucide.createIcons();
}

async function moverColunaConfig(indexAtual, direcao) {
    const novoIndex = indexAtual + direcao;
    if (novoIndex < 0 || novoIndex >= cacheColunasConfig.length) return;

    const listaReordenada = [...cacheColunasConfig];
    const [itemMovido] = listaReordenada.splice(indexAtual, 1);
    listaReordenada.splice(novoIndex, 0, itemMovido);

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
    document.getElementById('col-cor').value = sanitizarCorHex(col.corTopo, '#1D4ED8');

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
    const confirmado = await confirmarAcaoOSync(
        'Deseja excluir esta coluna do quadro Kanban?',
        { titulo: 'Excluir Coluna', textoConfirmar: 'Excluir' }
    );
    if (!confirmado) return;

    await db.collection('kanban_colunas').doc(colId).delete();

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
// TIPOS DE MANUTENÇÃO, SETORES E CENTROS DE CUSTO
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

    const tiposFixos = ['Corretiva', 'Preventiva', 'Programada', 'Manutenção Externa'];

    lista.innerHTML = tipos.map(t => {
        const ehFixo = tiposFixos.includes(t.nome);
        const corTipo = sanitizarCorHex(t.cor, '#1D4ED8');
        const tIdSeguro = escaparHTML(t.id);
        return `
        <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div class="flex items-center gap-2.5">
                <span class="w-3 h-3 rounded-full" style="background-color: ${corTipo}"></span>
                <span class="text-sm font-medium text-slate-700">${escaparHTML(t.nome)} ${ehFixo ? '<span class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-1 font-bold">Fixo</span>' : ''}</span>
            </div>
            ${!ehFixo ? `
            <button onclick="deletarItemConfig('tipos_manutencao', '${tIdSeguro}', carregarTiposConfig)" class="text-slate-400 hover:text-rose-600 p-1">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>` : `<span class="text-[11px] text-slate-400 italic pr-1">Sistema</span>`}
        </div>`;
    }).join('') || '<p class="text-xs text-slate-400 text-center py-4">Nenhum tipo cadastrado.</p>';
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

    const setoresFixos = ['Mecânica', 'Elétrica'];

    lista.innerHTML = setores.map(s => {
        const ehFixo = setoresFixos.includes(s.nome);
        const sIdSeguro = escaparHTML(s.id);
        return `
        <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-slate-700">${escaparHTML(s.nome)}</span>
                ${ehFixo ? '<span class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">Fixo</span>' : ''}
            </div>
            ${!ehFixo ? `
            <button onclick="deletarItemConfig('setores_executantes', '${sIdSeguro}', carregarSetoresConfig)" class="text-slate-400 hover:text-rose-600 p-1">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>` : `<span class="text-[11px] text-slate-400 italic pr-1">Sistema</span>`}
        </div>`;
    }).join('') || '<p class="text-xs text-slate-400 text-center py-4">Nenhum setor cadastrado.</p>';
    lucide.createIcons();
}

async function carregarCentrosCustoConfig() {
    const lista = document.getElementById('lista-centros-custo');
    if (!lista) return;

    const snap = await db.collection('centros_custo')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .get();

    const centros = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));

    lista.innerHTML = centros.map(cc => {
        const ccIdSeguro = escaparHTML(cc.id);
        return `
        <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div class="flex items-center gap-2 min-w-0">
                <span class="text-xs font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">${escaparHTML(cc.codigo)}</span>
                <span class="text-sm font-medium text-slate-700 truncate">${escaparHTML(cc.nome)}</span>
            </div>
            <button onclick="deletarItemConfig('centros_custo', '${ccIdSeguro}', carregarCentrosCustoConfig)" class="text-slate-400 hover:text-rose-600 p-1">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>`;
    }).join('') || '<p class="text-xs text-slate-400 text-center py-4">Nenhum centro de custo cadastrado.</p>';
    lucide.createIcons();
}

async function deletarItemConfig(colecao, id, callback) {
    const confirmado = await confirmarAcaoOSync(
        'Deseja excluir este item permanentemente?',
        { titulo: 'Excluir Registro', textoConfirmar: 'Excluir' }
    );
    if (!confirmado) return;

    await db.collection(colecao).doc(id).delete();
    callback();
}
