(function (A) {
    'use strict';
    const U = A.Utils;
    function children(record, table, prefix, indexField) {
        if (record.children && Array.isArray(record.children[table])) return record.children[table];
        const card = record.card || {};
        return Object.keys(card).filter(key => key.startsWith(indexField + '___')).map(key => {
            const suffix = key.slice(indexField.length);
            return Object.fromEntries(Object.entries(card).filter(([name]) => name.startsWith(prefix) && name.endsWith(suffix))
                .map(([name, value]) => [name.slice(0, -suffix.length), value]));
        });
    }
    function stageStatus(raw, order, current, processStatus) {
        const status = U.normalize(raw);
        if (status === 'reprovada' || status === 'reprovado') return 'reprovado';
        if (status === 'aprovada' || status === 'aprovado' || processStatus === 'aprovado') return 'aprovado';
        if (processStatus === 'reprovado') return order === current ? 'reprovado' : (order > current ? 'naoExecutada' : 'aprovado');
        return order === current ? 'execucao' : 'prevista';
    }
    A.RequestAdapter = {
        children,
        fromRecord(record) {
            const card = record.card || {};
            const workflow = record.workflow || {};
            const processStatus = workflow.processStatus;
            if (!A.Config.processStatuses[processStatus]) throw new Error('Situação do processo não reconhecida.');
            const current = Math.max(1, Number(card.alcada_indice_atual) || 1);
            const stages = children(record, 'tb_alcadas', 'alcada_', 'alcada_ordem').map(row => {
                const order = Number(row.alcada_ordem);
                const history = (workflow.history || []).find(item => Number(item.order) === order) || {};
                return {
                    order, title: row.alcada_descricao, level: row.alcada_nivel,
                    origin: row.alcada_origem === 'AREA_VALIDADORA' ? 'Área Validadora' : 'Hierarquia',
                    hierarchy: row.alcada_hierarquia_desc,
                    approver: { id: row.alcada_aprovador_id, login: row.alcada_aprovador_login, name: row.alcada_aprovador_nome },
                    costCenter: U.combine(row.alcada_centro_custo, row.alcada_centro_custo_nome),
                    rangeStart: U.number(row.alcada_valor_inicial), rangeEnd: U.number(row.alcada_valor_final),
                    status: stageStatus(row.alcada_status, order, current, processStatus),
                    receivedAt: history.receivedAt || null, actedAt: history.actedAt || null,
                    comment: history.comment || (processStatus === 'reprovado' && order === current ? card.alcada_justificativa_aprovador : '')
                };
            }).sort((a, b) => a.order - b.order);
            const completed = stages.filter(stage => stage.status === 'aprovado').length;
            const active = stages.find(stage => stage.status === 'execucao' || stage.status === 'reprovado');
            const approvalStatus = stages.some(stage => stage.status === 'reprovado') ? 'interrompidas' :
                (stages.length && completed === stages.length ? 'concluidas' : (active ? 'execucao' : 'previstas'));
            return {
                requestNumber: Number(workflow.requestNumber), processStatus, approvalStatus,
                openedAt: workflow.openedAt, closedAt: workflow.closedAt, requester: workflow.requester, activity: workflow.activity,
                company: { code: card.tmov_codcoligada, name: card.tmov_nomecoligada },
                branch: { code: card.tmov_codfilial, name: card.tmov_nomefilial },
                approvalType: { code: card.alcada_tipoaprovacao_codigo, name: card.alcada_tipoaprovacao_descricao },
                movementType: { code: card.tmov_codtmv, name: card.tmov_nometmv },
                movementId: card.tmov_idmov, movementNumber: card.tmov_numeromov,
                costCenter: { code: card.tmov_codccusto, name: card.tmov_nomeccusto },
                supplier: { code: card.tmov_codcfo, name: card.tmov_nomecfo, document: card.tmov_cgccfo },
                issuedAt: card.tmov_dataemissao, exitedAt: card.tmov_datasaida, series: card.tmov_serie,
                movementStatus: U.combine(card.tmov_status, card.tmov_statusdescricao),
                gross: U.number(card.tmov_valorbruto), net: U.number(card.tmov_valorliquido),
                freight: U.number(card.tmov_valorfrete), discount: U.number(card.tmov_valordesc), observation: card.tmov_observacao,
                rejectionReason: card.alcada_justificativa_aprovador, stages,
                approvals: { completed, total: stages.length, current, active },
                items: children(record, 'tb_titmmov', 'titmmov_', 'titmmov_nseqitmmov').map(row => ({
                    sequence: Number(row.titmmov_nseqitmmov), product: U.combine(row.titmmov_codigoprd, row.titmmov_nomefantasia),
                    unit: U.combine(row.titmmov_codund, row.titmmov_nomeund), quantity: U.number(row.titmmov_quantidade),
                    unitPrice: U.number(row.titmmov_precounitario), total: U.number(row.titmmov_valortotalitem),
                    costCenter: U.combine(row.titmmov_codccusto, row.titmmov_nomeccusto), group: U.combine(row.titmmov_codtb3fat, row.titmmov_nometb3fat)
                })),
                allocations: children(record, 'tb_tmovratccu', 'tmovratccu_', 'tmovratccu_idmovratccu').map(row => ({
                    costCenter: U.combine(row.tmovratccu_codccusto, row.tmovratccu_nome), percentage: U.number(row.tmovratccu_percentual),
                    value: U.number(row.tmovratccu_valor), observation: row.tmovratccu_historico,
                    project: row.tmovratccu_codprj, task: row.tmovratccu_codtrf
                })),
                itemAllocations: children(record, 'tb_titmmovratccu', 'titmmovratccu_', 'titmmovratccu_nseqitmmov').map(row => ({
                    sequence: Number(row.titmmovratccu_nseqitmmov), product: row.titmmovratccu_nomefantasia,
                    costCenter: U.combine(row.titmmovratccu_codccusto, row.titmmovratccu_nome),
                    percentage: U.number(row.titmmovratccu_percentual), value: U.number(row.titmmovratccu_valor), observation: row.titmmovratccu_historico
                }))
            };
        }
    };
})(window.AlcadaPanel);
