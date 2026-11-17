/**
 * Compacta a imagem no cliente (máx 1024px, WebP/JPEG 75%)
 * e envia ao Firebase Storage retornando apenas a URL leve.
 */
async function compactarEEnviarImagemOS(file, empresaId, osId) {
    const blobCompactado = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxDim = 1024;
                let w = img.width;
                let h = img.height;

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

                canvas.toBlob(
                    (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao compactar imagem'))),
                    'image/webp',
                    0.75
                );
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    // Envia para o Firebase Storage e devolve somente a URL
    const nomeArquivo = `empresas/${empresaId}/os/${osId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.webp`;
    const ref = storage.ref().child(nomeArquivo);
    await ref.put(blobCompactado, { contentType: 'image/webp' });
    return await ref.getDownloadURL();
}
