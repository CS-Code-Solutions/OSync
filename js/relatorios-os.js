let cacheRelatorioOS = [];
let cacheColunasRelOS = [];

async function initRelatoriosOS() {
    const tbody = document.getElementById('tabela-relatorios-os');
    if (tbody) {
        tbody.innerHTML = OSyncUtils.gerarSkeletonLinhasTabela(6, 6);
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
            const dataISO = OSyncUtils.extrairDataISO(data);
            const minutosParada = OSyncUtils.calcularMinutosParada(data);
            return {
                id: d.id,
                ...data,
                statusTitulo: col ? col.titulo : (data.encerrada ? 'Concluída' : 'Aberta'),
                statusCor: col ? col.corTopo : '#00E5B0',
                dataISO,
                dataBR: OSyncUtils.formatarDataBR(dataISO),
                minutosParada,
                paradaLabel: minutosParada > 0
                    ? OSyncUtils.formatarHorasParadas(minutosParada)
                    : (data.maquinaParada || data.condicaoMaquina === 'Maquina parada' ? 'Em aberto' : '-')
            };
        })
        .sort((a, b) => (b.numeroOs || 0) - (a.numeroOs || 0));

    const selStatus = document.getElementById('rel-os-status');
    if (selStatus) {
        selStatus.innerHTML = '<option value="">Todos Status</option>' +
            cacheColunasRelOS.map(c => `<option value="${escaparHTML(c.id)}">${escaparHTML(c.titulo)}</option>`).join('');
    }

    const selTipo = document.getElementById('rel-os-tipo');
    if (selTipo) {
        const tipos = tiposSnap.docs.map(d => d.data().nome).sort();
        selTipo.innerHTML = '<option value="">Todos Tipos</option>' +
            tipos.map(t => `<option value="${escaparHTML(t)}">${escaparHTML(t)}</option>`).join('');
    }

    const selManut = document.getElementById('rel-os-manutentor');
    if (selManut) {
        selManut.innerHTML = '<option value="">Todos Manutentores</option>' +
            manutSnap.docs.map(d => `<option value="${escaparHTML(d.id)}">${escaparHTML(d.data().nome)}</option>`).join('');
    }

    filtrarRelatorioOS();
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
    document.getElementById('rel-os-kpi-custo').textContent = OSyncUtils.formatarMoedaBR(custoTotal);

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-400">Nenhuma Ordem de Serviço encontrada com os filtros atuais.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(os => `
        <tr class="hover:bg-slate-50 transition align-top">
            <td class="py-3 px-2.5 font-extrabold text-slate-900 whitespace-nowrap">
                <div>#OS-${String(os.numeroOs || 0).padStart(4, '0')}</div>
                ${os.minutosParada > 0 ? `<span class="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Parada: ${escaparHTML(os.paradaLabel)}</span>` : ''}
            </td>
            <td class="py-3 px-2.5 text-slate-500 whitespace-nowrap">${escaparHTML(os.dataBR)}</td>
            <td class="py-3 px-3 font-bold text-slate-900">
                ${escaparHTML(os.ativoTag)} - ${escaparHTML(os.ativoNome)}
            </td>
            <td class="py-3 px-3 font-semibold whitespace-nowrap">${escaparHTML(os.tipoNome || 'Geral')}</td>
            <td class="py-3 px-3 text-slate-700">
                <div class="font-medium text-slate-800">${escaparHTML(os.descricao || '-')}</div>
                ${os.servicoRealizado ? `<div class="text-[11px] text-emerald-700 mt-0.5"><strong>Solução:</strong> ${escaparHTML(os.servicoRealizado)}</div>` : ''}
            </td>
            <td class="py-3 px-3 text-right whitespace-nowrap">
                <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white" style="background-color: ${sanitizarCorHex(os.statusCor, '#00E5B0')}">
                    ${escaparHTML(os.statusTitulo)}
                </span>
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
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Biblioteca de PDF carregando. Tente novamente em instantes.', 'aviso');
        }
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

    const minutosParadosTotal = baseFiltrada.reduce((acc, o) => acc + (Number(o.minutosParada) || 0), 0);
    const logoObj = await OSyncUtils.carregarImagemLogoBase64('images/cabe.png');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');

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
    doc.text(
        `Total de O.S. listadas: ${baseFiltrada.length} • Total Horas Paradas: ${OSyncUtils.formatarHorasParadas(minutosParadosTotal)} • Emitido em ${new Date().toLocaleDateString('pt-BR')}`,
        14,
        33
    );

    const linhas = baseFiltrada.map(os => {
        const falhaTexto = os.servicoRealizado
            ? `${os.descricao || '-'} (Solução: ${os.servicoRealizado})`
            : (os.descricao || '-');

        return [
            `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`,
            os.dataBR,
            `${os.ativoTag} - ${os.ativoNome}`,
            os.tipoNome || 'Geral',
            os.paradaLabel,
            falhaTexto,
            os.statusTitulo
        ];
    });

    if (linhas.length === 0) {
        linhas.push(['-', '-', 'Nenhuma Ordem de Serviço encontrada no período.', '-', '-', '-', '-']);
    }

    doc.autoTable({
        startY: 37,
        head: [['Nº O.S.', 'Data', 'Máquina / Ativo', 'Tipo', 'Parada', 'Falha do Equipamento', 'Status']],
        body: linhas,
        foot: [[
            '', '', '',
            'TOTAL PARADO:',
            OSyncUtils.formatarHorasParadas(minutosParadosTotal),
            `TOTAL DE ORDENS: ${baseFiltrada.length} O.S.`,
            ''
        ]],
        theme: 'grid',
        headStyles: { fillColor: [11, 17, 32], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        footStyles: { fillColor: [236, 253, 245], textColor: [4, 120, 87], fontStyle: 'bold', fontSize: 8.5 },
        styles: { fontSize: 7.8, cellPadding: 2.4 },
        columnStyles: {
            0: { cellWidth: 18, fontStyle: 'bold' },
            1: { cellWidth: 19 },
            2: { cellWidth: 44, fontStyle: 'bold' },
            3: { cellWidth: 26 },
            4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
            5: { cellWidth: 'auto' },
            6: { cellWidth: 24, halign: 'center', fontStyle: 'bold' }
        }
    });

    if (modo === 'total' && baseFiltrada.length > 0) {
        const mapaMensal = {};
        baseFiltrada.forEach(os => {
            const ym = (os.dataISO || '').slice(0, 7);
            if (!ym || ym.length < 7) return;
            if (!mapaMensal[ym]) mapaMensal[ym] = { qtd: 0, minutosParada: 0 };
            mapaMensal[ym].qtd += 1;
            mapaMensal[ym].minutosParada += Number(os.minutosParada) || 0;
        });

        const mesesOrdenados = Object.keys(mapaMensal).sort();
        if (mesesOrdenados.length > 0) {
            const linhasResumoMensal = mesesOrdenados.map(ym => {
                const [anoM, mesM] = ym.split('-');
                const nomeMes = `${nomesMeses[mesM] || mesM}/${anoM}`;
                const item = mapaMensal[ym];
                return [
                    nomeMes,
                    `${item.qtd} O.S.`,
                    OSyncUtils.formatarHorasParadas(item.minutosParada)
                ];
            });

            const posY = (doc.lastAutoTable?.finalY || 120) + 10;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text('RESUMO MENSAL — HORAS PARADAS POR MÊS', 14, posY);

            doc.autoTable({
                startY: posY + 3,
                head: [['Mês / Ano', 'Qtd. de O.S.', 'Total Horas Paradas no Mês']],
                body: linhasResumoMensal,
                foot: [[
                    'TOTAL ACUMULADO',
                    `${baseFiltrada.length} O.S.`,
                    OSyncUtils.formatarHorasParadas(minutosParadosTotal)
                ]],
                theme: 'grid',
                headStyles: { fillColor: [11, 17, 32], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                footStyles: { fillColor: [254, 242, 242], textColor: [185, 28, 28], fontStyle: 'bold', fontSize: 8.5 },
                styles: { fontSize: 8, cellPadding: 2.5 },
                tableWidth: 150
            });
        }
    }

    const sufixo = prefixoFiltro || 'Total';
    doc.save(`Relatorio_Geral_OS_${sufixo}.pdf`);

    btn.disabled = false;
    fecharModalFiltroPDF_OS();
}
