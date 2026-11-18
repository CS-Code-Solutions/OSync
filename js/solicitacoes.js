let unsubscribeSolicitacoes = null;
let cacheListaSolicitacoes = [];
let cacheAtivosSolicitacoes = [];

function initSolicitacoes() {
    iniciarListenerSolicitacoes();
    const formSol = document.getElementById('form-nova-solicitacao');
    if (formSol && !formSol.dataset.bound) {
        formSol.addEventListener('submit', salvarNovaSolicitacao);
        formSol.dataset.bound = 'true';
    }
}

function iniciarListenerSolicitacoes() {
    if (unsubscribeSolicitacoes) unsubscribeSolicitacoes();

    let query = db.collection('solicitacoes').where('empresaId', '==', usuarioAtual.empresaId);

    // Líder vê apenas as próprias solicitações; Gestor e Manutentor veem todas da empresa
    if (usuarioAtual.perfil === 'Lideranca') {
        query = query.where('solicitanteId', '==', usuarioAtual.id);
    }

    unsubscribeSolicitacoes = query.onSnapshot((snap) => {
        cacheListaSolicitacoes = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));

        renderizarSolicitacoes(cacheListaSolicitacoes);
    });
}

function formatarDataHoraSolicitacaoBR(isoStr) {
    if (!isoStr || isoStr.length < 16) return '';
    const [data, hora] = isoStr.split('T');
    const [a, m, d] = data.split('-');
    return `${d}/${m}/${a} às ${hora}`;
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
        const solIdSeguro = escaparHTML(sol.id);
        const statusNorm = (sol.status || 'Pendente').trim();
        const pendente = statusNorm === 'Pendente';
        const emAtendimento = statusNorm === 'Convertida em O.S.';
        const encerrada = statusNorm === 'Encerrada' || statusNorm === 'Concluída';
        const cancelada = statusNorm === 'Cancelada' || statusNorm === 'Recusada';
        const numOsLabel = sol.numeroOs ? `#OS-${String(sol.numeroOs).padStart(4, '0')}` : '';

        let badgeClasse = 'bg-blue-100 text-blue-700';
        let corBorda = '#1D4ED8';
        if (pendente) {
            badgeClasse = 'bg-amber-100 text-amber-700';
            corBorda = sol.maquinaParada ? '#E11D48' : '#F59E0B';
        } else if (encerrada) {
            badgeClasse = 'bg-emerald-600 text-white';
            corBorda = '#10B981';
        } else if (cancelada) {
            badgeClasse = 'bg-rose-600 text-white';
            corBorda = '#E11D48';
        }

        const labelStatus = encerrada
            ? `O.S. Encerrada ${numOsLabel}`.trim()
            : cancelada
                ? 'Chamado Cancelado'
                : (emAtendimento && numOsLabel ? `Em Atendimento (${numOsLabel})` : statusNorm);

        return `
        <div class="osync-card p-4 flex flex-col justify-between gap-3" style="border-left-color: ${corBorda}">
            <div>
                <div class="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badgeClasse}">
                        ${escaparHTML(labelStatus)}
                    </span>
                    ${sol.maquinaParada && !encerrada && !cancelada ? '<span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-rose-600 text-white animate-pulse">Máquina Parada</span>' : ''}
                </div>
                <h4 class="font-bold text-slate-900 text-sm">${escaparHTML(sol.ativoTag)} - ${escaparHTML(sol.ativoNome)}</h4>
                <p class="text-xs text-slate-600 mt-1">${escaparHTML(sol.problema)}</p>
                <span class="text-[11px] text-slate-400 block mt-2">Solicitante: <strong>${escaparHTML(sol.solicitanteNome)}</strong> (${escaparHTML(sol.setor || 'Produção')})</span>

                ${encerrada ? `
                <div class="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                    <div class="font-extrabold text-emerald-800 flex items-center gap-1.5">
                        <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 shrink-0"></i>
                        <span>Chamado Concluído pela Manutenção</span>
                    </div>
                    ${sol.servicoRealizado ? `<p class="text-emerald-900"><strong>Serviço realizado:</strong> ${escaparHTML(sol.servicoRealizado)}</p>` : ''}
                    <p class="text-[11px] text-emerald-700">
                        Encerrado por <strong>${escaparHTML(sol.encerradoPor || 'Manutenção')}</strong>${sol.dataHoraEncerramento ? ` em ${escaparHTML(formatarDataHoraSolicitacaoBR(sol.dataHoraEncerramento))}` : ''}
                    </p>
                </div>` : ''}

                ${cancelada ? `
                <div class="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-1">
                    <div class="font-extrabold text-rose-800 flex items-center gap-1.5">
                        <i data-lucide="x-circle" class="w-4 h-4 text-rose-600 shrink-0"></i>
                        <span>Chamado Cancelado pela Gestão</span>
                    </div>
                    <p class="text-rose-900"><strong>Motivo:</strong> ${escaparHTML(sol.motivoCancelamento || 'Cancelado pela gestão de manutenção.')}</p>
                    ${sol.canceladoPor ? `
                    <p class="text-[11px] text-rose-700">
                        Cancelado por <strong>${escaparHTML(sol.canceladoPor)}</strong>${sol.dataHoraCancelamento ? ` em ${escaparHTML(formatarDataHoraSolicitacaoBR(sol.dataHoraCancelamento))}` : ''}
                    </p>` : ''}
                </div>` : ''}
            </div>

            ${isGestor && (pendente || emAtendimento) ? `
            <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button onclick="abrirModalCancelarSolicitacao('${solIdSeguro}')" class="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition flex items-center gap-1">
                    <i data-lucide="x-circle" class="w-3.5 h-3.5"></i> Cancelar
                </button>
                ${pendente ? `
                <button onclick="aprovarEConverterEmOS('${solIdSeguro}')" class="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-1.5 transition">
                    <i data-lucide="arrow-right-circle" class="w-4 h-4"></i> Converter em O.S.
                </button>` : ''}
            </div>` : ''}
        </div>`;
    }).join('');

    lucide.createIcons();
}

function filtrarSelectAtivosSolicitacao(ativoIdForcado = '') {
    const sel = document.getElementById('sol-ativo');
    if (!sel) return;

    const termo = (document.getElementById('sol-ativo-busca')?.value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    const valorAtual = ativoIdForcado || sel.value;

    const filtrados = cacheAtivosSolicitacoes.filter(a => {
        if (!termo) return true;
        const texto = `${a.codigoTag || ''} ${a.nome || ''} ${a.setor || ''} ${a.tipoEquipamento || ''}`
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        return texto.includes(termo);
    });

    if (filtrados.length === 0) {
        sel.innerHTML = '<option value="">Nenhuma máquina encontrada...</option>';
        return;
    }

    sel.innerHTML = filtrados.map(a => {
        const tagSegura = escaparHTML(a.codigoTag || '');
        const nomeSeguro = escaparHTML(a.nome || '');
        const rotulo = (a.codigoTag || '').trim() ? `${tagSegura} - ${nomeSeguro}` : nomeSeguro;
        return `<option value="${escaparHTML(a.id)}" data-tag="${tagSegura}" data-nome="${nomeSeguro}">${rotulo}</option>`;
    }).join('');

    if (valorAtual && filtrados.some(a => a.id === valorAtual)) {
        sel.value = valorAtual;
    }
}

async function abrirModalNovaSolicitacao() {
    const form = document.getElementById('form-nova-solicitacao');
    if (form) form.reset();

    const buscaEl = document.getElementById('sol-ativo-busca');
    if (buscaEl) buscaEl.value = '';

    document.getElementById('modal-nova-solicitacao').classList.remove('hidden');

    const snap = await db.collection('ativos').where('empresaId', '==', usuarioAtual.empresaId).get();
    cacheAtivosSolicitacoes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
            const rotA = (a.codigoTag || '').trim() ? `${a.codigoTag} - ${a.nome}` : (a.nome || '');
            const rotB = (b.codigoTag || '').trim() ? `${b.codigoTag} - ${b.nome}` : (b.nome || '');
            return rotA.localeCompare(rotB);
        });

    filtrarSelectAtivosSolicitacao();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function fecharModalNovaSolicitacao() {
    const buscaEl = document.getElementById('sol-ativo-busca');
    if (buscaEl) buscaEl.value = '';
    document.getElementById('modal-nova-solicitacao').classList.add('hidden');
}

async function salvarNovaSolicitacao(e) {
    e.preventDefault();
    const sel = document.getElementById('sol-ativo');
    if (!sel.value) {
        alert('Selecione uma máquina válida na lista.');
        return;
    }
    const opt = sel.options[sel.selectedIndex];
    const parada = document.getElementById('sol-maquina-parada').checked;

    const agora = new Date();
    agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
    const agoraISO = agora.toISOString().slice(0, 16);

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
        inicioParada: parada ? agoraISO : '',
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
    const novoNumeroOs = maiorNum + 1;

    const agora = new Date();
    agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
    const agoraISO = agora.toISOString().slice(0, 16);

    const novaOSRef = await db.collection('ordens_servico').add({
        empresaId: usuarioAtual.empresaId,
        numeroOs: novoNumeroOs,
        solicitacaoId: solId,
        ativoId: sol.ativoId,
        ativoTag: sol.ativoTag,
        ativoNome: sol.ativoNome,
        tipoNome: 'Corretiva',
        tipoCor: sol.maquinaParada ? '#E11D48' : '#1D4ED8',
        colunaId: colunas[0].id,
        prioridade: sol.maquinaParada ? 'Urgente' : sol.prioridade,
        condicaoMaquina: sol.maquinaParada ? 'Maquina parada' : 'Operacional',
        maquinaParada: Boolean(sol.maquinaParada),
        inicioParada: sol.maquinaParada ? (sol.inicioParada || agoraISO) : '',
        terminoParada: '',
        tempoParadaMinutos: 0,
        descricao: `[Solicitação de ${sol.solicitanteNome}] ${sol.problema}`,
        custoTotal: 0,
        encerrada: false,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('solicitacoes').doc(solId).update({
        status: 'Convertida em O.S.',
        osId: novaOSRef.id,
        numeroOs: novoNumeroOs
    });

    if (typeof mostrarNotificacaoOSync === 'function') {
        mostrarNotificacaoOSync(`O.S. #${String(novoNumeroOs).padStart(4, '0')} criada na coluna "${colunas[0].titulo}"!`, 'sucesso');
    } else {
        alert(`O.S. #${String(novoNumeroOs).padStart(4, '0')} criada na coluna "${colunas[0].titulo}"!`);
    }
}

// ==========================================
// CANCELAMENTO DE CHAMADO COM MOTIVO (GESTOR)
// ==========================================
function abrirModalCancelarSolicitacao(solId) {
    const sol = cacheListaSolicitacoes.find(s => s.id === solId);
    if (!sol) return;

    document.getElementById('cancelar-sol-id').value = sol.id;
    document.getElementById('cancelar-sol-atalho').value = '';
    document.getElementById('cancelar-sol-motivo').value = '';
    document.getElementById('cancelar-sol-resumo').innerHTML = `
        <div class="font-bold text-slate-900">${escaparHTML(sol.ativoTag)} - ${escaparHTML(sol.ativoNome)}</div>
        <div class="text-slate-600 mt-0.5">${escaparHTML(sol.problema)}</div>
        <div class="text-[11px] text-slate-400 mt-1">Solicitante: <strong>${escaparHTML(sol.solicitanteNome)}</strong></div>
    `;

    document.getElementById('modal-cancelar-solicitacao').classList.remove('hidden');
    lucide.createIcons();
}

function fecharModalCancelarSolicitacao() {
    document.getElementById('modal-cancelar-solicitacao').classList.add('hidden');
}

function selecionarAtalhoMotivoCancelamento(valor) {
    if (!valor) return;
    document.getElementById('cancelar-sol-motivo').value = valor;
}

async function confirmarCancelamentoSolicitacao(e) {
    e.preventDefault();
    const solId = document.getElementById('cancelar-sol-id').value;
    const motivo = document.getElementById('cancelar-sol-motivo').value.trim();
    if (!solId || !motivo) return;

    const btn = document.getElementById('btn-confirmar-cancelamento-sol');
    btn.disabled = true;
    btn.textContent = 'Cancelando...';

    try {
        const sol = cacheListaSolicitacoes.find(s => s.id === solId);
        const agora = new Date();
        agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
        const agoraISO = agora.toISOString().slice(0, 16);

        await db.collection('solicitacoes').doc(solId).update({
            status: 'Cancelada',
            motivoCancelamento: motivo,
            canceladoPor: usuarioAtual.nome,
            dataHoraCancelamento: agoraISO,
            canceladaEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (sol?.maquinaParada && sol?.ativoId && !sol?.osId) {
            await db.collection('ativos').doc(sol.ativoId).update({ status: 'Operacional' });
        }

        fecharModalCancelarSolicitacao();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Chamado cancelado e solicitante notificado!', 'aviso');
        }
    } catch (err) {
        alert('Erro ao cancelar chamado: ' + err.message);
    }

    btn.disabled = false;
    btn.textContent = 'Confirmar Cancelamento';
}
