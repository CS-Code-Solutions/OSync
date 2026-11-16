let cacheAtivos = [];
let perfilAtualCadastro = 'Manutentor';

// ==========================================
// MÓDULO 1: ATIVOS (MÁQUINAS) E QR CODE
// ==========================================
async function initAtivos() {
    await carregarAtivos();
    document.getElementById('form-novo-ativo')?.addEventListener('submit', salvarNovoAtivo);

    // Verifica se a URL veio da leitura de um QR Code (?ativo=ID)
    const params = new URLSearchParams(window.location.search);
    const ativoIdUrl = params.get('ativo');
    if (ativoIdUrl) {
        abrirProntuarioAtivo(ativoIdUrl);
    }
}

async function carregarAtivos() {
    const lista = document.getElementById('lista-ativos');
    if (!lista) return;

    const { data, error } = await db.from('ativos').select('*').order('codigo_tag', { ascending: true });
    if (error) return;

    cacheAtivos = data || [];
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
                    <span class="font-extrabold text-base text-slate-900">${ativo.codigo_tag} - ${ativo.nome}</span>
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
            </div>
        </div>
    `).join('');

    lucide.createIcons();
}

function filtrarAtivos() {
    const termo = document.getElementById('busca-ativos').value.toLowerCase();
    const filtrados = cacheAtivos.filter(a =>
        `${a.codigo_tag} ${a.nome} ${a.fabricante || ''} ${a.setor || ''}`.toLowerCase().includes(termo)
    );
    renderizarListaAtivos(filtrados);
}

function abrirModalNovoAtivo() {
    document.getElementById('modal-novo-ativo').classList.remove('hidden');
}

function fecharModalNovoAtivo() {
    document.getElementById('modal-novo-ativo').classList.add('hidden');
}

async function salvarNovoAtivo(e) {
    e.preventDefault();
    const payload = {
        empresa_id: usuarioAtual?.empresa_id,
        codigo_tag: document.getElementById('ativo-tag').value.trim().toUpperCase(),
        nome: document.getElementById('ativo-nome').value.trim(),
        fabricante: document.getElementById('ativo-fabricante').value.trim(),
        modelo: document.getElementById('ativo-modelo').value.trim(),
        setor: document.getElementById('ativo-setor').value.trim(),
        status: document.getElementById('ativo-status').value
    };

    const { error } = await db.from('ativos').insert([payload]);
    if (!error) {
        fecharModalNovoAtivo();
        e.target.reset();
        carregarAtivos();
    } else {
        alert('Erro ao cadastrar máquina: ' + error.message);
    }
}

async function abrirProntuarioAtivo(ativoId) {
    const ativo = cacheAtivos.find(a => a.id === ativoId);
    if (!ativo) return;

    document.getElementById('prontuario-tag').textContent = ativo.codigo_tag;
    document.getElementById('prontuario-nome').textContent = ativo.nome;
    document.getElementById('prontuario-setor').textContent = ativo.setor || 'Não informado';
    document.getElementById('prontuario-fab-mod').textContent = `${ativo.fabricante || '-'} / ${ativo.modelo || '-'}`;
    document.getElementById('prontuario-status').textContent = ativo.status;
    document.getElementById('qrcode-label').textContent = `${ativo.codigo_tag} • OSync`;

    // Gera QR Code apontando para a URL da máquina
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

    // Busca histórico de O.S. desta máquina
    const historicoBox = document.getElementById('prontuario-historico-os');
    historicoBox.innerHTML = '<p class="text-xs text-slate-400">Carregando histórico...</p>';
    document.getElementById('modal-prontuario-ativo').classList.remove('hidden');

    const { data: ordens } = await db
        .from('ordens_servico')
        .select('*, tipos_manutencao(nome), usuarios(nome)')
        .eq('ativo_id', ativo.id)
        .order('criado_em', { ascending: false });

    if (!ordens || ordens.length === 0) {
        historicoBox.innerHTML = '<p class="text-xs text-slate-400 bg-slate-50 p-4 rounded-lg text-center">Nenhuma manutenção registrada para este equipamento.</p>';
    } else {
        historicoBox.innerHTML = ordens.map(os => `
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-start gap-3">
                <div>
                    <div class="font-bold text-slate-800">#OS-${String(os.numero_os).padStart(4, '0')} • ${os.tipos_manutencao?.nome || 'Manutenção'}</div>
                    <p class="text-slate-600 mt-1">${os.descricao}</p>
                    <span class="text-[11px] text-slate-400 block mt-1">Técnico: ${os.usuarios?.nome || 'N/A'} • Data: ${new Date(os.criado_em).toLocaleDateString('pt-BR')}</span>
                </div>
                <span class="font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shrink-0">
                    R$ ${Number(os.custo_total || 0).toFixed(2)}
                </span>
            </div>
        `).join('');
    }
    lucide.createIcons();
}

function fecharProntuarioAtivo() {
    document.getElementById('modal-prontuario-ativo').classList.add('hidden');
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

async function carregarUsuariosPorPerfil(perfil) {
    const grid = document.getElementById('lista-usuarios-perfil');
    if (!grid) return;

    const { data } = await db
        .from('usuarios')
        .select('*')
        .eq('perfil', perfil)
        .order('nome', { ascending: true });

    if (!data || data.length === 0) {
        grid.innerHTML = `<div class="col-span-full bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400">Nenhum registro encontrado nesta categoria.</div>`;
        return;
    }

    grid.innerHTML = data.map(u => `
        <div class="osync-card p-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-[#0B1120] text-[#00E5B0] font-bold flex items-center justify-center text-sm">
                    ${u.nome.substring(0, 2).toUpperCase()}
                </div>
                <div>
                    <h4 class="font-bold text-slate-900 text-sm">${u.nome}</h4>
                    <p class="text-xs text-slate-500">${u.email}</p>
                    <span class="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        Setor: ${u.setor || 'Geral'}
                    </span>
                </div>
            </div>
        </div>
    `).join('');
}

function abrirModalNovoUsuario(perfil) {
    document.getElementById('user-perfil-alvo').value = perfil;
    document.getElementById('modal-usuario-titulo').textContent = perfil === 'Manutentor' ? 'Cadastrar Manutentor' : 'Cadastrar Líder de Setor';
    document.getElementById('modal-novo-usuario').classList.remove('hidden');
}

function fecharModalNovoUsuario() {
    document.getElementById('modal-novo-usuario').classList.add('hidden');
}

async function salvarNovoUsuario(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-usuario');
    btn.disabled = true;
    btn.textContent = 'Criando...';

    const nome = document.getElementById('user-nome').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-senha').value;
    const setor = document.getElementById('user-setor').value.trim();
    const perfil = document.getElementById('user-perfil-alvo').value;

    // Cria cliente secundário sem persistir sessão para não deslogar o Admin atual
    const clientSecundario = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false }
    });

    const { data: authData, error: authError } = await clientSecundario.auth.signUp({ email, password });

    if (authError) {
        alert('Erro ao criar login: ' + authError.message);
        btn.disabled = false;
        btn.textContent = 'Criar Acesso';
        return;
    }

    if (authData?.user) {
        const { error: dbError } = await db.from('usuarios').insert([{
            id: authData.user.id,
            empresa_id: usuarioAtual?.empresa_id,
            nome,
            email,
            perfil,
            setor
        }]);

        if (!dbError) {
            fecharModalNovoUsuario();
            e.target.reset();
            carregarUsuariosPorPerfil(perfil);
        } else {
            alert('Erro ao salvar perfil no banco: ' + dbError.message);
        }
    }

    btn.disabled = false;
    btn.textContent = 'Criar Acesso';
}
