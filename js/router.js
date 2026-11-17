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
// LEITOR DE QR CODE VIA CÂMERA DO CELULAR
// ==========================================
async function abrirLeitorQRCodeCamera() {
    const modal = document.getElementById('modal-scanner-qr');
    const video = document.getElementById('video-scanner-qr');
    if (!modal || !video) return;

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        streamCameraQR = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        video.srcObject = streamCameraQR;
        await video.play();

        if (window.BarcodeDetector) {
            const detector = new BarcodeDetector({ formats: ['qr_code'] });
            scannerIntervalQR = setInterval(async () => {
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
        }
    } catch (err) {
        console.warn('Acesso direto à câmera indisponível ou negado:', err);
    }
}

function pararEfecharLeitorQR() {
    if (scannerIntervalQR) {
        clearInterval(scannerIntervalQR);
        scannerIntervalQR = null;
    }
    if (streamCameraQR) {
        streamCameraQR.getTracks().forEach(track => track.stop());
        streamCameraQR = null;
    }
    const video = document.getElementById('video-scanner-qr');
    if (video) video.srcObject = null;

    document.getElementById('modal-scanner-qr')?.classList.add('hidden');
}

function fecharLeitorQRCodeCamera() {
    pararEfecharLeitorQR();
}

async function processarArquivoQRCode(e) {
    const file = e.target.files[0];
    if (!file) return;

    pararEfecharLeitorQR();

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
            console.error('Erro ao ler QR code da imagem:', err);
        }
    }

    const leitorLeituraManual = prompt('Digite ou cole o link/ID da máquina lida no QR Code:');
    if (leitorLeituraManual) {
        tratarTextoQRLido(leitorLeituraManual);
    }
}

function tratarTextoQRLido(texto) {
    try {
        let ativoId = texto;
        if (texto.includes('?ativo=')) {
            const urlObj = new URL(texto);
            ativoId = urlObj.searchParams.get('ativo') || texto;
        }

        if (typeof abrirModalFlutuanteQRMaquina === 'function' && ativoId) {
            abrirModalFlutuanteQRMaquina(ativoId.trim());
        } else {
            alert('QR Code lido: ' + texto);
        }
    } catch (err) {
        alert('Conteúdo do QR Code: ' + texto);
    }
}
