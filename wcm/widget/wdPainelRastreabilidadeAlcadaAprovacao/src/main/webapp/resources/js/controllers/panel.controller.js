(function (A) {
    'use strict';
    const U = A.Utils;
    class PanelApp {
        constructor(root, provider, options = {}) {
            this.options = options; this.host = options.host || root.closest("[data-alcada-widget]");
            this.toast = message => A.Toast.show(message, U.find(this.host, "toast-root"));
            this.root = root; this.service = new A.RequestService(provider); this.modal = new A.Modal(U.find(this.host, 'modal-root'));
            this.state = { filters: {}, columnFilters: {}, search: '', from: '', to: '', page: 1, pageSize: 10, sort: { key: 'openedAt', direction: 'desc' } };
            this.loading = true; this.loadError = false;
        }
        element(id) { return U.find(this.root, id); }
        start() {
            this.root.innerHTML = A.PanelShell.render({
                title: A.Config.title,
                heading: 'Rastreabilidade de solicitações',
                description: 'Acompanhe os movimentos e cada etapa de aprovação, em um só lugar.',
                logo: this.options.logo, environment: this.options.environment, initials: this.options.initials, home: this.options.home
            });
            this.filters = new A.FilterPanel({
                root: this.element('filters-region'), fields: A.Config.filters,
                lookup: (field, companies) => this.service.lookup(field, companies),
                onApply: query => { Object.assign(this.state, query, { page: 1 }); this.element('request-search').value = query.search; this.render(); },
                onSearchReset: () => { this.element('request-search').value = ''; this.state.columnFilters = {}; if (this.table) this.table.clearColumnFilters(); }
            });
            U.namespace(this.host, this.options.instanceId || "preview");
            this.bind(); this.render(); this.refresh(false);
        }
        bind() {
            this.root.addEventListener('click', event => {
                const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
                const action = button.dataset.action;
                if (action === 'refresh') this.refresh(true);
                if (action === 'search') this.filters.apply();
                if (action === 'page' && this.table) this.table.goToPage(button.dataset.page);
                if (action === 'status-shortcut') this.filters.setStatus(button.dataset.status);
                if (action === 'export') this.export();
                if (action === 'history' || action === 'details') this.openRequest(action, button.dataset.request);
            });
            this.modal.dialog.addEventListener('click', event => {
                const button = event.target.closest('[data-action="history"], [data-action="details"]');
                if (button) this.openRequest(button.dataset.action, button.dataset.request);
            });
            this.element('request-search').addEventListener('input', event => { this.filters.setSearch(event.target.value); });
            this.element('request-search').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); this.filters.apply(); } });
            this.element('pagination-region').addEventListener('change', event => {
                if ((event.target.dataset.panelId || event.target.id) === 'request-page-size' && this.table) this.table.api.page.len(Number(event.target.value)).page(0).draw();
            });
        }
        async refresh(showToast) {
            if (this.refreshing) return;
            this.refreshing = true; this.loading = true; this.loadError = false; this.filters.close(); this.filters.setBusy(true); this.render();
            try {
                await this.service.load(); this.updatedAt = new Date();
                if (showToast) this.toast({ title: 'Consulta atualizada', message: 'As solicitações e os indicadores foram atualizados.' });
            } catch (error) {
                this.loadError = true;
                this.toast({ title: 'Não foi possível atualizar a consulta', message: 'Tente novamente em alguns instantes.', tone: 'red' });
                console.error('[Painel de Rastreabilidade] Falha ao consultar solicitações.', error);
            } finally {
                this.loading = false; this.refreshing = false; this.filters.setBusy(false); this.render();
            }
        }
        render() {
            const response = this.service.query(this.state);
            this.renderIndicators(response);
            const blank = this.loading || this.loadError;
            const tableRoot = this.element('table-region');
            if (this.loadError) {
                A.DataTable.destroy(tableRoot); this.table = null;
                tableRoot.innerHTML = A.Alert.render({ tone: 'red', title: 'Não foi possível carregar as solicitações', message: 'Clique em Atualizar para tentar novamente.', icon: 'alert' });
                this.element('pagination-region').innerHTML = '';
            } else {
                const options = {
                    columns: A.Config.columns, rows: response.allRows, renderers: A.RequestCells,
                    sort: this.state.sort, page: this.state.page, pageSize: this.state.pageSize, loading: this.loading,
                    caption: 'Solicitações de Alçada de Aprovação', emptyTitle: 'Nenhuma solicitação encontrada',
                    onDraw: (api, columns) => this.onTableDraw(api, columns)
                };
                if (this.table) this.table.update(options);
                else { tableRoot.innerHTML = A.DataTable.render(options); this.table = A.DataTable.mount(tableRoot)[0]; }
            }
            this.renderFooter(blank, response);
        }
        renderIndicators(response) {
            const blank = this.loading || this.loadError;
            const value = key => blank ? '—' : String(response.stats[key]);
            this.element('summary-region').innerHTML = [
                { label: 'Total de solicitações', value: value('total'), icon: 'document', tone: 'blue', description: 'Nos resultados da consulta' },
                { label: 'Em aberto', value: value('aberto'), icon: 'clock', tone: 'amber', action: 'status-shortcut', attrs: { 'data-status': 'aberto', disabled: blank }, description: 'Solicitações em andamento' },
                { label: 'Aprovadas', value: value('aprovado'), icon: 'check', tone: 'green', action: 'status-shortcut', attrs: { 'data-status': 'aprovado', disabled: blank }, description: 'Processos aprovados e concluídos' },
                { label: 'Reprovadas', value: value('reprovado'), icon: 'x', tone: 'red', action: 'status-shortcut', attrs: { 'data-status': 'reprovado', disabled: blank }, description: 'Processos encerrados por reprovação' }
            ].map(A.StatCard.render).join('');
            this.element('request-count').textContent = blank ? '—' : response.total;
            const selections = [...Object.values(this.state.filters), ...Object.values(this.state.columnFilters || {})];
            const criteria = selections.reduce((count, values) => count + values.length, 0) + Number(!!this.state.from || !!this.state.to) + Number(!!this.state.search);
            this.element('result-scope').textContent = this.loading ? 'Consultando solicitações…' :
                (criteria ? `${criteria} critério${criteria > 1 ? 's' : ''} aplicado${criteria > 1 ? 's' : ''} · valor líquido ${U.money(response.stats.amount)}` : `Todas as solicitações · valor líquido ${U.money(response.stats.amount)}`);
        }
        renderFooter(blank, response) {
            this.element('refresh-requests').disabled = this.loading;
            this.element('refresh-requests').classList.toggle('is-loading', this.loading);
            this.element('export-requests').disabled = this.exporting || blank || !(this.table ? this.table.api.page.info().recordsDisplay : response.total);
            this.element('last-update').textContent = this.loading ? 'Atualizando consulta…' : (this.updatedAt ? `Atualizado em ${U.dateTime(this.updatedAt)}` : 'Consulta indisponível');
        }
        onTableDraw(api, columns) {
            const info = api.page.info();
            if (!this.loading) {
                this.state.page = info.page + 1; this.state.pageSize = info.length;
                const order = api.order()[0];
                if (order) this.state.sort = { key: columns[order[0]].key, direction: order[1] };
            }
            if (!info.serverSide && !this.loading) {
                const rows = api.rows({ search: 'applied' }).data().toArray();
                this.renderIndicators({ total: rows.length, stats: {
                    total: rows.length, aberto: rows.filter(row => row.processStatus === 'aberto').length,
                    aprovado: rows.filter(row => row.processStatus === 'aprovado').length,
                    reprovado: rows.filter(row => row.processStatus === 'reprovado').length,
                    amount: rows.reduce((sum, row) => sum + (row.net || 0), 0)
                } });
            }
            this.element('export-requests').disabled = this.exporting || this.loading || !info.recordsDisplay;
            this.element('pagination-region').innerHTML = A.Pagination.render({
                page: info.page + 1, pages: Math.max(1, info.pages), total: info.recordsDisplay,
                pageSize: info.length, disabled: this.loading
            });
            U.namespace(this.element("pagination-region"), this.options.instanceId || "preview");
        }
        openRequest(view, number) {
            const row = this.service.get(number); if (!row) return;
            this.modal.open(A.RequestViews[view](row));
        }
        export() {
            const rows = this.table ? this.table.api.rows({ order: 'applied', search: 'applied' }).data().toArray() : [];
            if (!rows.length) return;
            A.ExcelExport.download('rastreabilidade-alcada-aprovacao.xlsx', this.service.export(this.state, rows));
            this.toast({ title: 'Exportação concluída', message: `${rows.length} solicitações exportadas com os filtros da consulta.` });
        }
    }
    A.PanelApp = PanelApp;
})(window.AlcadaPanel);
