(function (A) {
    'use strict';
    const U = A.Utils;
    const names = {
        main: 'dsConsultaAlcadaAprovacao',
        tb_titmmov: 'dsConsultaAlcadaAprovacaoItensMovimento',
        tb_tmovratccu: 'dsConsultaAlcadaAprovacaoRateioMovimento',
        tb_titmmovratccu: 'dsConsultaAlcadaAprovacaoRateioItens',
        tb_alcadas: 'dsConsultaAlcadaAprovacaoEtapas'
    };
    function status(card) {
        return card.alcada_rm_reprovado === 'S' ? 'reprovado' : (card.alcada_rm_aprovado === 'S' ? 'aprovado' : 'aberto');
    }
    function workflow(card, metadata = {}) {
        return {
            requestNumber: card.NUM_PROCES, processStatus: status(card),
            openedAt: metadata.startDateProcess, closedAt: metadata.endDateProcess,
            requester: metadata.requesterName || metadata.requesterId,
            activity: Number(card.COD_ATIVIDADE_ATUAL) === 22 ? 'Aprovação' :
                ({ 4: 'Início', 5: 'Tratar erro ao buscar dados do movimento no RM', 10: 'Buscar dados do movimento no RM',
                    16: 'Buscar alçadas de aprovação', 19: 'Tratar erro ao buscar alçadas de aprovação', 28: 'Aprovar movimento no RM',
                    31: 'Tratar erro ao aprovar movimento no RM', 34: 'Solicitação aprovada', 36: 'Reprovar movimento no RM',
                    37: 'Tratar erro ao reprovar movimento no RM', 42: 'Solicitação reprovada' }[Number(card.COD_ATIVIDADE_ATUAL)] || card.COD_ATIVIDADE_ATUAL)
        };
    }
    class FluigRequestService extends A.RequestService {
        constructor({ companyId, tenantCode }) {
            super(null); this.companyId = companyId; this.tenantCode = tenantCode;
            this.cards = new Map(); this.summary = new Map(); this.columnOptionsCache = new Map();
            this.columnRecordsCache = new Map(); this.distinctColumns = null; this.lookups = new A.FluigLookupService();
        }
        base(values = {}) { return { companyid: this.companyId, withProcess: '1', ...values }; }
        criteria(state) { return this.base({ filters: JSON.stringify(state.filters || {}), columnFilters: JSON.stringify(state.columnFilters || {}), search: state.search || '', from: state.from || '', to: state.to || '' }); }
        async load() {
            this.summary.clear(); this.columnOptionsCache.clear(); this.columnRecordsCache.clear(); this.distinctColumns = null;
            await this.lookups.load(); this.catalogs = this.lookups.catalogs;
        }
        lookup(field, companies) { return this.lookups.lookup(field, companies); }

        summaryFor(criteria) {
            const key = JSON.stringify(criteria);
            if (!this.summary.has(key)) this.summary.set(key, A.FluigDataset.get(names.main, { ...criteria, mode: 'resumo' }).catch(error => { this.summary.delete(key); throw error; }));
            return this.summary.get(key);
        }
        async columnRecords(state, includeColumnFilters = false) {
            // Filtros e exportação compartilham a leitura do principal em lotes.
            // A listagem normal continua paginada no servidor.
            const criteria = this.criteria(includeColumnFilters ? state : { ...state, columnFilters: {} }), key = JSON.stringify(criteria);
            if (!this.columnRecordsCache.has(key)) {
                this.columnRecordsCache.set(key, (async () => {
                    const summary = await this.summaryFor(criteria);
                    const total = Number(Object.entries(summary[0] || {}).find(([key]) => key.toUpperCase() === 'TOTAL')?.[1]);
                    if (!Number.isFinite(total) || total < 0) throw new Error('Não foi possível identificar o total de solicitações da consulta.');
                    const cards = [];
                    for (let page = 1; ; page++) {
                        const batch = await A.FluigDataset.get(names.main, { ...criteria, page, pageSize: 200, sortKey: 'requestNumber', sortDirection: 'desc' });
                        cards.push(...batch);
                        if (!batch.length || cards.length >= total) break;
                    }
                    return this.adapt(cards);
                })().catch(error => { this.columnRecordsCache.delete(key); throw error; }));
            }
            return this.columnRecordsCache.get(key);
        }
        async columnOptions(state, column) {
            const columnFilters = { ...state.columnFilters }; delete columnFilters[column.key];
            const criteria = { ...this.criteria({ ...state, columnFilters }), mode: 'opcoes', columnKey: column.key };
            const key = JSON.stringify(criteria);
            if (!this.columnOptionsCache.has(key)) {
                this.columnOptionsCache.set(key, (async () => {
                    const options = new Map();
                    if (this.distinctColumns !== false) {
                        const values = await A.FluigDataset.get(names.main, criteria);
                        this.distinctColumns = values.every(row => Object.keys(row).some(name => name.toUpperCase() === 'VALOR'));
                        if (this.distinctColumns) {
                            values.forEach(row => {
                                const field = Object.keys(row).find(name => name.toUpperCase() === 'VALOR');
                                const value = row[field] == null ? '' : String(row[field]);
                                options.set(value, { value, label: U.escape(A.Config.columnFilterLabel(value, column.key)) });
                            });
                            return [...options.values()];
                        }
                    }
                    const records = await this.columnRecords(state);
                    const matching = A.RequestService.prototype.query.call({ records }, { columnFilters }).allRows;
                    matching.forEach(row => {
                        const value = A.Config.columnFilterValue(row, column.key);
                        options.set(value, { value, label: U.escape(A.Config.columnFilterLabel(value, column.key)) });
                    });
                    return [...options.values()].sort((a, b) => a.value.localeCompare(b.value, 'pt-BR', { numeric: true }));
                })().catch(error => { this.columnOptionsCache.delete(key); throw error; }));
            }
            return this.columnOptionsCache.get(key);
        }

        async exportRows(state) {
            const selectedColumn = Object.keys(state.columnFilters || {}).find(key => state.columnFilters[key].length);
            if (selectedColumn && this.distinctColumns === null) await this.columnOptions(state, { key: selectedColumn });
            const filterLocally = this.distinctColumns === false;
            const records = await this.columnRecords(state, !filterLocally);
            return A.RequestService.prototype.query.call({ records }, {
                columnFilters: filterLocally ? state.columnFilters : {}, sort: state.sort
            }).allRows;
        }

        async page(state) {
            const selectedColumn = Object.keys(state.columnFilters || {}).find(key => state.columnFilters[key].length);
            if (selectedColumn && this.distinctColumns === null) await this.columnOptions(state, { key: selectedColumn });
            if (this.distinctColumns === false && Object.values(state.columnFilters || {}).some(values => values.length)) {
                const records = await this.columnRecords(state);
                const result = A.RequestService.prototype.query.call({ records }, {
                    columnFilters: state.columnFilters, page: state.page, pageSize: state.pageSize, sort: state.sort
                });
                this.records = result.rows;
                return { rows: result.rows, total: result.total, stats: result.stats };
            }
            const criteria = this.criteria(state), key = JSON.stringify(criteria);
            const [cards, summary] = await Promise.all([
                A.FluigDataset.get(names.main, { ...criteria, page: state.page, pageSize: state.pageSize, sortKey: state.sort.key, sortDirection: state.sort.direction }),
                this.summaryFor(criteria)
            ]);
            const stats = Object.fromEntries(Object.entries(summary[0] || {}).map(([key, value]) => [key.toUpperCase(), value]));
            if (stats.TOTAL == null || !Number.isFinite(Number(stats.TOTAL)) || (cards.length && Number(stats.TOTAL) === 0)) {
                this.summary.delete(key);
                throw new Error('O dataset dsConsultaAlcadaAprovacao não retornou o resumo da consulta. Republique sua versão atualizada, que atende à constraint mode=resumo, para carregar os indicadores e a paginação.');
            }
            this.records = this.adapt(cards);
            return { rows: this.records, total: Number(stats.TOTAL) || 0, stats: {
                total: Number(stats.TOTAL) || 0, aberto: Number(stats.ABERTO) || 0, aprovado: Number(stats.APROVADO) || 0,
                reprovado: Number(stats.REPROVADO) || 0, amount: U.number(stats.VALOR_LIQUIDO) || 0
            } };
        }
        adapt(cards) {
            return cards.map(card => {
                this.cards.set(Number(card.NUM_PROCES), card);
                const row = A.RequestAdapter.fromRecord({ card, workflow: workflow(card) });
                row.requestUrl = this.requestUrl(row.requestNumber);
                // O principal já contém o responsável, índice e total. Nenhum filho é consultado por linha.
                const total = Number(card.alcada_total_etapas) || 0, current = Number(card.alcada_indice_atual) || 1;
                const completed = row.processStatus === 'aprovado' ? total : Math.min(total, Math.max(0, current - 1));
                row.approvalStatus = row.processStatus === 'reprovado' ? 'interrompidas' :
                    (total && completed === total ? 'concluidas' : (total ? 'execucao' : 'previstas'));
                row.approvals = { total, completed, current, active: row.processStatus === 'aberto' && completed < total ? { approver: { name: card.alcada_aprovador_atual_nome } } : null };
                return row;
            });
        }
        async loadChildren(card, tables) {
            const children = await Promise.all(tables.map(table => A.FluigDataset.get(names[table], { masterid: card.ID })));
            return Object.fromEntries(tables.map((table, index) => [table, children[index]]));
        }
        async enrichGroups(row) {
            if (row.stages.some(stage => stage.group && stage.group.code)) {
                const catalog = await this.lookups.productGroups(row.company.code);
                row.stages.filter(stage => stage.group).forEach(stage => {
                    const group = catalog.find(item => String(item.CODTB3FAT) === stage.group.code);
                    if (group) stage.group.name = group.DESCRICAO;
                });
            }
            return row;
        }
        async exportDetails(rows, onProgress = () => {}) {
            const result = new Array(rows.length);
            const tables = ['tb_alcadas', 'tb_titmmov', 'tb_tmovratccu', 'tb_titmmovratccu'];
            let next = 0, completed = 0, failure;
            const worker = async () => {
                while (!failure) {
                    const index = next++;
                    if (index >= rows.length) return;
                    try {
                        const previous = this.cards.get(rows[index].requestNumber);
                        const cards = await A.FluigDataset.get(names.main, this.base({ documentid: previous.documentid }));
                        const card = cards[0];
                        if (!card) throw new Error('Não foi possível consultar a solicitação #' + rows[index].requestNumber + '.');
                        const children = await this.loadChildren(card, tables);
                        const row = A.RequestAdapter.fromRecord({ card, workflow: workflow(card), children });
                        if (!row.stages.length) {
                            const principal = this.adapt([card])[0];
                            row.approvals = principal.approvals; row.approvalStatus = principal.approvalStatus;
                        }
                        result[index] = await this.enrichGroups(row);
                        completed++;
                        if (!failure) onProgress({ completed, total: rows.length });
                    } catch (error) { failure = failure || error; }
                }
            };
            await Promise.all(Array.from({ length: Math.min(3, rows.length) }, worker));
            if (failure) throw failure;
            return result;
        }
        requestUrl(number) {
            return '/portal/p/' + encodeURIComponent(this.tenantCode) + '/pageworkflowview?app_ecm_workflowview_detailsProcessInstanceID=' + encodeURIComponent(number);
        }
        async detail(number, view) {
            const previous = this.cards.get(Number(number));
            if (!previous) throw new Error('Solicitação não encontrada na consulta atual.');
            const cards = await A.FluigDataset.get(names.main, this.base({ documentid: previous.documentid }));
            const card = cards[0];
            if (!card) throw new Error('O formulário desta solicitação não foi encontrado.');
            const tables = view === 'history' ? ['tb_alcadas'] : ['tb_alcadas', 'tb_titmmov', 'tb_tmovratccu', 'tb_titmmovratccu'];
            const [children, process] = await Promise.all([
                this.loadChildren(card, tables),
                A.FluigDataset.get('workflowProcess', { 'workflowProcessPK.companyId': this.companyId, 'workflowProcessPK.processInstanceId': card.NUM_PROCES })
            ]);
            const metadata = process[0] || {};
            if (metadata.requesterId) {
                const people = await A.FluigDataset.get('colleague', { 'colleaguePK.companyId': this.companyId, 'colleaguePK.colleagueId': metadata.requesterId }, ['colleagueName']);
                metadata.requesterName = (people[0] || {}).colleagueName;
            }
            const row = A.RequestAdapter.fromRecord({ card, workflow: workflow(card, metadata), children });
            await this.enrichGroups(row);
            row.requestUrl = this.requestUrl(row.requestNumber);
            return row;
        }
    }
    A.FluigRequestService = FluigRequestService;
})(window.AlcadaPanel);
