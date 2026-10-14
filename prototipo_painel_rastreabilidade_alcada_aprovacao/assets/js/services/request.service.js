(function (A) {
    'use strict';
    const U = A.Utils;
    function filterValues(row, field) {
        const mapped = {
            company: [row.company.code], approvalType: [row.approvalType.code],
            costCenter: [U.scoped(row.company.code, row.costCenter.code)],
            movementType: [U.scoped(row.company.code, row.movementType.code)],
            processStatus: [row.processStatus], approvalStatus: [row.approvalStatus],
            approver: row.stages.map(stage => stage.approver.id)
        };
        return mapped[field] || [];
    }
    function sortValue(row, key) {
        if (key === 'processStatus') return A.Config.requestStatus(row).label;
        if (['company', 'approvalType', 'movementType', 'costCenter'].includes(key)) return U.combine(row[key].code, row[key].name);
        if (key === 'supplier') return row.supplier.name;
        if (['issuedAt', 'openedAt'].includes(key)) return U.timestamp(row[key]);
        return row[key];
    }
    function matches(row, query) {
        if (!Object.entries(query.filters || {}).every(([field, values]) => !values.length || values.some(value => filterValues(row, field).includes(value)))) return false;
        const issuedDate = String(row.issuedAt || '').slice(0, 10);
        if (query.from && (!issuedDate || issuedDate < query.from)) return false;
        if (query.to && (!issuedDate || issuedDate > query.to)) return false;
        const term = U.normalize(query.search);
        if (!term) return true;
        const text = U.normalize([row.requestNumber, row.movementId, row.movementNumber, row.requester,
            row.company.code, row.company.name, row.approvalType.code, row.approvalType.name,
            row.movementType.code, row.movementType.name, row.costCenter.code, row.costCenter.name,
            row.supplier.name, row.supplier.document, A.Config.processStatuses[row.processStatus].label, A.Config.requestStatus(row).label,
            ...row.stages.map(stage => stage.approver.name)].join(' '));
        const compact = term.replace(/[^a-z0-9]/g, '');
        return text.includes(term) || (compact && text.replace(/[^a-z0-9]/g, '').includes(compact));
    }
    class RequestService {
        constructor(provider) { this.provider = provider; this.records = []; this.catalogs = {}; }
        async load() {
            const [records, catalogs] = await Promise.all([this.provider.listRequests(), this.provider.listLookups()]);
            this.records = records.map(A.RequestAdapter.fromRecord);
            this.catalogs = catalogs;
            return this;
        }
        lookup(field, companies = []) {
            return (this.catalogs[field] || []).filter(item => !item.company || !companies.length || companies.includes(item.company));
        }
        get(number) { return this.records.find(row => row.requestNumber === Number(number)); }
        query(query = {}) {
            const all = this.records.filter(row => matches(row, query));
            const key = (query.sort || {}).key || 'openedAt';
            const direction = (query.sort || {}).direction === 'asc' ? 1 : -1;
            const sorted = all.slice().sort((a, b) => {
                const left = sortValue(a, key), right = sortValue(b, key);
                const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left || '').localeCompare(String(right || ''), 'pt-BR', { numeric: true });
                return comparison ? comparison * direction : b.requestNumber - a.requestNumber;
            });
            const size = Math.max(1, Number(query.pageSize) || 10);
            const pages = Math.max(1, Math.ceil(sorted.length / size));
            const page = Math.min(pages, Math.max(1, Number(query.page) || 1));
            const stats = {
                total: all.length,
                aberto: all.filter(row => row.processStatus === 'aberto').length,
                aprovado: all.filter(row => row.processStatus === 'aprovado').length,
                reprovado: all.filter(row => row.processStatus === 'reprovado').length,
                amount: all.reduce((sum, row) => sum + (row.net || 0), 0)
            };
            return { rows: sorted.slice((page - 1) * size, page * size), allRows: sorted, total: sorted.length, page, pages, pageSize: size, stats };
        }
        export(query, rows = this.query(query).allRows) {
            const headers = ['Nº Solicitação', 'Coligada', 'Tipo de Aprovação', 'Movimento', 'Nº Movimento', 'IDMOV', 'Centro de Custo', 'Cliente / Fornecedor', 'CNPJ / CPF', 'Data Emissão', 'Valor Bruto', 'Valor Líquido', 'Status'];
            return U.csv([headers, ...rows.map(row => [row.requestNumber, U.combine(row.company.code, row.company.name), U.combine(row.approvalType.code, row.approvalType.name),
                U.combine(row.movementType.code, row.movementType.name), row.movementNumber, row.movementId, U.combine(row.costCenter.code, row.costCenter.name),
                row.supplier.name, row.supplier.document, U.date(row.issuedAt), U.money(row.gross), U.money(row.net),
                [A.Config.requestStatus(row).label, row.approvals.active ? row.approvals.active.approver.name : '', `${row.approvals.completed} de ${row.approvals.total} etapas aprovadas`].filter(Boolean).join(' · ')])]);
        }
    }
    A.RequestService = RequestService;
})(window.AlcadaPanel);
