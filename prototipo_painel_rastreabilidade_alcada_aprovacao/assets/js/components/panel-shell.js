(function (A) {
    'use strict';
    const U = A.Utils;
    A.Header = {
        render({ title, logo, initials = 'DM', environment = 'PROTÓTIPO', breadcrumbs = ['Alçadas de Aprovação', 'Rastreabilidade'] }) {
            return `<header class="brand-header"><div class="brand-header-main"><a class="brand-logo" href="index.html" aria-label="Painel de Rastreabilidade BEVAP"><img src="${U.escape(logo)}" alt="BEVAP"></a><span class="brand-divider"></span><h1>${U.escape(title)}</h1><div class="header-user"><span class="environment-label">${U.escape(environment)}</span><span class="avatar" aria-label="Usuário de demonstração">${U.escape(initials)}</span></div></div><nav class="breadcrumb" aria-label="Navegação estrutural">${A.Icon.render('home')}${breadcrumbs.map((label, index) => `${index ? A.Icon.render('chevron') : ''}<${index === breadcrumbs.length - 1 ? 'strong' : 'span'}>${U.escape(label)}</${index === breadcrumbs.length - 1 ? 'strong' : 'span'}>`).join('')}</nav></header>`;
        }
    };
    A.TableToolbar = {
        render({ title, searchId, countId, scopeId, searchPlaceholder, actions = '' }) {
            return `<div class="requests-toolbar"><div class="requests-title"><span class="section-icon">${A.Icon.render('document')}</span><div><h3 id="requests-title">${U.escape(title)} <span class="count-pill" id="${U.escape(countId)}">—</span></h3><p id="${U.escape(scopeId)}">Todas as solicitações</p></div></div><div class="table-search"><div class="search-input"><label class="sr-only" for="${U.escape(searchId)}">Busca textual nas solicitações</label>${A.Icon.render('search')}<input id="${U.escape(searchId)}" type="search" placeholder="${U.escape(searchPlaceholder)}" autocomplete="off"></div>${A.Button.render({ label: 'Buscar', variant: 'navy', action: 'search' })}</div>${actions}</div>`;
        }
    };
    A.PanelShell = {
        render({ title, heading, description, logo }) {
            return `${A.Header.render({ title, logo })}<main class="panel-main"><div class="page-heading"><div><span class="eyebrow">ACOMPANHAMENTO DE PROCESSOS</span><h2>${U.escape(heading)}</h2><p>${U.escape(description)}</p></div><div class="page-heading-actions">${A.Button.render({ label: 'Atualizar', icon: 'refresh', action: 'refresh', attrs: { id: 'refresh-requests' } })}</div></div><section id="summary-region" class="stats-grid" aria-label="Resumo da consulta"></section><section class="surface filter-surface" id="filters-region" aria-label="Filtros das solicitações"></section><section class="surface requests-surface" id="requests-region" aria-labelledby="requests-title">${A.TableToolbar.render({ title: 'Solicitações de aprovação', searchId: 'request-search', countId: 'request-count', scopeId: 'result-scope', searchPlaceholder: 'Buscar solicitação, movimento ou fornecedor…', actions: A.Button.render({ label: 'Exportar CSV', icon: 'download', action: 'export', attrs: { id: 'export-requests' } }) })}<div id="table-region"></div><div id="pagination-region"></div></section><footer class="panel-footer"><span>${A.Icon.render('shield')}Alçada de Aprovação · Acompanhamento de solicitações</span><span id="last-update">Carregando dados…</span></footer></main>`;
        }
    };
})(window.AlcadaPanel);
