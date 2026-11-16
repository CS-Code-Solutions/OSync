let osSelecionadaExecucao = null;

function abrirModalExecucaoOS(osId) {
    const os = cacheOrdens.find(item => item.id === osId);
    if (!os) return;

    osSelecionadaExecucao = os;

    document.getElementById('exec-os-id').value = os.id;
    document.getElementById('exec-ativo-id').value = os.ativoId || '';
    document.getElementById('exec-os-numero').textContent = `#OS-${String(os.numeroOs || 0).padStart(4, '0')}`;
    document.getElementById('exec-os-ativo').textContent = os.ativoTag ? `${os.ativoTag} - ${os.ativoNome}` : 'Equipamento';
    document.getElementById('exec-os-tipo').textContent = os.tipoNome || 'Geral';
    document.getElementById('exec-os-prioridade').textContent = os.prioridade;
    document.getElementById('exec-os-tecnico').textContent = os.manutentorNome || 'Não atribuído';
    document.getElementById('exec-os-descricao').textContent = os.descricao;

    document.getElementById('exec-parecer').value = os.parecerTecnico || '';
    document.getElementById('exec-custo').value = os.custoTotal > 0 ? os.custoTotal : '';
    document.getElementById('exec-foto-input').value = '';
    document.getElementById('exec-foto-nome').textContent = 'Clique para selecionar ou tirar foto (Compactação automática)';

    const previewBox = document.getElementById('exec-foto-preview-box');
    const previewImg = document.getElementById('exec-foto-preview');
    if (os.imagemConclusaoUrl) {
        previewImg.src = os.imagemConclusaoUrl;
        previewBox.classList.remove('hidden');
    } else {
        previewBox.classList.add('hidden');
    }

    atualizarEstadoBotoesExecucao(os);
    document.getElementById('modal-execucao-os').classList.remove('hidden');
    lucide.createIcons();
}

function fecharModalExecucaoOS() {
    document.getElementById('modal-execucao-os').classList.add('hidden');
    osSelecionadaExecucao = null;
}

function atualizarEstadoBotoesExecucao(os) {
    const btnIniciar = document.getElementById('btn-iniciar-os');
    const infoHorarios = document.getElementById('exec-info-horarios');
    const badgeStatus = document.getElementById('exec-os-badge-status');
    const btnEncerrar = document.getElementById('btn-encerrar-os');

    if (os.encerrada) {
        badgeStatus.textContent = 'Encerrada';
        badgeStatus.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-[#00E5B0]';
        btnIniciar.classList.add('hidden');
        btnEncerrar.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i><span>Atualizar Registro</span>';
        const inicio = os.dataInicio ? new Date(os.dataInicio).toLocaleString('pt-BR') : '-';
        const fim = os.dataFim ? new Date(os.dataFim).toLocaleString('pt-BR') : '-';
        infoHorarios.textContent = `Início: ${inicio} | Fim: ${fim}`;
    } else if (os.dataInicio) {
        badgeStatus.textContent = 'Em Execução';
        badgeStatus.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300';
        btnIniciar.classList.add('hidden');
        btnEncerrar.innerHTML = '<i data-lucide="check-circle-2" class="w-4 h-4"></i><span>Encerrar Ordem de Serviço</span>';
        infoHorarios.textContent = `Iniciado em: ${new Date(os.dataInicio).toLocaleString('pt-BR')}`;
    } else {
        badgeStatus.textContent = 'Aguardando Início';
        badgeStatus.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300';
        btnIniciar.classList.remove('hidden');
        infoHorarios.textContent = 'Clique em Iniciar Atendimento para registrar o horário.';
    }
}

async function iniciarAtendimentoOS() {
    if (!osSelecionadaExecucao) return;
    const agora = new Date().toISOString();

    const colAndamento = cacheColunas.find(c => c.titulo.toLowerCase().includes('andamento'));
    const updatePayload = { dataInicio: agora };
    if (colAndamento) updatePayload.colunaId = colAndamento.id;

    await db.collection('ordens_servico').doc(osSelecionadaExecucao.id).update(updatePayload);

    osSelecionadaExecucao.dataInicio = agora;
    atualizarEstadoBotoesExecucao(osSelecionadaExecucao);
    lucide.createIcons();
}

function previewFotoExecucao(input) {
    if (input.files && input.files[0]) {
        document.getElementById('exec-foto-nome').textContent = input.files[0].name;
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('exec-foto-preview').src = e.target.result;
            document.getElementById('exec-foto-preview-box').classList.remove('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function processarUploadFotoOS(osId) {
    const fileInput = document.getElementById('exec-foto-input');
    if (!fileInput.files || fileInput.files.length === 0) return osSelecionadaExecucao?.imagemConclusaoUrl || null;

    try {
        const arquivoComprimido = await comprimirImagem(fileInput.files[0], 1024, 0.72);
        const ref = storage.ref(`os-anexos/${usuarioAtual.empresaId}/${osId}_${Date.now()}.jpg`);
        await ref.put(arquivoComprimido);
        return await ref.getDownloadURL();
    } catch (err) {
        console.warn('Erro no upload de imagem:', err.message);
        return null;
    }
}

async function salvarApontamentoParcial() {
    if (!osSelecionadaExecucao) return;
    const btn = document.getElementById('btn-salvar-parcial');
    btn.disabled = true;

    const imagemUrl = await processarUploadFotoOS(osSelecionadaExecucao.id);
    await db.collection('ordens_servico').doc(osSelecionadaExecucao.id).update({
        parecerTecnico: document.getElementById('exec-parecer').value.trim(),
        custoTotal: parseFloat(document.getElementById('exec-custo').value) || 0,
        imagemConclusaoUrl: imagemUrl
    });

    btn.disabled = false;
    alert('Progresso salvo com sucesso!');
}

document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'form-execucao-os') return;
    e.preventDefault();

    if (!osSelecionadaExecucao) return;
    const btn = document.getElementById('btn-encerrar-os');
    btn.disabled = true;
    btn.innerHTML = '<span>Salvando e Encerrando...</span>';

    const imagemUrl = await processarUploadFotoOS(osSelecionadaExecucao.id);
    const agora = new Date().toISOString();

    const colConcluida = cacheColunas.find(c =>
        c.titulo.toLowerCase().includes('conclu') || c.titulo.toLowerCase().includes('finaliz')
    ) || cacheColunas[cacheColunas.length - 1];

    await db.collection('ordens_servico').doc(osSelecionadaExecucao.id).update({
        parecerTecnico: document.getElementById('exec-parecer').value.trim(),
        custoTotal: parseFloat(document.getElementById('exec-custo').value) || 0,
        imagemConclusaoUrl: imagemUrl,
        dataInicio: osSelecionadaExecucao.dataInicio || agora,
        dataFim: osSelecionadaExecucao.dataFim || agora,
        encerrada: true,
        colunaId: colConcluida ? colConcluida.id : osSelecionadaExecucao.colunaId
    });

    const ativoId = document.getElementById('exec-ativo-id').value;
    const novoStatusMaquina = document.getElementById('exec-status-maquina').value;
    if (ativoId) {
        await db.collection('ativos').doc(ativoId).update({ status: novoStatusMaquina });
    }

    btn.disabled = false;
    fecharModalExecucaoOS();
});
