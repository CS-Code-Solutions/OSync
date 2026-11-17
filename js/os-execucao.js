let anexosOSAtual = [];
let itensCustoOSAtual = [];
let cacheCentrosCustoOS = [];

async function abrirDetalhesOS(osId) {
    const os = cacheOrdensServico.find(o => o.id === osId);
    if (!os) return;

    const coluna = cacheColunasOS.find(c => c.id === os.colunaId) || { titulo: 'Aberta', corTopo: '#00E5B0' };

    document.getElementById('det-os-id').value = os.id;
    document.getElementById('det-os-numero').textContent = `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`;

    const badge = document.getElementById('det-os-status-badge');
    badge.textContent = coluna.titulo;
    badge.style.backgroundColor = coluna.corTopo || '#00E5B0';

    document.getElementById('det-os-maquina').textContent = `${os.ativoTag} - ${os.ativoNome}`;
    document.getElementById('det-os-tipo').textContent = os.tipoNome || 'Manutenção';
    document.getElementById('det-os-prioridade').textContent = `Prioridade: ${os.prioridade || 'Normal'}`;
    document.getElementById('det-os-descricao').textContent = os.descricao;

    // Preenche seletor de Status/Coluna e Manutentor para troca rápida no mobile
    const selCol = document.getElementById('det-os-coluna-select');
    selCol.innerHTML = cacheColunasOS.map(c =>
        `<option value="${c.id}" ${c.id === os.colunaId ? 'selected' : ''}>${c.titulo}</option>`
    ).join('');

    const [manutSnap, ccSnap] = await Promise.all([
        db.collection('usuarios').where('empresaId', '==', usuarioAtual.empresaId).where('perfil', '==', 'Manutentor').get(),
        db.collection('centros_custo').where('empresaId', '==', usuarioAtual.empresaId).get()
    ]);

    const selManut = document.getElementById('det-os-manutentor-select');
    selManut.innerHTML = '<option value="">-- Sem técnico --</option>' +
        manutSnap.docs.map(d => `<option value="${d.id}" data-nome="${d.data().nome}" ${d.id === os.manutentorId ? 'selected' : ''}>${d.data().nome}</option>`).join('');
    selManut.disabled = usuarioAtual.perfil === 'Manutentor';

    // Preenche Centros de Custo
    cacheCentrosCustoOS = ccSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const selCC = document.getElementById('item-custo-cc');
    selCC.innerHTML = '<option value="">Centro de Custo (Opcional)</option>' +
        cacheCentrosCustoOS.map(cc => `<option value="${cc.codigo} - ${cc.nome}">${cc.codigo} - ${cc.nome}</option>`).join('');

    // Carrega dados de encerramento se já existirem
    anexosOSAtual = Array.isArray(os.anexos) ? [...os.anexos] : [];
    itensCustoOSAtual = Array.isArray(os.itensCusto) ? [...os.itensCusto] : [];

    document.getElementById('enc-servico-realizado').value = os.servicoRealizado || '';
    document.getElementById('enc-observacoes').value = os.observacoes || '';

    // Preenche data e hora atual por padrão (formato YYYY-MM-DDTHH:mm)
    const agora = new Date();
    agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
    document.getElementById('enc-data-hora').value = os.dataHoraEncerramento || agora.toISOString().slice(0, 16);

    renderizarAnexosOS();
    renderizarItensCustoOS();

    // Se a O.S. já tiver encerramento salvo, já mostra o formulário aberto para consulta/edição
    if (os.encerrada) {
        mostrarFormularioEncerramento();
    } else {
        document.getElementById('form-encerramento-os').classList.add('hidden');
        document.getElementById('box-botao-abrir-encerramento').classList.remove('hidden');
    }

    document.getElementById('modal-detalhes-os').classList.remove('hidden');
    lucide.createIcons();
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

// ==========================================
// ANEXOS OTIMIZADOS (COMPACTAÇÃO + URL)
// ==========================================
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

// ==========================================
// ITENS DE CUSTO & CENTROS DE CUSTO
// ==========================================
function adicionarItemCustoOS() {
    const desc = document.getElementById('item-custo-desc').value.trim();
    const cc = document.getElementById('item-custo-cc').value;
    const valor = parseFloat(document.getElementById('item-custo-valor').value) || 0;

    if (!desc) {
        alert('Informe o nome do item ou peça.');
        return;
    }

    itensCustoOSAtual.push({ descricao: desc, centroCusto: cc || 'Geral', valor });

    document.getElementById('item-custo-desc').value = '';
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
        lista.innerHTML = '<p class="text-[11px] text-slate-400">Nenhum item de custo lançado.</p>';
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
        const servicoRealizado = document.getElementById('enc-servico-realizado').value.trim();
        const dataHoraEncerramento = document.getElementById('enc-data-hora').value;
        const observacoes = document.getElementById('enc-observacoes').value.trim();
        const custoTotal = itensCustoOSAtual.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);

        // Move automaticamente para a última coluna configurada (ex: Fechadas / Concluída)
        const ultimaColuna = cacheColunasOS[cacheColunasOS.length - 1];

        const dadosAtualizacao = {
            servicoRealizado,
            anexos: anexosOSAtual, // Salva apenas o array de URLs leves
            itensCusto: itensCustoOSAtual,
            custoTotal,
            dataHoraEncerramento,
            observacoes,
            encerrada: true,
            encerradoPor: usuarioAtual.nome
        };

        if (ultimaColuna) {
            dadosAtualizacao.colunaId = ultimaColuna.id;
        }

        await db.collection('ordens_servico').doc(osId).update(dadosAtualizacao);

        // Atualiza status da máquina de volta para Operacional
        const os = cacheOrdensServico.find(o => o.id === osId);
        if (os?.ativoId) {
            await db.collection('ativos').doc(os.ativoId).update({ status: 'Operacional' });
        }

        fecharModalDetalhesOS();
    } catch (err) {
        alert('Erro ao encerrar O.S.: ' + err.message);
    }

    btn.disabled = false;
    btn.textContent = 'Confirmar Encerramento';
}
