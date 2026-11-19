/**
 * ============================================================================
 * OSync — Módulo de Cadastros (Manutentores, Liderança e Ativos)
 * ============================================================================
 */

let abaCadastroAtual = 'manutentores';
let listaUsuariosCadastro = [];
let listaAtivosCadastro = [];

const ROTULOS_PAGINAS_PERFIL = {
    'dashboard': 'Dashboard',
    'os': 'Ordens de Serviço',
    'solicitacoes': 'Solicitações',
    'cad-manutentores': 'Cad. Manutentores',
    'cad-lideranca': 'Cad. Liderança',
    'cad-ativos': 'Cad. Ativos',
    'planos-manutencao': 'Planos Manut.',
    'relatorios': 'Relatórios'
};

/**
 * Inicializa a tela de Cadastros na sub-aba selecionada
 */
async function initCadastros(aba = 'manutentores') {
    abaCadastroAtual = aba;

    const titulos = {
        manutentores: {
            titulo: 'Cadastro de Manutentores',
            subtitulo: 'Gerencie técnicos, mecânicos, eletricistas e suas permissões de acesso.'
        },
        lideranca: {
            titulo: 'Cadastro de Liderança / Solicitantes',
            subtitulo: 'Gerencie supervisores e líderes que abrem solicitações de manutenção.'
        },
        ativos: {
            titulo: 'Cadastro de Ativos (Máquinas e Equipamentos)',
            subtitulo: 'Cadastre os equipamentos industriais vinculados às Ordens de Serviço.'
        }
    };

    const elTitulo = document.getElementById('cad-titulo');
    const elSub = document.getElementById('cad-subtitulo');
    if (elTitulo && titulos[aba]) elTitulo.textContent = titulos[aba].titulo;
    if (elSub && titulos[aba]) elSub.textContent = titulos[aba].subtitulo;

    // Alterna visibilidade dos painéis
    const secUsuarios = document.getElementById('secao-cad-usuarios');
    const secAtivos = document.getElementById('secao-cad-ativos');

    if (aba === 'ativos') {
        if (secUsuarios) secUsuarios.classList.add('hidden');
        if (secAtivos) secAtivos.classList.remove('hidden');
        await carregarAtivosCadastro();
    } else {
        if (secAtivos) secAtivos.classList.add('hidden');
        if (secUsuarios) secUsuarios.classList.remove('hidden');
        await carregarUsuariosCadastro(aba);
    }

    if (window.lucide) lucide.createIcons();
}

/* ============================================================================
   1. CADASTRO DE USUÁRIOS (MANUTENTORES E LIDERANÇA)
   ============================================================================ */

async function carregarUsuariosCadastro(aba) {
    const tbody = document.getElementById('tbody-cad-usuarios');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-400">Carregando registros...</td></tr>`;

    try {
        const empresaId = window.empresaAtual?.id;
        const perfilAlvo = aba === 'lideranca' ? 'Lideranca' : 'Manutentor';

        const snap = await db.collection('usuarios')
            .where('empresaId', '==', empresaId)
            .where('perfil', '==', perfilAlvo)
            .get();

        listaUsuariosCadastro = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

        renderizarTabelaUsuarios();
    } catch (erro) {
        console.error('Erro ao carregar usuários:', erro);
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-red-500">Erro ao carregar dados: ${erro.message}</td></tr>`;
    }
}

function renderizarTabelaUsuarios() {
    const tbody = document.getElementById('tbody-cad-usuarios');
    const filtro = (document.getElementById('busca-cad-usuario')?.value || '').toLowerCase();
    if (!tbody) return;

    const filtrados = listaUsuariosCadastro.filter(u =>
        (u.nome || '').toLowerCase().includes(filtro) ||
        (u.email || '').toLowerCase().includes(filtro) ||
        (u.especialidade || u.setor || '').toLowerCase().includes(filtro)
    );

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-10 text-center text-xs text-slate-400">Nenhum registro encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(u => {
        const paginas = Array.isArray(u.paginasPermitidas) ? u.paginasPermitidas : [];
        const badgesPaginas = paginas.map(p =>
            `<span class="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium mr-1 mb-1">${ROTULOS_PAGINAS_PERFIL[p] || p}</span>`
        ).join('');

        const statusBadge = u.ativo !== false
            ? `<span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-semibold">Ativo</span>`
            : `<span class="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-[11px] font-semibold">Inativo</span>`;

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="px-4 py-3">
                    <div class="font-semibold text-slate-800 text-sm">${escapeHTML(u.nome || '-')}</div>
                    <div class="text-xs text-slate-500">${escapeHTML(u.email || '-')}</div>
                </td>
                <td class="px-4 py-3 text-xs text-slate-600">${escapeHTML(u.especialidade || u.setor || '-')}</td>
                <td class="px-4 py-3 text-xs text-slate-600">${u.valorHora ? `R$ ${Number(u.valorHora).toFixed(2)}/h` : '-'}</td>
                <td class="px-4 py-3 max-w-xs">${badgesPaginas || '<span class="text-xs text-slate-400">Padrão</span>'}</td>
                <td class="px-4 py-3">${statusBadge}</td>
                <td class="px-4 py-3 text-right">
                    <button onclick="abrirModalUsuario('${u.id}')" class="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function abrirModalUsuario(usuarioId = null) {
    const modal = document.getElementById('modal-cad-usuario');
    const form = document.getElementById('form-cad-usuario');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('cad-user-id').value = usuarioId || '';

    const isLideranca = abaCadastroAtual === 'lideranca';
    document.getElementById('modal-user-titulo').textContent = usuarioId
        ? (isLideranca ? 'Editar Liderança' : 'Editar Manutentor')
        : (isLideranca ? 'Novo Solicitante / Liderança' : 'Novo Manutentor');

    // Campo senha só aparece na criação
    const grupoSenha = document.getElementById('grupo-cad-user-senha');
    const inputEmail = document.getElementById('cad-user-email');
    if (usuarioId) {
        if (grupoSenha) grupoSenha.classList.add('hidden');
        if (inputEmail) inputEmail.readOnly = true;
    } else {
        if (grupoSenha) grupoSenha.classList.remove('hidden');
        if (inputEmail) inputEmail.readOnly = false;
    }

    // Renderiza checkboxes de páginas permitidas
    const containerChecks = document.getElementById('container-paginas-permitidas');
    const padrao = isLideranca ? ['solicitacoes'] : ['os'];

    let paginasSelecionadas = padrao;
    if (usuarioId) {
        const u = listaUsuariosCadastro.find(item => item.id === usuarioId);
        if (u) {
            document.getElementById('cad-user-nome').value = u.nome || '';
            document.getElementById('cad-user-email').value = u.email || '';
            document.getElementById('cad-user-especialidade').value = u.especialidade || u.setor || '';
            document.getElementById('cad-user-valor-hora').value = u.valorHora || '';
            document.getElementById('cad-user-ativo').value = u.ativo === false ? 'false' : 'true';
            if (Array.isArray(u.paginasPermitidas)) {
                paginasSelecionadas = u.paginasPermitidas;
            }
        }
    }

    if (containerChecks) {
        containerChecks.innerHTML = Object.entries(ROTULOS_PAGINAS_PERFIL).map(([chave, rotulo]) => {
            const checked = paginasSelecionadas.includes(chave) ? 'checked' : '';
            return `
                <label class="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                    <input type="checkbox" name="paginasPermitidas" value="${chave}" ${checked} class="rounded text-blue-600 focus:ring-blue-500">
                    <span class="font-medium text-slate-700">${rotulo}</span>
                </label>
            `;
        }).join('');
    }

    modal.classList.remove('hidden');
}

function fecharModalUsuario() {
    const modal = document.getElementById('modal-cad-usuario');
    if (modal) modal.classList.add('hidden');
}

async function salvarUsuarioCadastro(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-cad-usuario');
    const usuarioId = document.getElementById('cad-user-id').value.trim();
    const nome = document.getElementById('cad-user-nome').value.trim();
    const email = document.getElementById('cad-user-email').value.trim().toLowerCase();
    const senha = document.getElementById('cad-user-senha')?.value || '';
    const especialidade = document.getElementById('cad-user-especialidade').value.trim();
    const valorHora = parseFloat(document.getElementById('cad-user-valor-hora').value) || 0;
    const ativo = document.getElementById('cad-user-ativo').value === 'true';

    const checkboxes = document.querySelectorAll('input[name="paginasPermitidas"]:checked');
    const paginasPermitidas = Array.from(checkboxes).map(cb => cb.value);

    if (paginasPermitidas.length === 0) {
        alert('Selecione pelo menos uma tela de acesso para o usuário.');
        return;
    }

    const perfil = abaCadastroAtual === 'lideranca' ? 'Lideranca' : 'Manutentor';
    const empresaId = window.empresaAtual?.id;

    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Salvando...';
        }

        if (usuarioId) {
            // Atualização de usuário existente
            await db.collection('usuarios').doc(usuarioId).update({
                nome,
                especialidade,
                setor: especialidade,
                valorHora,
                ativo,
                paginasPermitidas,
                atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // Criação de novo usuário via instância secundária do Firebase Auth (não desloga o Admin atual)
            if (senha.length < 6) {
                alert('A senha inicial deve ter no mínimo 6 caracteres.');
                return;
            }

            const secondaryAppName = 'SecondaryApp_' + Date.now();
            const secondaryApp = firebase.initializeApp(firebase.app().options, secondaryAppName);
            try {
                const cred = await secondaryApp.auth().createUserWithEmailAndPassword(email, senha);
                const novoUid = cred.user.uid;

                await db.collection('usuarios').doc(novoUid).set({
                    nome,
                    email,
                    perfil,
                    empresaId,
                    especialidade,
                    setor: especialidade,
                    valorHora,
                    ativo,
                    paginasPermitidas,
                    lgpdAceito: false,
                    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
                });

                await secondaryApp.auth().signOut();
            } finally {
                await secondaryApp.delete();
            }
        }

        fecharModalUsuario();
        await carregarUsuariosCadastro(abaCadastroAtual);

    } catch (erro) {
        console.error('Erro ao salvar usuário:', erro);
        alert('Erro ao salvar usuário: ' + erro.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Salvar Cadastro';
        }
    }
}

/* ============================================================================
   2. CADASTRO DE ATIVOS (MÁQUINAS E EQUIPAMENTOS)
   ============================================================================ */

async function carregarAtivosCadastro() {
    const tbody = document.getElementById('tbody-cad-ativos');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-xs text-slate-400">Carregando ativos...</td></tr>`;

    try {
        const empresaId = window.empresaAtual?.id;
        const snap = await db.collection('ativos')
            .where('empresaId', '==', empresaId)
            .get();

        listaAtivosCadastro = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (a.tag || a.nome || '').localeCompare(b.tag || b.nome || ''));

        renderizarTabelaAtivos();
    } catch (erro) {
        console.error('Erro ao carregar ativos:', erro);
        tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-xs text-red-500">Erro ao carregar ativos: ${erro.message}</td></tr>`;
    }
}

function renderizarTabelaAtivos() {
    const tbody = document.getElementById('tbody-cad-ativos');
    const filtro = (document.getElementById('busca-cad-ativo')?.value || '').toLowerCase();
    if (!tbody) return;

    const filtrados = listaAtivosCadastro.filter(a =>
        (a.tag || '').toLowerCase().includes(filtro) ||
        (a.nome || '').toLowerCase().includes(filtro) ||
        (a.setor || '').toLowerCase().includes(filtro)
    );

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-xs text-slate-400">Nenhum ativo cadastrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(a => {
        const criticidadeColors = {
            Alta: 'bg-red-50 text-red-700 border-red-200',
            Media: 'bg-amber-50 text-amber-700 border-amber-200',
            Baixa: 'bg-slate-100 text-slate-700 border-slate-200'
        };
        const badgeCrit = criticidadeColors[a.criticidade] || criticidadeColors.Media;

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="px-4 py-3 font-mono text-xs font-bold text-slate-700">${escapeHTML(a.tag || '-')}</td>
                <td class="px-4 py-3 text-sm font-semibold text-slate-800">${escapeHTML(a.nome || '-')}</td>
                <td class="px-4 py-3 text-xs text-slate-600">${escapeHTML(a.setor || '-')}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-0.5 border rounded-full text-[11px] font-semibold ${badgeCrit}">${escapeHTML(a.criticidade || 'Média')}</span>
                </td>
                <td class="px-4 py-3 text-right space-x-1">
                    <button onclick="abrirModalAtivo('${a.id}')" class="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="excluirAtivo('${a.id}', '${escapeHTML(a.nome || '')}')" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function abrirModalAtivo(ativoId = null) {
    const modal = document.getElementById('modal-cad-ativo');
    const form = document.getElementById('form-cad-ativo');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('cad-ativo-id').value = ativoId || '';
    document.getElementById('modal-ativo-titulo').textContent = ativoId ? 'Editar Ativo' : 'Novo Ativo (Máquina)';

    if (ativoId) {
        const a = listaAtivosCadastro.find(item => item.id === ativoId);
        if (a) {
            document.getElementById('cad-ativo-tag').value = a.tag || '';
            document.getElementById('cad-ativo-nome').value = a.nome || '';
            document.getElementById('cad-ativo-setor').value = a.setor || '';
            document.getElementById('cad-ativo-criticidade').value = a.criticidade || 'Media';
            document.getElementById('cad-ativo-descricao').value = a.descricao || '';
        }
    }

    modal.classList.remove('hidden');
}

function fecharModalAtivo() {
    const modal = document.getElementById('modal-cad-ativo');
    if (modal) modal.classList.add('hidden');
}

async function salvarAtivoCadastro(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-cad-ativo');
    const ativoId = document.getElementById('cad-ativo-id').value.trim();
    const tag = document.getElementById('cad-ativo-tag').value.trim().toUpperCase();
    const nome = document.getElementById('cad-ativo-nome').value.trim();
    const setor = document.getElementById('cad-ativo-setor').value.trim();
    const criticidade = document.getElementById('cad-ativo-criticidade').value;
    const descricao = document.getElementById('cad-ativo-descricao').value.trim();
    const empresaId = window.empresaAtual?.id;

    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Salvando...';
        }

        const payload = {
            tag,
            nome,
            setor,
            criticidade,
            descricao,
            empresaId,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (ativoId) {
            await db.collection('ativos').doc(ativoId).update(payload);
        } else {
            payload.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('ativos').add(payload);
        }

        fecharModalAtivo();
        await carregarAtivosCadastro();

    } catch (erro) {
        console.error('Erro ao salvar ativo:', erro);
        alert('Erro ao salvar ativo: ' + erro.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Salvar Ativo';
        }
    }
}

async function excluirAtivo(ativoId, nome) {
    if (!confirm(`Deseja realmente excluir o ativo "${nome}"?`)) return;
    try {
        await db.collection('ativos').doc(ativoId).delete();
        await carregarAtivosCadastro();
    } catch (erro) {
        console.error('Erro ao excluir ativo:', erro);
        alert('Erro ao excluir ativo: ' + erro.message);
    }
}

/**
 * Sanitização básica contra XSS em renderização HTML
 */
function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
