/**
 * Camada de Cache e Otimização de Leituras do Firestore (OSyncDataStore)
 * - Evita leituras duplicadas ao navegar entre Dashboard e Relatórios.
 * - Carrega janela recente (180 dias) por padrão e busca histórico completo sob demanda (Lazy Loading).
 */
const OSyncDataStore = {
    _cache: {
        empresaId: null,
        ordens: null,
        historicoCompleto: false,
        ordensTimestamp: 0,
        ativos: null,
        ativosTimestamp: 0,
        colunas: null,
        colunasTimestamp: 0,
        solicitacoes: null,
        solicitacoesTimestamp: 0
    },
    TTL_MS: 60 * 1000, // 60 segundos de validade entre trocas de aba

    _validarEmpresa() {
        const empId = usuarioAtual?.empresaId || null;
        if (this._cache.empresaId !== empId) {
            this.invalidarTudo();
            this._cache.empresaId = empId;
        }
        return empId;
    },

    invalidarOrdens() {
        this._cache.ordens = null;
        this._cache.historicoCompleto = false;
        this._cache.ordensTimestamp = 0;
    },

    invalidarAtivos() {
        this._cache.ativos = null;
        this._cache.ativosTimestamp = 0;
    },

    invalidarTudo() {
        this._cache.ordens = null;
        this._cache.historicoCompleto = false;
        this._cache.ordensTimestamp = 0;
        this._cache.ativos = null;
        this._cache.ativosTimestamp = 0;
        this._cache.colunas = null;
        this._cache.colunasTimestamp = 0;
        this._cache.solicitacoes = null;
        this._cache.solicitacoesTimestamp = 0;
    },

    async getAtivos(forcarRefresh = false) {
        const empId = this._validarEmpresa();
        if (!empId) return [];

        const agora = Date.now();
        if (!forcarRefresh && this._cache.ativos && (agora - this._cache.ativosTimestamp) < this.TTL_MS) {
            return this._cache.ativos;
        }

        const snap = await db.collection('ativos').where('empresaId', '==', empId).get();
        this._cache.ativos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this._cache.ativosTimestamp = agora;
        return this._cache.ativos;
    },

    async getColunasKanban(forcarRefresh = false) {
        const empId = this._validarEmpresa();
        if (!empId) return [];

        const agora = Date.now();
        if (!forcarRefresh && this._cache.colunas && (agora - this._cache.colunasTimestamp) < this.TTL_MS) {
            return this._cache.colunas;
        }

        const snap = await db.collection('kanban_colunas').where('empresaId', '==', empId).get();
        this._cache.colunas = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        this._cache.colunasTimestamp = agora;
        return this._cache.colunas;
    },

    async getSolicitacoes(forcarRefresh = false) {
        const empId = this._validarEmpresa();
        if (!empId) return [];

        const agora = Date.now();
        if (!forcarRefresh && this._cache.solicitacoes && (agora - this._cache.solicitacoesTimestamp) < this.TTL_MS) {
            return this._cache.solicitacoes;
        }

        const snap = await db.collection('solicitacoes').where('empresaId', '==', empId).get();
        this._cache.solicitacoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this._cache.solicitacoesTimestamp = agora;
        return this._cache.solicitacoes;
    },

    /**
     * Busca ordens de serviço com otimização:
     * - completo = false: busca os últimos 180 dias (cobre mês atual, 30d e últimos 6 meses de gráficos).
     * - completo = true: busca todo o histórico da empresa sob demanda (Lazy Loading).
     */
    async getOrdensServico({ completo = false, forcarRefresh = false } = {}) {
        const empId = this._validarEmpresa();
        if (!empId) return [];

        const agora = Date.now();
        const cacheValido = !forcarRefresh &&
            this._cache.ordens !== null &&
            (agora - this._cache.ordensTimestamp) < this.TTL_MS &&
            (!completo || this._cache.historicoCompleto);

        if (cacheValido) {
            return this._cache.ordens;
        }

        let snap;
        if (completo) {
            snap = await db.collection('ordens_servico')
                .where('empresaId', '==', empId)
                .get();
            this._cache.historicoCompleto = true;
        } else {
            const limite180Dias = new Date();
            limite180Dias.setDate(limite180Dias.getDate() - 180);
            try {
                snap = await db.collection('ordens_servico')
                    .where('empresaId', '==', empId)
                    .where('criadoEm', '>=', limite180Dias)
                    .get();
                this._cache.historicoCompleto = false;
            } catch (err) {
                // Fallback seguro caso algum ambiente exija índice composto
                snap = await db.collection('ordens_servico')
                    .where('empresaId', '==', empId)
                    .get();
                this._cache.historicoCompleto = true;
            }
        }

        this._cache.ordens = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.numeroOs || 0) - (a.numeroOs || 0));
        this._cache.ordensTimestamp = agora;
        return this._cache.ordens;
    },

    isHistoricoCompletoCarregado() {
        return Boolean(this._cache.historicoCompleto);
    }
};
