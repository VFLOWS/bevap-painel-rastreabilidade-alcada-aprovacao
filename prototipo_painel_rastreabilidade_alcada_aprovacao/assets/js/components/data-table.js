(function (A) {
    'use strict';
    const U = A.Utils;
    const definitions = new Map();
    const instances = new Map();
    let nextDefinition = 0;
    function valueOf(row, column) {
        if (typeof column.value === 'function') return column.value(row);
        const value = row[column.key];
        if (value && typeof value === 'object') return value.code != null ? U.combine(value.code, value.name) : (value.name || '');
        return value == null ? '' : value;
    }
    function orderOf(columns, sort = {}) {
        const index = columns.findIndex(column => column.key === sort.key && column.sortable !== false);
        return index < 0 ? [] : [[index, sort.direction === 'asc' ? 'asc' : 'desc']];
    }
    const language = {
        emptyTable: 'Nenhum registro encontrado', zeroRecords: 'Nenhum registro encontrado',
        info: 'Exibindo _START_–_END_ de _TOTAL_ registros', infoEmpty: 'Nenhum registro',
        infoFiltered: '(filtrados de _MAX_ registros)', lengthMenu: 'Exibir _MENU_ por página',
        search: 'Buscar:', loadingRecords: 'Consultando registros…', processing: 'Consultando registros…',
        paginate: { first: 'Primeira', previous: 'Anterior', next: 'Próxima', last: 'Última' },
        aria: { orderable: ': ordenar esta coluna', orderableReverse: ': inverter a ordenação', orderableRemove: ': remover a ordenação' }
    };
    class HorizontalScroll {
        constructor(viewport) {
            this.viewport = viewport;
            this.rail = document.createElement('div');
            this.rail.className = 'table-horizontal-scroll';
            this.rail.hidden = true; this.rail.tabIndex = 0;
            this.rail.setAttribute('role', 'scrollbar');
            this.rail.setAttribute('aria-orientation', 'horizontal');
            this.rail.setAttribute('aria-controls', viewport.id);
            this.rail.setAttribute('aria-valuemin', '0');
            this.rail.setAttribute('aria-label', 'Rolagem horizontal: ' + viewport.getAttribute('aria-label'));
            this.thumb = document.createElement('div');
            this.thumb.className = 'table-horizontal-scroll-thumb';
            this.thumb.setAttribute('aria-hidden', 'true');
            this.rail.appendChild(this.thumb); viewport.parentElement.appendChild(this.rail);
            this.fromViewport = () => this.positionThumb();
            this.pointerDown = event => {
                if (event.button !== 0 || this.rail.hidden || !this.travel) return;
                event.preventDefault(); this.rail.focus({ preventScroll: true });
                if (event.target !== this.thumb) {
                    const left = event.clientX - this.rail.getBoundingClientRect().left - this.thumbWidth / 2;
                    this.moveTo(left / this.travel * this.maximum);
                }
                this.drag = { id: event.pointerId, x: event.clientX, left: viewport.scrollLeft };
                this.rail.setPointerCapture(event.pointerId); this.rail.classList.add('is-dragging');
            };
            this.pointerMove = event => {
                if (!this.drag || this.drag.id !== event.pointerId || !this.travel) return;
                this.moveTo(this.drag.left + (event.clientX - this.drag.x) / this.travel * this.maximum);
            };
            this.pointerEnd = event => {
                if (!this.drag || this.drag.id !== event.pointerId) return;
                this.drag = null; this.rail.classList.remove('is-dragging');
                if (this.rail.hasPointerCapture(event.pointerId)) this.rail.releasePointerCapture(event.pointerId);
            };
            this.keyDown = event => {
                const targets = { ArrowLeft: viewport.scrollLeft - 40, ArrowRight: viewport.scrollLeft + 40,
                    Home: 0, End: this.maximum, PageUp: viewport.scrollLeft - viewport.clientWidth,
                    PageDown: viewport.scrollLeft + viewport.clientWidth };
                if (!(event.key in targets)) return;
                event.preventDefault(); this.moveTo(targets[event.key]);
            };
            this.schedule = () => {
                if (this.frame) return;
                this.frame = requestAnimationFrame(() => { this.frame = null; this.refresh(); });
            };
            viewport.addEventListener('scroll', this.fromViewport, { passive: true });
            this.rail.addEventListener('pointerdown', this.pointerDown);
            this.rail.addEventListener('pointermove', this.pointerMove);
            this.rail.addEventListener('pointerup', this.pointerEnd);
            this.rail.addEventListener('pointercancel', this.pointerEnd);
            this.rail.addEventListener('lostpointercapture', this.pointerEnd);
            this.rail.addEventListener('keydown', this.keyDown);
            document.addEventListener('scroll', this.schedule, { capture: true, passive: true });
            window.addEventListener('resize', this.schedule);
            if (typeof ResizeObserver !== 'undefined') {
                this.observer = new ResizeObserver(this.schedule);
                this.observer.observe(viewport); this.observer.observe(viewport.querySelector('table'));
            }
            this.refresh();
        }
        moveTo(value) {
            this.viewport.scrollLeft = Math.max(0, Math.min(this.maximum, value));
            this.positionThumb();
        }
        positionThumb() {
            const left = Math.max(0, this.viewport.scrollLeft);
            this.thumb.style.transform = `translateX(${this.maximum ? left / this.maximum * this.travel : 0}px)`;
            this.rail.setAttribute('aria-valuenow', String(Math.round(left)));
        }
        refresh() {
            const viewport = this.viewport;
            const width = viewport.clientWidth;
            const bounds = viewport.getBoundingClientRect();
            let top = 0, bottom = window.innerHeight;
            // A table inside a modal follows that modal's scroll area rather
            // than covering its footer or using the full browser viewport.
            for (let parent = viewport.parentElement; parent && parent !== document.body && parent !== document.documentElement; parent = parent.parentElement) {
                if (/^(auto|scroll|hidden|clip)$/.test(getComputedStyle(parent).overflowY)) {
                    const rect = parent.getBoundingClientRect();
                    top = Math.max(top, rect.top); bottom = Math.min(bottom, rect.bottom);
                }
            }
            const visible = Math.min(bounds.bottom, bottom) > Math.max(bounds.top, top);
            const overflow = viewport.scrollWidth > width + 1;
            const show = width > 0 && visible && overflow && bounds.bottom > bottom + 1;
            this.maximum = Math.max(0, viewport.scrollWidth - width);
            this.thumbWidth = viewport.scrollWidth ? Math.min(width, Math.max(24, width * width / viewport.scrollWidth)) : width;
            this.travel = Math.max(0, width - this.thumbWidth);
            this.thumb.style.width = this.thumbWidth + 'px';
            this.rail.setAttribute('aria-valuemax', String(this.maximum));
            this.rail.style.width = width + 'px';
            this.rail.style.marginLeft = viewport.clientLeft + 'px';
            this.rail.hidden = !show;
            this.positionThumb();
        }
        destroy() {
            if (this.frame) cancelAnimationFrame(this.frame);
            if (this.observer) this.observer.disconnect();
            this.viewport.removeEventListener('scroll', this.fromViewport);
            this.rail.removeEventListener('pointerdown', this.pointerDown);
            this.rail.removeEventListener('pointermove', this.pointerMove);
            this.rail.removeEventListener('pointerup', this.pointerEnd);
            this.rail.removeEventListener('pointercancel', this.pointerEnd);
            this.rail.removeEventListener('lostpointercapture', this.pointerEnd);
            this.rail.removeEventListener('keydown', this.keyDown);
            document.removeEventListener('scroll', this.schedule, true);
            window.removeEventListener('resize', this.schedule);
            this.rail.remove();
        }
    }
    class TableInstance {
        constructor(element, options) {
            this.element = element; this.options = options; this.updating = true;
            const table = this;
            this.api = new window.DataTable(element, {
                data: options.loading ? [] : (options.rows || []),
                columns: options.columns.map(column => {
                    const renderer = typeof column.render === 'function' ? column.render : (options.renderers || {})[column.cell || column.key];
                    return {
                        data: null, name: column.key, defaultContent: '', width: ((column.width || 160) / 16) + 'rem',
                        className: [column.align === 'right' ? 'align-right' : '', column.sticky ? 'sticky-' + column.sticky : ''].filter(Boolean).join(' '),
                        orderable: column.sortable !== false, orderSequence: ['asc', 'desc'],
                        render(data, type, row) {
                            if (type !== 'display') return valueOf(row, column);
                            return renderer ? renderer(row) : U.escape(row[column.key] == null ? '—' : row[column.key]);
                        }
                    };
                }),
                order: orderOf(options.columns, options.sort), orderMulti: false,
                pageLength: options.pageSize || 10, paging: options.paging !== false,
                searching: true, autoWidth: false,
                layout: { topStart: null, topEnd: null, bottomStart: null, bottomEnd: null },
                language: { ...language },
                drawCallback(settings) {
                    const api = new window.DataTable.Api(settings);
                    table.decorate();
                    if (!table.updating && table.options.onDraw) table.options.onDraw(api, table.options.columns);
                }
            });
            this.updating = false;
            if (options.followHorizontalScroll !== false) this.horizontalScroll = new HorizontalScroll(element.closest('.table-scroll'));
            this.layout = new A.TableLayout({
                element, api: this.api, columns: options.columns, resizable: options.resizableColumns !== false,
                onResize: () => { if (this.horizontalScroll) this.horizontalScroll.refresh(); }
            });
            this.goToPage(options.page || 1);
        }
        decorate() {
            const container = this.element.closest('.table-scroll');
            container.setAttribute('aria-busy', String(!!this.options.loading));
            const empty = this.element.querySelector('td.dt-empty');
            if (empty) empty.innerHTML = this.options.loading ?
                `<div class="table-loading" role="status">${A.Icon.render('refresh')}<strong>Consultando registros…</strong></div>` :
                A.EmptyState.render({ title: this.options.emptyTitle || 'Nenhum registro encontrado' });
            if (this.layout) this.layout.refresh();
            else if (this.horizontalScroll) this.horizontalScroll.refresh();
        }
        goToPage(page) {
            const pages = Math.max(1, this.api.page.info().pages);
            this.api.page(Math.min(pages, Math.max(1, Number(page) || 1)) - 1).draw('page');
        }
        update(options) {
            this.options = { ...this.options, ...options }; this.updating = true;
            this.api.clear(); this.api.rows.add(this.options.loading ? [] : this.options.rows);
            this.api.page.len(this.options.pageSize || 10);
            this.api.order(orderOf(this.options.columns, this.options.sort));
            this.api.draw(false); this.updating = false;
            this.goToPage(this.options.page || 1);
        }
        destroy() { if (this.layout) this.layout.destroy(); if (this.horizontalScroll) this.horizontalScroll.destroy(); this.api.destroy(); instances.delete(this.element); }
    }
    A.DataTable = {
        render(options) {
            const { id = 'requests', columns, compact = false, caption = 'Registros da consulta' } = options;
            const token = String(++nextDefinition);
            definitions.set(token, { ...options, id });
            const width = columns.reduce((sum, column) => sum + (column.width || 160), 0);
            const headings = columns.map(column => `<th scope="col"${U.attrs({ 'data-sort': column.key, 'data-dt-order': column.sortable === false ? 'disable' : null })}>${U.escape(column.label)}</th>`).join('');
            return `<div class="table-frame"><div class="table-scroll ${compact ? 'table-scroll--compact' : ''}" id="${U.escape(id)}-viewport" tabindex="0" role="region" aria-label="${U.escape(caption)}"><table class="data-table" id="${U.escape(id)}" data-table-component="${token}" style="min-width:${width / 16}rem"><caption class="sr-only">${U.escape(caption)}</caption><thead><tr>${headings}</tr></thead><tbody></tbody></table></div></div>`;
        },
        mount(root) {
            const tables = [...root.querySelectorAll('table[data-table-component]')];
            if (root.matches && root.matches('table[data-table-component]')) tables.unshift(root);
            return tables.map(element => {
                if (instances.has(element)) return instances.get(element);
                const token = element.dataset.tableComponent; const options = definitions.get(token);
                if (!options) return null;
                const instance = new TableInstance(element, options);
                definitions.delete(token); instances.set(element, instance); return instance;
            }).filter(Boolean);
        },
        get(id) { return [...instances.values()].find(instance => instance.element.id === id); },
        destroy(root) {
            [...instances.values()].filter(instance => root === instance.element || root.contains(instance.element)).forEach(instance => instance.destroy());
        },
        adjust(root) {
            [...instances.values()].filter(instance => root === instance.element || root.contains(instance.element)).forEach(instance => {
                instance.api.columns.adjust();
                if (instance.layout) instance.layout.refresh();
                else if (instance.horizontalScroll) instance.horizontalScroll.refresh();
            });
        }
    };
    A.Pagination = {
        render({ page = 1, pages = 1, total = 0, pageSize = 10, disabled = false, pageSizes = A.Config.pageSizes, selectId = 'request-page-size', recordLabel = 'solicitações', pageAction = 'page' }) {
            const start = total ? (page - 1) * pageSize + 1 : 0;
            const end = Math.min(page * pageSize, total);
            let visible = Array.from({ length: pages }, (_, index) => index + 1).filter(number => number === 1 || number === pages || Math.abs(page - number) <= 1);
            let previous = 0;
            const buttons = visible.map(number => {
                const separator = previous && number > previous + 1 ? '<span class="pagination-gap" aria-hidden="true">…</span>' : '';
                previous = number;
                return separator + A.Button.render({ label: String(number), variant: number === page ? 'page-active' : 'page', action: pageAction, disabled, attrs: { 'data-page': number, 'aria-current': number === page ? 'page' : null, 'aria-label': 'Página ' + number } });
            }).join('');
            return `<div class="pagination"><div class="pagination-size"><label for="${U.escape(selectId)}">Exibir</label><select id="${U.escape(selectId)}"${disabled ? ' disabled' : ''}>${pageSizes.map(size => `<option value="${size}"${size === pageSize ? ' selected' : ''}>${size}</option>`).join('')}</select><span>por página</span></div><p class="pagination-summary" role="status">Exibindo <strong>${start}–${end}</strong> de <strong>${total}</strong> ${U.escape(recordLabel)}</p><nav class="pagination-buttons" aria-label="Paginação">${A.Button.render({ icon: 'arrowLeft', title: 'Página anterior', iconOnly: true, variant: 'page', action: pageAction, attrs: { 'data-page': page - 1 }, disabled: disabled || page <= 1 })}${buttons}${A.Button.render({ icon: 'chevron', title: 'Próxima página', iconOnly: true, variant: 'page', action: pageAction, attrs: { 'data-page': page + 1 }, disabled: disabled || page >= pages })}</nav></div>`;
        }
    };
})(window.AlcadaPanel);
