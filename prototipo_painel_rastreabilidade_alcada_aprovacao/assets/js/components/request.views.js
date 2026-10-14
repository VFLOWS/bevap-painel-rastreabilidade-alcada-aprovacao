(function (A) {
    'use strict';
    const U = A.Utils;
    const B = A.Button;
    const text = value => U.escape(value == null || value === '' ? '—' : value);
    const label = (code, name) => `<span class="cell-label">${U.escape(U.combine(code, name))}</span>`;
    const processBadge = row => A.Badge.render(A.Config.processStatuses[row.processStatus]);
    const approvalBadge = row => A.Badge.render(A.Config.approvalStatuses[row.approvalStatus]);
    const requestLink = row => B.render({ label: '#' + row.requestNumber, icon: 'external', variant: 'link', href: 'about:blank', title: `Abrir solicitação ${row.requestNumber} em uma nova guia` });
    A.RequestCells = {
        request: requestLink,
        company: row => label(row.company.code, row.company.name),
        approvalType: row => label(row.approvalType.code, row.approvalType.name),
        movementType: row => label(row.movementType.code, row.movementType.name),
        movementNumber: row => `<span class="numeric">${text(row.movementNumber)}</span>`,
        movementId: row => `<span class="numeric subdued">${text(row.movementId)}</span>`,
        costCenter: row => label(row.costCenter.code, row.costCenter.name),
        supplier: row => `<span class="cell-label">${text(row.supplier.name)}</span><span class="cell-secondary numeric">${text(row.supplier.document)}</span>`,
        issuedAt: row => `<span class="numeric">${U.date(row.issuedAt)}</span>`,
        gross: row => `<span class="numeric money">${U.money(row.gross)}</span>`,
        net: row => `<strong class="numeric money">${U.money(row.net)}</strong>`,
        status: row => `<div class="approval-cell">${A.Badge.render(A.Config.requestStatus(row))}<span class="cell-secondary">${row.approvals.active ? text(row.approvals.active.approver.name) : `${row.approvals.completed} de ${row.approvals.total} etapas aprovadas`}</span><div class="approval-cell-progress">${A.Progress.render(row.approvals.completed, row.approvals.total, row.processStatus === 'reprovado' ? 'red' : 'green')}<small>${row.approvals.completed}/${row.approvals.total}</small></div></div>`,
        actions: row => `<div class="table-actions">${B.render({ icon: 'history', label: 'Histórico de Alçada de Aprovação', iconOnly: true, variant: 'history', action: 'history', attrs: { 'data-request': row.requestNumber }, title: `Histórico de Alçada de Aprovação · Solicitação ${row.requestNumber}` })}${B.render({ icon: 'eye', label: 'Detalhes', iconOnly: true, variant: 'details', action: 'details', attrs: { 'data-request': row.requestNumber }, title: `Detalhes da solicitação ${row.requestNumber}` })}</div>`
    };
    const itemColumns = [
        { key: 'sequence', label: 'Item', width: 60 }, { key: 'product', label: 'Produto / Serviço', width: 290 },
        { key: 'quantity', label: 'Quantidade', width: 120, align: 'right', render: row => `${U.quantity(row.quantity)} <span class="subdued" title="${U.escape(row.unit)}">${U.escape((row.unit || '').split(' - ')[0] || '—')}</span>` },
        { key: 'unitPrice', label: 'Valor Unitário', width: 135, align: 'right', render: row => U.money(row.unitPrice) },
        { key: 'total', label: 'Valor Total', width: 135, align: 'right', render: row => `<strong>${U.money(row.total)}</strong>` },
        { key: 'costCenter', label: 'Centro de Custo', width: 240 }, { key: 'group', label: 'Grupo de Produto', width: 155 }
    ];
    const allocationColumns = [
        { key: 'costCenter', label: 'Centro de Custo', width: 300 },
        { key: 'percentage', label: 'Percentual', width: 120, align: 'right', render: row => U.quantity(row.percentage) + '%' },
        { key: 'value', label: 'Valor Rateado', width: 155, align: 'right', render: row => `<strong>${U.money(row.value)}</strong>` },
        { key: 'observation', label: 'Observação', width: 300 }
    ];
    const itemAllocationColumns = [
        { key: 'sequence', label: 'Item', width: 60 }, { key: 'product', label: 'Produto / Serviço', width: 240 },
        { key: 'costCenter', label: 'Centro de Custo', width: 290 },
        { key: 'percentage', label: 'Percentual', width: 100, align: 'right', render: row => U.quantity(row.percentage) + '%' },
        { key: 'value', label: 'Valor Rateado', width: 145, align: 'right', render: row => U.money(row.value) }
    ];
    const section = options => A.InformationSection.render(options);
    const information = items => A.DefinitionList.render(items, 'definition-list--columns');
    const detailsContent = content => `<div class="request-detail-content">${content}</div>`;
    const movementAllocations = row => section({
        title: 'Rateio do movimento', icon: 'building', subtitle: 'Distribuição do valor líquido entre os centros de custo.',
        content: A.DataTable.render({ id: 'movement-allocations', columns: allocationColumns, rows: row.allocations, compact: true, paging: false, caption: 'Rateio do movimento', emptyTitle: 'Nenhum rateio informado' })
    });
    const itemAllocations = row => section({
        title: 'Rateio dos itens', icon: 'layers', subtitle: 'Distribuição dos custos de cada produto ou serviço.',
        content: A.DataTable.render({ id: 'item-allocations', columns: itemAllocationColumns, rows: row.itemAllocations, compact: true, paging: false, caption: 'Rateio dos itens', emptyTitle: 'Nenhum rateio de item informado' })
    });
    function general(row) {
        const current = row.approvals.active;
        const rejection = row.processStatus === 'reprovado' ? A.Alert.render({ tone: 'red', icon: 'alert', title: 'Solicitação reprovada', message: row.rejectionReason || 'Consulte o histórico das alçadas para verificar a decisão registrada.' }) : '';
        return `${rejection}${detailsContent(section({ title: 'Dados da solicitação', icon: 'document', content: information([
            { label: 'Nº Solicitação', html: requestLink(row) },
            { label: 'Status da solicitação', html: processBadge(row) },
            { label: 'Atividade atual', value: row.activity },
            { label: 'Situação das aprovações', html: approvalBadge(row) },
            { label: 'Alçadas aprovadas', html: `<div class="detail-approval-progress"><span>${row.approvals.completed} de ${row.approvals.total}</span>${A.Progress.render(row.approvals.completed, row.approvals.total, row.processStatus === 'reprovado' ? 'red' : 'green')}</div>` },
            { label: 'Solicitante', value: row.requester },
            { label: 'Abertura', value: U.dateTime(row.openedAt) },
            { label: 'Tipo de Aprovação', value: U.combine(row.approvalType.code, row.approvalType.name) },
            { label: 'Aprovador responsável', value: current ? current.approver.name : 'Etapas de aprovação concluídas' },
            { label: 'Coligada', value: U.combine(row.company.code, row.company.name) }, { label: 'Filial', value: U.combine(row.branch.code, row.branch.name) }
        ]) }) + section({ title: 'Dados do movimento', icon: 'layers', content: information([
            { label: 'Nº Movimento', value: row.movementNumber }, { label: 'IDMOV', value: row.movementId },
            { label: 'Movimento', value: U.combine(row.movementType.code, row.movementType.name), wide: true },
            { label: 'Data de emissão', value: U.dateTime(row.issuedAt) }, { label: 'Data de saída', value: U.dateTime(row.exitedAt) },
            { label: 'Série', value: row.series }, { label: 'Situação no RM', value: row.movementStatus },
            { label: 'Centro de Custo', value: U.combine(row.costCenter.code, row.costCenter.name), wide: true }
        ]) }) + section({ title: 'Cliente / Fornecedor', icon: 'building', content: information([
            { label: 'Código e nome', value: U.combine(row.supplier.code, row.supplier.name), wide: true },
            { label: 'CNPJ / CPF', value: row.supplier.document, wide: true }
        ]) }) + section({ title: 'Composição dos valores', icon: 'money', content: `<dl class="financial-list financial-list--columns"><div><dt>Valor bruto</dt><dd>${U.money(row.gross)}</dd></div><div><dt>Frete</dt><dd>${U.money(row.freight)}</dd></div><div><dt>Descontos</dt><dd>${U.money(row.discount)}</dd></div><div class="financial-total"><dt>Valor líquido</dt><dd>${U.money(row.net)}</dd></div></dl>` }) + movementAllocations(row) + section({ title: 'Alçadas de aprovação', icon: 'history', content: A.ApprovalTimeline.render({ stages: row.stages }) }) + section({ title: 'Observações da solicitação', icon: 'info', content: `<p class="observation">${text(row.observation)}</p>` }))}`;
    }
    A.RequestViews = {
        details(row) {
            const items = section({ title: 'Itens do movimento', icon: 'layers', subtitle: `${row.items.length} itens · total ${U.money(row.items.reduce((sum, item) => sum + (item.total || 0), 0))}`, content: A.DataTable.render({ id: 'request-items', columns: itemColumns, rows: row.items, compact: true, paging: false, caption: 'Itens do movimento', emptyTitle: 'Nenhum item informado' }) });
            return {
                title: `Detalhes da solicitação #${row.requestNumber}`,
                subtitle: U.combine(row.approvalType.code, row.approvalType.name), icon: 'eye', className: 'modal--details',
                content: A.Tabs.render({ id: 'request-details', tabs: [
                    { key: 'overview', label: 'Visão geral', icon: 'grid', content: general(row) },
                    { key: 'items', label: 'Itens do movimento', icon: 'layers', count: row.items.length, content: detailsContent(items + itemAllocations(row)) }
                ] }),
                footer: `<div class="modal-footer-context">${processBadge(row)}<span>Dados da solicitação #${row.requestNumber}</span></div>${B.render({ label: 'Histórico de Alçada de Aprovação', icon: 'history', action: 'history', attrs: { 'data-request': row.requestNumber }, variant: 'navy' })}`,
                onMount(dialog) { A.Tabs.mount(dialog.querySelector('[data-tabs]')); }
            };
        },
        history(row) {
            const status = A.Config.approvalStatuses[row.approvalStatus];
            const active = row.approvals.active;
            const message = row.approvalStatus === 'execucao' ? `Aguardando a manifestação de ${active.approver.name}. As próximas alçadas serão executadas em sequência.` :
                (row.approvalStatus === 'interrompidas' ? 'A sequência foi interrompida por uma reprovação. As etapas seguintes não foram executadas.' :
                    (row.approvalStatus === 'concluidas' ? `${row.approvals.total} etapas aprovadas. ${row.processStatus === 'aberto' ? 'O processo segue para a integração com o RM.' : 'O fluxo de aprovação foi concluído.'}` : 'A matriz de aprovação está definida. As etapas aguardam execução.'));
            return {
                title: 'Histórico de Alçada de Aprovação',
                subtitle: `Solicitação #${row.requestNumber} · ${U.combine(row.approvalType.code, row.approvalType.name)}\n${U.combine(row.movementType.code, row.movementType.name)} · ${row.movementNumber || '—'} · ${row.movementId || '—'}`,
                icon: 'history', className: 'modal--history',
                content: `<div class="history-overview"><div><span class="eyebrow">TRILHA DE APROVAÇÃO</span><h3>${row.approvals.completed} de ${row.approvals.total} alçadas aprovadas</h3></div>${approvalBadge(row)}</div>${A.Progress.render(row.approvals.completed, row.approvals.total, status.tone)}${A.Alert.render({ tone: status.tone, title: status.label, message, icon: status.icon })}${A.ApprovalTimeline.render({ stages: row.stages })}`,
                footer: `<div class="modal-footer-context">${processBadge(row)}<span>Solicitação #${row.requestNumber}</span></div>${B.render({ label: 'Detalhes da solicitação', icon: 'eye', action: 'details', attrs: { 'data-request': row.requestNumber }, variant: 'navy' })}`
            };
        }
    };
})(window.AlcadaPanel);
