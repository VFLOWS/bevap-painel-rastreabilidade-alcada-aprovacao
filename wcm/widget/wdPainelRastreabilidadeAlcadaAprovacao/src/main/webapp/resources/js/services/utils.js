(function (global) {
    'use strict';
    const A = global.AlcadaPanel = global.AlcadaPanel || {};
    const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const numbers = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
    const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const dateTime = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
    function escape(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }
    function number(value) {
        if (value === '' || value == null) return null;
        let text = String(value).replace(/R\$|\s/g, '');
        if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
        const result = Number(text);
        return Number.isFinite(result) ? result : null;
    }
    function toDate(value) {
        if (!value) return null;
        let text = String(value).trim();
        if (/^\d{11,13}$/.test(text)) {
            const timestamp = new Date(Number(text));
            return Number.isNaN(timestamp.getTime()) ? null : timestamp;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text += 'T12:00:00-03:00';
        else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(text)) text += '-03:00';
        const result = new Date(text);
        return Number.isNaN(result.getTime()) ? null : result;
    }
    A.Utils = {
        escape,
        find(root, id) { return root.querySelector('[data-panel-id="' + id + '"]') || root.querySelector('#' + id); },
        namespace(root, prefix) {
            const elements = [root, ...root.querySelectorAll('*')], ids = new Map();
            elements.filter(element => element.id && !element.dataset.panelId && !element.hasAttribute("data-alcada-widget")).forEach(element => {
                const old = element.id; element.dataset.panelId = old; element.id = prefix + '-' + old; ids.set(old, element.id);
            });
            elements.forEach(element => ['for', 'aria-controls', 'aria-labelledby', 'aria-describedby'].forEach(attribute => {
                const value = element.getAttribute(attribute);
                if (value) element.setAttribute(attribute, value.split(' ').map(id => ids.get(id) || id).join(' '));
            }));
        },
        attrs(attributes = {}) {
            return Object.entries(attributes).filter(([, value]) => value != null && value !== false).map(([name, value]) =>
                ` ${name}="${escape(value === true ? '' : value)}"`).join('');
        },
        text(value) { return String(value == null ? '' : value).trim(); },
        titleCase(value) {
            const connectors = ['a', 'as', 'o', 'os', 'ao', 'aos', 'à', 'às', 'de', 'da', 'das', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos', 'por', 'para', 'com', 'ou'];
            return String(value == null ? '' : value).replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g, (word, offset) =>
                offset > 0 && connectors.includes(word.toLowerCase()) ? word : word.charAt(0).toUpperCase() + word.slice(1));
        },
        normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); },
        number,
        money(value) { const parsed = number(value); return parsed == null ? '—' : currency.format(parsed); },
        quantity(value) { const parsed = number(value); return parsed == null ? '—' : numbers.format(parsed); },
        date(value) { const parsed = toDate(value); return parsed ? date.format(parsed) : '—'; },
        dateTime(value) { const parsed = toDate(value); return parsed ? dateTime.format(parsed) : '—'; },
        timestamp(value) { const parsed = toDate(value); return parsed ? parsed.getTime() : 0; },
        combine(code, description) { return [code, description].filter(value => value != null && String(value).trim()).join(' - ') || '—'; },
        scoped(company, code) { return `${String(company)}:${String(code)}`; },
        initials(name) { return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase(); },
        clone(value) { return JSON.parse(JSON.stringify(value)); },
        download(name, content, type = 'application/octet-stream') {
            const url = URL.createObjectURL(new Blob([content], { type }));
            const link = document.createElement('a');
            link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    };
})(window);
