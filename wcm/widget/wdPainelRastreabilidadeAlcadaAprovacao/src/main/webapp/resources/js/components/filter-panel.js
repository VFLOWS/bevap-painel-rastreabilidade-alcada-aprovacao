(function (A) {
    'use strict';
    const U = A.Utils;
    class FilterPanel {
        constructor({ root, fields, lookup, onApply, onSearchReset }) {
            this.root = root; this.fields = fields; this.lookup = lookup; this.onApply = onApply; this.onSearchReset = onSearchReset;
            this.draft = { filters: {}, from: '', to: '', search: '' }; this.applied = U.clone(this.draft); this.labels = {}; this.openField = null;
            this.root.innerHTML = `<div class="filter-heading"><div class="filter-heading-title">${A.Icon.render('filter')}<h3>Filtros</h3><span class="filter-active-count" hidden></span></div><button type="button" class="filter-collapse" aria-expanded="true" aria-controls="filter-content">Recolher ${A.Icon.render('down')}</button></div><div id="filter-content"><div class="filter-grid">${fields.map(field => {
                const id = 'filter-' + field.key;
                return `<div class="combo" data-field="${U.escape(field.key)}"><label for="${id}">${U.escape(U.titleCase(field.label))}</label><div class="combo-input"><input id="${id}" type="text" placeholder="Selecionar ou pesquisar..." autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-options" aria-haspopup="listbox"><button type="button" data-combo-toggle aria-label="Abrir opções de ${U.escape(U.titleCase(field.label))}" tabindex="-1">${A.Icon.render('down')}</button></div><div class="combo-dropdown" hidden><div class="combo-info" role="status"></div><div class="combo-options" id="${id}-options" role="listbox" aria-label="${U.escape(U.titleCase(field.label))}" aria-multiselectable="true"></div></div><div class="combo-chips"></div></div>`;
            }).join('')}<div data-emission-date-picker></div></div><div class="filter-footer"><div class="filter-footer-actions"><p class="filter-hint" role="status">Selecione uma ou mais opções e clique em Filtrar.</p><div>${A.Button.render({ label: 'Limpar filtros', variant: 'ghost', action: 'clear-filters' })}${A.Button.render({ label: 'Filtrar', icon: 'filter', variant: 'primary', action: 'apply-filters' })}</div></div></div><div class="filter-validation" hidden></div></div>`;
            this.datePicker = new A.DateRangePicker({
                root: this.root.querySelector('[data-emission-date-picker]'), id: 'filter-emission-date-' + (root.closest('[data-alcada-widget]').dataset.instanceId || 'preview'), label: 'Data de emissão',
                onOpen: () => this.close(),
                onChange: range => { Object.assign(this.draft, range); this.updateHint(); }
            });
            this.bind();
        }
        fieldElement(field) { return this.root.querySelector(`[data-field="${field}"]`); }
        bind() {
            this.root.addEventListener('focusin', event => {
                if (!this.suppressOpen && event.target.matches('.combo-input input')) this.open(event.target.closest('.combo').dataset.field);
            });
            this.root.addEventListener('input', event => {
                if (event.target.matches('.combo-input input')) this.renderOptions(event.target.closest('.combo').dataset.field);
                this.updateHint();
            });
            this.root.addEventListener('click', event => {
                const combo = event.target.closest('.combo');
                const field = combo && combo.dataset.field;
                if (event.target.matches('.combo-input input')) this.open(field);
                const toggle = event.target.closest('[data-combo-toggle]');
                if (toggle) { if (this.openField === field) this.close(); else { this.open(field); combo.querySelector('input').focus(); } }
                const option = event.target.closest('[data-option-value]');
                if (option) {
                    const value = option.dataset.optionValue;
                    const values = this.draft.filters[field] || [];
                    if (values.includes(value)) values.splice(values.indexOf(value), 1); else values.push(value);
                    this.draft.filters[field] = values;
                    this.changed(field);
                    this.renderOptions(field);
                    this.focusInput(field);
                }
                const remove = event.target.closest('[data-remove-value]');
                if (remove) {
                    this.draft.filters[field] = (this.draft.filters[field] || []).filter(value => value !== remove.dataset.removeValue);
                    this.changed(field); this.renderOptions(field); this.focusInput(field);
                }
                if (event.target.closest('[data-action="apply-filters"]')) this.apply();
                if (event.target.closest('[data-action="clear-filters"]')) this.clear();
                const collapse = event.target.closest('.filter-collapse');
                if (collapse) {
                    this.close(); this.datePicker.close(false); const content = U.find(this.root, 'filter-content'); content.hidden = !content.hidden;
                    collapse.setAttribute('aria-expanded', String(!content.hidden)); collapse.innerHTML = `${content.hidden ? 'Expandir' : 'Recolher'} ${A.Icon.render('down', content.hidden ? '' : 'rotate-180')}`;
                }
            });
            this.root.addEventListener('keydown', event => {
                const combo = event.target.closest('.combo'); if (!combo) return;
                const field = combo.dataset.field;
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); this.focusInput(field); }
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault(); if (this.openField !== field) this.open(field);
                    const options = [...combo.querySelectorAll('[data-option-value]')]; const index = options.indexOf(document.activeElement);
                    const next = event.key === 'ArrowDown' ? index + 1 : (index < 0 ? options.length - 1 : index - 1);
                    if (options.length) options[(next + options.length) % options.length].focus();
                }
                if (event.key === 'Enter' && event.target.matches('.combo-input input')) {
                    event.preventDefault(); const first = combo.querySelector('[data-option-value]'); if (first) first.click();
                }
            });
            this.root.addEventListener('focusout', () => setTimeout(() => {
                if (this.openField && !this.fieldElement(this.openField).contains(document.activeElement)) this.close();
            }, 0));
            document.addEventListener('click', event => {
                // Options and chips are replaced during selection. The event path
                // preserves the original combo even after the clicked node is removed.
                const insideCombo = event.composedPath().some(node =>
                    node instanceof Element && node.matches('.combo') && this.root.contains(node));
                if (!insideCombo) this.close();
            });
        }
        focusInput(field) { this.suppressOpen = true; this.fieldElement(field).querySelector('input').focus(); this.suppressOpen = false; }
        open(field) {
            if (this.openField === field) return;
            this.datePicker.close(false); this.close(); this.openField = field;
            const combo = this.fieldElement(field); combo.querySelector('input').value = '';
            combo.querySelector('input').setAttribute('aria-expanded', 'true'); combo.querySelector('.combo-dropdown').hidden = false;
            this.renderOptions(field);
        }
        close() {
            if (!this.openField) return;
            const combo = this.fieldElement(this.openField); combo.querySelector('.combo-dropdown').hidden = true;
            combo.querySelector('input').setAttribute('aria-expanded', 'false'); this.openField = null;
        }
        async renderOptions(field) {
            const combo = this.fieldElement(field); const term = U.normalize(combo.querySelector('input').value);
            const token = combo.lookupToken = (combo.lookupToken || 0) + 1;
            combo.querySelector('.combo-info').textContent = 'Consultando opções…';
            let options;
            try {
                options = (await this.lookup(field, this.draft.filters.company || [])).filter(option => U.normalize(option.label).includes(term));
            } catch (error) {
                if (token === combo.lookupToken) {
                    combo.querySelector('.combo-info').textContent = 'Não foi possível consultar as opções. Abra novamente para tentar.';
                    combo.querySelector('.combo-options').innerHTML = '';
                }
                return;
            }
            if (token !== combo.lookupToken) return;
            combo.querySelector('.combo-info').textContent = options.length ? `${options.length} opções · seleção múltipla` : 'Nenhuma opção encontrada.';
            combo.querySelector('.combo-options').innerHTML = options.map(option => {
                this.labels[field + ':' + option.value] = option.label;
                const selected = (this.draft.filters[field] || []).includes(option.value);
                return `<button type="button" class="combo-option ${selected ? 'is-selected' : ''}" role="option" aria-selected="${selected}" data-option-value="${U.escape(option.value)}"><span class="combo-check">${A.Icon.render('check')}</span><span>${U.escape(option.label)}</span></button>`;
            }).join('');
        }
        changed(field) {
            this.renderChips(field);
            if (field === 'company' && (this.draft.filters.company || []).length) {
                ['costCenter', 'movementType'].forEach(key => {
                    const options = (this.draft.filters[key] || []).map(value => ({ value })).filter(option => this.draft.filters.company.some(company => option.value.startsWith(company + ':')));
                    if (Array.isArray(options)) {
                        const allowed = options.map(option => option.value);
                        this.draft.filters[key] = (this.draft.filters[key] || []).filter(value => allowed.includes(value));
                    } else this.draft.filters[key] = [];
                    this.renderChips(key);
                });
            }
            this.updateHint();
        }
        renderChips(field) {
            const combo = this.fieldElement(field); const values = this.draft.filters[field] || [];
            combo.querySelector('input').placeholder = values.length ? `${values.length} selecionado(s) · pesquisar...` : 'Selecionar ou pesquisar...';
            combo.querySelector('.combo-chips').innerHTML = values.map(value => {
                const known = ['processStatus', 'approvalStatus'].includes(field) ? this.lookup(field, []) : [];
                const label = this.labels[field + ':' + value] || (known.find(option => option.value === value) || {}).label || value;
                return `<span class="chip"><span>${U.escape(label)}</span><button type="button" data-remove-value="${U.escape(value)}" aria-label="Remover ${U.escape(label)}">${A.Icon.render('x')}</button></span>`;
            }).join('');
        }
        setSearch(value) { this.draft.search = value; this.updateHint(); }
        setStatus(status) { this.draft.filters.processStatus = [status]; this.renderChips('processStatus'); this.apply(); }
        setBusy(busy) { this.datePicker.setDisabled(busy); this.root.querySelectorAll('[data-action="apply-filters"], [data-action="clear-filters"]').forEach(button => { button.disabled = busy; }); }
        updateHint() {
            const count = Object.values(this.applied.filters).reduce((sum, values) => sum + values.length, 0);
            const dirty = JSON.stringify(this.draft) !== JSON.stringify(this.applied);
            this.root.querySelector('.filter-hint').textContent = dirty ? 'Há alterações pendentes. Clique em Filtrar para aplicar.' :
                (count || this.applied.from || this.applied.to || this.applied.search ? 'Critérios aplicados à consulta.' : 'Selecione uma ou mais opções e clique em Filtrar.');
            const badge = this.root.querySelector('.filter-active-count'); badge.hidden = !count; badge.textContent = `${count} selecionado${count > 1 ? 's' : ''}`;
        }
        apply() {
            const validation = this.root.querySelector('.filter-validation');
            if (this.draft.from && this.draft.to && this.draft.from > this.draft.to) {
                validation.innerHTML = A.Alert.render({ tone: 'red', title: 'Confira o período informado', message: 'A data inicial deve ser menor ou igual à data final.', icon: 'alert' });
                validation.hidden = false; return false;
            }
            validation.hidden = true; this.datePicker.close(false); this.close(); this.applied = U.clone(this.draft); this.updateHint(); this.onApply(U.clone(this.applied)); return true;
        }
        clear() {
            this.draft = { filters: {}, from: '', to: '', search: '' };
            this.datePicker.setValue({ from: '', to: '' });
            this.root.querySelectorAll('.combo-input input').forEach(input => { input.value = ''; });
            this.fields.forEach(field => this.renderChips(field.key));
            if (this.onSearchReset) this.onSearchReset(); this.apply();
        }
    }
    A.FilterPanel = FilterPanel;
})(window.AlcadaPanel);
