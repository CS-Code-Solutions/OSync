let cacheRelatorioOS = [];
let cacheColunasRelOS = [];

async function initRelatoriosOS() {
    const tbody = document.getElementById('tabela-relatorios-os');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-slate-400">Carregando ordens de serviço...</td></tr>';
    }

    const [osSnap, colSnap, tiposSnap, manutSnap] = await Promise.all([
        db.collection('ordens_servico').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('kanban_colunas').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('tipos_manutencao').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('usuarios').where('empresaId', '==', usuarioAtual.empresaId).where('perfil', '==', 'Manutentor').get()
    ]);

    cacheColunasRelOS = colSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    cacheRelatorioOS = osSnap.docs
        .map(d => {
            const data = d.data();
            const col = cacheColunasRelOS.find(c => c.id === data.colunaId);
            const dataISO = extrairDataISO_OS(data);
            return {
                id: d.id,
                ...data,
                statusTitulo: col ? col.titulo : (data.encerrada ? 'Concluída' : 'Aberta'),
                statusCor: col ? col.corTopo : '#00E5B0',
                dataISO,
                dataBR: formatarDataBR_OS(dataISO)
            };
        })
        .sort((a, b) => (b.numeroOs || 0) - (a.numeroOs || 0));

    // Preenche filtros
    const selStatus = document.getElementById('rel-os-status');
    if (selStatus) {
        selStatus.innerHTML = '<option value="">Todos Status</option>' +
            cacheColunasRelOS.map(c => `<option value="${c.id}">${c.titulo}</option>`).join('');
    }

    const selTipo = document.getElementById('rel-os-tipo');
    if (selTipo) {
        const tipos = tiposSnap.docs.map(d => d.data().nome).sort();
        selTipo.innerHTML = '<option value="">Todos Tipos</option>' +
            tipos.map(t => `<option value="${t}">${t}</option>`).join('');
    }

    const selManut = document.getElementById('rel-os-manutentor');
    if (selManut) {
        selManut.innerHTML = '<option value="">Todos Manutentores</option>' +
            manutSnap.docs.map(d => `<option value="${d.id}">${d.data().nome}</option>`).join('');
    }

    filtrarRelatorioOS();
}

function extrairDataISO_OS(os) {
    if (os.dataHoraEncerramento) return os.dataHoraEncerramento.slice(0, 10);
    if (os.criadoEm?.toDate) return os.criadoEm.toDate().toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
}

function formatarDataBR_OS(iso) {
    if (!iso || iso.length < 10) return '-';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
}

function obterOSFiltradasRelatorio() {
    const busca = (document.getElementById('rel-os-busca')?.value || '').toLowerCase();
    const status = document.getElementById('rel-os-status')?.value || '';
    const tipo = document.getElementById('rel-os-tipo')?.value || '';
    const manut = document.getElementById('rel-os-manutentor')?.value || '';

    return cacheRelatorioOS.filter(os => {
        if (status && os.colunaId !== status) return false;
        if (tipo && os.tipoNome !== tipo) return false;
        if (manut && os.manutentorId !== manut) return false;
        if (busca) {
            const texto = `${os.numeroOs} ${os.ativoTag} ${os.ativoNome} ${os.descricao} ${os.servicoRealizado || ''}`.toLowerCase();
            if (!texto.includes(busca)) return false;
        }
        return true;
    });
}

function filtrarRelatorioOS() {
    const lista = obterOSFiltradasRelatorio();
    const tbody = document.getElementById('tabela-relatorios-os');
    if (!tbody) return;

    const total = lista.length;
    const concluidas = lista.filter(o => o.encerrada).length;
    const abertas = total - concluidas;
    const custoTotal = lista.reduce((acc, o) => acc + (Number(o.custoTotal) || 0), 0);

    document.getElementById('rel-os-kpi-total').textContent = total;
    document.getElementById('rel-os-kpi-abertas').textContent = abertas;
    document.getElementById('rel-os-kpi-concluidas').textContent = concluidas;
    document.getElementById('rel-os-kpi-custo').textContent = custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-slate-400">Nenhuma Ordem de Serviço encontrada com os filtros atuais.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(os => `
        <tr class="hover:bg-slate-50 transition">
            <td class="py-3 px-4 font-extrabold text-slate-900">#OS-${String(os.numeroOs || 0).padStart(4, '0')}</td>
            <td class="py-3 px-4 text-slate-500">${os.dataBR}</td>
            <td class="py-3 px-4">
                <div class="font-bold text-slate-900">${os.ativoTag} - ${os.ativoNome}</div>
                <div class="text-[11px] text-slate-500 truncate max-w-xs">${os.descricao || ''}</div>
            </td>
            <td class="py-3 px-4 font-semibold">${os.tipoNome || 'Geral'}</td>
            <td class="py-3 px-4 text-slate-600">${os.manutentorNome || 'Não atribuído'}</td>
            <td class="py-3 px-4">
                <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white" style="background-color: ${os.statusCor}">
                    ${os.statusTitulo}
                </span>
            </td>
            <td class="py-3 px-4 text-right font-extrabold text-emerald-700">
                ${Number(os.custoTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </td>
        </tr>
    `).join('');
}

// ==========================================
// MODAL E GERAÇÃO DO PDF GERAL DE O.S.
// ==========================================
function abrirModalFiltroPDF_OS() {
    const anoAtual = new Date().getFullYear();
    const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0');
    const selAno = document.getElementById('pdf-os-ano');
    selAno.innerHTML = '';
    for (let a = anoAtual; a >= anoAtual - 5; a--) {
        selAno.innerHTML += `<option value="${a}">${a}</option>`;
    }
    document.getElementById('pdf-os-mes').value = mesAtual;

    const radioTotal = document.querySelector('input[name="pdf-os-modo"][value="total"]');
    if (radioTotal) radioTotal.checked = true;
    alternarPeriodoPDF_OS();

    document.getElementById('modal-filtro-pdf-os').classList.remove('hidden');
    lucide.createIcons();
}

function fecharModalFiltroPDF_OS() {
    document.getElementById('modal-filtro-pdf-os').classList.add('hidden');
}

function alternarPeriodoPDF_OS() {
    const modo = document.querySelector('input[name="pdf-os-modo"]:checked')?.value;
    const box = document.getElementById('box-mes-ano-pdf-os');
    if (modo === 'mensal') box.classList.remove('hidden');
    else box.classList.add('hidden');
}

async function gerarPDFGeralOS(e) {
    e.preventDefault();
    if (!window.jspdf) {
        alert('Biblioteca de PDF carregando. Tente novamente em instantes.');
        return;
    }

    const btn = document.getElementById('btn-baixar-pdf-os');
    btn.disabled = true;

    const modo = document.querySelector('input[name="pdf-os-modo"]:checked')?.value || 'total';
    const mes = document.getElementById('pdf-os-mes').value;
    const ano = document.getElementById('pdf-os-ano').value;

    const nomesMeses = {
        '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
        '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
        '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
    };

    const prefixoFiltro = modo === 'mensal' ? `${ano}-${mes}` : '';
    const labelPeriodo = modo === 'mensal'
        ? `Período: ${nomesMeses[mes]} de ${ano}`
        : 'Período: Total (Histórico Completo)';

    const baseFiltrada = obterOSFiltradasRelatorio().filter(os =>
        !prefixoFiltro || (os.dataISO && os.dataISO.startsWith(prefixoFiltro))
    );

    const custoTotal = baseFiltrada.reduce((acc, o) => acc + (Number(o.custoTotal) || 0), 0);
    const logoObj = typeof carregarImagemLogoBase64 === 'function'
        ? await carregarImagemLogoBase64('images/cabe.png')
        : null;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Paisagem para caber todas as colunas com folga

    // Cabeçalho Escuro OSync
    doc.setFillColor(11, 17, 32);
    doc.rect(0, 0, 297, 26, 'F');
    doc.setFillColor(0, 229, 176);
    doc.rect(0, 26, 297, 1.5, 'F');

    if (logoObj) {
        const alturaLogo = 10;
        const larguraLogo = alturaLogo * logoObj.ratio;
        doc.addImage(logoObj.dataUrl, 'PNG', 14, 8, larguraLogo, alturaLogo);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO GERAL DE ORDENS DE SERVIÇO', 283, 12, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 229, 176);
    doc.text(labelPeriodo, 283, 19, { align: 'right' });

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8.5);
    doc.text(`Total de O.S. listadas: ${baseFiltrada.length} • Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 14, 33);

    const linhas = baseFiltrada.map(os => [
        `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`,
        os.dataBR,
        `${os.ativoTag} - ${os.ativoNome}`,
        os.tipoNome || 'Geral',
        os.manutentorNome || '-',
        os.statusTitulo,
        os.servicoRealizado || os.descricao || '-',
        Number(os.custoTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);

    if (linhas.length === 0) {
        linhas.push(['-', '-', 'Nenhuma Ordem de Serviço encontrada no período.', '-', '-', '-', '-', 'R$ 0,00']);
    }

    doc.autoTable({
        startY: 37,
        head: [['Nº O.S.', 'Data', 'Máquina', 'Tipo', 'Técnico', 'Status', 'Descrição / Serviço', 'Custo']],
        body: linhas,
        foot: [['', '', '', '', '', '', 'CUSTO TOTAL DO PERÍODO', custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]],
        theme: 'grid',
        headStyles: { fillColor: [11, 17, 32], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        footStyles: { fillColor: [236, 253, 245], textColor: [4, 120, 87], fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 7.8, cellPadding: 2.5 },
        columnStyles: {
            0: { cellWidth: 20, fontStyle: 'bold' },
            1: { cellWidth: 21 },
            2: { cellWidth: 42, fontStyle: 'bold' },
            3: { cellWidth: 28 },
            4: { cellWidth: 28 },
            5: { cellWidth: 24 },
            6: { cellWidth: 'auto' },
            7: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
        }
    });

    const sufixo = prefixoFiltro || 'Total';
    doc.save(`Relatorio_Geral_OS_${sufixo}.pdf`);

    btn.disabled = false;
    fecharModalFiltroPDF_OS();
}
