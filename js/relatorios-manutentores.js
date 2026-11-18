let cacheRelatorioManutOS = [];
let cacheListaManutentoresRel = [];

function extrairParticipantesOS(os) {
    if (Array.isArray(os?.manutentoresIds) && os.manutentoresIds.length > 0) {
        const nomes = Array.isArray(os.manutentoresNomes) ? os.manutentoresNomes : [];
        return os.manutentoresIds.map((id, idx) => ({
            id,
            nome: nomes[idx] || os.manutentorNome || 'Técnico'
        }));
    }
    if (os?.manutentorId) {
        return [{ id: os.manutentorId, nome: os.manutentorNome || 'Técnico' }];
    }
    return [];
}

function calcularMinutosTrabalhoOS(os) {
    if (Number(os?.tempoTrabalhoMinutos) > 0) {
        return Number(os.tempoTrabalhoMinutos);
    }

    const fimStr = os?.dataHoraEncerramento || '';
    if (!fimStr) return 0;
    const dFim = new Date(fimStr);
    if (isNaN(dFim.getTime())) return 0;

    let dIni = null;
    if (os?.inicioExecucao) {
        dIni = new Date(os.inicioExecucao);
    } else if (os?.inicioParada) {
        dIni = new Date(os.inicioParada);
    } else if (os?.criadoEm?.toDate) {
        dIni = os.criadoEm.toDate();
    }

    if (!dIni || isNaN(dIni.getTime())) return 0;
    return Math.max(0, Math.round((dFim.getTime() - dIni.getTime()) / 60000));
}

async function initRelatoriosManutentores() {
    const tbody = document.getElementById('tabela-relatorios-manutentores');
    if (tbody) {
        tbody.innerHTML = OSyncUtils.gerarSkeletonLinhasTabela(6, 7);
    }

    const [ordens, colunas, manutSnap] = await Promise.all([
        OSyncDataStore.getOrdensServico({ completo: true }),
        OSyncDataStore.getColunasKanban(),
        db.collection('usuarios')
            .where('empresaId', '==', usuarioAtual.empresaId)
            .where('perfil', 'in', ['Manutentor', 'Admin'])
            .get()
    ]);

    cacheListaManutentoresRel = manutSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.ativo !== false)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    const selTec = document.getElementById('rel-manut-tecnico');
    if (selTec) {
        selTec.innerHTML = '<option value="">Todos os Manutentores / Gestão</option>' +
            cacheListaManutentoresRel.map(m => {
                const rotulo = m.perfil === 'Admin' ? `${m.nome} (Gestão)` : m.nome;
                return `<option value="${escaparHTML(m.id)}">${escaparHTML(rotulo)}</option>`;
            }).join('');

        if (usuarioAtual?.perfil === 'Manutentor' || usuarioAtual?.perfil === 'Admin') {
            selTec.value = usuarioAtual.id;
        }
    }

    cacheRelatorioManutOS = ordens
        .map(data => {
            const col = colunas.find(c => c.id === data.colunaId);
            const dataISO = OSyncUtils.extrairDataISO(data);
            const participantes = extrairParticipantesOS(data);
            const minutosTrabalho = calcularMinutosTrabalhoOS(data);

            return {
                ...data,
                statusTitulo: col ? col.titulo : (data.encerrada ? 'Concluída' : 'Aberta'),
                statusCor: col ? col.corTopo : '#00E5B0',
                dataISO,
                dataBR: OSyncUtils.formatarDataBR(dataISO),
                participantes,
                ehParceria: participantes.length > 1,
                minutosTrabalho,
                horasTrabalhoLabel: minutosTrabalho > 0
                    ? OSyncUtils.formatarHorasParadas(minutosTrabalho)
                    : (data.encerrada ? '0h 00m' : 'Em andamento')
            };
        })
        .sort((a, b) => (b.numeroOs || 0) - (a.numeroOs || 0));

    filtrarRelatorioManutentores();
}

function obterOSFiltradasManutentores() {
    const tecnicoId = document.getElementById('rel-manut-tecnico')?.value || '';
    const periodo = document.getElementById('rel-manut-periodo')?.value || 'total';
    const modalidade = document.getElementById('rel-manut-modalidade')?.value || '';
    const busca = (document.getElementById('rel-manut-busca')?.value || '').toLowerCase();

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');

    return cacheRelatorioManutOS.filter(os => {
        if (os.participantes.length === 0) return false;

        if (tecnicoId && !os.participantes.some(p => p.id === tecnicoId)) return false;

        if (modalidade === 'parceria' && !os.ehParceria) return false;
        if (modalidade === 'individual' && os.ehParceria) return false;

        if (periodo !== 'total' && os.dataISO) {
            if (periodo === 'mes_atual' && !os.dataISO.startsWith(`${anoAtual}-${mesAtual}`)) return false;
            if (periodo === 'ano_atual' && !os.dataISO.startsWith(`${anoAtual}-`)) return false;
            if (periodo === 'ultimos_30d') {
                const limite = new Date();
                limite.setDate(limite.getDate() - 30);
                if (new Date(os.dataISO) < limite) return false;
            }
        }

        if (busca) {
            const nomes = os.participantes.map(p => p.nome).join(' ');
            const texto = `${os.numeroOs} ${os.ativoTag} ${os.ativoNome} ${nomes} ${os.descricao} ${os.servicoRealizado || ''}`.toLowerCase();
            if (!texto.includes(busca)) return false;
        }

        return true;
    });
}

function filtrarRelatorioManutentores() {
    const lista = obterOSFiltradasManutentores();
    const tbody = document.getElementById('tabela-relatorios-manutentores');
    if (!tbody) return;

    const tecnicoId = document.getElementById('rel-manut-tecnico')?.value || '';
    const total = lista.length;
    const concluidas = lista.filter(o => o.encerrada).length;
    const parcerias = lista.filter(o => o.ehParceria).length;
    const minutosTotais = lista.reduce((acc, o) => acc + (Number(o.minutosTrabalho) || 0), 0);

    document.getElementById('rel-manut-kpi-total').textContent = total;
    document.getElementById('rel-manut-kpi-concluidas').textContent = concluidas;
    document.getElementById('rel-manut-kpi-parcerias').textContent = parcerias;
    document.getElementById('rel-manut-kpi-horas').textContent = OSyncUtils.formatarHorasParadas(minutosTotais);

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-slate-400">Nenhuma O.S. encontrada para os filtros selecionados.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(os => {
        const nomesTodos = os.participantes.map(p => p.nome);
        const parceiros = tecnicoId
            ? os.participantes.filter(p => p.id !== tecnicoId).map(p => p.nome)
            : nomesTodos;

        const badgeEquipe = os.ehParceria
            ? `<span class="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                   Parceria (${os.participantes.length})
               </span>
               <div class="text-[11px] font-semibold text-slate-700 mt-1">
                   ${tecnicoId ? `Com: ${escaparHTML(parceiros.join(', '))}` : escaparHTML(nomesTodos.join(', '))}
               </div>`
            : `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">Individual</span>
               <div class="text-[11px] font-semibold text-slate-700 mt-1">${escaparHTML(nomesTodos[0] || '-')}</div>`;

        return `
        <tr class="hover:bg-slate-50 transition align-top">
            <td class="py-3 px-2.5 font-extrabold text-slate-900 whitespace-nowrap">
                #OS-${String(os.numeroOs || 0).padStart(4, '0')}
            </td>
            <td class="py-3 px-2.5 text-slate-500 whitespace-nowrap">${escaparHTML(os.dataBR)}</td>
            <td class="py-3 px-3 font-bold text-slate-900">
                ${escaparHTML(os.ativoTag)} - ${escaparHTML(os.ativoNome)}
            </td>
            <td class="py-3 px-3">${badgeEquipe}</td>
            <td class="py-3 px-3 text-slate-700">
                <div class="font-medium text-slate-800">${escaparHTML(os.descricao || '-')}</div>
                ${os.servicoRealizado ? `<div class="text-[11px] text-emerald-700 mt-0.5"><strong>Solução:</strong> ${escaparHTML(os.servicoRealizado)}</div>` : ''}
            </td>
            <td class="py-3 px-2.5 text-center font-extrabold text-blue-700 whitespace-nowrap">
                ${escaparHTML(os.horasTrabalhoLabel)}
            </td>
            <td class="py-3 px-3 text-right whitespace-nowrap">
                <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white" style="background-color: ${sanitizarCorHex(os.statusCor, '#00E5B0')}">
                    ${escaparHTML(os.statusTitulo)}
                </span>
            </td>
        </tr>`;
    }).join('');
}

// ==========================================
// EXPORTAÇÃO PDF DO RELATÓRIO DE MANUTENTORES
// ==========================================
function abrirModalFiltroPDF_Manutentores() {
    const anoAtual = new Date().getFullYear();
    const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0');
    const selAno = document.getElementById('pdf-manut-ano');
    selAno.innerHTML = '';
    for (let a = anoAtual; a >= anoAtual - 5; a--) {
        selAno.innerHTML += `<option value="${a}">${a}</option>`;
    }
    document.getElementById('pdf-manut-mes').value = mesAtual;

    const radioTotal = document.querySelector('input[name="pdf-manut-modo"][value="total"]');
    if (radioTotal) radioTotal.checked = true;
    alternarPeriodoPDF_Manutentores();

    document.getElementById('modal-filtro-pdf-manut').classList.remove('hidden');
    lucide.createIcons();
}

function fecharModalFiltroPDF_Manutentores() {
    document.getElementById('modal-filtro-pdf-manut').classList.add('hidden');
}

function alternarPeriodoPDF_Manutentores() {
    const modo = document.querySelector('input[name="pdf-manut-modo"]:checked')?.value;
    const box = document.getElementById('box-mes-ano-pdf-manut');
    if (modo === 'mensal') box.classList.remove('hidden');
    else box.classList.add('hidden');
}

async function gerarPDFManutentores(e) {
    e.preventDefault();
    if (!window.jspdf) return;

    const btn = document.getElementById('btn-baixar-pdf-manut');
    btn.disabled = true;

    const modo = document.querySelector('input[name="pdf-manut-modo"]:checked')?.value || 'total';
    const mes = document.getElementById('pdf-manut-mes').value;
    const ano = document.getElementById('pdf-manut-ano').value;
    const tecnicoId = document.getElementById('rel-manut-tecnico')?.value || '';
    const tecnicoObj = cacheListaManutentoresRel.find(m => m.id === tecnicoId);

    const nomesMeses = {
        '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
        '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
        '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
    };

    const prefixoFiltro = modo === 'mensal' ? `${ano}-${mes}` : '';
    const labelPeriodo = modo === 'mensal'
        ? `Período: ${nomesMeses[mes]} de ${ano}`
        : 'Período: Total (Histórico Completo)';

    const baseFiltrada = obterOSFiltradasManutentores().filter(os =>
        !prefixoFiltro || (os.dataISO && os.dataISO.startsWith(prefixoFiltro))
    );

    const minutosTotais = baseFiltrada.reduce((acc, o) => acc + (Number(o.minutosTrabalho) || 0), 0);
    const totalParcerias = baseFiltrada.filter(o => o.ehParceria).length;
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
    doc.text('RELATÓRIO DE PRODUTIVIDADE E HORAS — MANUTENTORES', 283, 12, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 229, 176);
    doc.text(`${tecnicoObj ? `Técnico: ${tecnicoObj.nome} • ` : ''}${labelPeriodo}`, 283, 19, { align: 'right' });

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8.5);
    doc.text(
        `Total de O.S.: ${baseFiltrada.length} • Em Parceria: ${totalParcerias} • Total Horas Trabalhadas: ${OSyncUtils.formatarHorasParadas(minutosTotais)} • Emitido em ${new Date().toLocaleDateString('pt-BR')}`,
        14,
        33
    );

    const linhas = baseFiltrada.map(os => {
        const equipeTexto = os.ehParceria
            ? `Parceria: ${os.participantes.map(p => p.nome).join(', ')}`
            : `Individual: ${os.participantes[0]?.nome || '-'}`;
        const descTexto = os.servicoRealizado
            ? `${os.descricao || '-'} (Solução: ${os.servicoRealizado})`
            : (os.descricao || '-');

        return [
            `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`,
            os.dataBR,
            `${os.ativoTag} - ${os.ativoNome}`,
            equipeTexto,
            descTexto,
            os.horasTrabalhoLabel,
            os.statusTitulo
        ];
    });

    if (linhas.length === 0) {
        linhas.push(['-', '-', 'Nenhuma O.S. encontrada no período.', '-', '-', '0h 00m', '-']);
    }

    doc.autoTable({
        startY: 37,
        head: [['Nº O.S.', 'Data', 'Máquina / Ativo', 'Equipe / Parceria', 'Serviço Realizado', 'Horas Trab.', 'Status']],
        body: linhas,
        foot: [[
            '', '', '',
            `TOTAL O.S.: ${baseFiltrada.length} (${totalParcerias} parcerias)`,
            'TOTAL HORAS TRABALHADAS:',
            OSyncUtils.formatarHorasParadas(minutosTotais),
            ''
        ]],
        theme: 'grid',
        headStyles: { fillColor: [11, 17, 32], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        footStyles: { fillColor: [236, 253, 245], textColor: [4, 120, 87], fontStyle: 'bold', fontSize: 8.5 },
        styles: { fontSize: 7.8, cellPadding: 2.4 },
        columnStyles: {
            0: { cellWidth: 18, fontStyle: 'bold' },
            1: { cellWidth: 19 },
            2: { cellWidth: 42, fontStyle: 'bold' },
            3: { cellWidth: 48 },
            4: { cellWidth: 'auto' },
            5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
            6: { cellWidth: 24, halign: 'center', fontStyle: 'bold' }
        }
    });

    const nomeArqTecnico = tecnicoObj ? tecnicoObj.nome.replace(/\s+/g, '_') : 'Todos';
    doc.save(`Relatorio_Manutentores_${nomeArqTecnico}_${prefixoFiltro || 'Total'}.pdf`);

    btn.disabled = false;
    fecharModalFiltroPDF_Manutentores();
}
