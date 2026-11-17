/**
 * Módulo de Conformidade LGPD e Aceite Obrigatório da Política de Privacidade
 * Coleção Firestore: termos_aceites/{uid}
 */
const VERSAO_TERMOS_LGPD = '1.0';

async function verificarAceiteLGPD(user) {
    if (!user || !user.id) return;

    const chaveLocal = `lgpd_aceite_${user.id}_v${VERSAO_TERMOS_LGPD}`;
    if (localStorage.getItem(chaveLocal) === 'true') {
        return;
    }

    try {
        const docAceite = await db.collection('termos_aceites').doc(user.id).get();
        if (docAceite.exists && docAceite.data().aceito === true && docAceite.data().versao === VERSAO_TERMOS_LGPD) {
            localStorage.setItem(chaveLocal, 'true');
            return;
        }
    } catch (err) {
        console.warn('Aviso ao consultar registro de aceite LGPD:', err.message);
    }

    exibirModalBloqueioLGPD(user);
}

function exibirModalBloqueioLGPD(user) {
    document.getElementById('modal-consentimento-lgpd')?.remove();

    const modalHTML = `
    <div id="modal-consentimento-lgpd" class="fixed inset-0 bg-[#0B1120]/90 backdrop-blur-md z-[10050] flex items-center justify-center p-4">
        <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
            <div class="bg-[#0B1120] px-6 py-5 flex items-center gap-3 border-b-2 border-[#00E5B0]">
                <div class="w-11 h-11 rounded-xl bg-[#00E5B0]/15 border border-[#00E5B0]/40 text-[#00E5B0] flex items-center justify-center shrink-0">
                    <i data-lucide="shield-check" class="w-6 h-6"></i>
                </div>
                <div>
                    <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#00E5B0]">Conformidade LGPD • Versão ${VERSAO_TERMOS_LGPD}</span>
                    <h2 class="text-base font-extrabold text-white leading-tight">Política de Privacidade e Termos de Uso</h2>
                </div>
            </div>

            <div class="p-6 space-y-4 text-xs text-slate-600 leading-relaxed">
                <p>
                    Olá, <strong class="text-slate-900">${user.nome || 'Colaborador'}</strong>! Para continuar utilizando o <strong>OSync</strong> em conformidade com a <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018)</strong>, precisamos registrar seu consentimento expresso.
                </p>

                <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-[11px] text-slate-600">
                    <div class="font-bold text-slate-800">Resumo dos Termos e Tratamento de Dados:</div>
                    <p>• <strong>Dados tratados:</strong> Nome, e-mail, setor, registros técnicos de O.S., apontamentos de execução e fotos de equipamentos.</p>
                    <p>• <strong>Finalidade e Segurança:</strong> Rastreabilidade operacional da sua empresa, com dados isolados e sem compartilhamento publicitário.</p>
                    <p>• <strong>Responsabilidade pelos Registros:</strong> O sistema não se responsabiliza pelo uso indevido nem pelo preenchimento de informações falsas, como concluir ou apontar a execução de uma tarefa sem tê-la realmente executado.</p>
                </div>

                <label class="flex items-start gap-2.5 p-3 rounded-xl border border-slate-300 bg-white cursor-pointer hover:border-blue-600 transition select-none">
                    <input type="checkbox" id="chk-aceite-lgpd-modal" onchange="alternarBotaoAceiteLGPD()"
                        class="mt-0.5 w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0">
                    <span class="text-xs text-slate-700 font-medium">
                        Li e concordo com a <a href="pages/privacidade.html" target="_blank" class="text-blue-600 font-bold underline hover:text-blue-800">Política de Privacidade e Termos de Uso</a>, assumindo a veracidade dos registros lançados por mim no sistema.
                    </span>
                </label>

                <div class="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button type="button" onclick="sairDoSistema()"
                        class="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition">
                        Recusar e Sair
                    </button>
                    <button type="button" id="btn-confirmar-lgpd" disabled onclick="registrarAceiteLGPD()"
                        class="w-full sm:w-auto px-5 py-2.5 text-xs font-extrabold bg-[#00E5B0] hover:bg-[#00c99b] disabled:opacity-40 disabled:cursor-not-allowed text-[#0B1120] rounded-xl shadow-sm transition flex items-center justify-center gap-1.5">
                        <i data-lucide="check-circle-2" class="w-4 h-4"></i>
                        <span>Aceitar e Continuar</span>
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function alternarBotaoAceiteLGPD() {
    const chk = document.getElementById('chk-aceite-lgpd-modal');
    const btn = document.getElementById('btn-confirmar-lgpd');
    if (btn && chk) {
        btn.disabled = !chk.checked;
    }
}

async function registrarAceiteLGPD() {
    const chk = document.getElementById('chk-aceite-lgpd-modal');
    const btn = document.getElementById('btn-confirmar-lgpd');
    if (!chk || !chk.checked || !usuarioAtual) return;

    btn.disabled = true;
    btn.innerHTML = '<span>Registrando aceite...</span>';

    try {
        await db.collection('termos_aceites').doc(usuarioAtual.id).set({
            aceito: true,
            versao: VERSAO_TERMOS_LGPD,
            nome: usuarioAtual.nome || '',
            email: usuarioAtual.email || '',
            empresaId: usuarioAtual.empresaId || '',
            dataAceite: firebase.firestore.FieldValue.serverTimestamp(),
            userAgent: navigator.userAgent || ''
        }, { merge: true });

        const chaveLocal = `lgpd_aceite_${usuarioAtual.id}_v${VERSAO_TERMOS_LGPD}`;
        localStorage.setItem(chaveLocal, 'true');

        document.getElementById('modal-consentimento-lgpd')?.remove();
        if (typeof mostrarNotificacaoOSync === 'function') {
            mostrarNotificacaoOSync('Termos de Privacidade (LGPD) registrados com sucesso!', 'sucesso');
        }
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check-circle-2" class="w-4 h-4"></i><span>Aceitar e Continuar</span>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        alert('Erro ao registrar aceite LGPD: ' + err.message);
    }
}
