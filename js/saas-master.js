let unsubscribeSaaSEmpresas = null;

async function initSaaSEmpresas() {
    if (usuarioAtual?.perfil !== 'SuperAdmin') {
        navegarPara('os');
        return;
    }

    iniciarListenerEmpresasSaaS();
    document.getElementById('form-nova-empresa-saas')?.addEventListener('submit', salvarNovaEmpresaSaaS);
    document.getElementById('form-usuario-empresa-saas')?.addEventListener('submit', salvarUsuarioEmpresaSaaS);
}

function calcularVencimentoContrato(tipoContrato) {
    const hoje = new Date();
    const dias = tipoContrato === 'teste_7d' ? 7 : 365;
    hoje.setDate(hoje.getDate() + dias);
    return hoje.toISOString();
}

function iniciarListenerEmpresasSaaS() {
    if (unsubscribeSaaSEmpresas) unsubscribeSaaSEmpresas();

    unsubscribeSaaSEmpresas = db.collection('empresas').onSnapshot(async (empSnap) => {
        const grid = document.getElementById('lista-empresas-saas');
        if (!grid) return;

        const empresas = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (empresas.length === 0) {
            grid.innerHTML = `<div class="col-span-full bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400">Nenhuma empresa cadastrada no SaaS.</div>`;
            return;
        }

        const usersSnap = await db.collection('usuarios').where('perfil', '==', 'Admin').get();
        const gestores = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        renderizarCardsEmpresasSaaS(empresas, gestores);
    });
}

function renderizarCardsEmpresasSaaS(empresas, gestores) {
    const grid = document.getElementById('lista-empresas-saas');
    if (!grid) return;

    grid.innerHTML = empresas.map(emp => {
        const empIdSeguro = escaparHTML(emp.id);
        const empNomeSeguro = escaparHTML(emp.nome);
        const ativa = emp.ativa !== false;
        const selecionada = usuarioAtual.empresaId === emp.id;

        const gestoresDaEmpresa = gestores.filter(g => g.empresaId === emp.id);
        const htmlGestores = gestoresDaEmpresa.length > 0
            ? gestoresDaEmpresa.map(g => `
                <div class="flex items-center justify-between text-xs bg-blue-50/80 border border-blue-200/70 rounded-lg px-3 py-2">
                    <div class="min-w-0">
                        <span class="font-bold text-slate-800 block truncate">${escaparHTML(g.nome)}</span>
                        <span class="text-[11px] text-slate-500 block truncate">${escaparHTML(g.email)}</span>
                    </div>
                    <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-600 text-white shrink-0 ml-2">Gestor</span>
                </div>
            `).join('')
            : `<div class="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                <i data-lucide="alert-circle" class="w-3.5 h-3.5 shrink-0"></i>
                <span>Nenhum gestor cadastrado ainda</span>
               </div>`;

        const labelContrato = emp.tipoContrato === 'teste_7d' ? '7 dias (Teste)' : '1 ano (Renovável)';
        let infoVencimento = 'Sem vencimento definido';
        let expirado = false;

        if (emp.dataVencimento) {
            const venc = new Date(emp.dataVencimento);
            const diffDias = Math.ceil((venc - new Date()) / (1000 * 60 * 60 * 24));
            const dataBR = venc.toLocaleDateString('pt-BR');
            expirado = diffDias < 0;
            infoVencimento = expirado
                ? `Vencido em ${dataBR} (${Math.abs(diffDias)}d atrás)`
                : `Vence em ${dataBR} (${diffDias}d restantes)`;
        }

        const tarjaVencidaHTML = expirado ? `
            <div class="tarja-vencida-piscante text-white text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg text-center mb-2">
                VENCIDA
            </div>
        ` : '';

        return `
        <div class="osync-card p-5 flex flex-col justify-between gap-4" style="border-left-color: ${ativa && !expirado ? '#00E5B0' : '#F43F5E'}">
            <div>
                ${tarjaVencidaHTML}
                <div class="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${ativa && !expirado ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                        ${!ativa ? 'Suspensa' : (expirado ? 'Contrato Vencido' : 'Ativa')} • ${escaparHTML(emp.plano || 'Pro')}
                    </span>
                    ${selecionada ? '<span class="text-[10px] font-extrabold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Visualizando</span>' : ''}
                </div>

                <h3 class="font-bold text-base text-slate-900 mt-1">${empNomeSeguro}</h3>
                <p class="text-xs text-slate-500">${escaparHTML(emp.cnpj || 'CNPJ não informado')}</p>

                <!-- Bloco de Contrato -->
                <div class="mt-2.5 p-2.5 rounded-lg border ${expirado ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-700'} text-xs space-y-0.5">
                    <div class="font-bold flex items-center justify-between">
                        <span>Contrato: ${escaparHTML(labelContrato)}</span>
                        <button data-nome="${empNomeSeguro}" onclick="renovarContratoEmpresa('${empIdSeguro}', this.getAttribute('data-nome'))" class="text-[11px] font-extrabold text-emerald-600 hover:underline">
                            + Renovar 1 Ano
                        </button>
                    </div>
                    <div class="text-[11px] opacity-80">${escaparHTML(infoVencimento)}</div>
                </div>

                <!-- Código de Convite -->
                <div class="mt-2.5 p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                    <code class="text-[11px] font-mono text-slate-700 truncate">${empIdSeguro}</code>
                    <button onclick="copiarTextoSimples('${empIdSeguro}')" class="text-xs font-bold text-blue-600 hover:underline shrink-0">Copiar ID</button>
                </div>

                <!-- Gestor(es) Cadastrado(s) -->
                <div class="mt-3 space-y-1.5">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Responsável / Gestor</span>
                    ${htmlGestores}
                </div>
            </div>

            <div class="space-y-2 pt-3 border-t border-slate-100">
                <div class="flex items-center gap-2">
                    <button data-nome="${empNomeSeguro}" onclick="acessarAmbienteEmpresa('${empIdSeguro}', this.getAttribute('data-nome'))"
                        class="flex-1 bg-[#0B1120] hover:bg-slate-800 text-white text-xs font-bold py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5">
                        <i data-lucide="eye" class="w-3.5 h-3.5 text-[#00E5B0]"></i>
                        <span>Entrar no Painel</span>
                    </button>
                    <button onclick="alternarStatusEmpresa('${empIdSeguro}', ${Boolean(ativa)})" title="${ativa ? 'Suspender Empresa' : 'Reativar Empresa'}"
                        class="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition">
                        <i data-lucide="${ativa ? 'pause-circle' : 'play-circle'}" class="w-4 h-4 ${ativa ? 'text-amber-600' : 'text-emerald-600'}"></i>
                    </button>
                </div>

                <button data-nome="${empNomeSeguro}" onclick="abrirModalUsuarioEmpresaSaaS('${empIdSeguro}', this.getAttribute('data-nome'))"
                    class="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5">
                    <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
                    <span>+ Criar Usuário / Gestor</span>
                </button>
            </div>
        </div>`;
    }).join('');

    lucide.createIcons();
}

function abrirModalNovaEmpresaSaaS() {
    document.getElementById('modal-nova-empresa-saas').classList.remove('hidden');
}

function fecharModalNovaEmpresaSaaS() {
    document.getElementById('modal-nova-empresa-saas').classList.add('hidden');
}

async function salvarNovaEmpresaSaaS(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-empresa-saas');
    btn.disabled = true;
    btn.textContent = 'Criando...';

    try {
        const nome = document.getElementById('saas-emp-nome').value.trim();
        const cnpj = document.getElementById('saas-emp-cnpj').value.trim();
        const plano = document.getElementById('saas-emp-plano').value;
        const tipoContrato = document.getElementById('saas-emp-contrato').value;
        const dataVencimento = calcularVencimentoContrato(tipoContrato);

        const empRef = await db.collection('empresas').add({
            nome,
            cnpj,
            plano,
            tipoContrato,
            dataVencimento,
            ativa: true,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        const batch = db.batch();
        [
            { titulo: 'Aberta', ordem: 1, corTopo: '#00E5B0' },
            { titulo: 'Em Andamento', ordem: 2, corTopo: '#1D4ED8' },
            { titulo: 'Concluída', ordem: 3, corTopo: '#10B981' }
        ].forEach(c => {
            batch.set(db.collection('kanban_colunas').doc(), { ...c, empresaId: empRef.id });
        });
        await batch.commit();

        fecharModalNovaEmpresaSaaS();
        e.target.reset();
        mostrarNotificacaoOSync(`Empresa "${nome}" criada com sucesso!`, 'sucesso');
    } catch (err) {
        mostrarNotificacaoOSync('Erro ao criar empresa: ' + err.message, 'erro');
    }

    btn.disabled = false;
    btn.textContent = 'Criar Empresa';
}

async function renovarContratoEmpresa(empId, nome) {
    if (!confirm(`Confirmar renovação de 1 ano (365 dias) para "${nome}"?`)) return;

    const novaData = calcularVencimentoContrato('anual_1a');
    await db.collection('empresas').doc(empId).update({
        tipoContrato: 'anual_1a',
        dataVencimento: novaData,
        ativa: true
    });
    mostrarNotificacaoOSync(`Contrato de "${nome}" renovado por 1 ano!`, 'sucesso');
}

function abrirModalUsuarioEmpresaSaaS(empId, empNome) {
    document.getElementById('saas-user-emp-id').value = empId;
    document.getElementById('saas-user-emp-nome').textContent = empNome;
    document.getElementById('modal-usuario-empresa-saas').classList.remove('hidden');
}

function fecharModalUsuarioEmpresaSaaS() {
    document.getElementById('modal-usuario-empresa-saas').classList.add('hidden');
}

async function salvarUsuarioEmpresaSaaS(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-user-saas');
    btn.disabled = true;
    btn.textContent = 'Criando...';

    const empresaId = document.getElementById('saas-user-emp-id').value;
    const nome = document.getElementById('saas-user-nome').value.trim();
    const perfil = document.getElementById('saas-user-perfil').value;
    const setor = document.getElementById('saas-user-setor').value.trim();
    const email = document.getElementById('saas-user-email').value.trim();
    const senha = document.getElementById('saas-user-senha').value;

    const appSecundario = firebase.apps.find(a => a.name === 'SecondaryApp') || firebase.initializeApp(firebaseConfig, 'SecondaryApp');

    try {
        const cred = await appSecundario.auth().createUserWithEmailAndPassword(email, senha);
        await appSecundario.auth().signOut();

        await db.collection('usuarios').doc(cred.user.uid).set({
            empresaId,
            nome,
            email,
            perfil,
            setor,
            ativo: true,
            statusAcesso: 'aprovado',
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        fecharModalUsuarioEmpresaSaaS();
        e.target.reset();
        iniciarListenerEmpresasSaaS();
        mostrarNotificacaoOSync(`Usuário "${nome}" (${perfil}) criado com sucesso!`, 'sucesso');
    } catch (err) {
        mostrarNotificacaoOSync('Erro ao criar usuário: ' + err.message, 'erro');
    }

    btn.disabled = false;
    btn.textContent = 'Criar Acesso';
}

async function alternarStatusEmpresa(empId, statusAtual) {
    const acao = statusAtual ? 'suspender' : 'reativar';
    if (!confirm(`Deseja realmente ${acao} o acesso desta empresa?`)) return;

    await db.collection('empresas').doc(empId).update({ ativa: !statusAtual });
    mostrarNotificacaoOSync(`Status da empresa atualizado!`, 'sucesso');
}

function acessarAmbienteEmpresa(empId, empNome) {
    usuarioAtual.empresaId = empId;
    document.getElementById('header-user-role').textContent = `SuperAdmin • ${empNome}`;
    navegarPara('os');
}

function copiarTextoSimples(texto) {
    navigator.clipboard.writeText(texto);
    mostrarNotificacaoOSync('Código copiado para a área de transferência!', 'sucesso');
}
