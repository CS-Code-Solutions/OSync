let cacheAtivosCC = [];
let cacheOrdensCC = [];

async function initCentrosCusto() {
    if (usuarioAtual?.perfil !== 'Admin' && usuarioAtual?.perfil !== 'SuperAdmin') {
        navegarPara('os');
        return;
    }

    const [ativosSnap, osSnap] = await Promise.all([
        db.collection('ativos').where('empresaId', '==', usuarioAtual.empresaId).get(),
        db.collection('ordens_servico').where('empresaId', '==', usuarioAtual.empresaId).get()
    ]);

    cacheAtivosCC = ativosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cacheOrdensCC = osSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Popula filtro de setores únicos dos ativos
    const setores = [...new Set(cacheAtivosCC.map(a => a.setor).filter(Boolean))].sort();
    const selSetor = document.getElementById('filtro-cc-setor');
    if (selSetor) {
        selSetor.innerHTML = '<option value="">Todos Setores</option>' +
            setores.map(s => `<option value="${s}">${s}</option>`).join('');
    }

    renderizarCentrosCusto();
}

function formatarMoedaBR(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderizarCentrosCusto() {
    const grid = document.getElementById('lista-centros-custo');
    if (!grid) return;

    const busca = (document.getElementById('filtro-cc-busca')?.value || '').toLowerCase();
    const setorFiltro = document.getElementById('filtro-cc-setor')?.value || '';
    const dataInicio = document.getElementById('filtro-cc-inicio')?.value || '';
    const dataFim = document.getElementById('filtro-cc-fim')?.value || '';

    // Filtra máquinas
    const ativosFiltrados = cacheAtivosCC.filter(a => {
        if (setorFiltro && a.setor !== setorFiltro) return false;
        if (busca) {
            const texto = `${a.codigoTag} ${a.nome} ${a.setor}`.toLowerCase();
            if (!texto.includes(busca)) return false;
        }
        return true;
    });

    // Consolida custos por ativo
    let custoTotalGeral = 0;
    let totalOSGeral = 0;
    let maquinaTop = { nome: '-', valor: 0 };

    const dadosConsolidados = ativosFiltrados.map(ativo => {
        const ordensDoAtivo = cacheOrdensCC.filter(os => {
            if (os.ativoId !== ativo.id) return false;

            // Filtro de período baseado na data de encerramento ou criação
            const rawData = os.encerradaEm?.toDate ? os.encerradaEm.toDate() : (os.criadoEm?.toDate ? os.criadoEm.toDate() : null);
            if (rawData) {
                const isoDia = rawData.toISOString().slice(0, 10);
                if (dataInicio && isoDia < dataInicio) return false;
                if (dataFim && isoDia > dataFim) return false;
            }
            return true;
        });

        const custoAtivo = ordensDoAtivo.reduce((soma, o) => soma + (Number(o.custoTotal) || 0), 0);
        custoTotalGeral += custoAtivo;
        totalOSGeral += ordensDoAtivo.length;

        if (custoAtivo > maquinaTop.valor) {
            maquinaTop = { nome: `${ativo.codigoTag} - ${ativo.nome}`, valor: custoAtivo };
        }

        return { ativo, ordens: ordensDoAtivo, custoAtivo };
    }).sort((a, b) => b.custoAtivo - a.custoAtivo);

    // Atualiza cards de topo
    document.getElementById('cc-resumo-total').textContent = formatarMoedaBR(custoTotalGeral);
    document.getElementById('cc-resumo-qtd').textContent = totalOSGeral;
    document.getElementById('cc-resumo-top').textContent = maquinaTop.valor > 0
        ? `${maquinaTop.nome} (${formatarMoedaBR(maquinaTop.valor)})`
        : 'Sem gastos registrados';

    if (dadosConsolidados.length === 0) {
        grid.innerHTML = `<div class="col-span-full bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-sm">Nenhuma máquina encontrada para os filtros informados.</div>`;
        return;
    }

    grid.innerHTML = dadosConsolidados.map(({ ativo, ordens, custoAtivo }) => {
        const osEncerradas = ordens.filter(o => o.encerrada).length;
        const operante = ativo.status !== 'Parada';

        return `
        <div class="osync-card p-5 flex flex-col justify-between gap-4" style="border-left-color: ${custoAtivo > 0 ? '#1D4ED8' : '#00E5B0'}">
            <div>
                <div class="flex items-center justify-between gap-2 mb-1">
                    <span class="text-xs font-extrabold font-mono px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        CC • ${ativo.codigoTag || 'SEM-TAG'}
                    </span>
                    <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${operante ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                        ${operante ? 'Operacional' : 'Parada'}
                    </span>
                </div>

                <h3 class="font-bold text-base text-slate-900 mt-1">${ativo.nome}</h3>
                <p class="text-xs text-slate-500">Setor: ${ativo.setor || 'Não informado'}</p>

                <div class="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                        <span class="text-[11px] text-slate-500 block">Gasto Acumulado</span>
                        <span class="text-lg font-extrabold text-slate-900">${formatarMoedaBR(custoAtivo)}</span>
                    </div>
                    <div class="text-right text-xs text-slate-600">
                        <span class="block font-bold">${ordens.length} O.S. total</span>
                        <span class="text-[11px] text-slate-400">${osEncerradas} concluída(s)</span>
                    </div>
                </div>
            </div>

            <button onclick="gerarRelatorioCentroCustoPDF('${ativo.id}')"
                class="w-full bg-slate-900 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2">
                <i data-lucide="file-down" class="w-4 h-4 text-[#00E5B0]"></i>
                <span>Gerar Relatório (PDF)</span>
            </button>
        </div>`;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function gerarRelatorioCentroCustoPDF(ativoId) {
    if (ativoId === 'geral') {
        mostrarNotificacaoOSync('Estrutura pronta! Em breve vamos configurar o layout do PDF consolidado.', 'info');
        return;
    }
    const item = cacheAtivosCC.find(a => a.id === ativoId);
    const nome = item ? `${item.codigoTag} - ${item.nome}` : 'Ativo';
    mostrarNotificacaoOSync(`Preparando estrutura do relatório PDF para: ${nome}`, 'info');
}
