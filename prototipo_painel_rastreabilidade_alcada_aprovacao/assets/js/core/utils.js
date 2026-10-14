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
        let text = String(value);
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text += 'T12:00:00-03:00';
        else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(text)) text += '-03:00';
        const result = new Date(text);
        return Number.isNaN(result.getTime()) ? null : result;
    }
    A.Utils = {
        escape,
        attrs(attributes = {}) {
            return Object.entries(attributes).filter(([, value]) => value != null && value !== false).map(([name, value]) =>
                ` ${name}="${escape(value === true ? '' : value)}"`).join('');
        },
        text(value) { return String(value == null ? '' : value).trim(); },
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
        csv(rows) {
            return '\uFEFF' + rows.map(row => row.map(value => {
                let text = String(value == null ? '' : value);
                if (/^[=+\-@]/.test(text)) text = "'" + text;
                return '"' + text.replace(/"/g, '""') + '"';
            }).join(';')).join('\r\n');
        },
        download(name, content, type = 'text/csv;charset=utf-8') {
            const url = URL.createObjectURL(new Blob([content], { type }));
            const link = document.createElement('a');
            link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    };
})(window);
