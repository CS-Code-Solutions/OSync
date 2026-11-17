async function initSaaSEmpresas() {
    if (usuarioAtual?.perfil !== 'SuperAdmin') {
        navegarPara('os');
        return;
    }

    await carregarEmpresasSaaS();
    document.getElementById('form-nova-empresa-saas')?.addEventListener('submit', salvarNovaEmpresaSaaS);
    document.getElementById('form-usuario-empresa-saas')?.addEventListener('submit', salvarUsuarioEmpresaSaaS);
}

async function carregarEmpresasSaaS() {
    const grid = document.getElementById('lista-empresas-saas');
    if (!grid) return;

    const snap = await db.collection('empresas').get();
    const empresas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (empresas.length === 0) {
        grid.innerHTML = `<div class="col-span-full bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400">Nenhuma empresa cadastrada no SaaS.</div>`;
        return;
    }

    grid.innerHTML = empresas.map(emp => {
        const ativa = emp.ativa !== false;
        const selecionada = usuarioAtual.empresaId === emp.id;

        return `
        <div class="osync-card p-5 flex flex-col justify-between gap-4" style="border-left-color: ${ativa ? '#00E5B0' : '#F43F5E'}">
            <div>
                <div class="flex items-center justify-between gap-2 mb-1">
                    <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${ativa ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                        ${ativa ? 'Ativa' : 'Suspensa'} • Plano ${emp.plano || 'Pro'}
                    </span>
                    ${selecionada ? '<span class="text-[10px] font-extrabold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Visualizando</span>' : ''}
                </div>
                <h3 class="font-bold text-base text-slate-900 mt-1">${emp.nome}</h3>
                <p class="text-xs text-slate-500">${emp.cnpj || 'CNPJ não informado'}</p>

                <!-- Código de Convite -->
                <div class="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                    <code class="text-[11px] font-mono text-slate-700 truncate">${emp.id}</code>
                    <button onclick="copiarTextoSimples('${emp.id}')" class="text-xs font-bold text-blue-600 hover:underline shrink-0">Copiar ID</button>
                </div>
            </div>

            <div class="space-y-2 pt-3 border-t border-slate-100">
                <div class="flex items-center gap-2">
                    <button onclick="acessarAmbienteEmpresa('${emp.id}', '${emp.nome}')"
                        class="flex-1 bg-[#0B1120] hover:bg-slate-800 text-white text-xs font-bold py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5">
                        <i data-lucide="eye" class="w-3.5 h-3.5 text-[#00E5B0]"></i>
                        <span>Entrar no Painel</span>
                    </button>
                    <button onclick="alternarStatusEmpresa('${emp.id}', ${ativa})" title="${ativa ? 'Suspender Empresa' : 'Reativar Empresa'}"
                        class="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition">
                        <i data-lucide="${ativa ? 'pause-circle' : 'play-circle'}" class="w-4 h-4 ${ativa ? 'text-amber-600' : 'text-emerald-600'}"></i>
                    </button>
                </div>

                <button onclick="abrirModalUsuarioEmpresaSaaS('${emp.id}', '${emp.nome}')"
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

        const empRef = await db.collection('empresas').add({
            nome,
            cnpj,
            plano,
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
        carregarEmpresasSaaS();
    } catch (err) {
        alert('Erro ao criar empresa: ' + err.message);
    }

    btn.disabled = false;
    btn.textContent = 'Criar Empresa';
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
        alert(`Usuário "${nome}" (${perfil}) criado com sucesso!`);
    } catch (err) {
        alert('Erro ao criar usuário: ' + err.message);
    }

    btn.disabled = false;
    btn.textContent = 'Criar Acesso';
}

async function alternarStatusEmpresa(empId, statusAtual) {
    const acao = statusAtual ? 'suspender' : 'reativar';
    if (!confirm(`Deseja realmente ${acao} o acesso desta empresa?`)) return;

    await db.collection('empresas').doc(empId).update({ ativa: !statusAtual });
    carregarEmpresasSaaS();
}

function acessarAmbienteEmpresa(empId, empNome) {
    usuarioAtual.empresaId = empId;
    document.getElementById('header-user-role').textContent = `SuperAdmin • ${empNome}`;
    navegarPara('os');
}

function copiarTextoSimples(texto) {
    navigator.clipboard.writeText(texto);
    alert('Código copiado: ' + texto);
}
