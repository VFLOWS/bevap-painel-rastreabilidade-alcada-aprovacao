(function (A) {
    'use strict';
    const U = A.Utils;
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const monthNames = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const fullDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' });
    const presets = [
        { key: 'clear', label: 'Limpar período' },
        { key: 'last30', label: 'Últimos 30 dias' },
        { key: 'thisMonth', label: 'Este mês' },
        { key: 'lastMonth', label: 'Mês passado' },
        { key: 'custom', label: 'Data personalizada' }
    ];
    const empty = () => ({ from: '', to: '' });
    // Calendar dates have no time of day. UTC arithmetic prevents DST or browser
    // time zones from moving a selection to an adjacent day.
    function parse(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
        const date = new Date(value + 'T12:00:00Z');
        return Number.isNaN(date.getTime()) || iso(date) !== value ? null : date;
    }
    function iso(date) { return date.toISOString().slice(0, 10); }
    function addDays(value, amount) { const date = parse(value); date.setUTCDate(date.getUTCDate() + amount); return iso(date); }
    function monthStart(value, offset = 0) {
        const date = parse(value); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + offset); return iso(date);
    }
    function shiftMonth(value, amount) {
        const date = parse(value), day = date.getUTCDate();
        const first = monthStart(value, amount), last = addDays(monthStart(first, 1), -1);
        return addDays(first, Math.min(day, parse(last).getUTCDate()) - 1);
    }
    function today() {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
        const get = type => parts.find(part => part.type === type).value;
        return `${get('year')}-${get('month')}-${get('day')}`;
    }
    function format(value) { return value ? value.split('-').reverse().join('/') : ''; }
    function formatRange(range) { return [range.from, range.to].filter(Boolean).map(format).join(' — '); }
    function validRange(range) {
        return (!range.from && !range.to) || Boolean(parse(range.from) && parse(range.to) && range.from <= range.to);
    }
    class DateRangePicker {
        constructor({ root, id = 'date-range', label = 'Período', value = empty(), onChange, onOpen, currentDate = today }) {
            this.root = root; this.id = id; this.onChange = onChange; this.onOpen = onOpen; this.currentDate = currentDate;
            this.value = empty(); this.isOpen = false; this.events = new AbortController();
            this.root.classList.add('date-picker');
            this.root.innerHTML = `<span id="${U.escape(id)}-label" class="date-picker-label">${U.escape(label)}</span><button type="button" id="${U.escape(id)}-trigger" class="date-picker-trigger" aria-labelledby="${U.escape(id)}-label ${U.escape(id)}-value" aria-haspopup="dialog" aria-expanded="false" aria-controls="${U.escape(id)}-dialog">${A.Icon.render('calendar')}<span id="${U.escape(id)}-value"></span>${A.Icon.render('down')}</button>`;
            this.trigger = this.root.querySelector('button'); this.text = this.root.querySelector('.date-picker-trigger span');
            this.popover = document.createElement('div'); this.popover.id = id + '-dialog'; this.popover.className = 'date-picker-popover'; this.popover.hidden = true;
            this.popover.setAttribute('role', 'dialog'); this.popover.setAttribute('aria-labelledby', id + '-label');
            document.body.appendChild(this.popover);
            this.trigger.addEventListener('click', () => this.isOpen ? this.close() : this.open(), { signal: this.events.signal });
            this.trigger.addEventListener('keydown', event => {
                if (event.key === 'ArrowDown') { event.preventDefault(); this.open(); }
            }, { signal: this.events.signal });
            this.popover.addEventListener('click', event => this.click(event), { signal: this.events.signal });
            this.popover.addEventListener('keydown', event => this.keydown(event), { signal: this.events.signal });
            this.popover.addEventListener('pointerover', event => {
                const day = event.target.closest('[data-date]');
                if (day && this.draft.from && !this.draft.to) this.paintRange(day.dataset.date);
            }, { signal: this.events.signal });
            this.popover.addEventListener('pointerleave', () => this.paintRange(), { signal: this.events.signal });
            this.setValue(value);
        }
        static presetRange(key, reference = today()) {
            if (!parse(reference)) throw new TypeError('Data de referência inválida. Use AAAA-MM-DD.');
            if (key === 'last30') return { from: addDays(reference, -29), to: reference };
            if (key === 'thisMonth') return { from: monthStart(reference), to: addDays(monthStart(reference, 1), -1) };
            if (key === 'lastMonth') return { from: monthStart(reference, -1), to: addDays(monthStart(reference), -1) };
            return empty();
        }
        setValue(value = empty()) {
            if (!validRange(value)) throw new TypeError('Informe um período completo e válido.');
            this.value = { from: value.from || '', to: value.to || '' };
            this.text.textContent = formatRange(this.value) || 'Selecione o período';
            this.trigger.classList.toggle('has-value', Boolean(this.value.from));
            if (this.isOpen) this.close(false);
        }
        open() {
            if (this.isOpen || this.trigger.disabled) return;
            if (this.onOpen) this.onOpen();
            this.isOpen = true; this.draft = { ...this.value }; this.activePreset = this.value.from ? 'custom' : '';
            this.today = this.currentDate(); this.activeDate = this.value.from || this.today; this.month = monthStart(this.activeDate);
            this.openEvents = new AbortController(); const signal = this.openEvents.signal;
            this.trigger.setAttribute('aria-expanded', 'true'); this.popover.hidden = false; this.render();
            if (!this.isOpen) return;
            document.addEventListener('pointerdown', event => {
                if (!this.root.contains(event.target) && !this.popover.contains(event.target)) this.close(false);
            }, { signal });
            document.addEventListener('keydown', event => {
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); }
            }, { signal, capture: true });
            window.addEventListener('resize', () => this.position(), { signal });
            window.addEventListener('scroll', () => this.position(), { signal, capture: true });
            this.focusDate();
        }
        close(restoreFocus = true) {
            if (!this.isOpen) return;
            this.isOpen = false; this.popover.hidden = true; this.trigger.setAttribute('aria-expanded', 'false');
            this.openEvents.abort();
            if (restoreFocus && this.root.isConnected && !this.trigger.disabled) this.trigger.focus({ preventScroll: true });
        }
        setDisabled(disabled) { this.trigger.disabled = disabled; if (disabled) this.close(false); }
        render() {
            this.popover.innerHTML = `<nav class="date-picker-presets" aria-label="Períodos rápidos">${presets.map(preset => `<button type="button" data-date-preset="${preset.key}" aria-pressed="${this.activePreset === preset.key}">${preset.key === 'clear' ? A.Icon.render('x') : ''}${U.escape(preset.label)}</button>`).join('')}</nav><div class="date-picker-content"><div class="date-picker-navigation">${A.Button.render({ icon: 'arrowLeft', iconOnly: true, title: 'Mês anterior', variant: 'ghost', attrs: { 'data-date-nav': '-1' } })}<p id="${U.escape(this.id)}-help" role="status">${this.draft.from && !this.draft.to ? 'Selecione a data final.' : 'Selecione a data inicial e a final.'}</p>${A.Button.render({ icon: 'chevron', iconOnly: true, title: 'Próximo mês', variant: 'ghost', attrs: { 'data-date-nav': '1' } })}</div><div class="date-picker-months">${this.renderMonth(this.month)}${this.renderMonth(monthStart(this.month, 1))}</div><div class="date-picker-footer"><span class="date-picker-summary" role="status">${U.escape(formatRange(this.draft) || 'Nenhum período selecionado')}${this.draft.from && !this.draft.to ? '<small>Aguardando data final</small>' : ''}</span><div>${A.Button.render({ label: 'Cancelar', variant: 'ghost', attrs: { 'data-date-cancel': '' } })}${A.Button.render({ label: 'Aplicar', variant: 'primary', disabled: !validRange(this.draft), attrs: { 'data-date-apply': '' } })}</div></div></div>`;
            this.paintRange(); this.position();
        }
        renderMonth(first) {
            const start = addDays(first, -parse(first).getUTCDay());
            return `<section class="date-picker-month" aria-label="${U.escape(monthNames.format(parse(first)))}"><h4>${U.escape(monthNames.format(parse(first)))}</h4><div class="date-picker-weekdays" aria-hidden="true">${weekdays.map(day => `<span>${day}</span>`).join('')}</div><div class="date-picker-days" role="group" aria-label="Dias de ${U.escape(monthNames.format(parse(first)))}">${Array.from({ length: 42 }, (_, index) => {
                const value = addDays(start, index), outside = value.slice(0, 7) !== first.slice(0, 7);
                // Adjacent-month placeholders avoid duplicate days and keep both
                // month grids at a stable six-week height.
                if (outside) return '<span class="date-picker-empty" aria-hidden="true"></span>';
                return `<button type="button" class="date-picker-day${value === this.today ? ' is-today' : ''}" data-date="${value}" tabindex="${value === this.activeDate ? '0' : '-1'}" aria-label="${U.escape(fullDate.format(parse(value)))}" aria-pressed="false"${value === this.today ? ' aria-current="date"' : ''}>${parse(value).getUTCDate()}</button>`;
            }).join('')}</div></section>`;
        }
        paintRange(preview = '') {
            if (!this.isOpen) return;
            let from = this.draft.from, to = this.draft.to || preview;
            if (from && to && from > to) [from, to] = [to, from];
            this.popover.querySelectorAll('[data-date]').forEach(button => {
                const date = button.dataset.date;
                const selected = date === this.draft.from || date === this.draft.to;
                button.classList.toggle('is-range-start', Boolean(from && date === from));
                button.classList.toggle('is-range-end', Boolean(to && date === to));
                button.classList.toggle('is-in-range', Boolean(from && to && date > from && date < to));
                button.classList.toggle('is-preview', Boolean(preview && !this.draft.to && from && date >= from && date <= to));
                button.setAttribute('aria-pressed', String(selected));
                button.setAttribute('aria-label', fullDate.format(parse(date)) + (date === this.draft.from ? ', início do período' : '') + (date === this.draft.to ? ', fim do período' : ''));
            });
        }
        click(event) {
            const preset = event.target.closest('[data-date-preset]');
            if (preset) {
                const key = preset.dataset.datePreset; this.activePreset = key;
                if (key !== 'custom') {
                    this.draft = DateRangePicker.presetRange(key, this.today);
                    this.activeDate = this.draft.from || this.today; this.month = monthStart(this.activeDate);
                }
                this.render(); this.popover.querySelector(`[data-date-preset="${key}"]`).focus(); return;
            }
            const nav = event.target.closest('[data-date-nav]');
            if (nav) {
                const direction = nav.dataset.dateNav; this.month = monthStart(this.month, Number(direction));
                this.activeDate = this.month; this.render(); this.popover.querySelector(`[data-date-nav="${direction}"]`).focus(); return;
            }
            const day = event.target.closest('[data-date]');
            if (day) {
                const selected = day.dataset.date;
                if (!this.draft.from || this.draft.to) this.draft = { from: selected, to: '' };
                else this.draft = { from: selected < this.draft.from ? selected : this.draft.from, to: selected < this.draft.from ? this.draft.from : selected };
                this.activeDate = selected; this.activePreset = 'custom'; this.render(); this.focusDate(); return;
            }
            if (event.target.closest('[data-date-cancel]')) this.close();
            if (event.target.closest('[data-date-apply]') && validRange(this.draft)) {
                const value = { ...this.draft }; this.close(); this.setValue(value); if (this.onChange) this.onChange({ ...value });
            }
        }
        focusDate() {
            const day = this.popover.querySelector(`[data-date="${this.activeDate}"]`);
            if (day) day.focus({ preventScroll: true });
        }
        keydown(event) {
            if (event.key === 'Tab') {
                const focusable = [...this.popover.querySelectorAll('button:not(:disabled)')].filter(button => button.tabIndex >= 0);
                const first = focusable[0], last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
                return;
            }
            const day = event.target.closest('[data-date]');
            if (!day || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return;
            event.preventDefault(); const date = day.dataset.date;
            const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -parse(date).getUTCDay(), End: 6 - parse(date).getUTCDay() };
            this.activeDate = event.key.startsWith('Page') ? shiftMonth(date, (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1)) : addDays(date, offsets[event.key]);
            if (this.activeDate < this.month || this.activeDate >= monthStart(this.month, 2)) this.month = monthStart(this.activeDate);
            this.render(); this.focusDate(); this.paintRange(this.activeDate);
        }
        position() {
            if (!this.isOpen) return;
            const rect = this.trigger.getBoundingClientRect(), gap = 6, margin = 12;
            if (rect.bottom < 0 || rect.top > window.innerHeight || !this.trigger.getClientRects().length) { this.close(false); return; }
            const width = Math.min(41.25 * parseFloat(getComputedStyle(document.documentElement).fontSize), window.innerWidth - margin * 2);
            this.popover.style.width = width + 'px'; this.popover.style.maxHeight = 'none';
            const height = this.popover.getBoundingClientRect().height, below = window.innerHeight - rect.bottom - gap - margin, above = rect.top - gap - margin;
            const placeAbove = below < height && above > below;
            this.popover.style.maxHeight = Math.max(0, placeAbove ? above : below) + 'px';
            this.popover.style.left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin)) + 'px';
            this.popover.style.top = placeAbove ? 'auto' : Math.max(margin, rect.bottom + gap) + 'px';
            this.popover.style.bottom = placeAbove ? Math.max(margin, window.innerHeight - rect.top + gap) + 'px' : 'auto';
        }
        destroy() { this.close(false); this.events.abort(); this.popover.remove(); this.root.innerHTML = ''; }
    }
    A.DateRangePicker = DateRangePicker;
})(window.AlcadaPanel);
