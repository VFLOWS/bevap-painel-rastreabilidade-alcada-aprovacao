(function (A) {
    'use strict';
    const companies = [
        { code: '1', name: 'BEVAP' }, { code: '2', name: 'BEVAP Agrícola' }, { code: '3', name: 'BEVAP Serviços' }
    ];
    const types = [
        { code: 'SCS', name: 'Solicitação de Compra de Serviço' },
        { code: 'PC', name: 'Pedido de Compra' }, { code: 'AC', name: 'Aquisição de Contratação' }
    ];
    const movements = [
        { code: '1.1.20', name: 'Pré SCS · Solicitação de compra de serviço e locação' },
        { code: '1.1.01', name: 'Pedido de compra de materiais' },
        { code: '1.1.05', name: 'Solicitação de contratação' }
    ];
    const centers = [
        { code: '1.01.001', name: 'Tecnologia da Informação e Comunicação' },
        { code: '1.02.014', name: 'Manutenção Industrial' },
        { code: '1.03.008', name: 'Operações Agrícolas' },
        { code: '1.04.003', name: 'Administrativo e Financeiro' },
        { code: '1.05.011', name: 'Logística e Suprimentos' },
        { code: '1.06.002', name: 'Engenharia e Projetos' }
    ];
    const suppliers = [
        { code: 'F00031', name: 'Norte Tecnologia Ltda.', document: '00.000.000/0001-01' },
        { code: 'F00042', name: 'Atlas Equipamentos Industriais', document: '00.000.000/0001-02' },
        { code: 'F00053', name: 'Verde Campo Soluções Agrícolas', document: '00.000.000/0001-03' },
        { code: 'F00064', name: 'Horizonte Serviços e Consultoria', document: '00.000.000/0001-04' },
        { code: 'F00075', name: 'Via Sul Transportes', document: '00.000.000/0001-05' },
        { code: 'F00086', name: 'Prisma Engenharia Ltda.', document: '00.000.000/0001-06' }
    ];
    const people = [
        { id: '000034', login: 'daniela.miguel', name: 'Daniela Miguel', role: 'Área Validadora · Tecnologia' },
        { id: '000014', login: 'hitalo.santos', name: 'Hitalo Santos', role: 'Coordenação' },
        { id: '000026', login: 'marina.costa', name: 'Marina Costa', role: 'Gerência' },
        { id: '000041', login: 'rafael.lima', name: 'Rafael Lima', role: 'Diretoria' },
        { id: '000052', login: 'camila.rocha', name: 'Camila Rocha', role: 'Área Validadora · Suprimentos' },
        { id: '000063', login: 'lucas.almeida', name: 'Lucas Almeida', role: 'Coordenação Industrial' }
    ];
    const reference = Date.parse('2026-10-13T10:30:00-03:00');
    const iso = offset => new Date(reference - offset * 86400000).toISOString();
    const records = Array.from({ length: 36 }, (_, index) => {
        const company = companies[Math.floor(index / 4) % companies.length];
        const type = types[index % types.length];
        const movement = movements[index % movements.length];
        const center = centers[index % centers.length];
        const supplier = suppliers[index % suppliers.length];
        const status = ['aberto', 'aprovado', 'aberto', 'reprovado', 'aberto', 'aprovado'][index % 6];
        const gross = index === 0 ? 2300 : 3700 + index * 1475;
        const freight = index % 3 ? 120 + index * 5 : 0;
        const discount = index === 0 || index % 4 ? 0 : Math.round(gross * 0.02 * 100) / 100;
        const net = Math.round((gross + freight - discount) * 100) / 100;
        const count = index === 0 ? 2 : (gross > 30000 ? 4 : 3);
        const integrating = status === 'aberto' && index > 0 && index % 12 === 0;
        const current = status === 'aprovado' || integrating ? count : (index % count) + 1;
        const startedAt = iso(index * 0.7 + 0.15);
        const issuedAt = index === 0 ? '2026-09-30T08:00:00-03:00' : iso(index * 0.7 + 1.5);
        const rejectedReason = 'A composição do orçamento precisa ser revisada. Favor conferir os valores e anexar uma nova cotação para o serviço.';
        const stages = Array.from({ length: count }, (_, stageIndex) => {
            const order = stageIndex + 1;
            const person = people[stageIndex === 0 ? (index % 2 ? 4 : 0) : stageIndex];
            const approved = status === 'aprovado' || integrating || order < current;
            return {
                alcada_ordem: String(order), alcada_origem: stageIndex === 0 ? 'AREA_VALIDADORA' : 'HIERARQUIA',
                alcada_descricao: `${type.code}-${String(26 + index).padStart(3, '0')} · Nível ${String(order).padStart(2, '0')}`,
                alcada_nivel: stageIndex === 0 ? 'Validação técnica' : ['Coordenação', 'Gerência', 'Diretoria'][stageIndex - 1],
                alcada_centro_custo: center.code, alcada_centro_custo_nome: center.name,
                alcada_hierarquia_id: String(100 + stageIndex), alcada_hierarquia_desc: person.role,
                alcada_aprovador_id: person.id, alcada_aprovador_login: person.login, alcada_aprovador_nome: person.name,
                alcada_valor_inicial: '0,00', alcada_valor_final: stageIndex < 2 ? '30.000,00' : '150.000,00',
                // The real workflow also initializes future steps as PENDENTE.
                alcada_status: approved ? 'APROVADA' : 'PENDENTE'
            };
        });
        const histories = stages.map((stage, stageIndex) => {
            const acted = stage.alcada_status === 'APROVADA' || (status === 'reprovado' && stageIndex + 1 === current);
            return {
                order: stageIndex + 1,
                receivedAt: stageIndex + 1 <= current ? new Date(Date.parse(startedAt) + stageIndex * 3600000).toISOString() : null,
                actedAt: acted ? new Date(Date.parse(startedAt) + (stageIndex + 0.8) * 3600000).toISOString() : null,
                comment: status === 'reprovado' && stageIndex + 1 === current ? rejectedReason :
                    (acted ? 'Valores e documentação conferidos. Aprovação registrada conforme a alçada definida.' : '')
            };
        });
        const itemValues = [Math.round(gross * 0.5 * 100) / 100, Math.round(gross * 0.3 * 100) / 100];
        itemValues.push(Math.round((gross - itemValues[0] - itemValues[1]) * 100) / 100);
        const itemNames = index % 3 === 0 ? ['Serviço de suporte técnico', 'Configuração de infraestrutura', 'Monitoramento de ambientes'] :
            (index % 3 === 1 ? ['Kit de manutenção preventiva', 'Conjunto de peças de reposição', 'Material de apoio operacional'] :
                ['Assessoria técnica especializada', 'Desenvolvimento de projeto', 'Acompanhamento de execução']);
        const items = itemValues.map((total, itemIndex) => ({
            titmmov_idprd: String(500 + itemIndex), titmmov_nseqitmmov: String(itemIndex + 1),
            titmmov_codigoprd: `PRD.${String(101 + itemIndex).padStart(4, '0')}`,
            titmmov_nomefantasia: itemNames[itemIndex], titmmov_codund: 'UN', titmmov_nomeund: 'Unidade',
            titmmov_quantidade: '1', titmmov_precounitario: String(total), titmmov_valortotalitem: String(total),
            titmmov_codccusto: center.code, titmmov_nomeccusto: center.name,
            titmmov_codtb3fat: index % 3 === 1 ? 'MAT' : 'SER', titmmov_nometb3fat: index % 3 === 1 ? 'Materiais' : 'Serviços'
        }));
        const secondaryCenter = centers[(index + 1) % centers.length];
        const firstAllocation = Math.round(net * 0.7 * 100) / 100;
        const allocations = [center, secondaryCenter].map((costCenter, i) => ({
            tmovratccu_idmovratccu: String(i + 1), tmovratccu_codccusto: costCenter.code,
            tmovratccu_nome: costCenter.name, tmovratccu_percentual: i ? '30' : '70',
            tmovratccu_valor: String(i ? Math.round((net - firstAllocation) * 100) / 100 : firstAllocation),
            tmovratccu_historico: i ? 'Apoio compartilhado entre áreas.' : 'Centro responsável pela contratação.',
            tmovratccu_codprj: index % 3 === 2 ? 'PRJ-2026-014' : '', tmovratccu_codtrf: index % 3 === 2 ? '01.02' : ''
        }));
        const card = {
            tmov_codcoligada: company.code, tmov_nomecoligada: company.name,
            tmov_idmov: String(6445728 + index * 17), tmov_codfilial: '1', tmov_nomefilial: 'BEVAP · João Pinheiro',
            tmov_codtmv: movement.code, tmov_nometmv: movement.name, tmov_numeromov: String(2385 + index).padStart(8, '0'),
            tmov_serie: type.code, tmov_status: status === 'aprovado' ? 'F' : (status === 'reprovado' ? 'C' : 'A'),
            tmov_statusdescricao: status === 'aprovado' ? 'Movimento aprovado' : (status === 'reprovado' ? 'Movimento cancelado' : 'Pendente a faturar'),
            tmov_integraaplicacao: 'T', tmov_dataemissao: issuedAt, tmov_datasaida: status === 'aprovado' ? histories[count - 1].actedAt : '',
            tmov_codcfo: supplier.code, tmov_nomecfo: supplier.name, tmov_cgccfo: supplier.document,
            tmov_codccusto: center.code, tmov_nomeccusto: center.name,
            tmov_valorbruto: String(gross), tmov_valorliquido: String(net), tmov_valorfrete: String(freight), tmov_valordesc: String(discount),
            tmov_observacao: `Contratação destinada à área de ${center.name.toLowerCase()}. Escopo e valores previstos na solicitação de compras. Conferir a distribuição dos custos antes da conclusão.`,
            alcada_tipoaprovacao_codigo: type.code, alcada_tipoaprovacao_descricao: type.name,
            alcada_indice_atual: String(current), alcada_total_etapas: String(count),
            alcada_aprovador_atual: stages[current - 1].alcada_aprovador_id,
            alcada_aprovador_atual_nome: stages[current - 1].alcada_aprovador_nome,
            alcada_rm_aprovado: status === 'aprovado' ? 'S' : '', alcada_rm_reprovado: status === 'reprovado' ? 'S' : '',
            alcada_justificativa_aprovador: status === 'reprovado' ? rejectedReason : ''
        };
        return {
            card,
            workflow: {
                requestNumber: 7105 + index, processStatus: status, openedAt: startedAt,
                closedAt: status === 'aberto' ? null : histories[current - 1].actedAt,
                requester: ['Ana Oliveira', 'Pedro Martins', 'Juliana Ribeiro', 'Gabriel Ferreira'][index % 4],
                activity: status === 'aberto' ? (integrating ? 'Aprovar movimento no TOTVS RM' : 'Aprovação') : 'Processo finalizado',
                history: histories
            },
            children: {
                tb_alcadas: stages, tb_titmmov: items, tb_tmovratccu: allocations,
                tb_titmmovratccu: items.map(item => ({
                    titmmovratccu_nseqitmmov: item.titmmov_nseqitmmov, titmmovratccu_nomefantasia: item.titmmov_nomefantasia,
                    titmmovratccu_codccusto: center.code, titmmovratccu_nome: center.name,
                    titmmovratccu_quantidade: '1', titmmovratccu_percentual: '100', titmmovratccu_valor: item.titmmov_valortotalitem,
                    titmmovratccu_historico: 'Rateio integral para o centro de custo solicitante.'
                }))
            }
        };
    });
    const catalogs = {
        company: companies.map(item => ({ value: item.code, label: A.Utils.combine(item.code, item.name) })),
        approvalType: types.map(item => ({ value: item.code, label: A.Utils.combine(item.code, item.name) })),
        costCenter: companies.flatMap(company => centers.map(item => ({ value: A.Utils.scoped(company.code, item.code), label: A.Utils.combine(item.code, item.name), company: company.code }))),
        movementType: companies.flatMap(company => movements.map(item => ({ value: A.Utils.scoped(company.code, item.code), label: A.Utils.combine(item.code, item.name), company: company.code }))),
        approver: people.map(item => ({ value: item.id, label: item.name })),
        processStatus: Object.entries(A.Config.processStatuses).map(([value, item]) => ({ value, label: item.label })),
        approvalStatus: Object.entries(A.Config.approvalStatuses).map(([value, item]) => ({ value, label: item.label }))
    };
    A.MockData = { records, catalogs, referenceDate: '2026-10-13' };
    A.MockProvider = {
        listRequests() { return new Promise(resolve => setTimeout(() => resolve(A.Utils.clone(records)), 240)); },
        listLookups() { return Promise.resolve(A.Utils.clone(catalogs)); }
    };
})(window.AlcadaPanel);
