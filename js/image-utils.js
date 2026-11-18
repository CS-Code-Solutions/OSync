/**
 * Compacta a imagem no cliente e tenta enviar ao Firebase Storage (com timeout de 8s).
 * Caso o Storage não esteja habilitado ou falhe, retorna a imagem compactada em Base64 leve
 * para que a foto seja anexada instantaneamente sem travar o usuário.
 */
async function compactarEEnviarImagemOS(file, empresaId, osId) {
    const { blob, dataUrlLeve } = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxDim = 800;
                let w = img.width || 800;
                let h = img.height || 600;

                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = Math.round((h * maxDim) / w);
                        w = maxDim;
                    } else {
                        w = Math.round((w * maxDim) / h);
                        h = maxDim;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.65);

                if (canvas.toBlob) {
                    canvas.toBlob(
                        (b) => resolve({ blob: b, dataUrlLeve: dataUrl }),
                        'image/jpeg',
                        0.65
                    );
                } else {
                    resolve({ blob: null, dataUrlLeve: dataUrl });
                }
            };
            img.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Erro ao abrir o arquivo de imagem.'));
        reader.readAsDataURL(file);
    });

    // Tenta enviar para o Firebase Storage com limite máximo de 8 segundos
    if (typeof storage !== 'undefined' && storage && blob) {
        try {
            const nomeArquivo = `empresas/${empresaId}/os/${osId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
            const ref = storage.ref().child(nomeArquivo);

            const uploadComTimeout = Promise.race([
                ref.put(blob, { contentType: 'image/jpeg' }).then(() => ref.getDownloadURL()),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Storage')), 8000))
            ]);

            const urlStorage = await uploadComTimeout;
            if (urlStorage) return urlStorage;
        } catch (errStorage) {
            console.warn('Storage indisponível ou lento, usando fallback compactado:', errStorage.message);
        }
    }

    return dataUrlLeve;
}
