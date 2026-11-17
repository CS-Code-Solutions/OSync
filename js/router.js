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

    document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => btn.classList.remove('active'));

    if (pagina.startsWith('cad-')) {
        document.getElementById('btn-menu-cadastros')?.classList.add('active');
        document.querySelector('.mobile-nav-btn[data-page="cadastros"]')?.classList.add('active');
    } else if (pagina === 'centros-custo' || pagina.startsWith('relatorios-')) {
        document.getElementById('btn-menu-relatorios')?.classList.add('active');
        document.querySelector('.mobile-nav-btn[data-page="relatorios"]')?.classList.add('active');
    } else {
        document.querySelectorAll(`[data-page="${pagina}"]`).forEach(btn => btn.classList.add('active'));
    }

    try {
        const resposta = await fetch(`pages/${pagina}.html`);
        if (!resposta.ok) throw new Error('Página não encontrada');
        const html = await resposta.text();
        container.innerHTML = html;
        lucide.createIcons();

        if (pagina === 'dashboard' && typeof initDashboard === 'function') initDashboard();
        if (pagina === 'os' && typeof initKanbanOS === 'function') initKanbanOS();
        if (pagina === 'solicitacoes' && typeof initSolicitacoes === 'function') initSolicitacoes();
        if (pagina === 'configuracoes' && typeof initConfiguracoes === 'function') initConfiguracoes();
        if (pagina === 'saas-empresas' && typeof initSaaSEmpresas === 'function') initSaaSEmpresas();
        if (pagina === 'centros-custo' && typeof initCentrosCusto === 'function') initCentrosCusto();
        if (pagina === 'relatorios-os' && typeof initRelatoriosOS === 'function') initRelatoriosOS();
        if (pagina === 'relatorios-maquinas' && typeof initRelatoriosMaquinas === 'function') initRelatoriosMaquinas();
        if (pagina === 'cad-ativos' && typeof initAtivos === 'function') initAtivos();
        if (pagina === 'cad-manutentores' && typeof initUsuariosCadastro === 'function') initUsuariosCadastro('Manutentor');
        if (pagina === 'cad-lideranca' && typeof initUsuariosCadastro === 'function') initUsuariosCadastro('Lideranca');

    } catch (err) {
        container.innerHTML = `<div class="p-8 text-center text-slate-500">Tela <b>${pagina}.html</b> não encontrada.</div>`;
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

        // Verifica suporte ao detector nativo de código de barras
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
        // O usuário ainda pode usar o botão de tirar foto/arquivo como fallback
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

    // Fallback: se não conseguiu decodificar automaticamente, tenta ler via URL caso o texto compartilhado contenha o ID do ativo
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
