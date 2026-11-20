let streamCameraQR = null;
let scannerIntervalQR = null;

// ==========================================
// CONTROLADOR GLOBAL DO BOTÃO VOLTAR NATIVO (MODAIS E GAVETAS)
// ==========================================
const pilhaModaisAbertos = [];
let ignorarProximoPopState = false;

function ehOverlayFlutuanteOSync(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.id === 'modal-licenca-expirada') return false;
    const cls = typeof el.className === 'string' ? el.className : '';
    return cls.includes('fixed') && cls.includes('inset-0');
}

function registrarAberturaOverlay(el) {
    if (!el || pilhaModaisAbertos.includes(el)) return;
    pilhaModaisAbertos.push(el);
    try {
        history.pushState({ osyncModal: true, modalId: el.id || '' }, '');
    } catch (_) {}
}

function registrarFechamentoOverlayManual(el) {
    const idx = pilhaModaisAbertos.indexOf(el);
    if (idx === -1) return;
    pilhaModaisAbertos.splice(idx, 1);

    // Consome a entrada de histórico correspondente se o fechamento foi pelo "X" ou "Cancelar"
    if (history.state && history.state.osyncModal) {
        ignorarProximoPopState = true;
        history.back();
    }
}

function fecharOverlayPeloBotaoVoltar(el) {
    if (!el) return;

    if (el.id === 'modal-scanner-qr' && typeof pararEfecharLeitorQR === 'function') {
        pararEfecharLeitorQR();
        return;
    }

    // Tenta acionar o botão de fechar interno do modal para executar limpezas específicas
    const btnFechar = el.querySelector(
        'button[onclick*="fechar"], button[onclick*="Fechar"], button[onclick*="cancelar"], button[onclick*="Cancelar"]'
    );
    if (btnFechar) {
        btnFechar.click();
    }

    if (!el.classList.contains('hidden')) {
        el.classList.add('hidden');
    }
}

(function iniciarInterceptadorGlobalVoltar() {
    if (window.__osyncBackGuardAtivo) return;
    window.__osyncBackGuardAtivo = true;

    // Âncora base para impedir retorno acidental à página de login
    try {
        if (!history.state || !history.state.osyncBase) {
            history.replaceState({ osyncBase: true }, '');
            history.pushState({ osyncGuard: true }, '');
        }
    } catch (_) {}

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
            if (m.type === 'attributes' && m.attributeName === 'class') {
                const el = m.target;
                if (!ehOverlayFlutuanteOSync(el)) return;

                const estaOculto = el.classList.contains('hidden');
                if (!estaOculto) {
                    registrarAberturaOverlay(el);
                } else {
                    registrarFechamentoOverlayManual(el);
                }
            } else if (m.type === 'childList') {
                m.addedNodes.forEach((node) => {
                    if (ehOverlayFlutuanteOSync(node) && !node.classList.contains('hidden')) {
                        registrarAberturaOverlay(node);
                    }
                });
                m.removedNodes.forEach((node) => {
                    if (ehOverlayFlutuanteOSync(node)) {
                        registrarFechamentoOverlayManual(node);
                    }
                });
            }
        });
    });

    const ativarObserver = () => {
        if (document.body) {
            observer.observe(document.body, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['class']
            });
        }
    };

    if (document.body) ativarObserver();
    else window.addEventListener('DOMContentLoaded', ativarObserver);

    window.addEventListener('popstate', () => {
        if (ignorarProximoPopState) {
            ignorarProximoPopState = false;
            return;
        }

        // Remove da pilha modais que já não estejam mais visíveis
        while (pilhaModaisAbertos.length > 0) {
            const topo = pilhaModaisAbertos[pilhaModaisAbertos.length - 1];
            if (!document.body.contains(topo) || topo.classList.contains('hidden')) {
                pilhaModaisAbertos.pop();
            } else {
                break;
            }
        }

        // Se existir alguma tela flutuante ou gaveta aberta, fecha apenas ela
        if (pilhaModaisAbertos.length > 0) {
            const modalTopo = pilhaModaisAbertos.pop();
            fecharOverlayPeloBotaoVoltar(modalTopo);
            return;
        }

        // Sem modal aberto: impede que o botão voltar regresse para pages/login
        try {
            history.pushState({ osyncGuard: true }, '');
        } catch (_) {}
    });
})();

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

    // Libera largura total e reduz margens no Kanban (O.S.) mantendo padrão nas demais telas
    if (container) {
        if (paginaSegura === 'os') {
            container.className = 'flex-1 max-w-full w-full mx-auto p-3 md:px-4 md:py-4';
        } else {
            container.className = 'flex-1 max-w-7xl w-full mx-auto p-4 md:p-6';
        }
    }

    document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => btn.classList.remove('active'));

    if (paginaSegura.startsWith('cad-') || paginaSegura === 'planos-manutencao') {
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
        if (paginaSegura === 'relatorios-manutentores' && typeof initRelatoriosManutentores === 'function') initRelatoriosManutentores();
        if (paginaSegura === 'cad-ativos' && typeof initAtivos === 'function') initAtivos();
        if (paginaSegura === 'planos-manutencao' && typeof initPlanosManutencao === 'function') initPlanosManutencao();
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
// LEITOR DE QR CODE UNIVERSAL (NATIVO + JSQR PARA IPHONE E ANDROID)
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
                } catch (e) {}
            }, 250);
        } else {
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
                } catch (frameErr) {}
            }, 250);
        }

    } catch (err) {
        console.warn('Acesso direto à câmera indisponível ou negado:', err);
        alert('Não foi possível acessar a câmera. Verifique as permissões nas configurações do dispositivo.');
        pararEfecharLeitorQR();
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
        } catch (err) {}
    }

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
                alert('Nenhum QR Code legível foi encontrado nesta foto. Tente aproximar mais.');
            } catch (err) {
                alert('Erro ao processar os pixels da imagem.');
            }
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
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
