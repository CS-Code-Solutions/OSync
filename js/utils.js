/**
 * Utilitários globais compartilhados do OSync
 * Centraliza cálculos de parada, datas, formatação monetária e geração de assets para PDF.
 */
const OSyncUtils = {
    calcularMinutosParada(os) {
        if (!os) return 0;
        if (Number(os.tempoParadaMinutos) > 0) return Number(os.tempoParadaMinutos);
        if (os.inicioParada && os.terminoParada) {
            const d1 = new Date(os.inicioParada);
            const d2 = new Date(os.terminoParada);
            if (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d2 >= d1) {
                return Math.round((d2.getTime() - d1.getTime()) / 60000);
            }
        }
        return 0;
    },

    formatarHorasParadas(minutos) {
        const mins = Math.max(0, Math.round(Number(minutos) || 0));
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}h ${String(m).padStart(2, '0')}m`;
    },

    osTeveParada(os) {
        if (!os) return false;
        return (
            this.calcularMinutosParada(os) > 0 ||
            os.maquinaParada === true ||
            os.condicaoMaquina === 'Maquina parada' ||
            Boolean(os.inicioParada)
        );
    },

    extrairDataISO(os) {
        if (!os) return new Date().toISOString().slice(0, 10);
        if (os.dataHoraEncerramento) return os.dataHoraEncerramento.slice(0, 10);
        if (os.encerradaEm?.toDate) return os.encerradaEm.toDate().toISOString().slice(0, 10);
        if (os.inicioParada) return os.inicioParada.slice(0, 10);
        if (os.criadoEm?.toDate) return os.criadoEm.toDate().toISOString().slice(0, 10);
        return new Date().toISOString().slice(0, 10);
    },

    formatarDataBR(iso) {
        if (!iso || iso.length < 10) return '-';
        const [ano, mes, dia] = iso.slice(0, 10).split('-');
        return `${dia}/${mes}/${ano}`;
    },

    formatarMoedaBR(valor) {
        return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    carregarImagemLogoBase64(url = 'images/cabe.png') {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve({
                    dataUrl: canvas.toDataURL('image/png'),
                    ratio: img.width / img.height
                });
            };
            img.onerror = () => resolve(null);
            img.src = url;
        });
    },

    gerarSkeletonCards(qtd = 6) {
        return Array.from({ length: qtd }).map(() => `
            <div class="osync-card p-5 space-y-4 animate-pulse">
                <div class="flex items-center justify-between">
                    <div class="h-5 w-20 bg-slate-200 rounded"></div>
                    <div class="h-4 w-16 bg-slate-200 rounded-full"></div>
                </div>
                <div class="space-y-2">
                    <div class="h-5 w-3/4 bg-slate-200 rounded"></div>
                    <div class="h-3.5 w-1/2 bg-slate-100 rounded"></div>
                </div>
                <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div class="space-y-1.5">
                        <div class="h-3 w-24 bg-slate-100 rounded"></div>
                        <div class="h-5 w-28 bg-slate-200 rounded"></div>
                    </div>
                    <div class="h-8 w-24 bg-slate-200 rounded-lg"></div>
                </div>
            </div>
        `).join('');
    },

    gerarSkeletonLinhasTabela(linhas = 6, colunas = 6) {
        return Array.from({ length: linhas }).map(() => `
            <tr class="animate-pulse">
                ${Array.from({ length: colunas }).map((_, idx) => `
                    <td class="py-3.5 px-3">
                        <div class="h-4 ${idx === colunas - 1 ? 'w-20 ml-auto' : 'w-full'} bg-slate-200 rounded"></div>
                    </td>
                `).join('')}
            </tr>
        `).join('');
    }
};

// Aliases globais para manter compatibilidade com qualquer outro módulo (ex: router.js / QR Code)
window.carregarImagemLogoBase64 = OSyncUtils.carregarImagemLogoBase64.bind(OSyncUtils);
window.formatarMoedaBR = OSyncUtils.formatarMoedaBR.bind(OSyncUtils);
