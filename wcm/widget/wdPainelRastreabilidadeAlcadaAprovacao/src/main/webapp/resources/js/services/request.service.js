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
        if (!Object.entries(query.columnFilters || {}).every(([key, values]) => !values.length || values.includes(A.Config.columnFilterValue(row, key)))) return false;
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
            const columns = [
                { label: 'Nº Solicitação', width: 17 }, { label: 'Coligada', width: 26 },
                { label: 'Tipo de Aprovação', width: 40 }, { label: 'Movimento', width: 55 },
                { label: 'Nº Movimento', width: 18 }, { label: 'IDMOV', width: 16 },
                { label: 'Centro de Custo', width: 55 }, { label: 'Cliente / Fornecedor', width: 40 },
                { label: 'CNPJ / CPF', width: 23 }, { label: 'Data Emissão', width: 16, format: 'dd/mm/yyyy' },
                { label: 'Valor Bruto', width: 20, format: '"R$" #,##0.00' },
                { label: 'Valor Líquido', width: 20, format: '"R$" #,##0.00' }, { label: 'Status', width: 22 },
                { label: 'Quem Aprovou', width: 35 }, { label: 'Em Aprovação', width: 35 },
                { label: 'Aprovadores Pendentes', width: 35 }, { label: 'Reprovado Por', width: 35 },
                { label: 'Itens do Movimento', width: 85 }, { label: 'Rateio do Movimento', width: 80 },
                { label: 'Rateio dos Itens', width: 85 }
            ];
            const present = value => value !== '' && value != null && value !== '—';
            const info = (label, value) => present(value) ? `${label}: ${value}` : '';
            const join = values => values.filter(present).join(' · ');
            const list = values => values.join('\n\n');
            const data = rows.map(row => {
                const issued = U.date(row.issuedAt);
                const date = issued === '—' ? null : new Date(issued.split('/').reverse().join('-') + 'T00:00:00Z');
                const people = status => [...new Set((row.stages || []).filter(stage => stage.status === status)
                    .map(stage => stage.approver.name).filter(Boolean))].join('\n');
                const current = people('execucao') || (!(row.stages || []).length && row.processStatus === 'aberto'
                    ? row.approvals.active?.approver.name || '' : '');
                const items = list((row.items || []).map(item => [
                    join([`Item ${item.sequence}`, item.product]),
                    join([info('Quantidade', U.quantity(item.quantity)), info('Unidade', item.unit),
                        info('Valor Unitário', U.money(item.unitPrice)), info('Total', U.money(item.total))]),
                    join([info('Centro de Custo', item.costCenter), info('Grupo', item.group)])
                ].filter(present).join('\n')));
                const distribution = allocation => join([allocation.costCenter,
                    present(allocation.percentage) ? `${U.quantity(allocation.percentage)}%` : '', U.money(allocation.value)]);
                const movementAllocations = list((row.allocations || []).map(allocation => [distribution(allocation),
                    join([info('Projeto', allocation.project), info('Tarefa', allocation.task), info('Observação', allocation.observation)])
                ].filter(present).join('\n')));
                const itemAllocations = list((row.itemAllocations || []).map(allocation => [
                    join([`Item ${allocation.sequence}`, (row.items || []).find(item => item.sequence === allocation.sequence)?.product || allocation.product]),
                    distribution(allocation), info('Observação', allocation.observation)
                ].filter(present).join('\n')));
                return [row.requestNumber, U.combine(row.company.code, row.company.name), U.combine(row.approvalType.code, row.approvalType.name),
                    U.combine(row.movementType.code, row.movementType.name), String(row.movementNumber || ''), String(row.movementId || ''),
                    U.combine(row.costCenter.code, row.costCenter.name), row.supplier.name, row.supplier.document, date, row.gross, row.net,
                    A.Config.requestStatus(row).label, people('aprovado'), current, people('prevista'), people('reprovado'),
                    items, movementAllocations, itemAllocations];
            });
            return A.ExcelExport.create({ columns, rows: data, wrapText: true });
        }
    }
    A.RequestService = RequestService;
})(window.AlcadaPanel);
