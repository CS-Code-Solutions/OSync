// Função global de logout
function fazerLogout() {
    // Na implementação final com auth: await supabase.auth.signOut();
    window.location.href = 'login.html';
}

// Destacar link ativo no menu lateral
document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll('aside nav a');
    const urlAtual = window.location.pathname.split('/').pop();
    
    links.forEach(link => {
        if (link.getAttribute('href') === urlAtual) {
            link.classList.remove('text-gray-600', 'hover:bg-gray-50');
            link.classList.add('bg-purple-100', 'text-purple-700', 'font-semibold');
        }
    });
});
