let usuarioAtual = null;
let unsubscribePerfilAtual = null;

function aplicarPermissoesInterface(perfil) {
    const cargo = (perfil || '').trim();
    const isGestor = cargo === 'Admin' || cargo === 'SuperAdmin';

    // Esconde Cadastros e Configurações de Manutentores e Líderes
    if (!isGestor) {
        document.getElementById('nav-cadastros-group')?.classList.add('hidden');
        document.getElementById('nav-configuracoes')?.classList.add('hidden');
        document.getElementById('mob-cadastros')?.classList.add('hidden');
        document.getElementById('mob-configuracoes')?.classList.add('hidden');
    }

    // Líder não acessa o quadro Kanban de O.S., apenas Solicitações
    if (cargo === 'Lideranca') {
        document.getElementById('nav-os')?.classList.add('hidden');
        document.getElementById('mob-os')?.classList.add('hidden');
    }

    // Painel Master SaaS exclusivo para SuperAdmin (Desktop + Mobile)
    if (cargo === 'SuperAdmin') {
        document.getElementById('btn-menu-saas')?.classList.remove('hidden');
        document.getElementById('mob-saas')?.classList.remove('hidden');
    }
}

function exibirModalLicencaExpirada(nomeEmpresa, tipoContrato, dataVencimento) {
    // Remove modal anterior caso exista
    document.getElementById('modal-licenca-expirada')?.remove();

    const labelContrato = tipoContrato === 'teste_7d' ? '7 dias (Teste)' : '1 ano (Renovável)';
    const dataFormatada = dataVencimento ? new Date(dataVencimento).toLocaleDateString('pt-BR') : 'Não informada';

    const mensagemWhatsApp = encodeURIComponent(
        `Olá! A licença do sistema *OSync* expirou e gostaria de solicitar a renovação.\n\n` +
        `• *Empresa:* ${nomeEmpresa}\n` +
        `• *Contrato atual:* ${labelContrato}\n` +
        `• *Vencimento:* ${dataFormatada}`
    );

    const linkWhatsApp = `https://wa.me/5551981061618?text=${mensagemWhatsApp}`;

    const modalHTML = `
    <div id="modal-licenca-expirada" class="fixed inset-0 bg-[#0B1120]/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
            <!-- Topo -->
            <div class="bg-[#0B1120] px-6 py-5 text-center border-b-2 border-rose-500">
                <div class="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-500 flex items-center justify-center mx-auto mb-3">
                    <i data-lucide="shield-alert" class="w-8 h-8"></i>
                </div>
                <h2 class="text-lg font-extrabold text-white tracking-tight">Licença Expirada</h2>
                <p class="text-xs text-slate-400 mt-1">O acesso ao ambiente desta empresa está temporariamente bloqueado.</p>
            </div>

            <!-- Corpo -->
            <div class="p-6 space-y-4">
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1.5">
                    <div class="flex justify-between">
                        <span class="text-slate-500">Empresa:</span>
                        <span class="font-bold text-slate-800">${nomeEmpresa}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-500">Contrato:</span>
                        <span class="font-bold text-slate-800">${labelContrato}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-500">Vencimento:</span>
                        <span class="font-bold text-rose-600">${dataFormatada}</span>
                    </div>
                </div>

                <p class="text-xs text-slate-600 text-center leading-relaxed">
                    Para liberar novamente o acesso de toda a equipe e renovar sua assinatura, fale diretamente com o suporte comercial da <strong>CS Code Solutions</strong>.
                </p>

                <!-- Botão WhatsApp -->
                <a href="${linkWhatsApp}" target="_blank" rel="noopener noreferrer"
                    class="w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2.5 text-sm">
                    <svg class="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.33-1.66a11.86 11.86 0 0 0 5.73 1.46h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.45-8.42ZM12.07 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.76.98 1-3.66-.24-.38a9.86 9.86 0 0 1-1.51-5.25c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.13 1.03 7 2.9a9.83 9.83 0 0 1 2.9 7c0 5.46-4.44 9.89-9.89 9.89Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z"/>
                    </svg>
                    <span>Entrar em contato</span>
                </a>

                <button type="button" onclick="window.location.href='pages/login.html'"
                    class="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition">
                    Voltar para a tela de login
                </button>
            </div>
        </div>
    </div>`;

    document.body.classList.remove('auth-loading');
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        if (unsubscribePerfilAtual) unsubscribePerfilAtual();
        // Não redireciona imediatamente se o modal de licença expirada estiver aberto na tela
        if (!document.getElementById('modal-licenca-expirada')) {
            window.location.href = 'pages/login.html';
        }
        return;
    }

    if (unsubscribePerfilAtual) unsubscribePerfilAtual();

    unsubscribePerfilAtual = db.collection('usuarios').doc(user.uid).onSnapshot(async (doc) => {
        if (!doc.exists || doc.data().ativo === false) {
            alert('Seu acesso foi revogado ou está pendente de aprovação pelo gestor.');
            await auth.signOut();
            window.location.href = 'pages/login.html';
            return;
        }

        const primeiraCarga = !usuarioAtual;
        usuarioAtual = { id: doc.id, ...doc.data() };
        usuarioAtual.perfil = (usuarioAtual.perfil || '').trim();

        // Valida se a empresa cliente está ativa e dentro do prazo do contrato (exceto SuperAdmin)
        if (usuarioAtual.perfil !== 'SuperAdmin' && usuarioAtual.empresaId) {
            try {
                const empDoc = await db.collection('empresas').doc(usuarioAtual.empresaId).get();
                if (empDoc.exists) {
                    const emp = empDoc.data();
                    const vencida = emp.dataVencimento && new Date(emp.dataVencimento) < new Date();
                    if (emp.ativa === false || vencida) {
                        if (unsubscribePerfilAtual) unsubscribePerfilAtual();
                        await auth.signOut();
                        exibirModalLicencaExpirada(
                            emp.nome || 'Empresa não identificada',
                            emp.tipoContrato || 'anual_1a',
                            emp.dataVencimento || ''
                        );
                        return;
                    }
                }
            } catch (errEmp) {
                console.warn('Aviso ao validar vigência da empresa:', errEmp.message);
            }
        }

        document.getElementById('header-user-name').textContent = usuarioAtual.nome;
        document.getElementById('header-user-role').textContent = usuarioAtual.perfil;

        if (primeiraCarga) {
            aplicarPermissoesInterface(usuarioAtual.perfil);
            atualizarStatusNuvem(true);
            document.body.classList.remove('auth-loading');

            if (usuarioAtual.perfil === 'Lideranca') {
                navegarPara('solicitacoes');
            } else if (usuarioAtual.perfil === 'SuperAdmin') {
                navegarPara('saas-empresas');
            } else {
                navegarPara('os');
            }
        }
    }, async (err) => {
        console.error('Erro ao validar permissão:', err);
        await auth.signOut();
        window.location.href = 'pages/login.html';
    });
});

async function sairDoSistema() {
    if (unsubscribePerfilAtual) unsubscribePerfilAtual();
    await auth.signOut();
    window.location.href = 'pages/login.html';
}
