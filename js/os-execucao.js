let anexosOSAtual = [];
let itensCustoOSAtual = [];
let cacheCentrosCustoOS = [];
let cacheManutentoresDetalhesOS = [];
let manutentoresDetalhesOSAtual = [];
let osAtualEhExterna = false;
let osAtualTeveParada = false;

function sanitizarURLImagem(url) {
    const str = String(url || '').trim();
    if (/^https?:\/\//i.test(str) || /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(str)) {
        return escaparHTML(str);
    }
    return '';
}

function obterColunaConclusaoOS() {
    if (!Array.isArray(cacheColunasOS) || cacheColunasOS.length === 0) return null;
    const ordenadas = [...cacheColunasOS].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    return (
        ordenadas.find(c => /conclu|finaliz|encerrad/i.test(c.titulo || '')) ||
        ordenadas[ordenadas.length - 1]
    );
}

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

function recalcularTempoTrabalhoEncerramento() {
    const ini = document.getElementById('enc-inicio-trabalho')?.value || '';
    const fim = document.getElementById('enc-data-hora')?.value || '';
    const badge = document.getElementById('enc-tempo-trabalho-calculado');
    if (!badge) return;

    const mins = calcularMinutosParadaEntreDatas(ini, fim);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    badge.textContent = `${h}h ${String(m).padStart(2, '0')}m`;
}

function resetarEstadoModalDetalhesOS() {
    anexosOSAtual = [];
    itensCustoOSAtual = [];
    manutentoresDetalhesOSAtual = [];
    osAtualEhExterna = false;
    osAtualTeveParada = false;

    const formEnc = document.getElementById('form-encerramento-os');
    if (formEnc) {
        formEnc.reset();
        formEnc.classList.add('hidden');
    }

    const boxAbrir = document.getElementById('box-botao-abrir-encerramento');
    if (boxAbrir) boxAbrir.classList.remove('hidden');

    const camposTexto = [
        'det-os-id',
        'enc-servico-realizado',
        'enc-observacoes',
        'item-custo-desc',
        'item-custo-valor',
        'enc-inicio-trabalho',
        'enc-data-hora',
        'enc-inicio-parada',
        'enc-termino-parada'
    ];
    camposTexto.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const inputFotos = document.getElementById('enc-input-fotos');
    if (inputFotos) inputFotos.value = '';

    const uploadStatus = document.getElementById('enc-upload-status');
    if (uploadStatus) uploadStatus.classList.add('hidden');

    const badgeTrab = document.getElementById('enc-tempo-trabalho-calculado');
    if (badgeTrab) badgeTrab.textContent = '0h 00m';

    const badgeParada = document.getElementById('enc-tempo-parada-calculado');
    if (badgeParada) badgeParada.textContent = '0h 00m';

    const listaAnexos = document.getElementById('enc-lista-anexos');
    if (listaAnexos) listaAnexos.innerHTML = '<span class="text-[11px] text-slate-400">Nenhuma foto anexada.</span>';

    const listaCustos = document.getElementById('enc-lista-custos');
    if (listaCustos) listaCustos.innerHTML = '<p class="text-[11px] text-slate-400">Nenhum item de custo lançado.</p>';

    const totalLabel = document.getElementById('enc-custo-total-label');
    if (totalLabel) totalLabel.textContent = '0,00';
}

function renderizarManutentoresDetalhesOS() {
    const selMan = document.getElementById('det-os-manutentor-select');
    const chipsBox = document.getElementById('det-os-manutentores-chips');

    if (selMan) {
        const disponiveis = cacheManutentoresDetalhesOS.filter(m => !manutentoresDetalhesOSAtual.some(sel => sel.id === m.id));
        const textoPadrao = manutentoresDetalhesOSAtual.length > 0
            ? '+ Adicionar parceria / técnico...'
            : 'Sem técnico — Toque para escolher';

        selMan.innerHTML = `<option value="">${textoPadrao}</option>` +
            disponiveis.map(m => `<option value="${escaparHTML(m.id)}">${escaparHTML(m.nome)}</option>`).join('');
        selMan.value = '';
    }

    if (chipsBox) {
        if (manutentoresDetalhesOSAtual.length === 0) {
            chipsBox.innerHTML = '';
        } else {
            chipsBox.innerHTML = manutentoresDetalhesOSAtual.map(m => `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                    <span>${escaparHTML(m.nome)}</span>
                    <button type="button" onclick="removerManutentorDetalhesOS('${escaparHTML(m.id)}')" class="text-blue-500 hover:text-rose-600 font-extrabold leading-none">×</button>
                </span>
            `).join('');
        }
    }
}

async function adicionarManutentorDetalhesOS() {
    const selMan = document.getElementById('det-os-manutentor-select');
    const manId = selMan?.value || '';
    if (!manId) return;

    const manObj = cacheManutentoresDetalhesOS.find(m => m.id === manId);
    if (manObj && !manutentoresDetalhesOSAtual.some(s => s.id === manObj.id)) {
        manutentoresDetalhesOSAtual.push({ id: manObj.id, nome: manObj.nome });
    }
    renderizarManutentoresDetalhesOS();
    await atualizarManutentorRapidoOS();
}

async function removerManutentorDetalhesOS(manId) {
    manutentoresDetalhesOSAtual = manutentoresDetalhesOSAtual.filter(m => m.id !== manId);
    renderizarManutentoresDetalhesOS();
    await atualizarManutentorRapidoOS();
}

async function abrirDetalhesOS(osId) {
    const os = cacheOrdensServico.find(o => o.id === osId);
    if (!os) return;

    // 1. Limpa completamente qualquer resquício de O.S. anterior
    resetarEstadoModalDetalhesOS();

    const coluna = cacheColunasOS.find(c => c.id === os.colunaId) || { titulo: 'Aberta', corTopo: '#00E5B0' };
    osAtualEhExterna = (os.tipoNome || '').trim().toLowerCase() === 'manutenção externa';
    osAtualTeveParada = os.condicaoMaquina === 'Maquina parada' || os.maquinaParada === true || Boolean(os.inicioParada);

    document.getElementById('det-os-id').value = os.id;
    document.getElementById('det-os-numero').textContent = `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`;

    const badge = document.getElementById('det-os-status-badge');
    badge.textContent = coluna.titulo;
    badge.style.backgroundColor = sanitizarCorHex(coluna.corTopo, '#00E5B0');

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

    const tituloMaquina = (os.ativoTag || '').trim() ? `${os.ativoTag} - ${os.ativoNome}` : (os.ativoNome || 'Equipamento');
    document.getElementById('det-os-maquina').textContent = tituloMaquina;
    document.getElementById('det-os-tipo').textContent = os.tipoNome || 'Manutenção';
    document.getElementById('det-os-prioridade').textContent = `Prioridade: ${os.prioridade || 'Normal'}`;
    document.getElementById('det-os-descricao').textContent = os.descricao;

    const selCol = document.getElementById('det-os-coluna-select');
    selCol.innerHTML = cacheColunasOS.map(c =>
        `<option value="${escaparHTML(c.id)}" ${c.id === os.colunaId ? 'selected' : ''}>${escaparHTML(c.titulo)}</option>`
    ).join('');

    const [manutSnap, ativosSnap] = await Promise.all([
        db.collection('usuarios').where('empresaId', '==', usuarioAtual.empresaId).where('perfil', '==', 'Manutentor').get(),
        db.collection('ativos').where('empresaId', '==', usuarioAtual.empresaId).get()
    ]);

    cacheManutentoresDetalhesOS = manutSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    const idsSelecionados = Array.isArray(os.manutentoresIds) && os.manutentoresIds.length > 0
        ? os.manutentoresIds
        : (os.manutentorId ? [os.manutentorId] : []);

    const nomesSelecionados = Array.isArray(os.manutentoresNomes) && os.manutentoresNomes.length > 0
        ? os.manutentoresNomes
        : (os.manutentorNome ? [os.manutentorNome] : []);

    manutentoresDetalhesOSAtual = idsSelecionados.map((id, idx) => {
        const encontrado = cacheManutentoresDetalhesOS.find(m => m.id === id);
        return {
            id,
            nome: encontrado ? encontrado.nome : (nomesSelecionados[idx] || 'Técnico')
        };
    });

    renderizarManutentoresDetalhesOS();

    cacheCentrosCustoOS = ativosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const selCC = document.getElementById('item-custo-cc');
    if (selCC) {
        const labelPadraoOS = escaparHTML(tituloMaquina);
        selCC.innerHTML = cacheCentrosCustoOS.map(a => {
            const rotulo = (a.codigoTag || '').trim() ? `${a.codigoTag} - ${a.nome}` : a.nome;
            const label = escaparHTML(rotulo);
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

    let inicioPadraoOS = os.inicioExecucao || os.inicioParada || '';
    if (!inicioPadraoOS && os.criadoEm?.toDate) {
        const dCriado = os.criadoEm.toDate();
        dCriado.setMinutes(dCriado.getMinutes() - dCriado.getTimezoneOffset());
        inicioPadraoOS = dCriado.toISOString().slice(0, 16);
    }

    const inpIniTrab = document.getElementById('enc-inicio-trabalho');
    if (inpIniTrab) inpIniTrab.value = os.inicioExecucao || '';

    const inpEncerramento = document.getElementById('enc-data-hora');
    if (inpEncerramento) inpEncerramento.value = os.dataHoraEncerramento || '';

    recalcularTempoTrabalhoEncerramento();

    const blocoParada = document.getElementById('bloco-encerramento-parada');
    const inpIniParada = document.getElementById('enc-inicio-parada');
    const inpFimParada = document.getElementById('enc-termino-parada');
    if (blocoParada && inpIniParada && inpFimParada) {
        if (osAtualTeveParada) {
            blocoParada.classList.remove('hidden');
            inpIniParada.required = true;
            inpFimParada.required = true;

            inpIniParada.value = os.inicioParada || inicioPadraoOS || agoraISO;
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
    if (typeof lucide !== 'undefined') lucide.createIcons();
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
    resetarEstadoModalDetalhesOS();
    document.getElementById('modal-detalhes-os').classList.add('hidden');
}

function mostrarFormularioEncerramento() {
    document.getElementById('box-botao-abrir-encerramento').classList.add('hidden');
    document.getElementById('form-encerramento-os').classList.remove('hidden');
    recalcularTempoTrabalhoEncerramento();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function atualizarStatusRapidoOS() {
    const osId = document.getElementById('det-os-id').value;
    const novaColId = document.getElementById('det-os-coluna-select').value;
    const os = cacheOrdensServico.find(o => o.id === osId);

    const colunaConclusao = obterColunaConclusaoOS();
    const ehColunaFinal = colunaConclusao && colunaConclusao.id === novaColId;

    if (ehColunaFinal && os && !os.encerrada) {
        document.getElementById('det-os-coluna-select').value = os.colunaId;
        mostrarFormularioEncerramento();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Preencha os dados abaixo e clique em Confirmar Encerramento.', 'aviso');
        }
        return;
    }

    await db.collection('ordens_servico').doc(osId).update({
        colunaId: novaColId,
        encerrada: ehColunaFinal ? true : false
    });

    const col = cacheColunasOS.find(c => c.id === novaColId);
    if (col) {
        const badge = document.getElementById('det-os-status-badge');
        badge.textContent = col.titulo;
        badge.style.backgroundColor = sanitizarCorHex(col.corTopo, '#00E5B0');
    }
}

async function atualizarManutentorRapidoOS() {
    const osId = document.getElementById('det-os-id').value;
    const manutentoresIds = manutentoresDetalhesOSAtual.map(m => m.id);
    const manutentoresNomes = manutentoresDetalhesOSAtual.map(m => m.nome);

    await db.collection('ordens_servico').doc(osId).update({
        manutentorId: manutentoresIds[0] || '',
        manutentorNome: manutentoresNomes.join(', '),
        manutentoresIds,
        manutentoresNomes
    });
}

async function processarUploadFotosOS(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const osId = document.getElementById('det-os-id').value;
    const statusEl = document.getElementById('enc-upload-status');
    if (statusEl) statusEl.classList.remove('hidden');

    try {
        for (const file of files) {
            const url = await compactarEEnviarImagemOS(file, usuarioAtual.empresaId, osId);
            if (url) anexosOSAtual.push(url);
        }
        renderizarAnexosOS();
    } catch (err) {
        alert('Erro ao processar imagem: ' + err.message);
    } finally {
        if (statusEl) statusEl.classList.add('hidden');
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

    container.innerHTML = anexosOSAtual.map((url, idx) => {
        const urlSegura = sanitizarURLImagem(url);
        if (!urlSegura) return '';
        return `
        <div class="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-slate-300 bg-white">
            <a href="${urlSegura}" target="_blank" rel="noopener noreferrer">
                <img src="${urlSegura}" class="w-full h-full object-cover">
            </a>
            <button type="button" onclick="removerAnexoOS(${idx})"
                class="absolute top-0.5 right-0.5 bg-rose-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">×</button>
        </div>`;
    }).join('');
}

function removerAnexoOS(idx) {
    anexosOSAtual.splice(idx, 1);
    renderizarAnexosOS();
}

function adicionarItemCustoOS() {
    const osId = document.getElementById('det-os-id').value;
    const os = cacheOrdensServico.find(o => o.id === osId);
    const padraoMaquina = os
        ? ((os.ativoTag || '').trim() ? `${os.ativoTag} - ${os.ativoNome}` : os.ativoNome)
        : 'Máquina';

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

    if (!lista) return;

    if (itensCustoOSAtual.length === 0) {
        lista.innerHTML = `<p class="text-[11px] text-slate-400">${osAtualEhExterna ? 'Nenhum valor de serviço lançado.' : 'Nenhum item de custo lançado.'}</p>`;
        return;
    }

    lista.innerHTML = itensCustoOSAtual.map((item, idx) => `
        <div class="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <div class="min-w-0 pr-2">
                <span class="font-bold text-slate-800">${escaparHTML(item.descricao)}</span>
                <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 ml-1">${escaparHTML(item.centroCusto)}</span>
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
        const padraoMaquina = os
            ? ((os.ativoTag || '').trim() ? `${os.ativoTag} - ${os.ativoNome}` : os.ativoNome)
            : 'Máquina';

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

        const inicioExecucao = document.getElementById('enc-inicio-trabalho')?.value || '';
        const dataHoraEncerramento = document.getElementById('enc-data-hora')?.value || '';
        if (inicioExecucao && dataHoraEncerramento && new Date(dataHoraEncerramento) < new Date(inicioExecucao)) {
            alert('A data/hora do encerramento não pode ser anterior ao início do trabalho.');
            btn.disabled = false;
            btn.textContent = 'Confirmar Encerramento';
            return;
        }
        const tempoTrabalhoMinutos = (inicioExecucao && dataHoraEncerramento)
            ? calcularMinutosParadaEntreDatas(inicioExecucao, dataHoraEncerramento)
            : 0;

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
        const observacoes = document.getElementById('enc-observacoes').value.trim();
        const custoTotal = itensCustoOSAtual.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);

        const manutentoresIds = manutentoresDetalhesOSAtual.map(m => m.id);
        const manutentoresNomes = manutentoresDetalhesOSAtual.map(m => m.nome);

        // Garante que cacheColunasOS está carregado e localiza a coluna de conclusão
        if (!Array.isArray(cacheColunasOS) || cacheColunasOS.length === 0) {
            const colSnap = await db.collection('kanban_colunas')
                .where('empresaId', '==', usuarioAtual.empresaId)
                .get();
            cacheColunasOS = colSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        }

        const colunaConclusao = obterColunaConclusaoOS();

        const dadosAtualizacao = {
            servicoRealizado,
            anexos: anexosOSAtual,
            itensCusto: itensCustoOSAtual,
            custoTotal,
            centroCustoId: os?.ativoId || '',
            centroCustoNome: padraoMaquina,
            inicioExecucao,
            dataHoraEncerramento,
            tempoTrabalhoMinutos,
            manutentorId: manutentoresIds[0] || '',
            manutentorNome: manutentoresNomes.join(', '),
            manutentoresIds,
            manutentoresNomes,
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

        if (colunaConclusao && colunaConclusao.id) {
            dadosAtualizacao.colunaId = colunaConclusao.id;
        }

        await db.collection('ordens_servico').doc(osId).update(dadosAtualizacao);

        if (os?.ativoId) {
            await db.collection('ativos').doc(os.ativoId).update({ status: 'Operacional' }).catch(() => {});
        }

        const payloadSolicitacaoEncerrada = {
            status: 'Encerrada',
            osId: osId,
            numeroOs: os?.numeroOs || 0,
            servicoRealizado,
            encerradoPor: usuarioAtual.nome,
            dataHoraEncerramento,
            encerradaEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        const idsSolicitacoesAtualizar = new Set();
        if (os?.solicitacaoId) idsSolicitacoesAtualizar.add(os.solicitacaoId);

        try {
            const solSnap = await db.collection('solicitacoes')
                .where('empresaId', '==', usuarioAtual.empresaId)
                .get();

            solSnap.docs.forEach(docSol => {
                const s = docSol.data();
                if (
                    s.osId === osId ||
                    (os?.numeroOs && Number(s.numeroOs) === Number(os.numeroOs)) ||
                    (s.status === 'Convertida em O.S.' && s.ativoId === os?.ativoId && (os?.descricao || '').includes(s.problema || '___'))
                ) {
                    idsSolicitacoesAtualizar.add(docSol.id);
                }
            });

            for (const solIdVinc of idsSolicitacoesAtualizar) {
                await db.collection('solicitacoes').doc(solIdVinc).update(payloadSolicitacaoEncerrada).catch(() => {});
            }
        } catch (errSol) {
            console.warn('Solicitações vinculadas não atualizadas:', errSol.message);
        }

        fecharModalDetalhesOS();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('O.S. encerrada com sucesso!', 'sucesso');
        }
    } catch (err) {
        alert('Erro ao encerrar O.S.: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar Encerramento';
    }
}
