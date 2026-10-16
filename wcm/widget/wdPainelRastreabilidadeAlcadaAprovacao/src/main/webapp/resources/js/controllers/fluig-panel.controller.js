(function (A) {
    'use strict';
    class FluigPanelController extends A.PanelApp {
        constructor(root, options) {
            super(root, null, options);
            this.service = new A.FluigRequestService(options);
            this.state.sort = { key: 'requestNumber', direction: 'desc' };
            this.response = { rows: [], total: 0, stats: { total: 0, aberto: 0, aprovado: 0, reprovado: 0, amount: 0 } };
            this.service.query = () => ({ ...this.response, allRows: this.response.rows });
            this.loadingIndicator = new A.Loading(root);
            this.exportIndicator = new A.Loading(root, { floating: true });
        }
        async refresh(showToast) {
            if (this.refreshing) return;
            this.refreshing = true; this.loading = true; this.loadError = false; this.filters.setBusy(true);
            this.notifyRefresh = showToast;
            this.filters.close(); this.filters.datePicker.close(false);
            this.loadingIndicator.show({ title: 'Carregando painel…', message: 'Consultando os filtros e as solicitações de aprovação.' });
            try {
                await this.service.load();
                this.loading = false; this.render();
            } catch (error) { this.fail(error); }
        }
        render() {
            // Mantém a tabela viva: DataTables solicita somente a página e a ordenação atuais.
            if (this.loading && !this.table) {
                this.renderIndicators(this.service.query()); this.renderFooter(true, this.response);
                this.element('table-region').innerHTML = '<div class="panel-loading-placeholder" aria-hidden="true"></div>';
                this.loadingIndicator.show({ title: 'Carregando painel…', message: 'Consultando os filtros e as solicitações de aprovação.' });
                return;
            }
            if (this.loadError) { super.render(); return; }
            if (this.table) { this.table.api.ajax.reload(null, true); return; }
            this.mountRemoteTable();
        }
        mountRemoteTable() {
            const root = this.element('table-region');
            const options = {
                id: 'requests-' + this.options.instanceId, columns: A.Config.columns, renderers: A.RequestCells,
                sort: this.state.sort, pageSize: this.state.pageSize, serverSide: true,
                caption: 'Solicitações de Alçada de Aprovação',
                columnOptions: column => this.service.columnOptions(this.state, column),
                onFilterError: error => this.toast({ title: 'Falha ao consultar opções', message: error.message, tone: 'red' }),
                ajax: async (request, callback) => {
                    const token = this.drawToken = (this.drawToken || 0) + 1;
                    this.loading = true; this.filters.setBusy(true); this.element('refresh-requests').disabled = true;
                    this.element('export-requests').disabled = true;
                    // Mantém o menu disponível para selecionar várias opções durante a consulta.
                    if (!root.querySelector('.column-filter-menu')) this.loadingIndicator.show({ title: 'Consultando solicitações…', message: 'Aguarde enquanto atualizamos a tabela e os indicadores.' });
                    root.setAttribute('aria-busy', 'true');
                    this.element('last-update').textContent = 'Consultando solicitações…';
                    const order = request.order[0];
                    const columnFilters = Object.fromEntries(request.columns.map(column => [column.name, Object.values(column.columnControl?.list || {})]).filter(([, values]) => values.length));
                    const state = { ...this.state, columnFilters, page: Math.floor(request.start / request.length) + 1, pageSize: request.length,
                        sort: order ? { key: A.Config.columns[order.column].key, direction: order.dir } : this.state.sort };
                    try {
                        const response = await this.service.page(state);
                        if (token !== this.drawToken) return;
                        this.response = response; Object.assign(this.state, state);
                        this.loading = false; this.loadError = false; this.updatedAt = new Date();
                        callback({ draw: request.draw, recordsTotal: response.total, recordsFiltered: response.total, data: response.rows });
                        this.renderSummary();
                        if (this.notifyRefresh) this.toast({ title: 'Consulta atualizada', message: 'Os filtros e a listagem foram atualizados.' });
                    } catch (error) {
                        if (token !== this.drawToken) return;
                        this.loading = false;
                        callback({ draw: request.draw, recordsTotal: 0, recordsFiltered: 0, data: [] });
                        this.fail(error);
                    } finally {
                        if (token === this.drawToken) {
                            root.setAttribute('aria-busy', 'false');
                            this.loadingIndicator.hide(); this.refreshing = false; this.notifyRefresh = false;
                            this.filters.setBusy(false); this.element('refresh-requests').disabled = false;
                        }
                    }
                },
                onDraw: (api, columns) => this.onTableDraw(api, columns)
            };
            root.innerHTML = A.DataTable.render(options);
            this.table = A.DataTable.mount(root)[0];
        }
        renderSummary() {
            this.renderIndicators(this.service.query());
            this.renderFooter(false, this.response);
        }
        fail(error) {
            this.loading = false; this.loadError = true;
            this.loadingIndicator.hide(); this.refreshing = false; this.notifyRefresh = false;
            this.filters.setBusy(false);
            super.render();
            this.toast({ title: 'Não foi possível consultar os dados', message: error.message, tone: 'red' });
            console.error('[Painel de Rastreabilidade]', error);
        }
        async openRequest(view, number) {
            const token = this.detailToken = (this.detailToken || 0) + 1;
            this.filters.close(); this.filters.datePicker.close(false);
            this.modal.openLoading({ title: (view === 'history' ? 'Histórico de Alçada de Aprovação' : 'Detalhes da solicitação') + ' #' + number,
                subtitle: 'Consultando os dados atualizados…', icon: view === 'history' ? 'history' : 'eye',
                message: view === 'history' ? 'Buscando a solicitação e suas etapas de aprovação.' : 'Buscando os dados da solicitação, itens, rateios e alçadas.' });
            try {
                const row = await this.service.detail(number, view);
                if (token === this.detailToken && this.modal.dialog.open) this.modal.open(A.RequestViews[view](row));
            } catch (error) {
                if (token === this.detailToken && this.modal.dialog.open) this.modal.open({ title: 'Não foi possível abrir a solicitação', content: A.Alert.render({ tone: 'red', title: 'Falha na consulta', message: error.message, icon: 'alert' }) });
            }
        }
        async export() {
            if (this.exporting || this.loading || !this.response.total) return;
            const state = A.Utils.clone(this.state);
            this.exporting = true; this.element('export-requests').disabled = true;
            this.exportIndicator.show({ title: 'Gerando Excel…', message: 'Consultando todas as solicitações que atendem aos filtros aplicados.' });
            try {
                const rows = await this.service.exportRows(state);
                if (!rows.length) {
                    this.toast({ title: 'Nenhuma solicitação para exportar', message: 'Não há resultados para os filtros aplicados.' });
                    return;
                }
                const details = await this.service.exportDetails(rows, ({ completed, total }) => {
                    this.exportIndicator.show({ title: 'Gerando Excel…', message: `Carregando aprovações, itens e rateios: ${completed} de ${total} solicitações.` });
                });
                A.ExcelExport.download('rastreabilidade-alcada-aprovacao.xlsx', this.service.export(state, details));
                this.toast({ title: 'Exportação concluída', message: rows.length + ' solicitações exportadas com os filtros da consulta.' });
            } catch (error) {
                this.toast({ title: 'Não foi possível exportar o Excel', message: error.message, tone: 'red' });
            } finally {
                this.exporting = false; this.exportIndicator.hide();
                this.element('export-requests').disabled = this.loading || this.loadError || !this.response.total;
            }
        }
    }
    A.FluigPanelController = FluigPanelController;
})(window.AlcadaPanel);
