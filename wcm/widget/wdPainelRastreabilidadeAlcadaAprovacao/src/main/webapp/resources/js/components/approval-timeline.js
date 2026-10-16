(function (A) {
    'use strict';
    const U = A.Utils;
    const text = value => U.escape(value == null || value === '' ? '—' : value);
    A.ApprovalTimeline = {
        render({ stages = [], expandCurrent = false }) {
            if (!stages.length) return A.EmptyState.render({
                title: 'Nenhuma alçada informada',
                message: 'As etapas de aprovação serão apresentadas quando estiverem disponíveis.'
            });
            const items = stages.map(stage => {
                const status = A.Config.stageStatuses[stage.status];
                const current = stage.status === 'execucao' || stage.status === 'reprovado';
                const comment = stage.comment || (stage.status === 'execucao' ? 'Aguardando a manifestação do aprovador.' :
                    (stage.status === 'prevista' ? 'Esta aprovação será disponibilizada após a conclusão da etapa anterior.' :
                        (stage.status === 'naoExecutada' ? 'Etapa não executada devido à reprovação anterior.' : 'Aprovação concluída.')));
                const fields = [{ label: 'Origem da alçada', value: stage.origin }];
                if (stage.group) {
                    fields.push({ label: 'Área validadora', value: stage.validatorArea },
                        { label: 'Grupo de Produto', value: U.combine(stage.group.code, stage.group.name), wide: true });
                } else if (['AREA_GERAL', 'AREA_VALIDADORA'].includes(stage.originCode)) {
                    fields.push({ label: 'Área validadora', value: stage.validatorArea });
                } else {
                    fields.push({ label: 'Nível', value: stage.level }, { label: 'Hierarquia / Área', value: stage.hierarchy },
                        { label: 'Centro de Custo', value: stage.costCenter, wide: true },
                        { label: 'Faixa de aprovação', value: `${U.money(stage.rangeStart)} até ${U.money(stage.rangeEnd)}`, wide: true });
                }
                return `<li class="timeline-step timeline-step--${status.tone}"><span class="timeline-marker">${A.Icon.render(status.icon)}</span><details class="stage-card"${expandCurrent && current ? ' open' : ''}><summary><div class="stage-topline"><strong>Aprovação ${String(stage.order).padStart(2, '0')}</strong>${A.Badge.render(status)}${A.Icon.render('down', 'stage-toggle')}</div><div class="stage-person"><span class="avatar avatar--small">${U.escape(U.initials(stage.approver.name))}</span><div><strong>${text(stage.approver.name)}</strong></div></div></summary><div class="stage-body">${A.DefinitionList.render(fields)}<div class="stage-comment"><span>${stage.status === 'reprovado' ? 'Justificativa da Reprovação' : 'Registro da Etapa'}</span><p>${text(comment)}</p></div></div></details></li>`;
            }).join('');
            return `<ol class="timeline">${items}</ol>`;
        }
    };
})(window.AlcadaPanel);
