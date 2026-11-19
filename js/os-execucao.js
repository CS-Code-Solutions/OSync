/**
 * ============================================================================
 * OSync — Execução de O.S., Abas Planilha, Checklist, Horas e Custos
 * ============================================================================
 */

let osDetalhesAtual = null;
let apontamentosOSAtual = [];
let itensCustoOSAtual = [];
let checklistOSAtual = [];
let abaDetalhesOSAtual = 'dados';

/**
 * Alterna entre a aba 'dados' e a aba 'checklist' no Modal de Detalhes da O.S.
 */
function alternarAbaDetalhesOS(aba = 'dados') {
    abaDetalhesOSAtual = aba;

    const paneDados = document.getElementById('tab-pane-os-dados');
    const paneChecklist = document.getElementById('tab-pane-os-checklist');
    const btnDados = document.getElementById('tab-btn-os-dados');
    const btnChecklist = document.getElementById('tab-btn-os-checklist');

    if (!paneDados || !paneChecklist) return;

    const classeAtiva = 'px-4 py-2 rounded-t-xl border border-b-0 border-slate-200 bg-white text-slate-900 text-xs font-bold flex items-center gap-2 shadow-2xs transition-colors shrink-0';
    const classeInativa = 'px-4 py-2 rounded-t-xl border border-b-0 border-transparent bg-slate-200/70 text-slate-600 hover:bg-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors shrink-0';

    if (aba === 'checklist' && checklistOSAtual.length > 0) {
        paneDados.classList.add('hidden');
        paneChecklist.classList.remove('hidden');
        if (btnDados) btnDados.className = classeInativa;
        if (btnChecklist) btnChecklist.className = classeAtiva;
    } else {
        abaDetalhesOSAtual = 'dados';
        paneChecklist.classList.add('hidden');
        paneDados.classList.remove('hidden');
        if (btnDados) btnDados.className = classeAtiva;
        if (btnChecklist) btnChecklist.className = classeInativa;
    }
}

/**
 * Abre o Modal 2 com todos os detalhes, checklist, apontamentos e custos da O.S.
 */
async function abrirDetalhesOS(osId) {
    const os = listaOrdensServico.find(item => item.id === osId);
    if (!os) return;

    osDetalhesAtual = { ...os };
    itensCustoOSAtual = Array.isArray(os.itensCusto) ? [...os.itensCusto] : [];
    checklistOSAtual = Array.isArray(os.checklistPlano)
        ? os.checklistPlano.map(it => ({ ...it }))
        : [];

    document.getElementById('det-os-numero').textContent = os.numeroOs || 'OS';
    document.getElementById('det-os-titulo').textContent = os.titulo || 'Sem título';
    document.getElementById('det-os-subtitulo').textContent =
        `${os.ativoTag ? `${os.ativoTag} — ${os.ativoNome}` : (os.ativoNome || 'Ativo')} • ${os.tipo || 'Corretiva'}`;
    document.getElementById('det-os-descricao').textContent = os.descricao || 'Sem descrição detalhada.';
    document.getElementById('det-os-responsavel').textContent = os.responsavelNome || 'Não atribuído';

    // Badges de Status e Prioridade
    const badgeStatus = document.getElementById('det-os-status-badge');
    const statusStyles = {
        Aberta: 'bg-amber-100 text-amber-800',
        'Em Execução': 'bg-blue-100 text-blue-800',
        Encerrada: 'bg-emerald-100 text-emerald-800'
    };
    badgeStatus.className = `text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusStyles[os.status] || 'bg-slate-100 text-slate-700'}`;
    badgeStatus.textContent = os.status;

    const badgePrio = document.getElementById('det-os-prioridade-badge');
    badgePrio.className = 'text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700';
    badgePrio.textContent = `Prioridade: ${os.prioridade || 'Média'}`;

    // Preenche select de manutentores no formulário de apontamento
    const selApont = document.getElementById('apont-manutentor');
    if (selApont) {
        selApont.innerHTML = `<option value="">Manutentor...</option>` +
            cacheManutentoresOS.map(m =>
                `<option value="${m.id}" data-nome="${escapeHTML(m.nome)}" data-valor="${Number(m.valorHora || 0)}">${escapeHTML(m.nome)}</option>`
            ).join('');

        if (window.usuarioLogado?.perfil === 'Manutentor') {
            selApont.value = window.usuarioLogado.uid;
        }
    }

    // Configura botões de transição de status e bloqueio de edição se Encerrada
    const boxBotoes = document.getElementById('det-os-botoes-acao');
    const formApont = document.getElementById('form-apontamento-horas');
    const formCusto = document.getElementById('form-item-custo');
    ocultarPainelEncerramento();

    if (os.status === 'Encerrada') {
        boxBotoes.innerHTML = `<span class="text-xs font-semibold text-emerald-700">O.S. Encerrada</span>`;
        if (formApont) formApont.classList.add('hidden');
        if (formCusto) formCusto.classList.add('hidden');
    } else {
        if (formApont) formApont.classList.remove('hidden');
        if (formCusto) formCusto.classList.remove('hidden');

        let htmlBotoes = '';
        if (os.status === 'Aberta') {
            htmlBotoes += `
                <button onclick="iniciarExecucaoOS()"
                    class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors">
                    Iniciar Execução
                </button>
            `;
        }
        htmlBotoes += `
            <button onclick="exibirPainelEncerramento()"
                class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors">
                Encerrar O.S.
            </button>
        `;
        boxBotoes.innerHTML = htmlBotoes;
    }

    renderizarItensCustoOS();
    renderizarChecklistPlanoExecucao(os);
    alternarAbaDetalhesOS('dados');
    await carregarApontamentosOS(os.id);

    document.getElementById('modal-detalhes-os').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function fecharModalDetalhesOS() {
    document.getElementById('modal-detalhes-os').classList.add('hidden');
    osDetalhesAtual = null;
    checklistOSAtual = [];
    abaDetalhesOSAtual = 'dados';
}

/* ============================================================================
   CHECKLIST DO PLANO DE MANUTENÇÃO NA ABA DEDICADA (OK / NÃO OK + MOTIVO)
   ============================================================================ */

function renderizarChecklistPlanoExecucao(os = osDetalhesAtual) {
    const tabsBar = document.getElementById('det-os-tabs-bar');
    const tabBadge = document.getElementById('tab-badge-checklist-qtd');
    const elTitulo = document.getElementById('det-plano-titulo');
    const elProg = document.getElementById('det-plano-progresso');
    const elInst = document.getElementById('det-plano-instrucoes');
    const lista = document.getElementById('det-lista-checklist-plano');

    if (!lista) return;

    // Se a O.S. não tem plano vinculado, oculta a barra de abas e mantém o fluxo padrão
    if (!Array.isArray(checklistOSAtual) || checklistOSAtual.length === 0) {
        if (tabsBar) tabsBar.classList.add('hidden');
        return;
    }

    // Exibe a barra de abas estilo planilha
    if (tabsBar) tabsBar.classList.remove('hidden');
    if (elTitulo) elTitulo.textContent = os?.planoTitulo || 'Checklist de Verificação';

    if (elInst) {
        if (os?.planoInstrucoes) {
            elInst.textContent = os.planoInstrucoes;
            elInst.classList.remove('hidden');
        } else {
            elInst.classList.add('hidden');
        }
    }

    const total = checklistOSAtual.length;
    const respondidos = checklistOSAtual.filter(it => it.status === 'OK' || it.status === 'NAO_OK').length;
    const concluido = respondidos === total && total > 0;

    if (elProg) {
        elProg.textContent = `${respondidos} / ${total} verificados`;
        elProg.className = concluido
            ? 'px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-bold text-emerald-700'
            : 'px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-700';
    }

    if (tabBadge) {
        tabBadge.textContent = `${respondidos}/${total}`;
        tabBadge.className = concluido
            ? 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700'
            : 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700';
    }

    const encerrada = os?.status === 'Encerrada';

    lista.innerHTML = checklistOSAtual.map((item, idx) => {
        const isOk = item.status === 'OK';
        const isNaoOk = item.status === 'NAO_OK';

        const btnOkClass = isOk
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
            : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400 hover:text-emerald-700';

        const btnNaoOkClass = isNaoOk
            ? 'bg-red-600 text-white border-red-600 shadow-xs'
            : 'bg-white text-slate-600 border-slate-200 hover:border-red-400 hover:text-red-700';

        return `
            <div class="bg-white border ${isNaoOk ? 'border-red-200' : isOk ? 'border-emerald-200' : 'border-slate-200'} rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div class="text-xs font-medium text-slate-800">
                        <span class="font-mono font-bold text-slate-400 mr-1.5">${idx + 1}.</span>
                        <span>${escapeHTML(item.descricao || '')}</span>
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0">
                        <button type="button" ${encerrada ? 'disabled' : ''} onclick="marcarItemChecklistOS(${idx}, 'OK')"
                            class="px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${btnOkClass} ${encerrada ? 'opacity-75 cursor-not-allowed' : ''}">
                            OK
                        </button>
                        <button type="button" ${encerrada ? 'disabled' : ''} onclick="marcarItemChecklistOS(${idx}, 'NAO_OK')"
                            class="px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${btnNaoOkClass} ${encerrada ? 'opacity-75 cursor-not-allowed' : ''}">
                            Não OK
                        </button>
                    </div>
                </div>

                ${isNaoOk ? `
                    <div class="pt-1">
                        <label class="block text-[11px] font-semibold text-red-700 mb-1">Motivo / Não conformidade encontrada *</label>
                        <input type="text" ${encerrada ? 'disabled' : ''}
                            value="${escapeHTML(item.motivo || '')}"
                            oninput="atualizarMotivoChecklistOS(${idx}, this.value)"
                            placeholder="Descreva o problema identificado neste item..."
                            class="w-full px-3 py-1.5 bg-red-50/40 border border-red-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-red-500 focus:outline-none">
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

async function marcarItemChecklistOS(index, status) {
    if (!osDetalhesAtual || osDetalhesAtual.status === 'Encerrada') return;
    if (!checklistOSAtual[index]) return;

    checklistOSAtual[index].status = status;
    if (status === 'OK') {
        checklistOSAtual[index].motivo = '';
    }

    renderizarChecklistPlanoExecucao(osDetalhesAtual);

    try {
        await db.collection('ordens_servico').doc(osDetalhesAtual.id).update({
            checklistPlano: checklistOSAtual
        });
        osDetalhesAtual.checklistPlano = checklistOSAtual.map(it => ({ ...it }));
    } catch (erro) {
        console.error('Erro ao salvar status do item de checklist:', erro);
    }
}

let timerSalvarMotivoChecklist = null;
function atualizarMotivoChecklistOS(index, valor) {
    if (!osDetalhesAtual || osDetalhesAtual.status === 'Encerrada') return;
    if (!checklistOSAtual[index]) return;

    checklistOSAtual[index].motivo = valor;

    clearTimeout(timerSalvarMotivoChecklist);
    timerSalvarMotivoChecklist = setTimeout(async () => {
        if (!osDetalhesAtual) return;
        try {
            await db.collection('ordens_servico').doc(osDetalhesAtual.id).update({
                checklistPlano: checklistOSAtual
            });
            osDetalhesAtual.checklistPlano = checklistOSAtual.map(it => ({ ...it }));
        } catch (erro) {
            console.error('Erro ao salvar motivo do checklist:', erro);
        }
    }, 500);
}

/**
 * Muda status de Aberta -> Em Execução
 */
async function iniciarExecucaoOS() {
    if (!osDetalhesAtual) return;
    const u = window.usuarioLogado;

    try {
        const atualizacao = {
            status: 'Em Execução',
            iniciadaEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!osDetalhesAtual.responsavelId && u.perfil === 'Manutentor') {
            atualizacao.responsavelId = u.uid;
            atualizacao.responsavelNome = u.nome;
        }

        await db.collection('ordens_servico').doc(osDetalhesAtual.id).update(atualizacao);
        await carregarOrdensServico();
        await abrirDetalhesOS(osDetalhesAtual.id);
    } catch (erro) {
        console.error('Erro ao iniciar execução:', erro);
        alert('Erro ao iniciar O.S.: ' + erro.message);
    }
}

/* ============================================================================
   APONTAMENTO DE HORAS (SUBCOLEÇÃO apontamentos_horas)
   ============================================================================ */

async function carregarApontamentosOS(osId) {
    const lista = document.getElementById('lista-apontamentos-os');
    if (!lista) return;

    try {
        const snap = await db.collection('ordens_servico').doc(osId)
            .collection('apontamentos_horas')
            .get();

        apontamentosOSAtual = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
                const tA = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : 0;
                const tB = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : 0;
                return tB - tA;
            });

        renderizarApontamentosOS();
        recalcularTotaisFinanceirosOS();
    } catch (erro) {
        console.error('Erro ao carregar apontamentos:', erro);
    }
}

function renderizarApontamentosOS() {
    const lista = document.getElementById('lista-apontamentos-os');
    if (!lista) return;

    if (apontamentosOSAtual.length === 0) {
        lista.innerHTML = `<p class="p-4 text-xs text-slate-400 text-center">Nenhum apontamento de horas registrado.</p>`;
        return;
    }

    const encerrada = osDetalhesAtual?.status === 'Encerrada';

    lista.innerHTML = apontamentosOSAtual.map(ap => {
        const custo = Number(ap.custoCalculado || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return `
            <div class="p-3 flex items-center justify-between gap-3 text-xs">
                <div class="min-w-0">
                    <p class="font-semibold text-slate-800">${escapeHTML(ap.manutentorNome || 'Técnico')} <span class="text-blue-600 font-bold">(${Number(ap.horas || 0).toFixed(1)}h)</span></p>
                    <p class="text-slate-500 truncate">${escapeHTML(ap.atividade || '-')}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="font-bold text-slate-700">${custo}</span>
                    ${!encerrada ? `
                        <button onclick="removerApontamentoHoras('${ap.id}')" class="p-1 text-slate-400 hover:text-red-600 rounded">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

async function registrarApontamentoHoras(e) {
    e.preventDefault();
    if (!osDetalhesAtual) return;

    const sel = document.getElementById('apont-manutentor');
    const option = sel.options[sel.selectedIndex];
    const manutentorId = sel.value;
    const manutentorNome = option?.dataset?.nome || '';
    const valorHora = parseFloat(option?.dataset?.valor || '0') || 0;
    const horas = parseFloat(document.getElementById('apont-horas').value) || 0;
    const atividade = document.getElementById('apont-atividade').value.trim();

    if (!manutentorId || horas <= 0) return;

    const custoCalculado = Number((horas * valorHora).toFixed(2));
    const btn = document.getElementById('btn-add-apontamento');

    try {
        if (btn) btn.disabled = true;

        await db.collection('ordens_servico').doc(osDetalhesAtual.id)
            .collection('apontamentos_horas')
            .add({
                empresaId: window.empresaAtual?.id,
                manutentorId,
                manutentorNome,
                valorHora,
                horas,
                custoCalculado,
                atividade,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });

        document.getElementById('apont-horas').value = '';
        document.getElementById('apont-atividade').value = '';

        await carregarApontamentosOS(osDetalhesAtual.id);
        await persistirTotaisNoDocumentoOS();
    } catch (erro) {
        console.error('Erro ao registrar apontamento:', erro);
        alert('Erro ao lançar horas: ' + erro.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function removerApontamentoHoras(apontamentoId) {
    if (!osDetalhesAtual || !confirm('Remover este apontamento de horas?')) return;
    try {
        await db.collection('ordens_servico').doc(osDetalhesAtual.id)
            .collection('apontamentos_horas').doc(apontamentoId)
            .delete();

        await carregarApontamentosOS(osDetalhesAtual.id);
        await persistirTotaisNoDocumentoOS();
    } catch (erro) {
        console.error('Erro ao remover apontamento:', erro);
    }
}

/* ============================================================================
   MATERIAIS, PEÇAS E SERVIÇOS TERCEIROS
   ============================================================================ */

function renderizarItensCustoOS() {
    const lista = document.getElementById('lista-itens-custo-os');
    if (!lista) return;

    if (itensCustoOSAtual.length === 0) {
        lista.innerHTML = `<p class="p-4 text-xs text-slate-400 text-center">Nenhum material ou serviço lançado.</p>`;
        recalcularTotaisFinanceirosOS();
        return;
    }

    const encerrada = osDetalhesAtual?.status === 'Encerrada';

    lista.innerHTML = itensCustoOSAtual.map((item, idx) => {
        const subtotal = Number(item.subtotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return `
            <div class="p-3 flex items-center justify-between gap-3 text-xs">
                <div class="min-w-0">
                    <span class="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold mr-1.5">${escapeHTML(item.categoria)}</span>
                    <span class="font-semibold text-slate-800">${escapeHTML(item.descricao)}</span>
                    <span class="text-slate-500 ml-1">(${item.quantidade}x R$ ${Number(item.valorUnitario).toFixed(2)})</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="font-bold text-slate-700">${subtotal}</span>
                    ${!encerrada ? `
                        <button onclick="removerItemCustoOS(${idx})" class="p-1 text-slate-400 hover:text-red-600 rounded">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    recalcularTotaisFinanceirosOS();
    if (window.lucide) lucide.createIcons();
}

async function adicionarItemCustoOS(e) {
    e.preventDefault();
    if (!osDetalhesAtual) return;

    const categoria = document.getElementById('custo-categoria').value;
    const descricao = document.getElementById('custo-descricao').value.trim();
    const quantidade = parseFloat(document.getElementById('custo-qtd').value) || 1;
    const valorUnitario = parseFloat(document.getElementById('custo-valor-unit').value) || 0;
    const subtotal = Number((quantidade * valorUnitario).toFixed(2));

    itensCustoOSAtual.push({
        categoria,
        descricao,
        quantidade,
        valorUnitario,
        subtotal
    });

    document.getElementById('custo-descricao').value = '';
    document.getElementById('custo-qtd').value = '1';
    document.getElementById('custo-valor-unit').value = '';

    renderizarItensCustoOS();
    await persistirTotaisNoDocumentoOS();
}

async function removerItemCustoOS(index) {
    if (!osDetalhesAtual) return;
    itensCustoOSAtual.splice(index, 1);
    renderizarItensCustoOS();
    await persistirTotaisNoDocumentoOS();
}

function recalcularTotaisFinanceirosOS() {
    const totalHoras = apontamentosOSAtual.reduce((acc, a) => acc + (Number(a.horas) || 0), 0);
    const custoMaoDeObra = apontamentosOSAtual.reduce((acc, a) => acc + (Number(a.custoCalculado) || 0), 0);
    const custoMateriais = itensCustoOSAtual.reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0);
    const custoTotal = Number((custoMaoDeObra + custoMateriais).toFixed(2));

    const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const badgeHoras = document.getElementById('det-total-horas-badge');
    const badgeMat = document.getElementById('det-total-materiais-badge');
    const badgeGeral = document.getElementById('det-custo-total-geral');

    if (badgeHoras) badgeHoras.textContent = `${totalHoras.toFixed(1)}h • ${fmt(custoMaoDeObra)}`;
    if (badgeMat) badgeMat.textContent = fmt(custoMateriais);
    if (badgeGeral) badgeGeral.textContent = fmt(custoTotal);

    return { totalHoras, custoMaoDeObra, custoMateriais, custoTotal };
}

async function persistirTotaisNoDocumentoOS() {
    if (!osDetalhesAtual) return;
    const totais = recalcularTotaisFinanceirosOS();

    try {
        await db.collection('ordens_servico').doc(osDetalhesAtual.id).update({
            itensCusto: itensCustoOSAtual,
            totalHoras: Number(totais.totalHoras.toFixed(2)),
            custoMaoDeObra: Number(totais.custoMaoDeObra.toFixed(2)),
            custoMateriais: Number(totais.custoMateriais.toFixed(2)),
            custoTotal: totais.custoTotal
        });
        await carregarOrdensServico();
    } catch (erro) {
        console.error('Erro ao atualizar totais da O.S.:', erro);
    }
}

/* ============================================================================
   ENCERRAMENTO TÉCNICO DA O.S.
   ============================================================================ */

function exibirPainelEncerramento() {
    const painel = document.getElementById('painel-encerramento-os');
    if (painel) painel.classList.remove('hidden');
}

function ocultarPainelEncerramento() {
    const painel = document.getElementById('painel-encerramento-os');
    if (painel) painel.classList.add('hidden');
}

async function confirmarEncerramentoOS(e) {
    e.preventDefault();
    if (!osDetalhesAtual) return;

    const btn = document.getElementById('btn-confirmar-encerramento');
    const servicoRealizado = document.getElementById('enc-servico-realizado').value.trim();
    const totais = recalcularTotaisFinanceirosOS();
    const u = window.usuarioLogado;

    // Validação do Checklist do Plano de Manutenção (quando houver)
    if (checklistOSAtual.length > 0) {
        const pendente = checklistOSAtual.find(it => it.status !== 'OK' && it.status !== 'NAO_OK');
        if (pendente) {
            alternarAbaDetalhesOS('checklist');
            alert('Marque OK ou Não OK em todos os itens do checklist antes de encerrar a O.S.');
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Confirmar Encerramento';
            }
            return;
        }

        const semMotivo = checklistOSAtual.find(it => it.status === 'NAO_OK' && (!it.motivo || it.motivo.trim().length < 3));
        if (semMotivo) {
            alternarAbaDetalhesOS('checklist');
            alert('Informe o motivo em todos os itens marcados como "Não OK".');
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Confirmar Encerramento';
            }
            return;
        }
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Encerrando...';
        }

        const agoraISO = new Date().toISOString();

        const dadosAtualizacao = {
            status: 'Encerrada',
            servicoRealizado,
            checklistPlano: checklistOSAtual,
            itensCusto: itensCustoOSAtual,
            totalHoras: Number(totais.totalHoras.toFixed(2)),
            custoMaoDeObra: Number(totais.custoMaoDeObra.toFixed(2)),
            custoMateriais: Number(totais.custoMateriais.toFixed(2)),
            custoTotal: totais.custoTotal,
            encerradoPorId: u.uid,
            encerradoPorNome: u.nome,
            dataHoraEncerramento: agoraISO,
            encerradaEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('ordens_servico').doc(osDetalhesAtual.id).update(dadosAtualizacao);

        // Se a O.S. veio de uma solicitação da liderança, encerra também a solicitação vinculada
        if (osDetalhesAtual.solicitacaoId) {
            await db.collection('solicitacoes').doc(osDetalhesAtual.solicitacaoId).update({
                status: 'Encerrada',
                osId: osDetalhesAtual.id,
                numeroOs: osDetalhesAtual.numeroOs || '',
                servicoRealizado,
                encerradoPor: u.nome,
                dataHoraEncerramento: agoraISO,
                encerradaEm: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        fecharModalDetalhesOS();
        await carregarOrdensServico();

    } catch (erro) {
        console.error('Erro ao encerrar O.S.:', erro);
        alert('Erro ao encerrar Ordem de Serviço: ' + erro.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Confirmar Encerramento';
        }
    }
}
