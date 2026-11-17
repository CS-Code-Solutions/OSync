/**
 * Notificações Toast e Diálogos Modernos OSync
 * Substitui automaticamente os alertas nativos (window.alert)
 */
function mostrarNotificacaoOSync(mensagem, tipo = 'info') {
    const texto = String(mensagem || '');
    const lower = texto.toLowerCase();

    // Detecta automaticamente o tipo se não for informado explicitamente
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

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto bg-[#0B1120]/95 backdrop-blur-md text-white border-l-4 ${cfg.borda} border border-slate-700/80 rounded-xl shadow-2xl p-3.5 flex items-start gap-3 transition-all duration-300 translate-y-[-10px] opacity-0`;
    toast.innerHTML = `
        <div class="w-8 h-8 rounded-lg ${cfg.iconeBg} flex items-center justify-center shrink-0 mt-0.5">
            <i data-lucide="${cfg.icone}" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 text-xs leading-relaxed text-slate-100 font-medium pt-0.5">${texto}</div>
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

// Sobrescreve o alert() nativo do navegador pelo Toast elegante do OSync
window.alert = function(msg) {
    mostrarNotificacaoOSync(msg);
};
