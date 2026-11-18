let cacheDashOrdens = [];
let cacheDashAtivos = [];
let cacheDashSolicitacoes = [];
let cacheDashColunas = [];
let instanciasGraficosDash = {};
let periodoWidgetParadas = 'mes';

const CATALOGO_WIDGETS_DASHBOARD = [
    {
        id: 'kpis_principais',
        titulo: 'Cartões de Resumo (KPIs)',
        descricao: 'O.S. em aberto, máquinas paradas agora, disponibilidade, chamados e custo total.',
        categoria: 'Indicadores',
        ativo: true,
        ordem: 1
    },
    {
        id: 'grafico_custos_mensais',
        titulo: 'Gráfico: Evolução Mensal de Custos',
        descricao: 'Comparativo de gastos com manutenção nos últimos 6 meses.',
        categoria: 'Financeiro',
        ativo: true,
        ordem: 2
    },
    {
        id: 'grafico_maquinas_paradas_periodo',
        titulo: 'Gráfico: Máquinas Paradas por Período',
        descricao: 'Horas paradas por equipamento (apenas máquinas que tiveram parada na Semana, Mês ou Ano).',
        categoria: 'Confiabilidade',
        ativo: true,
        ordem: 3
    },
    {
        id: 'grafico_tipos_manutencao',
        titulo: 'Gráfico: O.S. por Tipo de Manutenção',
        descricao: 'Distribuição entre Corretiva, Preventiva, Manutenção Externa, etc.',
        categoria: 'Operacional',
        ativo: true,
        ordem: 4
    },
    {
        id: 'grafico_top_maquinas_custo',
        titulo: 'Gráfico: Top 5 Máquinas por Custo',
        descricao: 'Equipamentos que geraram maior investimento no período.',
        categoria: 'Centros de Custo',
        ativo: true,
        ordem: 5
    },
    {
        id: 'grafico_top_maquinas_os',
        titulo: 'Gráfico: Top 5 Máquinas por Qtd. de O.S.',
        descricao: 'Ranking de reincidência de manutenções por equipamento.',
        categoria: 'Confiabilidade',
        ativo: true,
        ordem: 6
    },
    {
        id: 'grafico_produtividade_tecnicos',
        titulo: 'Gráfico: Desempenho por Manutentor',
        descricao: 'O.S. concluídas vs. em andamento por técnico.',
        categoria: 'Equipe',
        ativo: false,
        ordem: 7
    },
    {
        id: 'grafico_status_kanban',
        titulo: 'Gráfico: O.S. por Etapa do Kanban',
        descricao: 'Quantidade de ordens distribuídas em cada coluna do quadro.',
        categoria: 'Fluxo',
        ativo: false,
        ordem: 8
    },
    {
        id: 'lista_maquinas_paradas',
        titulo: 'Alerta: Máquinas Paradas / Em Manutenção',
        descricao: 'Lista rápida dos equipamentos que não estão operacionais agora.',
        categoria: 'Alertas',
        ativo: true,
        ordem: 9
    },
    {
        id: 'lista_os_urgentes',
        titulo: 'Lista: O.S. Urgentes em Aberto',
        descricao: 'Ordens de prioridade Urgente aguardando conclusão.',
        categoria: 'Alertas',
        ativo: true,
        ordem: 10
    }
];

let layoutWidgetsAtual = [];

function renderizarSkeletonDashboard() {
    const container = document.getElementById('dashboard-widgets-container');
    if (!container) return;

    const kpisSkeleton = Array.from({ length: 5 }).map(() => `
        <div class="osync-card p-5 space-y-2.5 animate-pulse">
            <div class="h-3 w-24 bg-slate-200 rounded"></div>
            <div class="h-7 w-20 bg-slate-200 rounded"></div>
            <div class="h-3 w-32 bg-slate-100 rounded"></div>
        </div>
    `).join('');

    const cardsSkeleton = Array.from({ length: 4 }).map(() => `
        <div class="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 animate-pulse">
            <div class="space-y-1.5 pb-3 border-b border-slate-100">
                <div class="h-4 w-48 bg-slate-200 rounded"></div>
                <div class="h-3 w-64 bg-slate-100 rounded"></div>
            </div>
            <div class="h-56 w-full bg-slate-100 rounded-xl"></div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">${kpisSkeleton}</div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">${cardsSkeleton}</div>
    `;
}

async function initDashboard() {
    renderizarSkeletonDashboard();
    await carregarPreferenciasLayoutDashboard();
    await carregarDadosBrutosDashboard();
    renderizarWidgetsDashboard();
}

async function carregarPreferenciasLayoutDashboard() {
    try {
        const doc = await db.collection('dashboard_config').doc(usuarioAtual.empresaId).get();
        if (doc.exists && Array.isArray(doc.data().widgets)) {
            const salvos = doc.data().widgets;
            layoutWidgetsAtual = CATALOGO_WIDGETS_DASHBOARD.map(padrao => {
                const encontrado = salvos.find(s =>
                    s.id === padrao.id ||
                    (padrao.id === 'grafico_maquinas_paradas_periodo' && s.id === 'grafico_horas_paradas_mensais')
                );
                return encontrado ? { ...padrao, ativo: encontrado.ativo, ordem: encontrado.ordem } : { ...padrao };
            }).sort((a, b) => a.ordem - b.ordem);
        } else {
            layoutWidgetsAtual = CATALOGO_WIDGETS_DASHBOARD.map(w => ({ ...w }));
        }
    } catch (err) {
        console.warn('Usando layout padrão do dashboard:', err.message);
        layoutWidgetsAtual = CATALOGO_WIDGETS_DASHBOARD.map(w => ({ ...w }));
    }
}

async function carregarDadosBrutosDashboard(completo = false) {
    const [ordens, ativos, solicitacoes, colunas] = await Promise.all([
        OSyncDataStore.getOrdensServico({ completo }),
        OSyncDataStore.getAtivos(),
        OSyncDataStore.getSolicitacoes(),
        OSyncDataStore.getColunasKanban()
    ]);

    cacheDashColunas = colunas;
    cacheDashAtivos = ativos;
    cacheDashSolicitacoes = solicitacoes;
    cacheDashOrdens = ordens.map(data => ({
        ...data,
        dataISO: OSyncUtils.extrairDataISO(data)
    }));
}

async function renderizarWidgetsDashboard() {
    const container = document.getElementById('dashboard-widgets-container');
    if (!container) return;

    const periodo = document.getElementById('dash-filtro-periodo')?.value || 'mes_atual';
    const exigeCompleto = periodo === 'total' || periodo === 'ano_atual';

    // Lazy Loading: busca histórico completo somente se o usuário pedir Ano Atual ou Total
    if (exigeCompleto && !OSyncDataStore.isHistoricoCompletoCarregado()) {
        renderizarSkeletonDashboard();
        await carregarDadosBrutosDashboard(true);
    }

    destruirGraficosAnteriores();

    const ativosOrdenados = layoutWidgetsAtual
        .filter(w => w.ativo)
        .sort((a, b) => a.ordem - b.ordem);

    if (ativosOrdenados.length === 0) {
        container.innerHTML = `
            <div class="bg-white p-10 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
                <p class="text-slate-500 text-sm">Nenhum bloco visível no momento.</p>
                <button onclick="abrirDrawerAjustarDashboard()" class="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl">
                    Escolher Blocos no Ajuste de Página
                </button>
            </div>`;
        return;
    }

    const ordensFiltradas = obterOrdensFiltradasDashboard();

    let htmlFinal = '';
    let bufferGrid = [];

    const descarregarBufferGrid = () => {
        if (bufferGrid.length === 0) return;
        htmlFinal += `<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">${bufferGrid.join('')}</div>`;
        bufferGrid = [];
    };

    ativosOrdenados.forEach(w => {
        if (w.id === 'kpis_principais') {
            descarregarBufferGrid();
            htmlFinal += construirHTML_KPIs(ordensFiltradas);
        } else {
            bufferGrid.push(construirHTML_CardWidget(w));
        }
    });
    descarregarBufferGrid();

    container.innerHTML = htmlFinal;
    lucide.createIcons();

    ativosOrdenados.forEach(w => {
        if (w.id === 'grafico_custos_mensais') montarGraficoCustosMensais();
        if (w.id === 'grafico_maquinas_paradas_periodo') montarGraficoMaquinasParadasPeriodo();
        if (w.id === 'grafico_tipos_manutencao') montarGraficoTiposManutencao(ordensFiltradas);
        if (w.id === 'grafico_top_maquinas_custo') montarGraficoTopMaquinasCusto(ordensFiltradas);
        if (w.id === 'grafico_top_maquinas_os') montarGraficoTopMaquinasOS(ordensFiltradas);
        if (w.id === 'grafico_produtividade_tecnicos') montarGraficoProdutividadeTecnicos(ordensFiltradas);
        if (w.id === 'grafico_status_kanban') montarGraficoStatusKanban(ordensFiltradas);
        if (w.id === 'lista_maquinas_paradas') preencherListaMaquinasParadas();
        if (w.id === 'lista_os_urgentes') preencherListaOSUrgentes();
    });
}
// ==========================================
// CONSTRUTORES DE HTML DOS BLOCOS
// ==========================================
function construirHTML_KPIs(ordens) {
    const abertas = ordens.filter(o => !o.encerrada).length;
    const concluidas = ordens.filter(o => o.encerrada).length;
    const custoTotal = ordens.reduce((acc, o) => acc + (Number(o.custoTotal) || 0), 0);

    const idsMaquinasParadasAgora = new Set();
    cacheDashAtivos.forEach(a => {
        if (a.status === 'Parada') {
            idsMaquinasParadasAgora.add(a.id);
        }
    });
    cacheDashOrdens.forEach(o => {
        if (!o.encerrada && (o.maquinaParada === true || o.condicaoMaquina === 'Maquina parada')) {
            idsMaquinasParadasAgora.add(o.ativoId || `${o.ativoTag}-${o.ativoNome}`);
        }
    });
    const qtdMaquinasParadasAgora = idsMaquinasParadasAgora.size;

    const ordensParadasPeriodo = ordens.filter(o => OSyncUtils.osTeveParada(o));
    const totalMinutosParados = ordensParadasPeriodo.reduce((acc, o) => acc + OSyncUtils.calcularMinutosParada(o), 0);

    const totalMaquinas = cacheDashAtivos.length;
    const operacionais = cacheDashAtivos.filter(a => a.status === 'Operacional').length;
    const disponibilidade = totalMaquinas > 0 ? Math.round((operacionais / totalMaquinas) * 100) : 100;

    const chamadosPendentes = cacheDashSolicitacoes.filter(s => s.status === 'Pendente').length;

    return `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div class="osync-card p-5 border-l-4 border-l-blue-600">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase text-slate-400">O.S. no Período</span>
                <i data-lucide="clipboard-list" class="w-4 h-4 text-blue-600"></i>
            </div>
            <div class="text-2xl font-extrabold text-slate-900 mt-1.5">${ordens.length}</div>
            <p class="text-[11px] text-slate-500 mt-1"><strong>${abertas}</strong> em aberto • <strong>${concluidas}</strong> concluídas</p>
        </div>

        <div class="osync-card p-5 border-l-4 ${qtdMaquinasParadasAgora > 0 ? 'border-l-rose-600' : 'border-l-emerald-500'}">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase text-slate-400">Máquinas Paradas</span>
                <i data-lucide="alert-octagon" class="w-4 h-4 ${qtdMaquinasParadasAgora > 0 ? 'text-rose-600' : 'text-emerald-600'}"></i>
            </div>
            <div class="text-2xl font-extrabold ${qtdMaquinasParadasAgora > 0 ? 'text-rose-600' : 'text-emerald-700'} mt-1.5">
                ${qtdMaquinasParadasAgora} <span class="text-sm font-bold text-slate-600">${qtdMaquinasParadasAgora === 1 ? 'máquina' : 'máquinas'}</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1">
                ${ordensParadasPeriodo.length > 0
                    ? `<strong>${ordensParadasPeriodo.length}</strong> ${ordensParadasPeriodo.length === 1 ? 'parada' : 'paradas'} no período${totalMinutosParados > 0 ? ` • <strong>${OSyncUtils.formatarHorasParadas(totalMinutosParados)}</strong>` : ''}`
                    : 'Nenhuma parada registrada no período'}
            </p>
        </div>

        <div class="osync-card p-5 border-l-4 border-l-emerald-500">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase text-slate-400">Disponibilidade</span>
                <i data-lucide="activity" class="w-4 h-4 text-emerald-600"></i>
            </div>
            <div class="text-2xl font-extrabold text-emerald-700 mt-1.5">${disponibilidade}%</div>
            <p class="text-[11px] text-slate-500 mt-1"><strong>${operacionais}</strong> de <strong>${totalMaquinas}</strong> operacionais</p>
        </div>

        <div class="osync-card p-5 border-l-4 border-l-amber-500">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase text-slate-400">Chamados Pendentes</span>
                <i data-lucide="bell-ring" class="w-4 h-4 text-amber-500"></i>
            </div>
            <div class="text-2xl font-extrabold text-slate-900 mt-1.5">${chamadosPendentes}</div>
            <p class="text-[11px] text-slate-500 mt-1">Aguardando abertura de O.S.</p>
        </div>

        <div class="osync-card p-5 border-l-4 border-l-purple-600">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase text-slate-400">Custo no Período</span>
                <i data-lucide="wallet" class="w-4 h-4 text-purple-600"></i>
            </div>
            <div class="text-2xl font-extrabold text-slate-900 mt-1.5">${OSyncUtils.formatarMoedaBR(custoTotal)}</div>
            <p class="text-[11px] text-slate-500 mt-1">Peças internas + serviços externos</p>
        </div>
    </div>`;
}

function construirHTML_CardWidget(widget) {
    const ehLista = widget.id.startsWith('lista_');
    const ehWidgetParadas = widget.id === 'grafico_maquinas_paradas_periodo';

    const botoesPeriodoParadas = ehWidgetParadas ? `
        <div class="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 shrink-0">
            <button type="button" onclick="alterarPeriodoWidgetParadas('semana')"
                class="px-2.5 py-1 text-[11px] font-bold rounded-md transition ${periodoWidgetParadas === 'semana' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}">
                Semana
            </button>
            <button type="button" onclick="alterarPeriodoWidgetParadas('mes')"
                class="px-2.5 py-1 text-[11px] font-bold rounded-md transition ${periodoWidgetParadas === 'mes' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}">
                Mês
            </button>
            <button type="button" onclick="alterarPeriodoWidgetParadas('ano')"
                class="px-2.5 py-1 text-[11px] font-bold rounded-md transition ${periodoWidgetParadas === 'ano' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}">
                Ano
            </button>
        </div>
    ` : `<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">${escaparHTML(widget.categoria)}</span>`;

    const idSeguro = escaparHTML(widget.id);
    const tituloLimpo = escaparHTML(widget.titulo.replace(/^(Gráfico:|Alerta:|Lista:)\s*/, ''));

    return `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
        <div class="flex items-start justify-between gap-2 mb-4 pb-2.5 border-b border-slate-100">
            <div>
                <h3 class="font-bold text-slate-900 text-sm">${tituloLimpo}</h3>
                <p class="text-[11px] text-slate-400">${escaparHTML(widget.descricao)}</p>
            </div>
            ${botoesPeriodoParadas}
        </div>

        ${ehLista
            ? `<div id="conteudo-${idSeguro}" class="space-y-2 max-h-64 overflow-y-auto"></div>`
            : ehWidgetParadas
                ? `<div id="wrapper-grafico-maquinas-paradas" class="relative h-64 w-full"><canvas id="canvas-${idSeguro}"></canvas></div>`
                : `<div class="relative h-64 w-full"><canvas id="canvas-${idSeguro}"></canvas></div>`
        }
    </div>`;
}

// ==========================================
// GRÁFICOS (CHART.JS)
// ==========================================
function montarGraficoCustosMensais() {
    const ctx = document.getElementById('canvas-grafico_custos_mensais');
    if (!ctx) return;

    const meses = [];
    const valores = [];
    const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        meses.push(`${nomesMeses[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`);

        const somaMes = cacheDashOrdens
            .filter(o => o.dataISO && o.dataISO.startsWith(chave))
            .reduce((acc, o) => acc + (Number(o.custoTotal) || 0), 0);
        valores.push(somaMes);
    }

    instanciasGraficosDash['grafico_custos_mensais'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [{
                label: 'Custo Total (R$)',
                data: valores,
                backgroundColor: '#00E5B0',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

async function alterarPeriodoWidgetParadas(novoPeriodo) {
    periodoWidgetParadas = novoPeriodo;
    if (novoPeriodo === 'ano' && !OSyncDataStore.isHistoricoCompletoCarregado()) {
        renderizarSkeletonDashboard();
        await carregarDadosBrutosDashboard(true);
    }
    renderizarWidgetsDashboard();
}

function montarGraficoMaquinasParadasPeriodo() {
    const wrapper = document.getElementById('wrapper-grafico-maquinas-paradas');
    if (!wrapper) return;

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');

    const ordensNoIntervalo = cacheDashOrdens.filter(os => {
        if (!OSyncUtils.osTeveParada(os)) return false;
        if (!os.dataISO) return false;

        if (periodoWidgetParadas === 'semana') {
            const limite = new Date();
            limite.setDate(limite.getDate() - 7);
            return new Date(os.dataISO) >= limite;
        }
        if (periodoWidgetParadas === 'mes') {
            return os.dataISO.startsWith(`${anoAtual}-${mesAtual}`);
        }
        if (periodoWidgetParadas === 'ano') {
            return os.dataISO.startsWith(`${anoAtual}-`);
        }
        return true;
    });

    const mapaMaquinas = {};
    ordensNoIntervalo.forEach(os => {
        const chave = `${os.ativoTag || 'TAG'} - ${os.ativoNome || 'Máquina'}`;
        if (!mapaMaquinas[chave]) {
            mapaMaquinas[chave] = { minutos: 0, ocorrencias: 0 };
        }
        mapaMaquinas[chave].minutos += OSyncUtils.calcularMinutosParada(os);
        mapaMaquinas[chave].ocorrencias += 1;
    });

    const ranking = Object.entries(mapaMaquinas).sort((a, b) => {
        if (b[1].minutos !== a[1].minutos) return b[1].minutos - a[1].minutos;
        return b[1].ocorrencias - a[1].ocorrencias;
    });

    const labelPeriodoTexto = {
        semana: 'nos últimos 7 dias',
        mes: 'neste mês',
        ano: 'neste ano'
    }[periodoWidgetParadas] || 'no período';

    if (ranking.length === 0) {
        wrapper.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center bg-emerald-50/70 border border-emerald-200 rounded-xl p-6 text-center">
                <span class="text-xs font-extrabold text-emerald-800">Nenhuma máquina parada ${escaparHTML(labelPeriodoTexto)}!</span>
                <span class="text-[11px] text-emerald-600 mt-1">100% da frota sem registros de parada no intervalo selecionado.</span>
            </div>`;
        return;
    }

    wrapper.innerHTML = `<canvas id="canvas-grafico_maquinas_paradas_periodo"></canvas>`;
    const ctx = document.getElementById('canvas-grafico_maquinas_paradas_periodo');
    if (!ctx) return;

    const labels = ranking.map(([nome, info]) => `${nome} (${info.ocorrencias}x)`);
    const horasDados = ranking.map(([, info]) => Number((info.minutos / 60).toFixed(2)));
    const minutosOriginais = ranking.map(([, info]) => info.minutos);
    const ocorrenciasOriginais = ranking.map(([, info]) => info.ocorrencias);

    instanciasGraficosDash['grafico_maquinas_paradas_periodo'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Tempo Parado (horas)',
                data: horasDados,
                backgroundColor: '#E11D48',
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const idx = context.dataIndex;
                            const mins = minutosOriginais[idx] || 0;
                            const qtd = ocorrenciasOriginais[idx] || 1;
                            const tempoFmt = mins > 0 ? OSyncUtils.formatarHorasParadas(mins) : 'Em aberto';
                            return ` Parada: ${tempoFmt} (${qtd} ${qtd === 1 ? 'ocorrência' : 'ocorrências'})`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: { display: true, text: 'Horas Paradas', font: { size: 10 } }
                }
            }
        }
    });
}

function montarGraficoTiposManutencao(ordens) {
    const ctx = document.getElementById('canvas-grafico_tipos_manutencao');
    if (!ctx) return;

    const contagem = {};
    ordens.forEach(o => {
        const tipo = o.tipoNome || 'Geral';
        contagem[tipo] = (contagem[tipo] || 0) + 1;
    });

    const labels = Object.keys(contagem);
    const dados = Object.values(contagem);

    instanciasGraficosDash['grafico_tipos_manutencao'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length ? labels : ['Sem dados'],
            datasets: [{
                data: dados.length ? dados : [1],
                backgroundColor: ['#1D4ED8', '#00E5B0', '#8B5CF6', '#F59E0B', '#EF4444', '#0F172A']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });
}

function montarGraficoTopMaquinasCusto(ordens) {
    const ctx = document.getElementById('canvas-grafico_top_maquinas_custo');
    if (!ctx) return;

    const mapa = {};
    ordens.forEach(o => {
        const chave = `${o.ativoTag || 'TAG'} - ${o.ativoNome || 'Máquina'}`;
        mapa[chave] = (mapa[chave] || 0) + (Number(o.custoTotal) || 0);
    });

    const ranking = Object.entries(mapa)
        .filter(([, val]) => val > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    instanciasGraficosDash['grafico_top_maquinas_custo'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ranking.length ? ranking.map(r => r[0]) : ['Sem custos no período'],
            datasets: [{
                label: 'Custo (R$)',
                data: ranking.length ? ranking.map(r => r[1]) : [0],
                backgroundColor: '#1D4ED8',
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

function montarGraficoTopMaquinasOS(ordens) {
    const ctx = document.getElementById('canvas-grafico_top_maquinas_os');
    if (!ctx) return;

    const mapa = {};
    ordens.forEach(o => {
        const chave = `${o.ativoTag || 'TAG'} - ${o.ativoNome || 'Máquina'}`;
        mapa[chave] = (mapa[chave] || 0) + 1;
    });

    const ranking = Object.entries(mapa)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    instanciasGraficosDash['grafico_top_maquinas_os'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ranking.length ? ranking.map(r => r[0]) : ['Sem O.S. no período'],
            datasets: [{
                label: 'Qtd. de O.S.',
                data: ranking.length ? ranking.map(r => r[1]) : [0],
                backgroundColor: '#F59E0B',
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

function montarGraficoProdutividadeTecnicos(ordens) {
    const ctx = document.getElementById('canvas-grafico_produtividade_tecnicos');
    if (!ctx) return;

    const mapa = {};
    ordens.forEach(o => {
        const tec = o.manutentorNome || 'Não atribuído';
        if (!mapa[tec]) mapa[tec] = { concluidas: 0, abertas: 0 };
        if (o.encerrada) mapa[tec].concluidas++;
        else mapa[tec].abertas++;
    });

    const labels = Object.keys(mapa);

    instanciasGraficosDash['grafico_produtividade_tecnicos'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['Sem dados'],
            datasets: [
                {
                    label: 'Concluídas',
                    data: labels.map(l => mapa[l].concluidas),
                    backgroundColor: '#10B981',
                    borderRadius: 4
                },
                {
                    label: 'Em Aberto',
                    data: labels.map(l => mapa[l].abertas),
                    backgroundColor: '#94A3B8',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
        }
    });
}

function montarGraficoStatusKanban(ordens) {
    const ctx = document.getElementById('canvas-grafico_status_kanban');
    if (!ctx) return;

    const labels = cacheDashColunas.map(c => c.titulo);
    const cores = cacheDashColunas.map(c => c.corTopo || '#1D4ED8');
    const valores = cacheDashColunas.map(c => ordens.filter(o => o.colunaId === c.id).length);

    instanciasGraficosDash['grafico_status_kanban'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['Sem colunas'],
            datasets: [{
                label: 'Qtd. O.S.',
                data: valores.length ? valores : [0],
                backgroundColor: cores.length ? cores : ['#1D4ED8'],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// ==========================================
// LISTAS DE AÇÃO RÁPIDA
// ==========================================
function preencherListaMaquinasParadas() {
    const el = document.getElementById('conteudo-lista_maquinas_paradas');
    if (!el) return;

    const paradas = cacheDashAtivos.filter(a => a.status && a.status !== 'Operacional');
    if (paradas.length === 0) {
        el.innerHTML = `<div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold text-center">100% das máquinas estão operacionais no momento!</div>`;
        return;
    }

    el.innerHTML = paradas.map(m => `
        <div class="p-3 bg-rose-50/70 border border-rose-200 rounded-xl flex items-center justify-between text-xs">
            <div>
                <span class="font-extrabold text-slate-900">${escaparHTML(m.codigoTag)} - ${escaparHTML(m.nome)}</span>
                <span class="block text-[11px] text-slate-500">Setor: ${escaparHTML(m.setor || 'Geral')}</span>
            </div>
            <span class="font-bold px-2.5 py-0.5 rounded-full bg-rose-600 text-white">${escaparHTML(m.status)}</span>
        </div>
    `).join('');
}

function preencherListaOSUrgentes() {
    const el = document.getElementById('conteudo-lista_os_urgentes');
    if (!el) return;

    const urgentes = cacheDashOrdens.filter(o => !o.encerrada && o.prioridade === 'Urgente');
    if (urgentes.length === 0) {
        el.innerHTML = `<div class="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">Nenhuma O.S. com prioridade Urgente em aberto.</div>`;
        return;
    }

    el.innerHTML = urgentes.map(os => `
        <div onclick="navegarPara('os')" class="cursor-pointer p-3 bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs transition">
            <div class="min-w-0">
                <span class="font-extrabold text-slate-900">#OS-${String(os.numeroOs || 0).padStart(4, '0')} • ${escaparHTML(os.ativoTag)} - ${escaparHTML(os.ativoNome)}</span>
                <p class="text-[11px] text-slate-600 truncate">${escaparHTML(os.descricao)}</p>
            </div>
            <span class="text-[11px] font-bold text-blue-700 shrink-0">${escaparHTML(os.manutentorNome || 'Sem técnico')}</span>
        </div>
    `).join('');
}

// ==========================================
// GAVETA FLUIDA: AJUSTAR PÁGINA DO DASHBOARD
// ==========================================
function abrirDrawerAjustarDashboard() {
    document.getElementById('drawer-ajustar-dashboard')?.classList.remove('hidden');
    renderizarListaConfigWidgets();
}

function fecharDrawerAjustarDashboard() {
    document.getElementById('drawer-ajustar-dashboard')?.classList.add('hidden');
}

function renderizarListaConfigWidgets() {
    const lista = document.getElementById('lista-config-widgets-dashboard');
    if (!lista) return;

    layoutWidgetsAtual.sort((a, b) => a.ordem - b.ordem);

    lista.innerHTML = layoutWidgetsAtual.map((w, idx) => `
        <div class="p-3.5 rounded-xl border ${w.ativo ? 'bg-white border-blue-200 shadow-2xs' : 'bg-slate-50 border-slate-200 opacity-70'} flex items-center justify-between gap-3 transition">
            <div class="flex items-start gap-3 min-w-0">
                <input type="checkbox" ${w.ativo ? 'checked' : ''} onchange="alternarWidgetDashboard('${escaparHTML(w.id)}', this.checked)"
                    class="mt-1 w-4 h-4 accent-blue-600 cursor-pointer shrink-0">
                <div class="min-w-0">
                    <div class="text-xs font-bold text-slate-900 truncate">${escaparHTML(w.titulo)}</div>
                    <p class="text-[11px] text-slate-500 leading-snug mt-0.5">${escaparHTML(w.descricao)}</p>
                </div>
            </div>

            <div class="flex flex-col gap-0.5 shrink-0">
                <button type="button" onclick="moverWidgetDashboard(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}
                    class="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-25">
                    <i data-lucide="chevron-up" class="w-4 h-4"></i>
                </button>
                <button type="button" onclick="moverWidgetDashboard(${idx}, 1)" ${idx === layoutWidgetsAtual.length - 1 ? 'disabled' : ''}
                    class="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-25">
                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `).join('');

    lucide.createIcons();
}

function alternarWidgetDashboard(id, ativo) {
    const item = layoutWidgetsAtual.find(w => w.id === id);
    if (item) item.ativo = ativo;
    renderizarListaConfigWidgets();
}

function moverWidgetDashboard(idxAtual, direcao) {
    const novoIdx = idxAtual + direcao;
    if (novoIdx < 0 || novoIdx >= layoutWidgetsAtual.length) return;

    const [movido] = layoutWidgetsAtual.splice(idxAtual, 1);
    layoutWidgetsAtual.splice(novoIdx, 0, movido);

    layoutWidgetsAtual.forEach((w, i) => {
        w.ordem = i + 1;
    });

    renderizarListaConfigWidgets();
}

function restaurarPadraoDashboard() {
    layoutWidgetsAtual = CATALOGO_WIDGETS_DASHBOARD.map(w => ({ ...w }));
    renderizarListaConfigWidgets();
}

async function salvarConfiguracaoDashboard() {
    const btn = document.getElementById('btn-salvar-layout-dashboard');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Salvando...';
    }

    try {
        const dadosSalvar = layoutWidgetsAtual.map((w, i) => ({
            id: w.id,
            ativo: Boolean(w.ativo),
            ordem: i + 1
        }));

        await db.collection('dashboard_config').doc(usuarioAtual.empresaId).set({
            empresaId: usuarioAtual.empresaId,
            widgets: dadosSalvar,
            atualizadoPor: usuarioAtual.nome,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        fecharDrawerAjustarDashboard();
        renderizarWidgetsDashboard();

        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Layout do Dashboard atualizado com sucesso!', 'sucesso');
        }
    } catch (err) {
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Erro ao salvar layout do dashboard: ' + err.message, 'erro');
        }
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i><span>Aplicar e Salvar</span>';
        lucide.createIcons();
    }
}
// ==========================================
// FILTRAGEM DE PERÍODO E LIMPEZA DE GRÁFICOS
// ==========================================
function destruirGraficosAnteriores() {
    Object.values(instanciasGraficosDash).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    instanciasGraficosDash = {};
}

function obterOrdensFiltradasDashboard() {
    const periodo = document.getElementById('dash-filtro-periodo')?.value || 'mes_atual';
    if (periodo === 'total') return cacheDashOrdens;

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');

    return cacheDashOrdens.filter(os => {
        if (!os.dataISO) return periodo === 'mes_atual' ? !os.encerrada : false;

        if (periodo === 'mes_atual') {
            return os.dataISO.startsWith(`${anoAtual}-${mesAtual}`);
        }
        if (periodo === 'mes_anterior') {
            const dAnt = new Date(anoAtual, hoje.getMonth() - 1, 1);
            const chaveAnt = `${dAnt.getFullYear()}-${String(dAnt.getMonth() + 1).padStart(2, '0')}`;
            return os.dataISO.startsWith(chaveAnt);
        }
        if (periodo === '30_dias' || periodo === 'ultimos_30_dias') {
            const limite = new Date();
            limite.setDate(limite.getDate() - 30);
            return new Date(os.dataISO) >= limite;
        }
        if (periodo === 'trimestre' || periodo === 'ultimos_90_dias') {
            const limite = new Date();
            limite.setDate(limite.getDate() - 90);
            return new Date(os.dataISO) >= limite;
        }
        if (periodo === 'ano_atual') {
            return os.dataISO.startsWith(`${anoAtual}-`);
        }
        return true;
    });
}
