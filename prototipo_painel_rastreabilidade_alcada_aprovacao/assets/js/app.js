(function (A) {
    'use strict';
    const U = A.Utils;
    class PanelApp {
        constructor(root, provider) {
            this.root = root; this.service = new A.RequestService(provider); this.modal = new A.Modal(document.getElementById('modal-root'));
            this.state = { filters: {}, search: '', from: '', to: '', page: 1, pageSize: 10, sort: { key: 'openedAt', direction: 'desc' } };
            this.loading = true; this.loadError = false;
        }
        start() {
            this.root.innerHTML = A.PanelShell.render({
                title: A.Config.title,
                heading: 'Rastreabilidade de solicitações',
                description: 'Acompanhe os movimentos e cada etapa de aprovação, em um só lugar.',
                logo: 'assets/images/logo-bevap.png'
            });
            this.filters = new A.FilterPanel({
                root: this.root.querySelector('#filters-region'), fields: A.Config.filters,
                lookup: (field, companies) => this.service.lookup(field, companies),
                onApply: query => { Object.assign(this.state, query, { page: 1 }); this.root.querySelector('#request-search').value = query.search; this.render(); },
                onSearchReset: () => { this.root.querySelector('#request-search').value = ''; }
            });
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
            this.root.querySelector('#request-search').addEventListener('input', event => { this.filters.setSearch(event.target.value); });
            this.root.querySelector('#request-search').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); this.filters.apply(); } });
            this.root.querySelector('#pagination-region').addEventListener('change', event => {
                if (event.target.id === 'request-page-size' && this.table) this.table.api.page.len(Number(event.target.value)).page(0).draw();
            });
        }
        async refresh(showToast) {
            if (this.refreshing) return;
            this.refreshing = true; this.loading = true; this.loadError = false; this.filters.close(); this.filters.setBusy(true); this.render();
            try {
                await this.service.load(); this.updatedAt = new Date();
                if (showToast) A.Toast.show({ title: 'Consulta atualizada', message: 'As solicitações e os indicadores foram atualizados.' });
            } catch (error) {
                this.loadError = true;
                A.Toast.show({ title: 'Não foi possível atualizar a consulta', message: 'Tente novamente em alguns instantes.', tone: 'red' });
                console.error('[Painel de Rastreabilidade] Falha ao consultar solicitações.', error);
            } finally {
                this.loading = false; this.refreshing = false; this.filters.setBusy(false); this.render();
            }
        }
        render() {
            const response = this.service.query(this.state);
            const blank = this.loading || this.loadError;
            const value = key => blank ? '—' : String(response.stats[key]);
            this.root.querySelector('#summary-region').innerHTML = [
                { label: 'Total de solicitações', value: value('total'), icon: 'document', tone: 'blue', description: 'Nos resultados da consulta' },
                { label: 'Em aberto', value: value('aberto'), icon: 'clock', tone: 'amber', action: 'status-shortcut', attrs: { 'data-status': 'aberto', disabled: blank }, description: 'Solicitações em andamento' },
                { label: 'Aprovadas', value: value('aprovado'), icon: 'check', tone: 'green', action: 'status-shortcut', attrs: { 'data-status': 'aprovado', disabled: blank }, description: 'Processos aprovados e concluídos' },
                { label: 'Reprovadas', value: value('reprovado'), icon: 'x', tone: 'red', action: 'status-shortcut', attrs: { 'data-status': 'reprovado', disabled: blank }, description: 'Processos encerrados por reprovação' }
            ].map(A.StatCard.render).join('');
            this.root.querySelector('#request-count').textContent = blank ? '—' : response.total;
            const criteria = Object.values(this.state.filters).reduce((count, values) => count + values.length, 0) + Number(!!this.state.from || !!this.state.to) + Number(!!this.state.search);
            this.root.querySelector('#result-scope').textContent = this.loading ? 'Consultando solicitações…' :
                (criteria ? `${criteria} critério${criteria > 1 ? 's' : ''} aplicado${criteria > 1 ? 's' : ''} · valor líquido ${U.money(response.stats.amount)}` : `Todas as solicitações · valor líquido ${U.money(response.stats.amount)}`);
            const tableRoot = this.root.querySelector('#table-region');
            if (this.loadError) {
                A.DataTable.destroy(tableRoot); this.table = null;
                tableRoot.innerHTML = A.Alert.render({ tone: 'red', title: 'Não foi possível carregar as solicitações', message: 'Clique em Atualizar para tentar novamente.', icon: 'alert' });
                this.root.querySelector('#pagination-region').innerHTML = '';
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
            this.root.querySelector('#refresh-requests').disabled = this.loading;
            this.root.querySelector('#refresh-requests').classList.toggle('is-loading', this.loading);
            this.root.querySelector('#export-requests').disabled = blank || !response.total;
            this.root.querySelector('#last-update').textContent = this.loading ? 'Atualizando consulta…' : (this.updatedAt ? `Atualizado em ${U.dateTime(this.updatedAt)}` : 'Consulta indisponível');
        }
        onTableDraw(api, columns) {
            const info = api.page.info();
            if (!this.loading) {
                this.state.page = info.page + 1; this.state.pageSize = info.length;
                const order = api.order()[0];
                if (order) this.state.sort = { key: columns[order[0]].key, direction: order[1] };
            }
            this.root.querySelector('#pagination-region').innerHTML = A.Pagination.render({
                page: info.page + 1, pages: Math.max(1, info.pages), total: info.recordsDisplay,
                pageSize: info.length, disabled: this.loading
            });
        }
        openRequest(view, number) {
            const row = this.service.get(number); if (!row) return;
            this.modal.open(A.RequestViews[view](row));
        }
        export() {
            const response = this.service.query(this.state); if (!response.total) return;
            const rows = this.table.api.rows({ order: 'applied', search: 'applied' }).data().toArray();
            U.download('rastreabilidade-alcada-aprovacao.csv', this.service.export(this.state, rows));
            A.Toast.show({ title: 'Exportação concluída', message: `${response.total} solicitações exportadas com os filtros da consulta.` });
        }
    }
    A.PanelApp = PanelApp;
    A.application = new PanelApp(document.getElementById('alcada-panel'), window.ALCADA_PANEL_PROVIDER || A.MockProvider);
    A.application.start();
})(window.AlcadaPanel);
