(function (A) {
    'use strict';
    const U = A.Utils;
    const paths = {
        search: '<circle cx="10.8" cy="10.8" r="7.1"/><path d="m16 16 4.5 4.5"/>',
        filter: '<path d="M3 4h18l-7 8v7l-4 2v-9z"/>',
        refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2"/>',
        download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
        external: '<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M7 14h2m4 0h2m-8 4h2"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        x: '<path d="m6 6 12 12M18 6 6 18"/>',
        minus: '<path d="M5 12h14"/>',
        chevron: '<path d="m8 5 7 7-7 7"/>',
        down: '<path d="m6 9 6 6 6-6"/>',
        arrowLeft: '<path d="m14 6-6 6 6 6"/>',
        history: '<path d="M3 11a9 9 0 1 1 2.6 7.5M3 4v7h7M12 7v5l3 2"/>',
        eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
        document: '<path d="M14 2H5v20h14V7zM14 2v5h5M8 12h8M8 16h6"/>',
        layers: '<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
        shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6z"/><path d="m8 12 3 3 5-6"/>',
        building: '<path d="M4 22V3h12v19M16 10h4v12M2 22h20M8 7h1m3 0h1M8 11h1m3 0h1M8 15h1m3 0h1M9 22v-3h3v3"/>',
        money: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 9v6m14-6v6"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
        alert: '<path d="m12 3 10 18H2zM12 9v5m0 3h.01"/>',
        inbox: '<path d="M4 4h16l2 13v4H2v-4zM2 17h6l2 3h4l2-3h6"/>',
        sort: '<path d="m8 3-4 4 4 4M4 7h16m-4 6 4 4-4 4M20 17H4"/>',
        grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        home: '<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>'
    };
    A.Icon = { render(name, className = '') { return `<svg class="icon ${U.escape(className)}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.document}</svg>`; } };
    A.Button = {
        render({ label = '', icon, variant = 'secondary', size = '', action, title, attrs = {}, disabled = false, href, iconOnly = false }) {
            const attributes = { ...attrs, class: `btn btn--${variant} ${size ? 'btn--' + size : ''} ${iconOnly ? 'btn--icon' : ''} ${attrs.class || ''}`, title, 'data-action': action };
            if (iconOnly) attributes['aria-label'] = title || label;
            const content = `${icon ? A.Icon.render(icon) : ''}${label ? `<span${iconOnly ? ' class="sr-only"' : ''}>${U.escape(U.titleCase(label))}</span>` : ''}`;
            if (href) return `<a${U.attrs({ ...attributes, href, target: attrs.target || '_blank', rel: 'noopener noreferrer' })}>${content}</a>`;
            return `<button${U.attrs({ ...attributes, type: 'button', disabled })}>${content}</button>`;
        }
    };
    A.Badge = { render(status, className = '') { return `<span class="badge badge--${U.escape(status.tone || 'neutral')} ${U.escape(className)}">${status.icon ? A.Icon.render(status.icon) : '<span class="badge-dot"></span>'}${U.escape(status.label)}</span>`; } };
    A.Alert = {
        render({ tone = 'blue', title, message, icon = 'info' }) {
            return `<div class="alert alert--${U.escape(tone)}" role="${tone === 'red' ? 'alert' : 'status'}">${A.Icon.render(icon)}<div>${title ? `<strong>${U.escape(U.titleCase(title))}</strong>` : ''}${message ? `<p>${U.escape(message)}</p>` : ''}</div></div>`;
        }
    };
    A.EmptyState = { render({ title = 'Nenhum registro encontrado', message = 'Altere os filtros ou limpe a busca para consultar os registros disponíveis.' } = {}) {
        return `<div class="empty-state" role="status"><span class="empty-state-icon">${A.Icon.render('inbox')}</span><strong>${U.escape(U.titleCase(title))}</strong><p>${U.escape(message)}</p></div>`;
    } };
    A.StatCard = { render({ label, value, description, icon, tone, action, attrs = {} }) {
        const tag = action ? 'button' : 'article';
        return `<${tag}${U.attrs({ class: `stat-card stat-card--${tone || 'blue'}`, type: action ? 'button' : null, 'data-action': action, ...attrs })}><span class="stat-icon">${A.Icon.render(icon)}</span><span class="stat-copy"><span class="stat-label">${U.escape(U.titleCase(label))}</span><strong>${U.escape(value)}</strong><small>${U.escape(description || 'Nos resultados da consulta')}</small></span>${action ? A.Icon.render('chevron', 'stat-arrow') : ''}</${tag}>`;
    } };
    A.DefinitionList = { render(items, className = '') { return `<dl class="definition-list ${U.escape(className)}">${items.map(item => `<div${U.attrs({ class: item.wide ? 'definition-wide' : '' })}><dt>${U.escape(U.titleCase(item.label))}</dt><dd>${item.html || U.escape(item.value == null || item.value === '' ? '—' : item.value)}</dd></div>`).join('')}</dl>`; } };
    A.Card = { render({ title, icon, subtitle, content, className = '' }) { return `<section class="detail-card ${U.escape(className)}"><div class="detail-card-heading">${icon ? A.Icon.render(icon) : ''}<div><h3>${U.escape(U.titleCase(title))}</h3>${subtitle ? `<p>${U.escape(subtitle)}</p>` : ''}</div></div>${content}</section>`; } };
    A.InformationSection = {
        render({ title, icon, subtitle, content }) {
            return `<section class="information-section" aria-label="${U.escape(U.titleCase(title))}"><div class="information-section-heading">${icon ? A.Icon.render(icon) : ''}<div><h3>${U.escape(U.titleCase(title))}</h3>${subtitle ? `<p>${U.escape(subtitle)}</p>` : ''}</div></div>${content}</section>`;
        }
    };
    A.Progress = { render(done, total, tone = 'green') { const percent = total ? Math.min(100, Math.round(done / total * 100)) : 0; return `<div class="progress progress--${U.escape(tone)}" role="progressbar" aria-label="Etapas aprovadas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><span style="width:${percent}%"></span></div>`; } };
    A.Toast = { show({ title, message = '', tone = 'green' }, root = document.getElementById('toast-root')) {
        const container = document.createElement('div'); container.className = 'toast';
        container.innerHTML = A.Alert.render({ title, message, tone, icon: tone === 'green' ? 'check' : 'alert' }) + A.Button.render({ icon: 'x', title: 'Fechar aviso', iconOnly: true, variant: 'ghost' });
        root.appendChild(container);
        const close = () => container.remove(); container.querySelector('button').addEventListener('click', close);
        setTimeout(close, 5000);
    } };
    A.Tabs = {
        render({ id, tabs, active = tabs[0].key }) {
            return `<div class="tabs" data-tabs="${U.escape(id)}"><div class="tab-list" role="tablist" aria-label="Seções dos detalhes">${tabs.map(tab => `<button type="button" role="tab" id="${id}-tab-${tab.key}" aria-controls="${id}-panel-${tab.key}" aria-selected="${tab.key === active}" tabindex="${tab.key === active ? '0' : '-1'}" data-tab="${U.escape(tab.key)}">${A.Icon.render(tab.icon)}${U.escape(U.titleCase(tab.label))}${tab.count != null ? `<span class="tab-count">${tab.count}</span>` : ''}</button>`).join('')}</div>${tabs.map(tab => `<section id="${id}-panel-${tab.key}" role="tabpanel" aria-labelledby="${id}-tab-${tab.key}"${tab.key === active ? '' : ' hidden'} tabindex="0">${tab.content}</section>`).join('')}</div>`;
        },
        mount(element) {
            if (!element) return;
            function activate(button) {
                element.querySelectorAll('[role="tab"]').forEach(tab => { const selected = tab === button; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
                element.querySelectorAll('[role="tabpanel"]').forEach(panel => { panel.hidden = panel.id !== button.getAttribute('aria-controls'); });
                if (A.DataTable) A.DataTable.adjust(element.querySelector('[role="tabpanel"]:not([hidden])'));
            }
            element.addEventListener('click', event => { const tab = event.target.closest('[role="tab"]'); if (tab) activate(tab); });
            element.addEventListener('keydown', event => {
                const tab = event.target.closest('[role="tab"]'); if (!tab || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault(); const tabs = [...element.querySelectorAll('[role="tab"]')]; let index = tabs.indexOf(tab);
                index = event.key === 'Home' ? 0 : (event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length);
                activate(tabs[index]); tabs[index].focus();
            });
        }
    };
})(window.AlcadaPanel);
