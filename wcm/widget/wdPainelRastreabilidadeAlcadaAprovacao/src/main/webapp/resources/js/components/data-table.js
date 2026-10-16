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
    const hasColumnFilter = (column, options) => options.columnFilters !== false && column.filterable !== false && column.key !== 'actions';
    const columnWidth = (column, options) => (column.width || 160) * .8 + (hasColumnFilter(column, options) ? 40 : 0);
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
        columnControl: { dropdown: 'Filtrar coluna', orderAsc: 'Ordenar crescente', orderDesc: 'Ordenar decrescente', searchClear: 'Limpar filtro', list: { empty: 'Nenhuma opção encontrada', all: 'Selecionar', none: 'Limpar seleção', search: 'Pesquisar opções…' } },
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
    class ColumnFilters {
        constructor(table) {
            this.table = table;
            table.api.columns().header().toArray().forEach((header, index) => {
                const button = header.querySelector('.dtcc-button_dropdown');
                if (button) button.setAttribute('aria-label', 'Filtrar ' + table.options.columns[index].label);
            });
            this.open = event => {
                const button = event.target.closest('button.dtcc-button_dropdown');
                if (!button) return;
                // O ColumnControl interrompe a propagação; aguardamos seu handler abrir o menu.
                setTimeout(() => this.show(button), 0);
            };
            this.escape = event => {
                if (event.key !== 'Escape' || !this.menu?.isConnected) return;
                event.preventDefault(); event.stopPropagation();
                this.menu._close(); this.button.focus({ preventScroll: true });
            };
            document.addEventListener('keydown', this.escape, true);
            this.reposition = () => this.position();
            table.element.tHead.addEventListener('click', this.open, true);
            table.element.tHead.addEventListener('keypress', this.open, true);
            window.addEventListener('resize', this.reposition);
            document.addEventListener('scroll', this.reposition, true);
        }
        position() {
            if (!this.menu || !this.menu.isConnected || !this.button.isConnected) return;
            const bounds = this.button.getBoundingClientRect();
            const width = this.menu.offsetWidth;
            this.menu.style.left = Math.max(8, Math.min(window.innerWidth - width - 8, bounds.right - width)) + 'px';
            const dialog = this.button.closest('dialog')?.getBoundingClientRect();
            const below = Math.max(100, Math.min(dialog?.bottom || window.innerHeight, window.innerHeight) - bounds.bottom - 16);
            const above = Math.max(0, bounds.top - (dialog?.top || 0) - 16);
            const upwards = this.menu.scrollHeight > below && above > below;
            this.menu.style.maxHeight = (upwards ? above : below) + 'px';
            this.menu.style.top = (upwards ? bounds.top - this.menu.offsetHeight - 4 : bounds.bottom + 4) + 'px';
        }
        async show(button) {
            if (this.destroyed || button.getAttribute('aria-expanded') !== 'true') return;
            const table = this.table;
            this.menu = table.api.table().container().querySelector('.dtcc-dropdown');
            this.button = button;
            if (!this.menu) return;
            this.menu.classList.add('column-filter-menu'); this.position();
            const input = this.menu.querySelector('input');
            const index = table.api.columns().header().toArray().indexOf(button.closest('th'));
            const column = table.options.columns[index];
            this.menu.setAttribute('aria-label', 'Filtrar ' + column.label);
            if (input) input.setAttribute('aria-label', 'Pesquisar opções de ' + column.label);
            if (!table.options.columnOptions) return;
            const menu = this.menu, list = menu.querySelector('.dtcc-list-buttons');
            menu.querySelectorAll('.column-filter-status').forEach(status => status.remove());
            const status = document.createElement('p');
            status.className = 'column-filter-status'; status.setAttribute('role', 'status');
            status.textContent = 'Consultando opções…'; list.before(status);
            list.hidden = true;
            try {
                const options = await table.options.columnOptions(column);
                if (this.destroyed) return;
                table.api.column(index).columnControl.searchList(options);
                status.remove(); list.hidden = false;
            } catch (error) {
                status.textContent = error.message || 'Não foi possível carregar as opções. Abra o filtro para tentar novamente.';
                if (table.options.onFilterError) table.options.onFilterError(error);
            } finally {
                this.position();
            }
        }
        destroy() {
            this.destroyed = true;
            if (this.menu && this.menu.isConnected) this.menu._close();
            this.table.element.tHead.removeEventListener('click', this.open, true);
            this.table.element.tHead.removeEventListener('keypress', this.open, true);
            window.removeEventListener('resize', this.reposition);
            document.removeEventListener('scroll', this.reposition, true);
            document.removeEventListener('keydown', this.escape, true);
        }
    }
    class TableInstance {
        constructor(element, options) {
            this.element = element; this.options = options; this.updating = true;
            const table = this;
            this.api = new A.TableLibrary(element, {
                data: options.serverSide ? undefined : (options.loading ? [] : (options.rows || [])),
                serverSide: !!options.serverSide, processing: false, ajax: options.ajax,
                columns: options.columns.map(column => {
                    const renderer = typeof column.render === 'function' ? column.render : (options.renderers || {})[column.cell || column.key];
                    return {
                        columnControl: !hasColumnFilter(column, options) ? [] : [{
                            extend: 'dropdown', text: 'Filtrar ' + column.label,
                            content: [{ extend: 'searchList', orthogonal: 'columnLabel', search: true, select: true,
                                ...(options.serverSide ? { options: [] } : {}) }, 'spacer', ...(column.sortable === false ? [] : ['orderAsc', 'orderDesc']), 'searchClear']
                        }],
                        data: null, name: column.key, defaultContent: '', width: columnWidth(column, options) + 'px',
                        className: [column.align === 'right' ? 'align-right' : '', column.sticky ? 'sticky-' + column.sticky : ''].filter(Boolean).join(' '),
                        orderable: column.sortable !== false, orderSequence: ['asc', 'desc'],
                        render(data, type, row) {
                            const filterValue = typeof column.filterValue === 'function' ? column.filterValue(row) : valueOf(row, column);
                            if (type === 'filter') return String(filterValue == null ? '' : filterValue);
                            if (type === 'columnLabel') return U.escape(column.filterLabel ? column.filterLabel(filterValue) : (filterValue === '' ? 'Não informado' : filterValue));
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
                    const api = new A.TableLibrary.Api(settings);
                    table.decorate();
                    if (!table.updating && table.options.onDraw) table.options.onDraw(api, table.options.columns);
                }
            });
            this.updating = false;
            this.columnFilters = new ColumnFilters(this);
            if (options.followHorizontalScroll !== false) this.horizontalScroll = new HorizontalScroll(element.closest('.table-scroll'));
            this.layout = new A.TableLayout({
                element, api: this.api, columns: options.columns, resizable: options.resizableColumns !== false,
                onResize: () => { this.columnFilters.position(); if (this.horizontalScroll) this.horizontalScroll.refresh(); }
            });
            if (!options.serverSide) this.goToPage(options.page || 1);
        }
        decorate() {
            const container = this.element.closest('.table-scroll');
            container.setAttribute('aria-busy', String(!!this.options.loading));
            const empty = this.element.querySelector('td.dt-empty');
            if (empty) empty.innerHTML = this.options.loading ?
                A.Loading.render({ title: 'Consultando registros…', compact: true }) :
                A.EmptyState.render({ title: this.options.emptyTitle || 'Nenhum registro encontrado' });
            if (this.layout) this.layout.refresh();
            else if (this.horizontalScroll) this.horizontalScroll.refresh();
        }
        clearColumnFilters() { this.api.columns().columnControl.searchClear(); }
        goToPage(page) {
            const pages = Math.max(1, this.api.page.info().pages);
            this.api.page(Math.min(pages, Math.max(1, Number(page) || 1)) - 1).draw('page');
        }
        update(options) {
            this.options = { ...this.options, ...options }; this.updating = true;
            this.api.clear(); this.api.rows.add(this.options.loading ? [] : this.options.rows);
            this.api.page.len(this.options.pageSize || 10);
            this.api.order(orderOf(this.options.columns, this.options.sort));
            this.api.draw(false);
            if (this.options.columnFilters !== false) this.api.columns().columnControl.searchList('refresh');
            this.updating = false;
            this.goToPage(this.options.page || 1);
        }
        destroy() { this.columnFilters.destroy(); if (this.layout) this.layout.destroy(); if (this.horizontalScroll) this.horizontalScroll.destroy(); this.api.destroy(); instances.delete(this.element); }
    }
    A.DataTable = {
        render(options) {
            const { id = 'requests', columns, compact = false, caption = 'Registros da consulta' } = options;
            const token = String(++nextDefinition);
            definitions.set(token, { ...options, id });
            const width = columns.reduce((sum, column) => sum + columnWidth(column, options), 0);
            const headings = columns.map(column => `<th scope="col"${U.attrs({ 'data-sort': column.key, 'data-dt-order': column.sortable === false ? 'disable' : null })}>${column.heading || U.escape(U.titleCase(column.label))}</th>`).join('');
            return `<div class="table-frame"><div class="table-scroll ${compact ? 'table-scroll--compact' : ''}" id="${U.escape(id)}-viewport" tabindex="0" role="region" aria-label="${U.escape(caption)}"><table class="data-table" id="${U.escape(id)}" data-table-component="${token}" style="min-width:${width}px"><caption class="sr-only">${U.escape(caption)}</caption><thead><tr>${headings}</tr></thead><tbody></tbody></table></div></div>`;
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
