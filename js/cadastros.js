let cacheAtivos = [];
let cacheUsuariosPerfil = [];
let perfilAtualCadastro = 'Manutentor';

// ==========================================
// MÓDULO 1: ATIVOS (MÁQUINAS) E QR CODE
// ==========================================
async function initAtivos() {
    await carregarAtivos();
    document.getElementById('form-novo-ativo')?.addEventListener('submit', salvarNovoAtivo);

    const params = new URLSearchParams(window.location.search);
    const ativoIdUrl = params.get('ativo');
    if (ativoIdUrl) {
        abrirProntuarioAtivo(ativoIdUrl);
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

    lista.innerHTML = ativos.map(ativo => `
        <div class="osync-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="space-y-1">
                <div class="flex items-center gap-2.5 flex-wrap">
                    <span class="font-extrabold text-base text-slate-900">${ativo.codigoTag} - ${ativo.nome}</span>
                    <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 flex items-center gap-1">
                        <i data-lucide="settings" class="w-3 h-3"></i> ${ativo.setor || 'Geral'}
                    </span>
                    <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badgeStatus[ativo.status] || 'bg-slate-100 text-slate-700'}">
                        ${ativo.status}
                    </span>
                </div>
                <div class="text-xs text-slate-500 flex items-center gap-3">
                    <span><i data-lucide="factory" class="w-3.5 h-3.5 inline mr-1"></i>${ativo.fabricante || 'Fabricante N/I'}</span>
                    <span>•</span>
                    <span>Modelo: ${ativo.modelo || 'N/I'}</span>
                </div>
            </div>

            <div class="flex items-center gap-2 self-end sm:self-center">
                <button onclick="abrirProntuarioAtivo('${ativo.id}')" class="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition">
                    <i data-lucide="qr-code" class="w-4 h-4"></i>
                    <span>QR Code & Prontuário</span>
                </button>
                <button onclick="excluirAtivo('${ativo.id}', '${ativo.nome}')" title="Excluir Máquina" class="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `).join('');

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
        await db.collection('ativos').add({
            empresaId: usuarioAtual.empresaId,
            codigoTag: document.getElementById('ativo-tag').value.trim().toUpperCase(),
            nome: document.getElementById('ativo-nome').value.trim(),
            fabricante: document.getElementById('ativo-fabricante').value.trim(),
            modelo: document.getElementById('ativo-modelo').value.trim(),
            setor: document.getElementById('ativo-setor').value.trim(),
            status: document.getElementById('ativo-status').value,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        fecharModalNovoAtivo();
        e.target.reset();
        carregarAtivos();
    } catch (err) {
        alert('Erro ao cadastrar máquina: ' + err.message);
    }
}

async function excluirAtivo(ativoId, nome) {
    if (!confirm(`Deseja excluir a máquina "${nome}"?`)) return;
    await db.collection('ativos').doc(ativoId).delete();
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
    const urlMaquina = `${window.location.origin}${window.location.pathname}?ativo=${ativo.id}`;
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
                    <div class="font-bold text-slate-800">#OS-${String(os.numeroOs || 0).padStart(4, '0')} • ${os.tipoNome || 'Manutenção'}</div>
                    <p class="text-slate-600 mt-1">${os.descricao}</p>
                    <span class="text-[11px] text-slate-400 block mt-1">Técnico: ${os.manutentorNome || 'N/A'} • Data: ${dataFormatada}</span>
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

    grid.innerHTML = cacheUsuariosPerfil.map(u => `
        <div class="osync-card p-4 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-11 h-11 shrink-0 rounded-full bg-[#0B1120] text-[#00E5B0] font-bold flex items-center justify-center text-sm border border-slate-700">
                    ${(u.nome || 'US').substring(0, 2).toUpperCase()}
                </div>
                <div class="min-w-0">
                    <h4 class="font-bold text-slate-900 text-sm truncate">${u.nome}</h4>
                    <p class="text-xs text-slate-500 truncate">${u.email}</p>
                    <span class="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        <i data-lucide="wrench" class="w-3 h-3"></i> ${u.setor || 'Geral'}
                    </span>
                </div>
            </div>

            <div class="flex items-center gap-1 shrink-0">
                <button onclick="abrirModalEditarUsuario('${u.id}')" title="Editar" class="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button onclick="excluirUsuarioPerfil('${u.id}', '${u.nome}')" title="Excluir" class="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `).join('');

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

    verificarOutraEspecialidade();
    document.getElementById('modal-novo-usuario')?.classList.remove('hidden');
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

    document.getElementById('modal-novo-usuario')?.classList.remove('hidden');
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

    let setor = '';
    const selectSetor = document.getElementById('user-setor-select');
    if (selectSetor) {
        setor = selectSetor.value === 'Outra'
            ? document.getElementById('user-setor-outro').value.trim()
            : selectSetor.value;
    } else {
        setor = document.getElementById('user-setor').value.trim();
    }

    // MODO EDIÇÃO
    if (editId) {
        btn.textContent = 'Salvando...';
        try {
            await db.collection('usuarios').doc(editId).update({ nome, setor });
            fecharModalNovoUsuario();
            carregarUsuariosPorPerfil(perfil);
        } catch (err) {
            alert('Erro ao atualizar: ' + err.message);
        }
        btn.disabled = false;
        return;
    }

    // MODO CRIAÇÃO
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
            ativo: true,
            statusAcesso: 'aprovado',
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        fecharModalNovoUsuario();
        e.target.reset();
        carregarUsuariosPorPerfil(perfil);
    } catch (err) {
        alert('Erro ao criar acesso: ' + err.message);
    }

    btn.disabled = false;
    btn.textContent = 'Criar Acesso';
}

async function excluirUsuarioPerfil(userId, nome) {
    if (!confirm(`Deseja realmente excluir "${nome}" da equipe?`)) return;
    try {
        await db.collection('usuarios').doc(userId).delete();
        carregarUsuariosPorPerfil(perfilAtualCadastro);
    } catch (err) {
        alert('Erro ao excluir: ' + err.message);
    }
}
