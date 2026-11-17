let cacheRelatorioMaquinas = [];

function calcularMinutosParadaMaq(os) {
    if (Number(os.tempoParadaMinutos) > 0) return Number(os.tempoParadaMinutos);
    if (os.inicioParada && os.terminoParada) {
        const d1 = new Date(os.inicioParada);
        const d2 = new Date(os.terminoParada);
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d2 >= d1) {
            return Math.round((d2.getTime() - d1.getTime()) / 60000);
        }
    }
    return 0;
}

function formatarHorasParadasMaq(minutos) {
    const mins = Math.max(0, Math.round(Number(minutos) || 0));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
}

async function initRelatoriosMaquinas() {
    const grid = document.getElementById('lista-relatorios-maquinas');
    if (grid) {
        grid.innerHTML = '<div class="col-span-full text-center py-8 text-slate-400 text-sm">Carregando histórico das máquinas...</div>';
    }

    const [ativosSnap, osSnap, colSnap] = await Promise.all([
        db.collection('ativos').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('ordens_servico').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('kanban_colunas').where('empresaId', '==', usuarioAtual.empresaId).get()
    ]);

    const colunas = colSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const ordens = osSnap.docs.map(d => {
        const data = d.data();
        const col = colunas.find(c => c.id === data.colunaId);
        const dataISO = extrairDataISO_Maq(data);
        const minutosParada = calcularMinutosParadaMaq(data);
        return {
            id: d.id,
            ...data,
            statusTitulo: col ? col.titulo : (data.encerrada ? 'Concluída' : 'Aberta'),
            dataISO,
            dataBR: formatarDataBR_Maq(dataISO),
            minutosParada,
            paradaLabel: minutosParada > 0 ? formatarHorasParadasMaq(minutosParada) : (data.maquinaParada || data.condicaoMaquina === 'Maquina parada' ? 'Em aberto' : '-')
        };
    });

    let totalOSGeral = 0;

    cacheRelatorioMaquinas = ativosSnap.docs
        .map(d => {
            const ativo = { id: d.id, ...d.data() };
            const ordensMaquina = ordens
                .filter(o => o.ativoId === ativo.id)
                .sort((a, b) => (b.numeroOs || 0) - (a.numeroOs || 0));

            totalOSGeral += ordensMaquina.length;
            const totalMinutosParada = ordensMaquina.reduce((acc, o) => acc + (Number(o.minutosParada) || 0), 0);

            return {
                ...ativo,
                ordens: ordensMaquina,
                qtdOS: ordensMaquina.length,
                totalMinutosParada
            };
        })
        .sort((a, b) => (a.codigoTag || '').localeCompare(b.codigoTag || ''));

    const operacionais = cacheRelatorioMaquinas.filter(m => m.status === 'Operacional').length;

    document.getElementById('rel-maq-kpi-total').textContent = cacheRelatorioMaquinas.length;
    document.getElementById('rel-maq-kpi-os').textContent = totalOSGeral;
    document.getElementById('rel-maq-kpi-operacionais').textContent = operacionais;

    filtrarRelatorioMaquinas();
}

function extrairDataISO_Maq(os) {
    if (os.dataHoraEncerramento) return os.dataHoraEncerramento.slice(0, 10);
    if (os.criadoEm?.toDate) return os.criadoEm.toDate().toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
}

function formatarDataBR_Maq(iso) {
    if (!iso || iso.length < 10) return '-';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
}

function filtrarRelatorioMaquinas() {
    const busca = (document.getElementById('rel-maq-busca')?.value || '').toLowerCase();
    const status = document.getElementById('rel-maq-status')?.value || '';

    const filtradas = cacheRelatorioMaquinas.filter(m => {
        if (status && m.status !== status) return false;
        if (busca) {
            const texto = `${m.codigoTag} ${m.nome} ${m.fabricante || ''} ${m.modelo || ''} ${m.setor || ''}`.toLowerCase();
            if (!texto.includes(busca)) return false;
        }
        return true;
    });

    renderizarCardsRelatorioMaquinas(filtradas);
}

function renderizarCardsRelatorioMaquinas(lista) {
    const grid = document.getElementById('lista-relatorios-maquinas');
    if (!grid) return;

    if (lista.length === 0) {
        grid.innerHTML = `<div class="col-span-full bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400">Nenhuma máquina encontrada.</div>`;
        return;
    }

    const badgeStatus = {
        'Operacional': 'bg-emerald-100 text-emerald-700',
        'Manutencao': 'bg-amber-100 text-amber-700',
        'Parada': 'bg-rose-100 text-rose-700'
    };

    grid.innerHTML = lista.map(m => `
        <div class="osync-card p-5 flex flex-col justify-between gap-4 hover:shadow-md transition">
            <div>
                <div class="flex items-center justify-between gap-2 mb-1">
                    <span class="text-xs font-extrabold px-2.5 py-0.5 rounded bg-slate-900 text-[#00E5B0]">${m.codigoTag}</span>
                    <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badgeStatus[m.status] || 'bg-slate-100 text-slate-700'}">
                        ${m.status || 'Operacional'}
                    </span>
                </div>
                <h3 class="font-bold text-slate-900 text-base mt-1.5">${m.nome}</h3>
                <p class="text-xs text-slate-500 mt-0.5">${m.setor || 'Geral'} • ${m.fabricante || 'Fab. N/I'}</p>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div>
                    <span class="text-[11px] font-semibold text-slate-400 block">O.S. • Horas Paradas</span>
                    <span class="text-sm font-extrabold text-slate-900">${m.qtdOS} O.S. <span class="text-rose-600">(${formatarHorasParadasMaq(m.totalMinutosParada)})</span></span>
                </div>
                <div class="flex items-center gap-1.5">
                    <button onclick="abrirModalHistoricoMaquina('${m.id}')" class="px-3 py-2 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-bold transition flex items-center gap-1">
                        <i data-lucide="list" class="w-3.5 h-3.5"></i>
                        <span>Histórico</span>
                    </button>
                    <button onclick="abrirModalFiltroPDF_Maquina('${m.id}')" title="Gerar PDF da Máquina" class="p-2 rounded-lg bg-[#0B1120] hover:bg-slate-800 text-[#00E5B0] transition">
                        <i data-lucide="file-down" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    lucide.createIcons();
}

function abrirModalHistoricoMaquina(ativoId) {
    const m = cacheRelatorioMaquinas.find(item => item.id === ativoId);
    if (!m) return;

    document.getElementById('det-rel-maq-tag').textContent = m.codigoTag;
    document.getElementById('det-rel-maq-nome').textContent = m.nome;
    document.getElementById('det-rel-maq-setor').textContent = m.setor || 'Não informado';
    document.getElementById('det-rel-maq-fab').textContent = m.fabricante || '-';
    document.getElementById('det-rel-maq-mod').textContent = m.modelo || '-';
    document.getElementById('det-rel-maq-status').textContent = m.status || 'Operacional';
    document.getElementById('det-rel-maq-qtd-os').textContent = `${m.qtdOS} O.S. • Parada: ${formatarHorasParadasMaq(m.totalMinutosParada)}`;

    document.getElementById('btn-abrir-pdf-maquina').onclick = () => abrirModalFiltroPDF_Maquina(m.id);

    const listaContainer = document.getElementById('det-rel-maq-lista-os');
    if (m.ordens.length === 0) {
        listaContainer.innerHTML = `<p class="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl text-center">Nenhuma Ordem de Serviço registrada para este equipamento.</p>`;
    } else {
        listaContainer.innerHTML = m.ordens.map(os => `
            <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                    <span class="font-extrabold text-slate-900">#OS-${String(os.numeroOs || 0).padStart(4, '0')} • ${os.tipoNome || 'Manutenção'}</span>
                    <div class="flex items-center gap-1.5">
                        ${os.minutosParada > 0 ? `<span class="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">Parada: ${os.paradaLabel}</span>` : ''}
                        <span class="font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">${os.statusTitulo}</span>
                    </div>
                </div>
                <p class="text-slate-700"><strong>Problema:</strong> ${os.descricao || '-'}</p>
                ${os.servicoRealizado ? `<p class="text-emerald-800 bg-emerald-50/70 p-2 rounded border border-emerald-100"><strong>Serviço Executado:</strong> ${os.servicoRealizado}</p>` : ''}
                <div class="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Data: ${os.dataBR}</span>
                    <span>Técnico: ${os.manutentorNome || 'N/I'}</span>
                </div>
            </div>
        `).join('');
    }

    document.getElementById('modal-historico-maquina-rel').classList.remove('hidden');
    lucide.createIcons();
}

function fecharModalHistoricoMaquina() {
    document.getElementById('modal-historico-maquina-rel').classList.add('hidden');
}

// ==========================================
// MODAL E GERAÇÃO DO PDF INDIVIDUAL DA MÁQUINA
// ==========================================
function abrirModalFiltroPDF_Maquina(ativoId) {
    const m = cacheRelatorioMaquinas.find(item => item.id === ativoId);
    if (!m) return;

    document.getElementById('pdf-maq-ativo-id').value = ativoId;
    document.getElementById('titulo-modal-pdf-maq').innerHTML = `
        <i data-lucide="file-text" class="w-4 h-4 text-[#00E5B0]"></i>
        <span>PDF Máquina • ${m.codigoTag}</span>
    `;

    const anoAtual = new Date().getFullYear();
    const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0');
    const selAno = document.getElementById('pdf-maq-ano');
    selAno.innerHTML = '';
    for (let a = anoAtual; a >= anoAtual - 5; a--) {
        selAno.innerHTML += `<option value="${a}">${a}</option>`;
    }
    document.getElementById('pdf-maq-mes').value = mesAtual;

    const radioTotal = document.querySelector('input[name="pdf-maq-modo"][value="total"]');
    if (radioTotal) radioTotal.checked = true;
    alternarPeriodoPDF_Maquina();

    document.getElementById('modal-filtro-pdf-maquina').classList.remove('hidden');
    lucide.createIcons();
}

function fecharModalFiltroPDF_Maquina() {
    document.getElementById('modal-filtro-pdf-maquina').classList.add('hidden');
}

function alternarPeriodoPDF_Maquina() {
    const modo = document.querySelector('input[name="pdf-maq-modo"]:checked')?.value;
    const box = document.getElementById('box-mes-ano-pdf-maq');
    if (modo === 'mensal') box.classList.remove('hidden');
    else box.classList.add('hidden');
}

async function gerarPDFIndividualMaquina(e) {
    e.preventDefault();
    if (!window.jspdf) {
        alert('Biblioteca de PDF carregando. Aguarde instantes e tente novamente.');
        return;
    }

    const btn = document.getElementById('btn-baixar-pdf-maq');
    btn.disabled = true;

    const ativoId = document.getElementById('pdf-maq-ativo-id').value;
    const m = cacheRelatorioMaquinas.find(item => item.id === ativoId);
    if (!m) {
        btn.disabled = false;
        return;
    }

    const modo = document.querySelector('input[name="pdf-maq-modo"]:checked')?.value || 'total';
    const mes = document.getElementById('pdf-maq-mes').value;
    const ano = document.getElementById('pdf-maq-ano').value;

    const nomesMeses = {
        '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
        '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
        '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
    };

    const prefixoFiltro = modo === 'mensal' ? `${ano}-${mes}` : '';
    const labelPeriodo = modo === 'mensal'
        ? `Período: ${nomesMeses[mes]} de ${ano}`
        : 'Período: Total (Histórico Completo)';

    const ordensFiltradas = m.ordens.filter(os =>
        !prefixoFiltro || (os.dataISO && os.dataISO.startsWith(prefixoFiltro))
    );

    const minutosParadaTotal = ordensFiltradas.reduce((acc, o) => acc + (Number(o.minutosParada) || 0), 0);

    const logoObj = typeof carregarImagemLogoBase64 === 'function'
        ? await carregarImagemLogoBase64('images/cabe.png')
        : null;

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
    doc.text('HISTÓRICO DE MANUTENÇÃO DA MÁQUINA', 196, 13, { align: 'right' });

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
    doc.text(`Total Horas Paradas: ${formatarHorasParadasMaq(minutosParadaTotal)}`, 85, 55);
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, 145, 55);

    const linhas = ordensFiltradas.map(os => [
        `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`,
        os.dataBR,
        os.tipoNome || 'Geral',
        os.manutentorNome || '-',
        os.paradaLabel,
        os.statusTitulo,
        os.servicoRealizado || os.descricao || '-'
    ]);

    if (linhas.length === 0) {
        linhas.push(['-', '-', '-', '-', '-', '-', 'Nenhuma O.S. aplicada nesta máquina no período.']);
    }

    doc.autoTable({
        startY: 67,
        head: [['Nº O.S.', 'Data', 'Tipo', 'Técnico', 'Parada', 'Status', 'Problema / Serviço Realizado']],
        body: linhas,
        foot: [['', '', '', 'TOTAL PARADO:', formatarHorasParadasMaq(minutosParadaTotal), 'TOTAL O.S.:', `${ordensFiltradas.length} O.S.`]],
        theme: 'grid',
        headStyles: { fillColor: [11, 17, 32], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8.5 },
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        columnStyles: {
            0: { cellWidth: 20, fontStyle: 'bold' },
            1: { cellWidth: 20 },
            2: { cellWidth: 25 },
            3: { cellWidth: 24 },
            4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
            5: { cellWidth: 22 },
            6: { cellWidth: 'auto' }
        }
    });

    const sufixo = prefixoFiltro || 'Total';
    doc.save(`Relatorio_Maquina_${m.codigoTag}_${sufixo}.pdf`);

    btn.disabled = false;
    fecharModalFiltroPDF_Maquina();
}