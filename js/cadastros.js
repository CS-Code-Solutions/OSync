let cacheAtivos = [];
let cacheUsuariosPerfil = [];
let perfilAtualCadastro = 'Manutentor';

const ROTULOS_PAGINAS_PERFIL = {
    'os': 'O.S.',
    'solicitacoes': 'Solicitações',
    'dashboard': 'Dashboard',
    'cad-ativos': 'Máquinas',
    'relatorios-os': 'Rel. O.S.',
    'relatorios-maquinas': 'Rel. Máquinas',
    'centros-custo': 'C. Custo',
    'configuracoes': 'Configurações'
};

// ==========================================
// MÓDULO 1: ATIVOS (MÁQUINAS) E QR CODE
// ==========================================
async function initAtivos() {
    await carregarAtivos();
    document.getElementById('form-novo-ativo')?.addEventListener('submit', salvarNovoAtivo);

    const params = new URLSearchParams(window.location.search);
    const ativoIdUrl = params.get('ativo');
    if (ativoIdUrl) {
        abrirModalFlutuanteQRMaquina(ativoIdUrl);
    }
}

async function carregarAtivos() {
    const lista = document.getElementById('lista-ativos');
    if (!lista) return;

    const snap = await db.collection('ativos')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .get();

    cacheAtivos = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.codigoTag || '').localeCompare(b.codigoTag || ''));

    renderizarListaAtivos(cacheAtivos);
}

function renderizarListaAtivos(ativos) {
    const lista = document.getElementById('lista-ativos');
    if (!lista) return;

    if (ativos.length === 0) {
        lista.innerHTML = `<div class="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400">Nenhuma máquina cadastrada ainda.</div>`;
        return;
    }

    const badgeStatus = {
        'Operacional': 'bg-emerald-100 text-emerald-700',
        'Manutencao': 'bg-amber-100 text-amber-700',
        'Parada': 'bg-rose-100 text-rose-700'
    };

    lista.innerHTML = ativos.map(ativo => {
        const ativoIdSeguro = escaparHTML(ativo.id);
        const ativoNomeSeguro = escaparHTML(ativo.nome);
        return `
        <div class="osync-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="space-y-1">
                <div class="flex items-center gap-2.5 flex-wrap">
                    <span class="font-extrabold text-base text-slate-900">${escaparHTML(ativo.codigoTag)} - ${ativoNomeSeguro}</span>
                    <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 flex items-center gap-1">
                        <i data-lucide="settings" class="w-3 h-3"></i> ${escaparHTML(ativo.setor || 'Geral')}
                    </span>
                    <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badgeStatus[ativo.status] || 'bg-slate-100 text-slate-700'}">
                        ${escaparHTML(ativo.status)}
                    </span>
                </div>
                <div class="text-xs text-slate-500 flex items-center gap-3">
                    <span><i data-lucide="factory" class="w-3.5 h-3.5 inline mr-1"></i>${escaparHTML(ativo.fabricante || 'Fabricante N/I')}</span>
                    <span>•</span>
                    <span>Modelo: ${escaparHTML(ativo.modelo || 'N/I')}</span>
                </div>
            </div>

            <div class="flex items-center gap-2 self-end sm:self-center">
                <button onclick="abrirProntuarioAtivo('${ativoIdSeguro}')" class="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition">
                    <i data-lucide="qr-code" class="w-4 h-4"></i>
                    <span>QR Code & Prontuário</span>
                </button>
                <button data-nome="${ativoNomeSeguro}" onclick="excluirAtivo('${ativoIdSeguro}', this.getAttribute('data-nome'))" title="Excluir Máquina" class="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>`;
    }).join('');

    lucide.createIcons();
}

function filtrarAtivos() {
    const termo = (document.getElementById('busca-ativos')?.value || '').toLowerCase();
    const filtrados = cacheAtivos.filter(a =>
        `${a.codigoTag} ${a.nome} ${a.fabricante || ''} ${a.setor || ''}`.toLowerCase().includes(termo)
    );
    renderizarListaAtivos(filtrados);
}

function abrirModalNovoAtivo() {
    document.getElementById('modal-novo-ativo')?.classList.remove('hidden');
}

function fecharModalNovoAtivo() {
    document.getElementById('modal-novo-ativo')?.classList.add('hidden');
}

async function salvarNovoAtivo(e) {
    e.preventDefault();
    try {
        const codigoTag = document.getElementById('ativo-tag').value.trim().toUpperCase();
        const nome = document.getElementById('ativo-nome').value.trim();
        const fabricante = document.getElementById('ativo-fabricante').value.trim();
        const modelo = document.getElementById('ativo-modelo').value.trim();
        const setor = document.getElementById('ativo-setor').value.trim();
        const status = document.getElementById('ativo-status').value;

        const ativoRef = await db.collection('ativos').add({
            empresaId: usuarioAtual.empresaId,
            codigoTag,
            nome,
            fabricante,
            modelo,
            setor,
            status,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('centros_custo').doc(ativoRef.id).set({
            empresaId: usuarioAtual.empresaId,
            ativoId: ativoRef.id,
            codigo: codigoTag,
            nome: `${codigoTag} - ${nome}`,
            setor: setor || 'Geral',
            ativo: true,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        fecharModalNovoAtivo();
        e.target.reset();
        carregarAtivos();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync(`Máquina "${codigoTag} - ${nome}" cadastrada como Centro de Custo!`, 'sucesso');
        }
    } catch (err) {
        alert('Erro ao cadastrar máquina: ' + err.message);
    }
}

async function excluirAtivo(ativoId, nome) {
    if (!await confirmarAcaoOSync(`Deseja excluir a máquina <strong>"${escaparHTML(nome)}"</strong>?`, { titulo: 'Excluir Máquina', textoConfirmar: 'Excluir' })) return;
    await db.collection('ativos').doc(ativoId).delete();
    await db.collection('centros_custo').doc(ativoId).delete().catch(() => {});
    carregarAtivos();
}

async function abrirProntuarioAtivo(ativoId) {
    const ativo = cacheAtivos.find(a => a.id === ativoId);
    if (!ativo) return;

    document.getElementById('prontuario-tag').textContent = ativo.codigoTag;
    document.getElementById('prontuario-nome').textContent = ativo.nome;
    document.getElementById('prontuario-setor').textContent = ativo.setor || 'Não informado';
    document.getElementById('prontuario-fab-mod').textContent = `${ativo.fabricante || '-'} / ${ativo.modelo || '-'}`;
    document.getElementById('prontuario-status').textContent = ativo.status;
    document.getElementById('qrcode-label').textContent = `${ativo.codigoTag} • OSync`;

    const qrContainer = document.getElementById('qrcode-container');
    qrContainer.innerHTML = '';
    const urlMaquina = `${window.location.origin}${window.location.pathname}?ativo=${encodeURIComponent(ativo.id)}`;
    new QRCode(qrContainer, {
        text: urlMaquina,
        width: 110,
        height: 110,
        colorDark: "#0B1120",
        colorLight: "#FFFFFF"
    });

    const historicoBox = document.getElementById('prontuario-historico-os');
    historicoBox.innerHTML = '<p class="text-xs text-slate-400">Carregando histórico...</p>';
    document.getElementById('modal-prontuario-ativo').classList.remove('hidden');

    const snap = await db.collection('ordens_servico')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .where('ativoId', '==', ativo.id)
        .get();

    const ordens = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.numeroOs || 0) - (a.numeroOs || 0));

    if (ordens.length === 0) {
        historicoBox.innerHTML = '<p class="text-xs text-slate-400 bg-slate-50 p-4 rounded-lg text-center">Nenhuma manutenção registrada para este equipamento.</p>';
    } else {
        historicoBox.innerHTML = ordens.map(os => {
            const dataFormatada = os.criadoEm?.toDate ? os.criadoEm.toDate().toLocaleDateString('pt-BR') : '-';
            return `
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-start gap-3">
                <div>
                    <div class="font-bold text-slate-800">#OS-${String(os.numeroOs || 0).padStart(4, '0')} • ${escaparHTML(os.tipoNome || 'Manutenção')}</div>
                    <p class="text-slate-600 mt-1">${escaparHTML(os.descricao)}</p>
                    <span class="text-[11px] text-slate-400 block mt-1">Técnico: ${escaparHTML(os.manutentorNome || 'N/A')} • Data: ${escaparHTML(dataFormatada)}</span>
                </div>
                <span class="font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shrink-0">
                    R$ ${Number(os.custoTotal || 0).toFixed(2)}
                </span>
            </div>`;
        }).join('');
    }
    lucide.createIcons();
}

function fecharProntuarioAtivo() {
    document.getElementById('modal-prontuario-ativo')?.classList.add('hidden');
}

function imprimirEtiquetaQR() {
    const conteudoQR = document.getElementById('area-impressao-qr').innerHTML;
    const janela = window.open('', '', 'width=350,height=350');
    janela.document.write(`<html><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">${conteudoQR}</body></html>`);
    janela.document.close();
    janela.print();
}

// ==========================================
// FLUTUANTE GLOBAL DE LEITURA DO QR CODE DA MÁQUINA
// ==========================================
let dadosAtivoQRAtual = null;
let ordensAtivoQRAtual = [];

async function verificarQRCodeNaURL() {
    const params = new URLSearchParams(window.location.search);
    const ativoIdUrl = params.get('ativo');
    if (!ativoIdUrl) return;

    window.history.replaceState({}, document.title, window.location.pathname);
    await abrirModalFlutuanteQRMaquina(ativoIdUrl);
}

async function abrirModalFlutuanteQRMaquina(ativoId) {
    try {
        const ativoDoc = await db.collection('ativos').doc(ativoId).get();
        if (!ativoDoc.exists) {
            alert('Máquina não encontrada ou removida do sistema.');
            return;
        }

        const ativo = { id: ativoDoc.id, ...ativoDoc.data() };
        if (ativo.empresaId !== usuarioAtual.empresaId && usuarioAtual.perfil !== 'SuperAdmin') {
            alert('Este equipamento pertence a outra empresa.');
            return;
        }

        dadosAtivoQRAtual = ativo;

        document.getElementById('qr-glob-ativo-id').value = ativo.id;
        document.getElementById('qr-glob-tag').textContent = ativo.codigoTag || 'TAG';
        document.getElementById('qr-glob-nome').textContent = ativo.nome || 'Equipamento';
        document.getElementById('qr-glob-setor').textContent = ativo.setor || 'Geral';
        document.getElementById('qr-glob-fab').textContent = ativo.fabricante || '-';
        document.getElementById('qr-glob-mod').textContent = ativo.modelo || '-';
        document.getElementById('qr-glob-status').textContent = ativo.status || 'Operacional';

        const isGestor = usuarioAtual.perfil === 'Admin' || usuarioAtual.perfil === 'SuperAdmin';
        const isLider = usuarioAtual.perfil === 'Lideranca';

        const btnPrincipal = document.querySelector('[onclick="acaoQR_NovaOrdemOuChamado()"]');
        const boxBotoes = btnPrincipal?.parentElement;
        const btnRelMaq = document.getElementById('qr-glob-btn-rel-maquina');
        const btnRelCC = document.getElementById('qr-glob-btn-rel-cc');

        document.getElementById('qr-glob-btn-nova-os-texto').textContent = isLider ? 'Abrir Solicitação' : 'Nova Ordem (O.S.)';
        btnRelCC?.classList.toggle('hidden', !isGestor);
        btnRelMaq?.classList.toggle('hidden', isLider);

        if (boxBotoes) {
            boxBotoes.classList.remove('sm:grid-cols-3', 'sm:grid-cols-2');
            if (isLider) {
                // Líder vê exclusivamente a opção Abrir Solicitação
            } else if (isGestor) {
                boxBotoes.classList.add('sm:grid-cols-3');
            } else {
                boxBotoes.classList.add('sm:grid-cols-2');
            }
        }

        const histBox = document.getElementById('qr-glob-historico-os');
        document.getElementById('modal-qr-maquina-global').classList.remove('hidden');
        lucide.createIcons();

        // Líderes não possuem permissão de leitura direta na coleção ordens_servico
        if (isLider) {
            ordensAtivoQRAtual = [];
            document.getElementById('qr-glob-qtd-os').textContent = '';
            histBox.innerHTML = '<p class="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl text-center border border-slate-200">Clique em <strong>Abrir Solicitação</strong> acima para registrar um chamado de manutenção para este equipamento.</p>';
            return;
        }

        histBox.innerHTML = '<p class="text-xs text-slate-400 py-4 text-center">Carregando histórico da máquina...</p>';

        const [osSnap, colSnap] = await Promise.all([
            db.collection('ordens_servico')
                .where('empresaId', '==', usuarioAtual.empresaId)
                .where('ativoId', '==', ativo.id)
                .get(),
            db.collection('kanban_colunas')
                .where('empresaId', '==', usuarioAtual.empresaId)
                .get()
        ]);

        const colunas = colSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        ordensAtivoQRAtual = osSnap.docs
            .map(d => {
                const data = d.data();
                const col = colunas.find(c => c.id === data.colunaId);
                const dataISO = data.dataHoraEncerramento
                    ? data.dataHoraEncerramento.slice(0, 10)
                    : (data.criadoEm?.toDate ? data.criadoEm.toDate().toISOString().slice(0, 10) : '');
                return {
                    id: d.id,
                    ...data,
                    statusTitulo: col ? col.titulo : (data.encerrada ? 'Concluída' : 'Aberta'),
                    dataISO,
                    dataBR: dataISO ? dataISO.split('-').reverse().join('/') : '-'
                };
            })
            .sort((a, b) => (b.numeroOs || 0) - (a.numeroOs || 0));

        document.getElementById('qr-glob-qtd-os').textContent = `${ordensAtivoQRAtual.length} O.S.`;

        if (ordensAtivoQRAtual.length === 0) {
            histBox.innerHTML = '<p class="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl text-center">Nenhuma Ordem de Serviço aplicada nesta máquina ainda.</p>';
        } else {
            histBox.innerHTML = ordensAtivoQRAtual.map(os => `
                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div class="flex items-center justify-between gap-2">
                        <span class="font-extrabold text-slate-900">#OS-${String(os.numeroOs || 0).padStart(4, '0')} • ${escaparHTML(os.tipoNome || 'Manutenção')}</span>
                        <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">${escaparHTML(os.statusTitulo)}</span>
                    </div>
                    <p class="text-slate-700">${escaparHTML(os.servicoRealizado || os.descricao || '-')}</p>
                    <div class="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                        <span>Data: ${escaparHTML(os.dataBR)}</span>
                        <span>Técnico: ${escaparHTML(os.manutentorNome || 'N/I')}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Erro ao abrir prontuário via QR Code:', err);
    }
}

function fecharModalQRMaquinaGlobal() {
    document.getElementById('modal-qr-maquina-global')?.classList.add('hidden');
}

async function acaoQR_NovaOrdemOuChamado() {
    if (!dadosAtivoQRAtual) return;
    const ativoId = dadosAtivoQRAtual.id;
    fecharModalQRMaquinaGlobal();

    if (usuarioAtual.perfil === 'Lideranca') {
        await navegarPara('solicitacoes');
        await abrirModalNovaSolicitacao();
        const selSol = document.getElementById('sol-ativo');
        if (selSol) selSol.value = ativoId;
        return;
    }

    await navegarPara('os');
    await abrirModalNovaOS();
    const selAtivo = document.getElementById('os-ativo');
    if (selAtivo) selAtivo.value = ativoId;
}

function acaoQR_GerarRelatorioMaquina() {
    if (!dadosAtivoQRAtual) return;
    abrirModalQRPeriodoPDF('maquina', `Relatório da Máquina • ${dadosAtivoQRAtual.codigoTag}`);
}

function acaoQR_GerarRelatorioCentroCusto() {
    if (!dadosAtivoQRAtual) return;
    abrirModalQRPeriodoPDF('centro_custo', `Centro de Custo • ${dadosAtivoQRAtual.codigoTag}`);
}

function abrirModalQRPeriodoPDF(tipo, titulo) {
    document.getElementById('qr-pdf-tipo').value = tipo;
    document.getElementById('qr-pdf-modal-titulo').innerHTML = `
        <i data-lucide="file-down" class="w-4 h-4 text-[#00E5B0]"></i>
        <span>${escaparHTML(titulo)}</span>
    `;

    const anoAtual = new Date().getFullYear();
    const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0');
    const selAno = document.getElementById('qr-pdf-ano');
    selAno.innerHTML = '';
    for (let a = anoAtual; a >= anoAtual - 5; a--) {
        selAno.innerHTML += `<option value="${a}">${a}</option>`;
    }
    document.getElementById('qr-pdf-mes').value = mesAtual;

    const radioTotal = document.querySelector('input[name="qr-pdf-modo"][value="total"]');
    if (radioTotal) radioTotal.checked = true;
    alternarPeriodoQRPDF();

    document.getElementById('modal-qr-periodo-pdf').classList.remove('hidden');
    lucide.createIcons();
}

function fecharModalQRPeriodoPDF() {
    document.getElementById('modal-qr-periodo-pdf')?.classList.add('hidden');
}

function alternarPeriodoQRPDF() {
    const modo = document.querySelector('input[name="qr-pdf-modo"]:checked')?.value;
    const box = document.getElementById('box-mes-ano-qr-pdf');
    if (modo === 'mensal') box.classList.remove('hidden');
    else box.classList.add('hidden');
}

async function executarPDFDoQRCode(e) {
    e.preventDefault();
    if (!window.jspdf || !dadosAtivoQRAtual) return;

    const btn = document.getElementById('btn-qr-baixar-pdf');
    btn.disabled = true;

    const tipo = document.getElementById('qr-pdf-tipo').value;
    const modo = document.querySelector('input[name="qr-pdf-modo"]:checked')?.value || 'total';
    const mes = document.getElementById('qr-pdf-mes').value;
    const ano = document.getElementById('qr-pdf-ano').value;

    const nomesMeses = {
        '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
        '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
        '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
    };

    const prefixoFiltro = modo === 'mensal' ? `${ano}-${mes}` : '';
    const labelPeriodo = modo === 'mensal'
        ? `Período: ${nomesMeses[mes]} de ${ano}`
        : 'Período: Total (Histórico Completo)';

    const logoObj = typeof carregarImagemLogoBase64 === 'function'
        ? await carregarImagemLogoBase64('images/cabe.png')
        : null;

    const m = dadosAtivoQRAtual;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    doc.setFillColor(11, 17, 32);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setFillColor(0, 229, 176);
    doc.rect(0, 28, 210, 1.5, 'F');

    if (logoObj) {
        const alturaLogo = 11;
        const larguraLogo = alturaLogo * logoObj.ratio;
        doc.addImage(logoObj.dataUrl, 'PNG', 14, 8.5, larguraLogo, alturaLogo);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(
        tipo === 'centro_custo' ? 'RELATÓRIO INDIVIDUAL DE CENTRO DE CUSTO' : 'HISTÓRICO DE MANUTENÇÃO DA MÁQUINA',
        196, 13, { align: 'right' }
    );

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 229, 176);
    doc.text(labelPeriodo, 196, 20, { align: 'right' });

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 34, 182, 28, 2, 2, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${m.codigoTag} - ${m.nome}`, 18, 41);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Setor: ${m.setor || 'Não informado'}`, 18, 48);
    doc.text(`Fabricante: ${m.fabricante || '-'}`, 85, 48);
    doc.text(`Modelo: ${m.modelo || '-'}`, 145, 48);
    doc.text(`Status Atual: ${m.status || 'Operacional'}`, 18, 55);
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, 145, 55);

    const ordensFiltradas = ordensAtivoQRAtual.filter(os =>
        !prefixoFiltro || (os.dataISO && os.dataISO.startsWith(prefixoFiltro))
    );

    if (tipo === 'centro_custo') {
        const labelAtivo = `${m.codigoTag} - ${m.nome}`;
        const lancamentos = [];

        ordensFiltradas.forEach(os => {
            const itens = Array.isArray(os.itensCusto) ? os.itensCusto : [];
            if (itens.length > 0) {
                itens.forEach(item => {
                    if (!item.centroCusto || item.centroCusto.toLowerCase() === labelAtivo.toLowerCase()) {
                        lancamentos.push([
                            `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`,
                            os.dataBR,
                            item.descricao,
                            Number(item.valor || 0)
                        ]);
                    }
                });
            } else if (Number(os.custoTotal) > 0) {
                lancamentos.push([
                    `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`,
                    os.dataBR,
                    os.servicoRealizado || os.descricao || 'Manutenção',
                    Number(os.custoTotal || 0)
                ]);
            }
        });

        const totalCusto = lancamentos.reduce((acc, l) => acc + l[3], 0);
        const linhasCC = lancamentos.map(l => [
            l[0], l[1], l[2],
            l[3].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ]);

        if (linhasCC.length === 0) {
            linhasCC.push(['-', '-', 'Nenhum custo registrado no período selecionado.', 'R$ 0,00']);
        }

        doc.autoTable({
            startY: 67,
            head: [['Nº O.S.', 'Data', 'Item / Serviço Realizado', 'Valor do Item']],
            body: linhasCC,
            foot: [['', '', 'VALOR TOTAL DO PERÍODO', totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]],
            theme: 'grid',
            headStyles: { fillColor: [11, 17, 32], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
            footStyles: { fillColor: [236, 253, 245], textColor: [4, 120, 87], fontStyle: 'bold', fontSize: 10 },
            styles: { fontSize: 8.5, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 26, fontStyle: 'bold' },
                1: { cellWidth: 26 },
                2: { cellWidth: 'auto' },
                3: { cellWidth: 34, halign: 'right', fontStyle: 'bold' }
            }
        });

        doc.save(`CentroCusto_${m.codigoTag}_${prefixoFiltro || 'Total'}.pdf`);
    } else {
        const linhasMaq = ordensFiltradas.map(os => [
            `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`,
            os.dataBR,
            os.tipoNome || 'Geral',
            os.manutentorNome || '-',
            os.statusTitulo,
            os.servicoRealizado || os.descricao || '-'
        ]);

        if (linhasMaq.length === 0) {
            linhasMaq.push(['-', '-', '-', '-', '-', 'Nenhuma O.S. aplicada nesta máquina no período.']);
        }

        doc.autoTable({
            startY: 67,
            head: [['Nº O.S.', 'Data', 'Tipo', 'Técnico', 'Status', 'Problema / Serviço Realizado']],
            body: linhasMaq,
            foot: [['', '', '', '', 'TOTAL DE O.S.', `${ordensFiltradas.length} O.S.`]],
            theme: 'grid',
            headStyles: { fillColor: [11, 17, 32], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
            footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 9 },
            styles: { fontSize: 8, cellPadding: 2.8 },
            columnStyles: {
                0: { cellWidth: 22, fontStyle: 'bold' },
                1: { cellWidth: 22 },
                2: { cellWidth: 28 },
                3: { cellWidth: 26 },
                4: { cellWidth: 24 },
                5: { cellWidth: 'auto' }
            }
        });

        doc.save(`Relatorio_Maquina_${m.codigoTag}_${prefixoFiltro || 'Total'}.pdf`);
    }

    btn.disabled = false;
    fecharModalQRPeriodoPDF();
}

// ==========================================
// MÓDULO 2: MANUTENTORES E LIDERANÇA
// ==========================================
async function initUsuariosCadastro(perfil) {
    perfilAtualCadastro = perfil;
    await carregarUsuariosPorPerfil(perfil);
    document.getElementById('form-novo-usuario')?.addEventListener('submit', salvarNovoUsuario);
}

function verificarOutraEspecialidade() {
    const select = document.getElementById('user-setor-select');
    const grupoOutro = document.getElementById('grupo-user-setor-outro');
    const inputOutro = document.getElementById('user-setor-outro');
    if (!select || !grupoOutro) return;

    if (select.value === 'Outra') {
        grupoOutro.classList.remove('hidden');
        inputOutro.required = true;
        inputOutro.focus();
    } else {
        grupoOutro.classList.add('hidden');
        inputOutro.required = false;
        inputOutro.value = '';
    }
}

function alternarTodasPermissoesManutentor() {
    const checkboxes = Array.from(document.querySelectorAll('input[name="user-perm-pagina"]'));
    if (checkboxes.length === 0) return;

    const todasMarcadas = checkboxes.every(cb => cb.checked);
    checkboxes.forEach(cb => {
        cb.checked = !todasMarcadas;
    });
}

function obterPermissoesSelecionadasFormulario() {
    const checkboxes = Array.from(document.querySelectorAll('input[name="user-perm-pagina"]:checked'));
    return checkboxes.map(cb => cb.value);
}

function preencherPermissoesFormulario(permissoesSalvas, perfil = 'Manutentor') {
    const checkboxes = Array.from(document.querySelectorAll('input[name="user-perm-pagina"]'));
    if (checkboxes.length === 0) return;

    const padraoPerfil = perfil === 'Lideranca' ? ['solicitacoes'] : ['os', 'solicitacoes'];
    const lista = Array.isArray(permissoesSalvas) && permissoesSalvas.length > 0
        ? permissoesSalvas
        : padraoPerfil;

    checkboxes.forEach(cb => {
        cb.checked = lista.includes(cb.value);
    });
}

async function carregarUsuariosPorPerfil(perfil) {
    const grid = document.getElementById('lista-usuarios-perfil');
    if (!grid) return;

    const snap = await db.collection('usuarios')
        .where('empresaId', '==', usuarioAtual.empresaId)
        .where('perfil', '==', perfil)
        .get();

    cacheUsuariosPerfil = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    if (cacheUsuariosPerfil.length === 0) {
        grid.innerHTML = `<div class="col-span-full bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400">Nenhum registro cadastrado ainda.</div>`;
        return;
    }

    grid.innerHTML = cacheUsuariosPerfil.map(u => {
        const uIdSeguro = escaparHTML(u.id);
        const uNomeSeguro = escaparHTML(u.nome);
        const padraoPerfil = perfil === 'Lideranca' ? ['solicitacoes'] : ['os', 'solicitacoes'];
        const paginasPermitidas = Array.isArray(u.paginasPermitidas) && u.paginasPermitidas.length > 0
            ? u.paginasPermitidas
            : padraoPerfil;

        const badgesPaginas = `
            <div class="flex flex-wrap gap-1 mt-2">
                ${paginasPermitidas.map(p => `
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        ${escaparHTML(ROTULOS_PAGINAS_PERFIL[p] || p)}
                    </span>
                `).join('')}
            </div>`;

        return `
        <div class="osync-card p-4 flex items-start justify-between gap-3">
            <div class="flex items-start gap-3 min-w-0">
                <div class="w-11 h-11 shrink-0 rounded-full bg-[#0B1120] text-[#00E5B0] font-bold flex items-center justify-center text-sm border border-slate-700">
                    ${escaparHTML((u.nome || 'US').substring(0, 2).toUpperCase())}
                </div>
                <div class="min-w-0">
                    <h4 class="font-bold text-slate-900 text-sm truncate">${uNomeSeguro}</h4>
                    <p class="text-xs text-slate-500 truncate">${escaparHTML(u.email)}</p>
                    <span class="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        <i data-lucide="wrench" class="w-3 h-3"></i> ${escaparHTML(u.setor || 'Geral')}
                    </span>
                    ${badgesPaginas}
                </div>
            </div>

            <div class="flex items-center gap-1 shrink-0">
                <button onclick="abrirModalEditarUsuario('${uIdSeguro}')" title="Editar" class="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button data-nome="${uNomeSeguro}" onclick="excluirUsuarioPerfil('${uIdSeguro}', this.getAttribute('data-nome'))" title="Excluir" class="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>`;
    }).join('');

    lucide.createIcons();
}

function abrirModalNovoUsuario(perfil) {
    const form = document.getElementById('form-novo-usuario');
    if (form) form.reset();

    document.getElementById('user-edit-id').value = '';
    document.getElementById('user-perfil-alvo').value = perfil;
    document.getElementById('modal-usuario-titulo').textContent = perfil === 'Manutentor' ? 'Cadastrar Manutentor' : 'Cadastrar Líder de Setor';
    document.getElementById('btn-salvar-usuario').textContent = 'Criar Acesso';

    document.getElementById('grupo-user-email')?.classList.remove('hidden');
    document.getElementById('grupo-user-senha')?.classList.remove('hidden');
    if (document.getElementById('user-email')) document.getElementById('user-email').required = true;
    if (document.getElementById('user-senha')) document.getElementById('user-senha').required = true;

    const padraoPerfil = perfil === 'Lideranca' ? ['solicitacoes'] : ['os', 'solicitacoes'];
    preencherPermissoesFormulario(padraoPerfil, perfil);
    verificarOutraEspecialidade();
    document.getElementById('modal-novo-usuario')?.classList.remove('hidden');
    lucide.createIcons();
}

function abrirModalEditarUsuario(userId) {
    const u = cacheUsuariosPerfil.find(item => item.id === userId);
    if (!u) return;

    document.getElementById('user-edit-id').value = u.id;
    document.getElementById('user-perfil-alvo').value = u.perfil;
    document.getElementById('user-nome').value = u.nome;
    document.getElementById('modal-usuario-titulo').textContent = 'Editar Cadastro';
    document.getElementById('btn-salvar-usuario').textContent = 'Salvar Alterações';

    document.getElementById('grupo-user-email')?.classList.add('hidden');
    document.getElementById('grupo-user-senha')?.classList.add('hidden');
    if (document.getElementById('user-email')) document.getElementById('user-email').required = false;
    if (document.getElementById('user-senha')) document.getElementById('user-senha').required = false;

    const select = document.getElementById('user-setor-select');
    const inputOutro = document.getElementById('user-setor-outro');

    if (select) {
        const opcoesPadrao = ['Mecânica', 'Elétrica', 'Predial'];
        if (opcoesPadrao.includes(u.setor)) {
            select.value = u.setor;
            verificarOutraEspecialidade();
        } else {
            select.value = 'Outra';
            verificarOutraEspecialidade();
            if (inputOutro) inputOutro.value = u.setor || '';
        }
    } else if (document.getElementById('user-setor')) {
        document.getElementById('user-setor').value = u.setor || '';
    }

    preencherPermissoesFormulario(u.paginasPermitidas, u.perfil);
    document.getElementById('modal-novo-usuario')?.classList.remove('hidden');
    lucide.createIcons();
}

function fecharModalNovoUsuario() {
    document.getElementById('modal-novo-usuario')?.classList.add('hidden');
}

async function salvarNovoUsuario(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-usuario');
    btn.disabled = true;

    const editId = document.getElementById('user-edit-id').value;
    const nome = document.getElementById('user-nome').value.trim();
    const perfil = document.getElementById('user-perfil-alvo').value;

    const paginasPermitidas = obterPermissoesSelecionadasFormulario();
    if (paginasPermitidas.length === 0) {
        alert('Selecione ao menos uma tela que o usuário terá acesso.');
        btn.disabled = false;
        return;
    }

    let setor = '';
    const selectSetor = document.getElementById('user-setor-select');
    if (selectSetor) {
        setor = selectSetor.value === 'Outra'
            ? document.getElementById('user-setor-outro').value.trim()
            : selectSetor.value;
    } else {
        setor = document.getElementById('user-setor').value.trim();
    }

    if (editId) {
        btn.textContent = 'Salvando...';
        try {
            await db.collection('usuarios').doc(editId).update({
                nome,
                setor,
                paginasPermitidas
            });
            fecharModalNovoUsuario();
            carregarUsuariosPorPerfil(perfil);
            if (typeof mostrarNotificacaoOSync === 'function') {
                mostrarNotificacaoOSync('Cadastro e permissões atualizados!', 'sucesso');
            }
        } catch (err) {
            alert('Erro ao atualizar: ' + err.message);
        }
        btn.disabled = false;
        return;
    }

    btn.textContent = 'Criando...';
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-senha').value;

    const appSecundario = firebase.apps.find(a => a.name === 'SecondaryApp') || firebase.initializeApp(firebaseConfig, 'SecondaryApp');

    try {
        const cred = await appSecundario.auth().createUserWithEmailAndPassword(email, password);
        await appSecundario.auth().signOut();

        await db.collection('usuarios').doc(cred.user.uid).set({
            empresaId: usuarioAtual.empresaId,
            nome,
            email,
            perfil,
            setor,
            paginasPermitidas,
            ativo: true,
            statusAcesso: 'aprovado',
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        fecharModalNovoUsuario();
        e.target.reset();
        carregarUsuariosPorPerfil(perfil);
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Cadastro criado com as permissões selecionadas!', 'sucesso');
        }
    } catch (err) {
        alert('Erro ao criar acesso: ' + err.message);
    }

    btn.disabled = false;
    btn.textContent = 'Criar Acesso';
}

async function excluirUsuarioPerfil(userId, nome) {
    if (!await confirmarAcaoOSync(`Deseja realmente excluir <strong>"${escaparHTML(nome)}"</strong> da equipe?`, { titulo: 'Remover Colaborador', textoConfirmar: 'Excluir' })) return;
    try {
        await db.collection('usuarios').doc(userId).delete();
        carregarUsuariosPorPerfil(perfilAtualCadastro);
    } catch (err) {
        alert('Erro ao excluir: ' + err.message);
    }
}
