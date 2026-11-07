document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.kanban-card');
    const columns = document.querySelectorAll('.kanban-col');

    // Lógica para os cartões (O.S.)
    cards.forEach(card => {
        card.addEventListener('dragstart', () => {
            card.classList.add('dragging');
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });
    });

    // Lógica para as colunas receberem os cartões
    columns.forEach(col => {
        col.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessário para permitir o drop
            col.classList.add('drag-over');
            
            const draggingCard = document.querySelector('.dragging');
            if(draggingCard) {
                col.appendChild(draggingCard);
            }
        });

        col.addEventListener('dragleave', () => {
            col.classList.remove('drag-over');
        });

        col.addEventListener('drop', (e) => {
            col.classList.remove('drag-over');
            const statusAtualizado = col.getAttribute('data-status');
            
            // Aqui futuramente entra a chamada Supabase para atualizar a O.S no banco
            console.log(`Cartão movido para o status: ${statusAtualizado}`);
        });
    });
});
