let cacheCentrosCustoDetalhado = [];

async function initCentrosCusto() {
    await carregarDadosCentrosCusto();
}

async function carregarDadosCentrosCusto() {
    const grid = document.getElementById('lista-centros-custo-cards');
    if (!grid) return;

    grid.innerHTML = OSyncUtils.gerarSkeletonCards(6);

    const [ativosSnap, osSnap] = await Promise.all([
        db.collection('ativos').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('ordens_servico').where('empresaId', '==', usuarioAtual.empresaId).get()
    ]);

    const ativos = ativosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const ordens = osSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let totalGeralFabrica = 0;
    let totalOSComCusto = 0;

    cacheCentrosCustoDetalhado = ativos.map(ativo => {
        const labelAtivo = `${ativo.codigoTag} - ${ativo.nome}`;
        const lancamentos = [];
        const osVinculadasSet = new Set();

        ordens.forEach(os => {
            const itens = Array.isArray(os.itensCusto) ? os.itensCusto : [];
            const dataBase = OSyncUtils.extrairDataISO(os);

            if (itens.length > 0) {
                itens.forEach(item => {
                    const pertenceAEstaMaquina =
                        (item.centroCusto && item.centroCusto.trim().toLowerCase() === labelAtivo.toLowerCase()) ||
                        (!item.centroCusto && os.ativoId === ativo.id);

                    if (pertenceAEstaMaquina) {
                        lancamentos.push({
                            osId: os.id,
                            numeroOs: os.numeroOs || 0,
                            dataISO: dataBase,
                            dataFormatada: OSyncUtils.formatarDataBR(dataBase),
                            descricao: item.descricao,
                            tipoCusto: item.tipoCusto || os.tipoNome || 'Manutenção',
                            valor: Number(item.valor) || 0
                        });
                        osVinculadasSet.add(os.id);
                    }
                });
            } else if (os.ativoId === ativo.id && Number(os.custoTotal) > 0) {
                lancamentos.push({
                    osId: os.id,
                    numeroOs: os.numeroOs || 0,
                    dataISO: dataBase,
                    dataFormatada: OSyncUtils.formatarDataBR(dataBase),
                    descricao: os.servicoRealizado || os.descricao || 'Manutenção registrada',
                    tipoCusto: os.tipoNome || 'Manutenção',
                    valor: Number(os.custoTotal) || 0
                });
                osVinculadasSet.add(os.id);
            }
        });

        lancamentos.sort((a, b) => (b.numeroOs || 0) - (a.numeroOs || 0));
        const custoAcumulado = lancamentos.reduce((acc, item) => acc + item.valor, 0);

        totalGeralFabrica += custoAcumulado;
        totalOSComCusto += osVinculadasSet.size;

        return {
            ...ativo,
            labelAtivo,
            custoAcumulado,
            qtdOS: osVinculadasSet.size,
            lancamentos
        };
    }).sort((a, b) => b.custoAcumulado - a.custoAcumulado);

    document.getElementById('cc-kpi-qtd-maquinas').textContent = cacheCentrosCustoDetalhado.length;
    document.getElementById('cc-kpi-qtd-os').textContent = totalOSComCusto;
    document.getElementById('cc-kpi-custo-total').textContent = OSyncUtils.formatarMoedaBR(totalGeralFabrica);

    renderizarCardsCentrosCusto(cacheCentrosCustoDetalhado);
}

function renderizarCardsCentrosCusto(lista) {
    const grid = document.getElementById('lista-centros-custo-cards');
    if (!grid) return;

    if (lista.length === 0) {
        grid.innerHTML = `<div class="col-span-full bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400">Nenhuma máquina cadastrada como centro de custo.</div>`;
        return;
    }

    grid.innerHTML = lista.map(cc => `
        <div class="osync-card p-5 flex flex-col justify-between gap-4 hover:shadow-md transition">
            <div>
                <div class="flex items-center justify-between gap-2 mb-1">
                    <span class="text-xs font-extrabold px-2.5 py-0.5 rounded bg-slate-900 text-[#00E5B0]">${escaparHTML(cc.codigoTag)}</span>
                    <span class="text-xs font-semibold text-slate-400">${escaparHTML(cc.setor || 'Geral')}</span>
                </div>
                <h3 class="font-bold text-slate-900 text-base mt-1.5">${escaparHTML(cc.nome)}</h3>
                <p class="text-xs text-slate-500 mt-0.5">${escaparHTML(cc.fabricante || '')} ${cc.modelo ? '• ' + escaparHTML(cc.modelo) : ''}</p>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-end justify-between">
                <div>
                    <span class="text-[11px] font-semibold text-slate-400 block">Custo Acumulado (${cc.qtdOS} O.S.)</span>
                    <span class="text-lg font-extrabold ${cc.custoAcumulado > 0 ? 'text-emerald-700' : 'text-slate-600'}">
                        ${OSyncUtils.formatarMoedaBR(cc.custoAcumulado)}
                    </span>
                </div>
                <button onclick="abrirDetalheCentroCusto('${escaparHTML(cc.id)}')" class="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-bold transition flex items-center gap-1.5">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    <span>Detalhes</span>
                </button>
            </div>
        </div>
    `).join('');

    lucide.createIcons();
}

function filtrarCentrosCusto() {
    const termo = (document.getElementById('busca-centros-custo')?.value || '').toLowerCase();
    const filtrados = cacheCentrosCustoDetalhado.filter(c =>
        `${c.codigoTag} ${c.nome} ${c.setor || ''}`.toLowerCase().includes(termo)
    );
    renderizarCardsCentrosCusto(filtrados);
}

function abrirDetalheCentroCusto(ativoId) {
    const cc = cacheCentrosCustoDetalhado.find(c => c.id === ativoId);
    if (!cc) return;

    document.getElementById('det-cc-tag').textContent = cc.codigoTag;
    document.getElementById('det-cc-nome').textContent = cc.nome;
    document.getElementById('det-cc-setor').textContent = cc.setor || 'Não informado';
    document.getElementById('det-cc-fabricante').textContent = cc.fabricante || '-';
    document.getElementById('det-cc-modelo').textContent = cc.modelo || '-';
    document.getElementById('det-cc-status').textContent = cc.status || 'Operacional';
    document.getElementById('det-cc-total').textContent = OSyncUtils.formatarMoedaBR(cc.custoAcumulado);

    const btnPdf = document.getElementById('btn-pdf-individual-cc');
    btnPdf.onclick = () => abrirModalFiltroPDF('individual', cc.id);

    const histContainer = document.getElementById('det-cc-historico-itens');
    if (cc.lancamentos.length === 0) {
        histContainer.innerHTML = `<p class="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl text-center">Nenhum custo lançado para esta máquina até o momento.</p>`;
    } else {
        histContainer.innerHTML = cc.lancamentos.map(item => `
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                <div class="min-w-0">
                    <div class="font-bold text-slate-900">
                        #OS-${String(item.numeroOs).padStart(4, '0')} • ${escaparHTML(item.descricao)}
                    </div>
                    <span class="text-[11px] text-slate-500">Data: ${escaparHTML(item.dataFormatada)} • ${escaparHTML(item.tipoCusto)}</span>
                </div>
                <span class="font-extrabold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
                    ${OSyncUtils.formatarMoedaBR(item.valor)}
                </span>
            </div>
        `).join('');
    }

    document.getElementById('modal-detalhe-cc').classList.remove('hidden');
    lucide.createIcons();
}

function fecharModalDetalheCC() {
    document.getElementById('modal-detalhe-cc').classList.add('hidden');
}

// ==========================================
// MODAL DE FILTRO DE PERÍODO PARA O PDF
// ==========================================
function abrirModalFiltroPDF(tipo, ativoId = '') {
    document.getElementById('pdf-tipo-relatorio').value = tipo;
    document.getElementById('pdf-ativo-id').value = ativoId;

    const cc = ativoId ? cacheCentrosCustoDetalhado.find(c => c.id === ativoId) : null;
    document.getElementById('titulo-modal-filtro-pdf').innerHTML = tipo === 'individual' && cc
        ? `<i data-lucide="file-text" class="w-4 h-4 text-[#00E5B0]"></i><span>PDF Individual • ${escaparHTML(cc.codigoTag)}</span>`
        : `<i data-lucide="file-text" class="w-4 h-4 text-[#00E5B0]"></i><span>PDF Geral • Centros de Custo</span>`;

    const anoAtual = new Date().getFullYear();
    const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0');
    const selAno = document.getElementById('pdf-filtro-ano');
    selAno.innerHTML = '';
    for (let a = anoAtual; a >= anoAtual - 5; a--) {
        selAno.innerHTML += `<option value="${a}">${a}</option>`;
    }
    document.getElementById('pdf-filtro-mes').value = mesAtual;

    const radioTotal = document.querySelector('input[name="pdf-modo-periodo"][value="total"]');
    if (radioTotal) radioTotal.checked = true;
    alternarCamposPeriodoPDF();

    document.getElementById('modal-filtro-pdf-cc').classList.remove('hidden');
    lucide.createIcons();
}

function fecharModalFiltroPDF() {
    document.getElementById('modal-filtro-pdf-cc').classList.add('hidden');
}

function alternarCamposPeriodoPDF() {
    const modo = document.querySelector('input[name="pdf-modo-periodo"]:checked')?.value;
    const boxMesAno = document.getElementById('box-selecao-mes-ano');
    if (modo === 'mensal') {
        boxMesAno.classList.remove('hidden');
    } else {
        boxMesAno.classList.add('hidden');
    }
}

async function executarGeracaoPDF(e) {
    e.preventDefault();
    if (!window.jspdf) {
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Biblioteca de PDF ainda carregando. Aguarde 2 segundos.', 'aviso');
        }
        return;
    }

    const btn = document.getElementById('btn-confirmar-pdf');
    btn.disabled = true;

    const tipo = document.getElementById('pdf-tipo-relatorio').value;
    const ativoId = document.getElementById('pdf-ativo-id').value;
    const modo = document.querySelector('input[name="pdf-modo-periodo"]:checked')?.value || 'total';
    const mes = document.getElementById('pdf-filtro-mes').value;
    const ano = document.getElementById('pdf-filtro-ano').value;

    const nomesMeses = {
        '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
        '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
        '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
    };

    const prefixoFiltro = modo === 'mensal' ? `${ano}-${mes}` : '';
    const labelPeriodo = modo === 'mensal'
        ? `Período: ${nomesMeses[mes]} de ${ano}`
        : 'Período: Total (Histórico Completo)';

    const logoObj = await OSyncUtils.carregarImagemLogoBase64('images/cabe.png');

    if (tipo === 'individual') {
        await gerarPDFIndividualCentroCusto(ativoId, prefixoFiltro, labelPeriodo, logoObj);
    } else {
        await gerarPDFGeralCentrosCusto(prefixoFiltro, labelPeriodo, logoObj);
    }

    btn.disabled = false;
    fecharModalFiltroPDF();
}

// ==========================================
// PDF 1: RELATÓRIO INDIVIDUAL DO ATIVO
// ==========================================
async function gerarPDFIndividualCentroCusto(ativoId, prefixoFiltro, labelPeriodo, logoObj) {
    const cc = cacheCentrosCustoDetalhado.find(c => c.id === ativoId);
    if (!cc) return;

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
    doc.text('RELATÓRIO INDIVIDUAL DE CENTRO DE CUSTO', 196, 13, { align: 'right' });

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
    doc.text(`${cc.codigoTag} - ${cc.nome}`, 18, 41);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Setor: ${cc.setor || 'Não informado'}`, 18, 48);
    doc.text(`Fabricante: ${cc.fabricante || '-'}`, 85, 48);
    doc.text(`Modelo: ${cc.modelo || '-'}`, 145, 48);
    doc.text(`Status Atual: ${cc.status || 'Operacional'}`, 18, 55);
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, 145, 55);

    const itensFiltrados = cc.lancamentos.filter(item =>
        !prefixoFiltro || (item.dataISO && item.dataISO.startsWith(prefixoFiltro))
    );

    const valorTotal = itensFiltrados.reduce((acc, i) => acc + i.valor, 0);

    const linhasTabela = itensFiltrados.map(item => [
        `#OS-${String(item.numeroOs).padStart(4, '0')}`,
        item.dataFormatada,
        item.descricao,
        OSyncUtils.formatarMoedaBR(item.valor)
    ]);

    if (linhasTabela.length === 0) {
        linhasTabela.push(['-', '-', 'Nenhum custo registrado no período selecionado.', 'R$ 0,00']);
    }

    doc.autoTable({
        startY: 67,
        head: [['Nº O.S.', 'Data', 'Item / Serviço Realizado', 'Valor do Item']],
        body: linhasTabela,
        foot: [['', '', 'VALOR TOTAL DO PERÍODO', OSyncUtils.formatarMoedaBR(valorTotal)]],
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

    const sufixoArquivo = prefixoFiltro || 'Total';
    doc.save(`CentroCusto_${cc.codigoTag}_${sufixoArquivo}.pdf`);
}

// ==========================================
// PDF 2: RELATÓRIO GERAL DE CENTROS DE CUSTO
// ==========================================
async function gerarPDFGeralCentrosCusto(prefixoFiltro, labelPeriodo, logoObj) {
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
    doc.text('RELATÓRIO GERAL DE CENTROS DE CUSTO', 196, 13, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 229, 176);
    doc.text(labelPeriodo, 196, 20, { align: 'right' });

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(9);
    doc.text(`Ativos com geração de custo no período • Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 14, 36);

    const maquinasComCusto = cacheCentrosCustoDetalhado.map(cc => {
        const itensPeriodo = cc.lancamentos.filter(item =>
            !prefixoFiltro || (item.dataISO && item.dataISO.startsWith(prefixoFiltro))
        );
        const totalMaquina = itensPeriodo.reduce((acc, i) => acc + i.valor, 0);
        const qtdOS = new Set(itensPeriodo.map(i => i.osId)).size;
        return {
            tag: cc.codigoTag,
            nome: cc.nome,
            setor: cc.setor || 'Geral',
            qtdOS,
            totalMaquina
        };
    }).filter(m => m.totalMaquina > 0)
      .sort((a, b) => b.totalMaquina - a.totalMaquina);

    const totalGeral = maquinasComCusto.reduce((acc, m) => acc + m.totalMaquina, 0);

    const linhasTabela = maquinasComCusto.map(m => [
        m.tag,
        m.nome,
        m.setor,
        String(m.qtdOS),
        OSyncUtils.formatarMoedaBR(m.totalMaquina)
    ]);

    if (linhasTabela.length === 0) {
        linhasTabela.push(['-', 'Nenhuma máquina gerou custo no período selecionado.', '-', '0', 'R$ 0,00']);
    }

    doc.autoTable({
        startY: 41,
        head: [['TAG', 'Máquina / Equipamento', 'Setor', 'Qtd. O.S.', 'Custo Total']],
        body: linhasTabela,
        foot: [['', '', '', 'TOTAL GERAL', OSyncUtils.formatarMoedaBR(totalGeral)]],
        theme: 'grid',
        headStyles: { fillColor: [11, 17, 32], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        footStyles: { fillColor: [236, 253, 245], textColor: [4, 120, 87], fontStyle: 'bold', fontSize: 10 },
        styles: { fontSize: 8.5, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 24, fontStyle: 'bold' },
            1: { cellWidth: 'auto', fontStyle: 'bold' },
            2: { cellWidth: 32 },
            3: { cellWidth: 20, halign: 'center' },
            4: { cellWidth: 34, halign: 'right', fontStyle: 'bold' }
        }
    });

    const sufixoArquivo = prefixoFiltro || 'Total';
    doc.save(`Relatorio_Geral_CentrosCusto_${sufixoArquivo}.pdf`);
}
