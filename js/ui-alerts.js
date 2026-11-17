/**
 * Notificações Toast e Diálogos Modernos OSync
 * Substitui automaticamente os alertas nativos (window.alert) e fornece confirmação modal
 */
function mostrarNotificacaoOSync(mensagem, tipo = 'info') {
    const texto = String(mensagem || '');
    const lower = texto.toLowerCase();

    if (tipo === 'info') {
        if (lower.includes('erro') || lower.includes('falha') || lower.includes('bloquead') || lower.includes('restrito') || lower.includes('expir')) {
            tipo = 'erro';
        } else if (lower.includes('sucesso') || lower.includes('copiado') || lower.includes('criada') || lower.includes('criado') || lower.includes('aprovad')) {
            tipo = 'sucesso';
        } else if (lower.includes('atenção') || lower.includes('configure') || lower.includes('informe')) {
            tipo = 'aviso';
        }
    }

    const estilos = {
        sucesso: { borda: 'border-[#00E5B0]', iconeBg: 'bg-[#00E5B0]/15 text-[#00E5B0]', icone: 'check-circle-2' },
        erro:    { borda: 'border-rose-500',   iconeBg: 'bg-rose-500/15 text-rose-400',     icone: 'alert-circle' },
        aviso:   { borda: 'border-amber-400',  iconeBg: 'bg-amber-400/15 text-amber-400',   icone: 'alert-triangle' },
        info:    { borda: 'border-blue-500',   iconeBg: 'bg-blue-500/15 text-blue-400',     icone: 'info' }
    };

    const cfg = estilos[tipo] || estilos.info;

    let container = document.getElementById('osync-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'osync-toast-container';
        container.className = 'fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[9999] flex flex-col gap-2.5 pointer-events-none';
        document.body.appendChild(container);
    }

    const textoSeguro = typeof escaparHTML === 'function' ? escaparHTML(texto) : texto.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto bg-[#0B1120]/95 backdrop-blur-md text-white border-l-4 ${cfg.borda} border border-slate-700/80 rounded-xl shadow-2xl p-3.5 flex items-start gap-3 transition-all duration-300 translate-y-[-10px] opacity-0`;
    toast.innerHTML = `
        <div class="w-8 h-8 rounded-lg ${cfg.iconeBg} flex items-center justify-center shrink-0 mt-0.5">
            <i data-lucide="${cfg.icone}" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 text-xs leading-relaxed text-slate-100 font-medium pt-0.5">${textoSeguro}</div>
        <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white p-0.5 shrink-0">
            <i data-lucide="x" class="w-4 h-4"></i>
        </button>
    `;

    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-[-10px]', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-[-10px]');
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

/**
 * Modal de Confirmação no padrão visual OSync (substitui window.confirm)
 */
function confirmarAcaoOSync(mensagem, opcoes = {}) {
    return new Promise((resolve) => {
        document.getElementById('osync-confirm-modal')?.remove();

        const titulo = opcoes.titulo || 'Confirmar Ação';
        const textoConfirmar = opcoes.textoConfirmar || 'Confirmar';
        const textoCancelar = opcoes.textoCancelar || 'Cancelar';
        const perigo = opcoes.perigo !== false;

        const corBtnConfirmar = perigo
            ? 'bg-rose-600 hover:bg-rose-700 text-white'
            : 'bg-[#00E5B0] hover:bg-[#00c99b] text-[#0B1120]';

        const corIcone = perigo
            ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
            : 'bg-[#00E5B0]/15 border-[#00E5B0]/40 text-[#00E5B0]';

        const iconeNome = perigo ? 'alert-triangle' : 'help-circle';

        const escapeFn = typeof escaparHTML === 'function' ? escaparHTML : (v) => String(v || '');

        const modal = document.createElement('div');
        modal.id = 'osync-confirm-modal';
        modal.className = 'fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[10000] flex items-center justify-center p-4 animate-fade-in';
        modal.innerHTML = `
            <div class="bg-[#0B1120] w-full max-w-sm rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden">
                <div class="p-5 text-center space-y-3">
                    <div class="w-12 h-12 rounded-2xl border ${corIcone} flex items-center justify-center mx-auto">
                        <i data-lucide="${iconeNome}" class="w-6 h-6"></i>
                    </div>
                    <h3 class="text-base font-extrabold text-white tracking-tight">${escapeFn(titulo)}</h3>
                    <p class="text-xs text-slate-300 leading-relaxed">${mensagem}</p>
                </div>
                <div class="px-5 pb-5 flex items-center gap-2.5">
                    <button type="button" id="osync-btn-cancelar"
                        class="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition">
                        ${escapeFn(textoCancelar)}
                    </button>
                    <button type="button" id="osync-btn-confirmar"
                        class="flex-1 py-2.5 px-4 rounded-xl ${corBtnConfirmar} font-extrabold text-xs shadow-sm transition">
                        ${escapeFn(textoConfirmar)}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        if (typeof lucide !== 'undefined') lucide.createIcons();

        const fechar = (resposta) => {
            modal.remove();
            resolve(resposta);
        };

        document.getElementById('osync-btn-cancelar').onclick = () => fechar(false);
        document.getElementById('osync-btn-confirmar').onclick = () => fechar(true);
        modal.onclick = (e) => {
            if (e.target === modal) fechar(false);
        };
    });
}

window.alert = function(msg) {
    mostrarNotificacaoOSync(msg);
};
