let anexosOSAtual = [];
let itensCustoOSAtual = [];
let cacheCentrosCustoOS = [];
let osAtualEhExterna = false;
let osAtualTeveParada = false;

function calcularMinutosParadaEntreDatas(inicioISO, terminoISO) {
    if (!inicioISO || !terminoISO) return 0;
    const d1 = new Date(inicioISO);
    const d2 = new Date(terminoISO);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 60000));
}

function recalcularTempoParadaEncerramento() {
    const ini = document.getElementById('enc-inicio-parada')?.value || '';
    const fim = document.getElementById('enc-termino-parada')?.value || '';
    const badge = document.getElementById('enc-tempo-parada-calculado');
    if (!badge) return;

    const mins = calcularMinutosParadaEntreDatas(ini, fim);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    badge.textContent = `${h}h ${String(m).padStart(2, '0')}m`;
}

async function abrirDetalhesOS(osId) {
    const os = cacheOrdensServico.find(o => o.id === osId);
    if (!os) return;

    const coluna = cacheColunasOS.find(c => c.id === os.colunaId) || { titulo: 'Aberta', corTopo: '#00E5B0' };
    osAtualEhExterna = (os.tipoNome || '').trim().toLowerCase() === 'manutenção externa';
    osAtualTeveParada = os.condicaoMaquina === 'Maquina parada' || os.maquinaParada === true || Boolean(os.inicioParada);

    document.getElementById('det-os-id').value = os.id;
    document.getElementById('det-os-numero').textContent = `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`;

    const badge = document.getElementById('det-os-status-badge');
    badge.textContent = coluna.titulo;
    badge.style.backgroundColor = coluna.corTopo || '#00E5B0';

    // Badge de condição da máquina no cabeçalho do modal
    const condBadge = document.getElementById('det-os-condicao-badge');
    if (condBadge) {
        if (osAtualTeveParada) {
            condBadge.textContent = 'Máquina Parada';
            condBadge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-600 text-white';
            condBadge.classList.remove('hidden');
        } else if (os.condicaoMaquina === 'Parcialmente funcional') {
            condBadge.textContent = 'Parcialmente Funcional';
            condBadge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500 text-white';
            condBadge.classList.remove('hidden');
        } else {
            condBadge.classList.add('hidden');
        }
    }

    document.getElementById('det-os-maquina').textContent = `${os.ativoTag} - ${os.ativoNome}`;
    document.getElementById('det-os-tipo').textContent = os.tipoNome || 'Manutenção';
    document.getElementById('det-os-prioridade').textContent = `Prioridade: ${os.prioridade || 'Normal'}`;
    document.getElementById('det-os-descricao').textContent = os.descricao;

    // Preenche seletor de Status/Coluna e Manutentor
    const selCol = document.getElementById('det-os-coluna-select');
    selCol.innerHTML = cacheColunasOS.map(c =>
        `<option value="${c.id}" ${c.id === os.colunaId ? 'selected' : ''}>${c.titulo}</option>`
    ).join('');

    const [manutSnap, ativosSnap] = await Promise.all([
        db.collection('usuarios').where('empresaId', '==', usuarioAtual.empresaId).where('perfil', '==', 'Manutentor').get(),
        db.collection('ativos').where('empresaId', '==', usuarioAtual.empresaId).get()
    ]);

    const selManut = document.getElementById('det-os-manutentor-select');
    selManut.innerHTML = '<option value="">-- Sem técnico --</option>' +
        manutSnap.docs.map(d => `<option value="${d.id}" data-nome="${d.data().nome}" ${d.id === os.manutentorId ? 'selected' : ''}>${d.data().nome}</option>`).join('');
    selManut.disabled = usuarioAtual.perfil === 'Manutentor';

    cacheCentrosCustoOS = ativosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const selCC = document.getElementById('item-custo-cc');
    if (selCC) {
        const labelPadraoOS = `${os.ativoTag} - ${os.ativoNome}`;
        selCC.innerHTML = cacheCentrosCustoOS.map(a => {
            const label = `${a.codigoTag} - ${a.nome}`;
            const selecionado = a.id === os.ativoId ? 'selected' : '';
            return `<option value="${label}" ${selecionado}>${label}</option>`;
        }).join('') || `<option value="${labelPadraoOS}" selected>${labelPadraoOS}</option>`;
    }

    aplicarLayoutCustosPorTipo(osAtualEhExterna);

    anexosOSAtual = Array.isArray(os.anexos) ? [...os.anexos] : [];
    itensCustoOSAtual = Array.isArray(os.itensCusto) ? [...os.itensCusto] : [];

    document.getElementById('enc-servico-realizado').value = os.servicoRealizado || '';
    document.getElementById('enc-observacoes').value = os.observacoes || '';

    const agora = new Date();
    agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
    const agoraISO = agora.toISOString().slice(0, 16);
    document.getElementById('enc-data-hora').value = os.dataHoraEncerramento || agoraISO;

    // Configura bloco de Início e Término da Parada de Máquina
    const blocoParada = document.getElementById('bloco-encerramento-parada');
    const inpIniParada = document.getElementById('enc-inicio-parada');
    const inpFimParada = document.getElementById('enc-termino-parada');
    if (blocoParada && inpIniParada && inpFimParada) {
        if (osAtualTeveParada) {
            blocoParada.classList.remove('hidden');
            inpIniParada.required = true;
            inpFimParada.required = true;

            let inicioPadrao = os.inicioParada;
            if (!inicioPadrao && os.criadoEm?.toDate) {
                const dCriado = os.criadoEm.toDate();
                dCriado.setMinutes(dCriado.getMinutes() - dCriado.getTimezoneOffset());
                inicioPadrao = dCriado.toISOString().slice(0, 16);
            }
            inpIniParada.value = inicioPadrao || agoraISO;
            inpFimParada.value = os.terminoParada || agoraISO;
            recalcularTempoParadaEncerramento();
        } else {
            blocoParada.classList.add('hidden');
            inpIniParada.required = false;
            inpFimParada.required = false;
            inpIniParada.value = '';
            inpFimParada.value = '';
        }
    }

    renderizarAnexosOS();
    renderizarItensCustoOS();

    if (os.encerrada) {
        mostrarFormularioEncerramento();
    } else {
        document.getElementById('form-encerramento-os').classList.add('hidden');
        document.getElementById('box-botao-abrir-encerramento').classList.remove('hidden');
    }

    document.getElementById('modal-detalhes-os').classList.remove('hidden');
    lucide.createIcons();
}

function aplicarLayoutCustosPorTipo(ehExterna) {
    const tituloCustos = document.getElementById('label-titulo-custos');
    const inputDesc = document.getElementById('item-custo-desc');
    const selCC = document.getElementById('item-custo-cc');
    const inputValor = document.getElementById('item-custo-valor');
    const wrapperValor = inputValor?.parentElement;

    if (!inputDesc || !selCC || !inputValor || !wrapperValor) return;

    if (ehExterna) {
        if (tituloCustos) {
            tituloCustos.innerHTML = `<i data-lucide="briefcase" class="w-4 h-4 text-purple-600"></i><span>Serviço Terceirizado & Valor</span>`;
        }
        inputDesc.placeholder = 'Descrição do serviço externo / Fornecedor';
        inputDesc.className = 'sm:col-span-7 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-purple-600';

        selCC.classList.add('hidden');

        wrapperValor.className = 'sm:col-span-5 flex gap-1.5';
        inputValor.placeholder = 'Valor do Serviço (R$)';
    } else {
        if (tituloCustos) {
            tituloCustos.innerHTML = `<i data-lucide="dollar-sign" class="w-4 h-4 text-emerald-600"></i><span>Peças, Materiais & Custos</span>`;
        }
        inputDesc.placeholder = 'Item / Peça utilizada';
        inputDesc.className = 'sm:col-span-5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none';

        selCC.classList.remove('hidden');
        selCC.className = 'sm:col-span-4 px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none';

        wrapperValor.className = 'sm:col-span-3 flex gap-1.5';
        inputValor.placeholder = 'R$ 0,00';
    }
}

function fecharModalDetalhesOS() {
    document.getElementById('modal-detalhes-os').classList.add('hidden');
}

function mostrarFormularioEncerramento() {
    document.getElementById('box-botao-abrir-encerramento').classList.add('hidden');
    document.getElementById('form-encerramento-os').classList.remove('hidden');
    lucide.createIcons();
}

async function atualizarStatusRapidoOS() {
    const osId = document.getElementById('det-os-id').value;
    const novaColId = document.getElementById('det-os-coluna-select').value;
    const os = cacheOrdensServico.find(o => o.id === osId);

    const ultimaColuna = cacheColunasOS[cacheColunasOS.length - 1];
    const ehColunaFinal = ultimaColuna && ultimaColuna.id === novaColId;

    if (ehColunaFinal && os && !os.encerrada) {
        document.getElementById('det-os-coluna-select').value = os.colunaId;
        mostrarFormularioEncerramento();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Preencha os dados abaixo e clique em Confirmar Encerramento.', 'aviso');
        }
        return;
    }

    await db.collection('ordens_servico').doc(osId).update({ colunaId: novaColId });

    const col = cacheColunasOS.find(c => c.id === novaColId);
    if (col) {
        const badge = document.getElementById('det-os-status-badge');
        badge.textContent = col.titulo;
        badge.style.backgroundColor = col.corTopo;
    }
}

async function atualizarManutentorRapidoOS() {
    const osId = document.getElementById('det-os-id').value;
    const sel = document.getElementById('det-os-manutentor-select');
    const opt = sel.options[sel.selectedIndex];

    await db.collection('ordens_servico').doc(osId).update({
        manutentorId: sel.value || '',
        manutentorNome: sel.value ? (opt?.getAttribute('data-nome') || '') : ''
    });
}

async function processarUploadFotosOS(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const osId = document.getElementById('det-os-id').value;
    const statusEl = document.getElementById('enc-upload-status');
    statusEl.classList.remove('hidden');

    try {
        for (const file of files) {
            const url = await compactarEEnviarImagemOS(file, usuarioAtual.empresaId, osId);
            anexosOSAtual.push(url);
        }
        renderizarAnexosOS();
    } catch (err) {
        alert('Erro ao enviar imagem: ' + err.message);
    } finally {
        statusEl.classList.add('hidden');
        event.target.value = '';
    }
}

function renderizarAnexosOS() {
    const container = document.getElementById('enc-lista-anexos');
    if (!container) return;

    if (anexosOSAtual.length === 0) {
        container.innerHTML = '<span class="text-[11px] text-slate-400">Nenhuma foto anexada.</span>';
        return;
    }

    container.innerHTML = anexosOSAtual.map((url, idx) => `
        <div class="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-slate-300 bg-white">
            <a href="${url}" target="_blank">
                <img src="${url}" class="w-full h-full object-cover">
            </a>
            <button type="button" onclick="removerAnexoOS(${idx})"
                class="absolute top-0.5 right-0.5 bg-rose-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">×</button>
        </div>
    `).join('');
}

function removerAnexoOS(idx) {
    anexosOSAtual.splice(idx, 1);
    renderizarAnexosOS();
}

function adicionarItemCustoOS() {
    const osId = document.getElementById('det-os-id').value;
    const os = cacheOrdensServico.find(o => o.id === osId);
    const padraoMaquina = os ? `${os.ativoTag} - ${os.ativoNome}` : 'Máquina';

    const descInput = document.getElementById('item-custo-desc');
    const desc = descInput.value.trim() || (osAtualEhExterna ? 'Serviço de Manutenção Externa' : '');
    const cc = osAtualEhExterna ? padraoMaquina : (document.getElementById('item-custo-cc')?.value || padraoMaquina);
    const valor = parseFloat(document.getElementById('item-custo-valor').value) || 0;

    if (!desc) {
        alert('Informe o nome do item ou peça.');
        return;
    }

    if (valor <= 0 && osAtualEhExterna) {
        alert('Informe o valor do serviço externo.');
        return;
    }

    itensCustoOSAtual.push({
        descricao: desc,
        centroCusto: cc,
        valor,
        tipoCusto: osAtualEhExterna ? 'Serviço Externo' : 'Peça/Material'
    });

    descInput.value = '';
    document.getElementById('item-custo-valor').value = '';
    renderizarItensCustoOS();
}

function removerItemCustoOS(idx) {
    itensCustoOSAtual.splice(idx, 1);
    renderizarItensCustoOS();
}

function renderizarItensCustoOS() {
    const lista = document.getElementById('enc-lista-custos');
    const totalLabel = document.getElementById('enc-custo-total-label');

    const total = itensCustoOSAtual.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
    if (totalLabel) totalLabel.textContent = total.toFixed(2).replace('.', ',');

    if (itensCustoOSAtual.length === 0) {
        lista.innerHTML = `<p class="text-[11px] text-slate-400">${osAtualEhExterna ? 'Nenhum valor de serviço lançado.' : 'Nenhum item de custo lançado.'}</p>`;
        return;
    }

    lista.innerHTML = itensCustoOSAtual.map((item, idx) => `
        <div class="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <div class="min-w-0 pr-2">
                <span class="font-bold text-slate-800">${item.descricao}</span>
                <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 ml-1">${item.centroCusto}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <span class="font-bold text-emerald-700">R$ ${Number(item.valor).toFixed(2).replace('.', ',')}</span>
                <button type="button" onclick="removerItemCustoOS(${idx})" class="text-rose-500 hover:text-rose-700 font-bold px-1">×</button>
            </div>
        </div>
    `).join('');
}

// ==========================================
// SALVAR ENCERRAMENTO FINAL DA O.S.
// ==========================================
async function confirmarEncerramentoOS(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-confirmar-encerramento');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        const osId = document.getElementById('det-os-id').value;
        const os = cacheOrdensServico.find(o => o.id === osId);
        const padraoMaquina = os ? `${os.ativoTag} - ${os.ativoNome}` : 'Máquina';

        // Valida datas de parada de máquina se aplicável
        let inicioParada = '';
        let terminoParada = '';
        let tempoParadaMinutos = 0;

        if (osAtualTeveParada) {
            inicioParada = document.getElementById('enc-inicio-parada')?.value || '';
            terminoParada = document.getElementById('enc-termino-parada')?.value || '';
            if (!inicioParada || !terminoParada) {
                alert('Informe a data/hora de início e término da parada da máquina.');
                btn.disabled = false;
                btn.textContent = 'Confirmar Encerramento';
                return;
            }
            if (new Date(terminoParada) < new Date(inicioParada)) {
                alert('O término da parada não pode ser anterior ao início da parada.');
                btn.disabled = false;
                btn.textContent = 'Confirmar Encerramento';
                return;
            }
            tempoParadaMinutos = calcularMinutosParadaEntreDatas(inicioParada, terminoParada);
        }

        const descPendente = document.getElementById('item-custo-desc')?.value.trim();
        const valorPendente = parseFloat(document.getElementById('item-custo-valor')?.value) || 0;
        if (valorPendente > 0) {
            itensCustoOSAtual.push({
                descricao: descPendente || (osAtualEhExterna ? 'Serviço de Manutenção Externa' : 'Material / Peça'),
                centroCusto: osAtualEhExterna ? padraoMaquina : (document.getElementById('item-custo-cc')?.value || padraoMaquina),
                valor: valorPendente,
                tipoCusto: osAtualEhExterna ? 'Serviço Externo' : 'Peça/Material'
            });
        }

        const servicoRealizado = document.getElementById('enc-servico-realizado').value.trim();
        const dataHoraEncerramento = document.getElementById('enc-data-hora').value;
        const observacoes = document.getElementById('enc-observacoes').value.trim();
        const custoTotal = itensCustoOSAtual.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);

        const ultimaColuna = cacheColunasOS[cacheColunasOS.length - 1];

        const dadosAtualizacao = {
            servicoRealizado,
            anexos: anexosOSAtual,
            itensCusto: itensCustoOSAtual,
            custoTotal,
            centroCustoId: os?.ativoId || '',
            centroCustoNome: padraoMaquina,
            dataHoraEncerramento,
            observacoes,
            encerrada: true,
            encerradoPor: usuarioAtual.nome,
            encerradaEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (osAtualTeveParada) {
            dadosAtualizacao.inicioParada = inicioParada;
            dadosAtualizacao.terminoParada = terminoParada;
            dadosAtualizacao.tempoParadaMinutos = tempoParadaMinutos;
        }

        if (ultimaColuna) {
            dadosAtualizacao.colunaId = ultimaColuna.id;
        }

        await db.collection('ordens_servico').doc(osId).update(dadosAtualizacao);

        if (os?.ativoId) {
            await db.collection('ativos').doc(os.ativoId).update({ status: 'Operacional' });
        }

        // Atualiza a solicitação vinculada (se existir) para avisar o solicitante que a O.S. foi encerrada
        if (os?.solicitacaoId) {
            await db.collection('solicitacoes').doc(os.solicitacaoId).update({
                status: 'Encerrada',
                osId: osId,
                numeroOs: os.numeroOs || 0,
                servicoRealizado,
                encerradoPor: usuarioAtual.nome,
                dataHoraEncerramento,
                encerradaEm: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        fecharModalDetalhesOS();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('O.S. encerrada e custos vinculados ao Centro de Custo!', 'sucesso');
        }
    } catch (err) {
        alert('Erro ao encerrar O.S.: ' + err.message);
    }

    btn.disabled = false;
    btn.textContent = 'Confirmar Encerramento';
}
