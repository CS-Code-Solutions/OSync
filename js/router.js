let streamCameraQR = null;
let scannerIntervalQR = null;

async function navegarPara(pagina) {
    const container = document.getElementById('app-content');
    const perfil = usuarioAtual?.perfil;
    const isGestor = perfil === 'Admin' || perfil === 'SuperAdmin';

    // Verifica permissão de acesso à rota para perfis não-gestores
    if (!isGestor) {
        const permitidas = typeof obterPaginasPermitidasUsuario === 'function'
            ? (obterPaginasPermitidasUsuario(usuarioAtual) || [])
            : (perfil === 'Lideranca' ? ['solicitacoes'] : ['os', 'solicitacoes']);

        if (!permitidas.includes(pagina)) {
            pagina = permitidas[0] || (perfil === 'Lideranca' ? 'solicitacoes' : 'os');
        }
    }

    // Proteção contra Path Traversal no nome da página
    const paginaSegura = String(pagina || 'os').replace(/[^a-z0-9\-]/gi, '');

    document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => btn.classList.remove('active'));

    if (paginaSegura.startsWith('cad-')) {
        document.getElementById('btn-menu-cadastros')?.classList.add('active');
        document.querySelector('.mobile-nav-btn[data-page="cadastros"]')?.classList.add('active');
    } else if (paginaSegura === 'centros-custo' || paginaSegura.startsWith('relatorios-')) {
        document.getElementById('btn-menu-relatorios')?.classList.add('active');
        document.querySelector('.mobile-nav-btn[data-page="relatorios"]')?.classList.add('active');
    } else {
        document.querySelectorAll(`[data-page="${paginaSegura}"]`).forEach(btn => btn.classList.add('active'));
    }

    try {
        const resposta = await fetch(`pages/${paginaSegura}.html`);
        if (!resposta.ok) throw new Error('Página não encontrada');
        const html = await resposta.text();
        container.innerHTML = html;
        lucide.createIcons();

        if (paginaSegura === 'dashboard' && typeof initDashboard === 'function') initDashboard();
        if (paginaSegura === 'os' && typeof initKanbanOS === 'function') initKanbanOS();
        if (paginaSegura === 'solicitacoes' && typeof initSolicitacoes === 'function') initSolicitacoes();
        if (paginaSegura === 'configuracoes' && typeof initConfiguracoes === 'function') initConfiguracoes();
        if (paginaSegura === 'saas-empresas' && typeof initSaaSEmpresas === 'function') initSaaSEmpresas();
        if (paginaSegura === 'centros-custo' && typeof initCentrosCusto === 'function') initCentrosCusto();
        if (paginaSegura === 'relatorios-os' && typeof initRelatoriosOS === 'function') initRelatoriosOS();
        if (paginaSegura === 'relatorios-maquinas' && typeof initRelatoriosMaquinas === 'function') initRelatoriosMaquinas();
        if (paginaSegura === 'cad-ativos' && typeof initAtivos === 'function') initAtivos();
        if (paginaSegura === 'cad-manutentores' && typeof initUsuariosCadastro === 'function') initUsuariosCadastro('Manutentor');
        if (paginaSegura === 'cad-lideranca' && typeof initUsuariosCadastro === 'function') initUsuariosCadastro('Lideranca');

    } catch (err) {
        container.innerHTML = `<div class="p-8 text-center text-slate-500">Tela <b>${escaparHTML(paginaSegura)}.html</b> não encontrada.</div>`;
    }
}

function abrirMenuCadastrosMobile() {
    document.getElementById('mobile-cadastros-drawer')?.classList.remove('hidden');
}

function fecharMenuCadastrosMobile() {
    document.getElementById('mobile-cadastros-drawer')?.classList.add('hidden');
}

function abrirMenuRelatoriosMobile() {
    document.getElementById('mobile-relatorios-drawer')?.classList.remove('hidden');
}

function fecharMenuRelatoriosMobile() {
    document.getElementById('mobile-relatorios-drawer')?.classList.add('hidden');
}

// ==========================================
// LEITOR DE QR CODE VIA CÂMERA DO CELULAR (CORRIGIDO PARA IPHONE / SAFARI)
// ==========================================
async function abrirLeitorQRCodeCamera() {
    const modal = document.getElementById('modal-scanner-qr');
    const video = document.getElementById('video-scanner-qr');
    if (!modal || !video) return;

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        // Garante os atributos vitais exigidos pelo Safari do iOS
        video.setAttribute('playsinline', 'true');
        video.setAttribute('muted', 'true');
        video.setAttribute('autoplay', 'true');

        streamCameraQR = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        
        video.srcObject = streamCameraQR;
        
        // O iOS exige que o play() seja tratado como Promise
        try {
            await video.play();
        } catch (playErr) {
            console.warn('Erro ao reproduzir vídeo da câmera:', playErr);
        }

        // Verifica se o BarcodeDetector existe (Android/Chrome), senão avisa o usuário no iPhone
        if (window.BarcodeDetector) {
            const detector = new BarcodeDetector({ formats: ['qr_code'] });
            scannerIntervalQR = setInterval(async () => {
                if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
                try {
                    const barcodes = await detector.detect(video);
                    if (barcodes.length > 0) {
                        const codigoLido = barcodes[0].rawValue;
                        pararEfecharLeitorQR();
                        tratarTextoQRLido(codigoLido);
                    }
                } catch (e) {
                    // Ignora erros de frame individual
                }
            }, 300);
        } else {
            // Fallback elegante para o Safari do iOS que não suporta BarcodeDetector nativo
            console.info('BarcodeDetector nativo indisponível neste navegador (iOS Safari). Usando captura por imagem/arquivo.');
        }

    } catch (err) {
        console.warn('Acesso direto à câmera indisponível ou negado:', err);
        alert('Não foi possível acessar a câmera do dispositivo. Verifique as permissões nas configurações do seu navegador.');
        pararEfecharLeitorQR();
    }
}
