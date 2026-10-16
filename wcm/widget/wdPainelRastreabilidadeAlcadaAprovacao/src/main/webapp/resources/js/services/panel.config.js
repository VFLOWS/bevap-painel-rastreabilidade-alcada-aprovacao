(function (A) {
    'use strict';
    A.Config = {
        columnFilterValue(row, key) {
            if (key === 'processStatus') return A.Config.requestStatus(row).label;
            if (key === 'supplier') return row.supplier.name || '';
            if (key === 'issuedAt') return String(row.issuedAt || '').slice(0, 10);
            const value = row[key];
            return value && typeof value === 'object' ? A.Utils.combine(value.code, value.name) : String(value == null ? '' : value);
        },
        columnFilterLabel(value, key) {
            if (key === 'issuedAt') return A.Utils.date(value);
            if (key === 'gross' || key === 'net') return A.Utils.money(value);
            return value === '' ? 'Não informado' : value;
        },
        title: 'Painel de Rastreabilidade Alçada de Aprovação',
        process: 'wf_alcada_aprovacao',
        pageSizes: [10, 20, 50],
        processStatuses: {
            aberto: { label: 'Aberto', tone: 'blue', icon: 'clock' },
            aprovado: { label: 'Aprovado', tone: 'green', icon: 'check' },
            reprovado: { label: 'Reprovado', tone: 'red', icon: 'x' }
        },
        approvalStatuses: {
            execucao: { label: 'Em execução', tone: 'amber', icon: 'clock' },
            concluidas: { label: 'Concluídas', tone: 'green', icon: 'check' },
            interrompidas: { label: 'Reprovado', tone: 'red', icon: 'x' },
            previstas: { label: 'Previstas', tone: 'neutral', icon: 'clock' }
        },
        stageStatuses: {
            aprovado: { label: 'Aprovada', tone: 'green', icon: 'check' },
            execucao: { label: 'Em execução', tone: 'amber', icon: 'clock' },
            prevista: { label: 'Prevista', tone: 'neutral', icon: 'clock' },
            reprovado: { label: 'Reprovada', tone: 'red', icon: 'x' },
            naoExecutada: { label: 'Não executada', tone: 'neutral', icon: 'minus' }
        },
        requestStatus(row) {
            return row.processStatus === 'aprovado' || row.processStatus === 'reprovado' ?
                A.Config.processStatuses[row.processStatus] : A.Config.approvalStatuses[row.approvalStatus];
        },
        filters: [
            { key: 'company', label: 'Coligada' },
            { key: 'approvalType', label: 'Tipo de Aprovação' },
            { key: 'costCenter', label: 'Centro de Custo' },
            { key: 'movementType', label: 'Movimento' },
            { key: 'processStatus', label: 'Status da Solicitação' },
            { key: 'approvalStatus', label: 'Situação das Aprovações' },
            { key: 'approver', label: 'Aprovador Responsável' }
        ],
        columns: [
            { key: 'requestNumber', label: 'Nº Solicitação', width: 125, sticky: 'start', sortable: true, cell: 'request' },
            { key: 'processStatus', label: 'Status', width: 185, sortable: true, cell: 'status', value: row => A.Config.requestStatus(row).label },
            { key: 'company', label: 'Coligada', width: 100, sortable: true, cell: 'company' },
            { key: 'approvalType', label: 'Tipo de Aprovação', width: 150, sortable: true, cell: 'approvalType' },
            { key: 'movementType', label: 'Movimento', width: 185, sortable: true, cell: 'movementType' },
            { key: 'movementNumber', label: 'Nº Movimento', width: 95, sortable: true, cell: 'movementNumber' },
            { key: 'movementId', label: 'IDMOV', width: 90, sortable: true, cell: 'movementId' },
            { key: 'costCenter', label: 'Centro de Custo', width: 185, sortable: true, cell: 'costCenter' },
            { key: 'supplier', label: 'Cliente / Fornecedor', width: 180, sortable: true, cell: 'supplier' },
            { key: 'issuedAt', label: 'Data Emissão', width: 110, sortable: true, cell: 'issuedAt', value: row => A.Utils.timestamp(row.issuedAt) },
            { key: 'gross', label: 'Valor Bruto', width: 120, align: 'right', sortable: true, cell: 'gross' },
            { key: 'net', label: 'Valor Líquido', width: 120, align: 'right', sortable: true, cell: 'net' },
            { key: 'actions', label: 'Ações', width: 105, sticky: 'end', sortable: false, resizable: false, cell: 'actions' }
        ]
    };
    A.Config.columns.forEach(column => {
        column.filterable = column.key !== 'actions';
        column.filterValue = row => A.Config.columnFilterValue(row, column.key);
        column.filterLabel = value => A.Config.columnFilterLabel(value, column.key);
    });
})(window.AlcadaPanel);
