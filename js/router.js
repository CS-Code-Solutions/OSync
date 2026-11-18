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
// LEITOR DE QR CODE HÍBRIDO (NATIVO ANDROID/SAMSUNG + JSQR IPHONE)
// ==========================================
async function abrirLeitorQRCodeCamera() {
    const modal = document.getElementById('modal-scanner-qr');
    const video = document.getElementById('video-scanner-qr');
    if (!modal || !video) return;

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
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
        await video.play();

        // 1. TENTA USAR O BARCODE DETECTOR NATIVO (Samsung / Android / Chrome)
        if (window.BarcodeDetector) {
            const detector = new BarcodeDetector({ formats: ['qr_code'] });
            scannerIntervalQR = setInterval(async () => {
                if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;
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
            }, 250);
        } 
        // 2. SE NÃO TIVER NATIVO (iPhone / Safari), USA O JSQR
        else {
            const canvasElement = document.createElement('canvas');
            const canvasCtx = canvasElement.getContext('2d', { willReadFrequently: true });

            scannerIntervalQR = setInterval(() => {
                if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;
                if (video.videoWidth === 0 || video.videoHeight === 0) return;

                canvasElement.width = video.videoWidth;
                canvasElement.height = video.videoHeight;
                canvasCtx.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
                
                try {
                    const imageData = canvasCtx.getImageData(0, 0, canvasElement.width, canvasElement.height);
                    if (typeof jsQR !== 'undefined') {
                        const code = jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: "dontInvert",
                        });

                        if (code && code.data) {
                            const codigoLido = code.data;
                            pararEfecharLeitorQR();
                            tratarTextoQRLido(codigoLido);
                        }
                    }
                } catch (frameErr) {
                    // Evita travamento de frame
                }
            }, 250);
        }

    } catch (err) {
        console.warn('Acesso à câmera indisponível ou negado:', err);
        alert('Não foi possível acessar a câmera. Verifique as permissões do dispositivo.');
        pararEfecharLeitorQR();
    }
}

async function processarArquivoQRCode(e) {
    const file = e.target.files[0];
    if (!file) return;

    pararEfecharLeitorQR();

    // Tenta primeiro via BarcodeDetector se disponível em imagem
    if (window.BarcodeDetector) {
        try {
            const imageBitmap = await createImageBitmap(file);
            const detector = new BarcodeDetector({ formats: ['qr_code'] });
            const barcodes = await detector.detect(imageBitmap);
            if (barcodes.length > 0) {
                tratarTextoQRLido(barcodes[0].rawValue);
                return;
            }
        } catch (err) {
            console.log('BarcodeDetector de imagem falhou, tentando via jsQR...');
        }
    }

    // Fallback via FileReader + jsQR para fotos (iPhone e Android)
    const reader = new FileReader();
    reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            try {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                if (typeof jsQR !== 'undefined') {
                    const code = jsQR(imgData.data, imgData.width, imgData.height, {
                        inversionAttempts: "attemptBoth"
                    });
                    if (code && code.data) {
                        tratarTextoQRLido(code.data);
                        return;
                    }
                }
                alert('Nenhum QR Code legível foi encontrado nesta foto.');
            } catch (err) {
                console.error('Erro ao ler pixels da imagem:', err);
                alert('Erro ao processar os pixels da imagem.');
            }
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}
