(function (A) {
    'use strict';
    const U = A.Utils;
    // Catálogos são consultados na origem, independentemente das solicitações da página.
    class FluigLookupService {
        constructor() { this.cache = new Map(); this.catalogs = {}; }
        async load() {
            this.cache.clear();
            const [companies, types, people] = await Promise.all([
                A.FluigDataset.get('deGetColigada_RM'),
                A.FluigDataset.get('dsGetFormTipoAprovacao', { 'metadata#active': 'true' }),
                A.FluigDataset.get('dsFluigActiveUsers')
            ]);
            this.catalogs = {
                company: companies.map(row => ({ value: String(row.CODCOLIGADA), label: U.combine(row.CODCOLIGADA, row.NOMEFANTASIA) })),
                approvalType: types.map(row => ({ value: String(row.tipoAprovacaoCodigo), label: U.combine(row.tipoAprovacaoSigla || row.tipoAprovacaoCodigo, row.tipoAprovacaoDescricao), company: String(row.coligadaCodigo) })),
                approver: people.map(row => ({ value: String(row.colleagueId || row['colleaguePK.colleagueId']), label: row.colleagueName })),
                processStatus: Object.entries(A.Config.processStatuses).map(([value, config]) => ({ value, label: config.label })),
                approvalStatus: Object.entries(A.Config.approvalStatuses).map(([value, config]) => ({ value, label: config.label }))
            };
        }
        lookup(field, companies = []) {
            if (field !== 'costCenter' && field !== 'movementType') return (this.catalogs[field] || []).filter(option => !option.company || !companies.length || companies.includes(option.company));
            const codes = companies.length ? companies : this.catalogs.company.map(option => option.value);
            return Promise.all(codes.map(company => {
                const key = field + ':' + company;
                if (!this.cache.has(key)) {
                    const cost = field === 'costCenter';
                    this.cache.set(key, A.FluigDataset.get(cost ? 'dsGetCentroCusto_RM' : 'dsConsultaTipoMovimento_RM',
                        cost ? { codColigada: company } : { CODCOLIGADA: company, LIST_ALL: 'true' }).then(rows => rows.map(row => {
                            const code = cost ? row.CODCCUSTO : row.CODTMV;
                            return { value: U.scoped(company, code), label: U.combine(code, row.NOME), company };
                        })).catch(error => { this.cache.delete(key); throw error; }));
                }
                return this.cache.get(key);
            })).then(groups => groups.flat());
        }
        productGroups(company) {
            const key = 'productGroups:' + company;
            if (!this.cache.has(key)) this.cache.set(key, A.FluigDataset.get('dsConsultaGrupoProduto_RM', { CODCOLIGADA: company })
                .catch(error => { this.cache.delete(key); throw error; }));
            return this.cache.get(key);
        }
    }
    A.FluigLookupService = FluigLookupService;
})(window.AlcadaPanel);
