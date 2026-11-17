let unsubscribeSolicitacoes = null;

function initSolicitacoes() {
    iniciarListenerSolicitacoes();
    document.getElementById('form-nova-solicitacao')?.addEventListener('submit', salvarNovaSolicitacao);
}

function iniciarListenerSolicitacoes() {
    if (unsubscribeSolicitacoes) unsubscribeSolicitacoes();

    let query = db.collection('solicitacoes').where('empresaId', '==', usuarioAtual.empresaId);

    // Líder vê apenas as próprias solicitações; Gestor e Manutentor veem todas da empresa
    if (usuarioAtual.perfil === 'Lideranca') {
        query = query.where('solicitanteId', '==', usuarioAtual.id);
    }

    unsubscribeSolicitacoes = query.onSnapshot((snap) => {
        const lista = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));

        renderizarSolicitacoes(lista);
    });
}

function renderizarSolicitacoes(lista) {
    const grid = document.getElementById('lista-solicitacoes');
    if (!grid) return;

    if (lista.length === 0) {
        grid.innerHTML = `<div class="col-span-full bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400">Nenhuma solicitação encontrada.</div>`;
        return;
    }

    const isGestor = usuarioAtual.perfil === 'Admin' || usuarioAtual.perfil === 'SuperAdmin';

    grid.innerHTML = lista.map(sol => {
        const pendente = sol.status === 'Pendente';
        return `
        <div class="osync-card p-4 flex flex-col justify-between gap-3" style="border-left-color: ${sol.maquinaParada ? '#E11D48' : (pendente ? '#F59E0B' : '#10B981')}">
            <div>
                <div class="flex items-center justify-between gap-2 mb-1.5">
                    <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${pendente ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}">
                        ${sol.status}
                    </span>
                    ${sol.maquinaParada ? '<span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-rose-600 text-white animate-pulse">Máquina Parada</span>' : ''}
                </div>
                <h4 class="font-bold text-slate-900 text-sm">${sol.ativoTag} - ${sol.ativoNome}</h4>
                <p class="text-xs text-slate-600 mt-1">${sol.problema}</p>
                <span class="text-[11px] text-slate-400 block mt-2">Solicitante: <strong>${sol.solicitanteNome}</strong> (${sol.setor || 'Produção'})</span>
            </div>

            ${isGestor && pendente ? `
            <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button onclick="recusarSolicitacao('${sol.id}')" class="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition">Recusar</button>
                <button onclick="aprovarEConverterEmOS('${sol.id}')" class="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-1.5 transition">
                    <i data-lucide="arrow-right-circle" class="w-4 h-4"></i> Converter em O.S.
                </button>
            </div>` : ''}
        </div>`;
    }).join('');

    lucide.createIcons();
}

async function abrirModalNovaSolicitacao() {
    document.getElementById('modal-nova-solicitacao').classList.remove('hidden');
    const snap = await db.collection('ativos').where('empresaId', '==', usuarioAtual.empresaId).get();
    document.getElementById('sol-ativo').innerHTML = snap.docs.map(d => {
        const a = d.data();
        return `<option value="${d.id}" data-tag="${a.codigoTag}" data-nome="${a.nome}">${a.codigoTag} - ${a.nome}</option>`;
    }).join('');
}

function fecharModalNovaSolicitacao() {
    document.getElementById('modal-nova-solicitacao').classList.add('hidden');
}

async function salvarNovaSolicitacao(e) {
    e.preventDefault();
    const sel = document.getElementById('sol-ativo');
    const opt = sel.options[sel.selectedIndex];
    const parada = document.getElementById('sol-maquina-parada').checked;

    await db.collection('solicitacoes').add({
        empresaId: usuarioAtual.empresaId,
        ativoId: sel.value,
        ativoTag: opt?.getAttribute('data-tag') || '',
        ativoNome: opt?.getAttribute('data-nome') || '',
        solicitanteId: usuarioAtual.id,
        solicitanteNome: usuarioAtual.nome,
        setor: usuarioAtual.setor || '',
        prioridade: document.getElementById('sol-prioridade').value,
        maquinaParada: parada,
        problema: document.getElementById('sol-problema').value.trim(),
        status: 'Pendente',
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (parada && sel.value) {
        await db.collection('ativos').doc(sel.value).update({ status: 'Parada' });
    }

    fecharModalNovaSolicitacao();
    e.target.reset();
}

async function aprovarEConverterEmOS(solId) {
    const doc = await db.collection('solicitacoes').doc(solId).get();
    if (!doc.exists) return;
    const sol = doc.data();

    const [colSnap, osSnap] = await Promise.all([
        db.collection('kanban_colunas').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('ordens_servico').where('empresaId', '==', usuarioAtual.empresaId).get()
    ]);

    const colunas = colSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.ordem - b.ordem);
    if (colunas.length === 0) {
        alert('Configure ao menos uma coluna no Kanban antes de converter.');
        return;
    }

    const maiorNum = osSnap.docs.reduce((max, d) => Math.max(max, d.data().numeroOs || 0), 0);

    await db.collection('ordens_servico').add({
        empresaId: usuarioAtual.empresaId,
        numeroOs: maiorNum + 1,
        ativoId: sol.ativoId,
        ativoTag: sol.ativoTag,
        ativoNome: sol.ativoNome,
        tipoNome: 'Corretiva',
        tipoCor: sol.maquinaParada ? '#E11D48' : '#1D4ED8',
        colunaId: colunas[0].id,
        prioridade: sol.maquinaParada ? 'Urgente' : sol.prioridade,
        descricao: `[Solicitação de ${sol.solicitanteNome}] ${sol.problema}`,
        custoTotal: 0,
        encerrada: false,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('solicitacoes').doc(solId).update({ status: 'Convertida em O.S.' });
    alert(`O.S. #${String(maiorNum + 1).padStart(4, '0')} criada na coluna "${colunas[0].titulo}"!`);
}

async function recusarSolicitacao(solId) {
    if (!confirm('Recusar esta solicitação?')) return;
    await db.collection('solicitacoes').doc(solId).update({ status: 'Recusada' });
}
