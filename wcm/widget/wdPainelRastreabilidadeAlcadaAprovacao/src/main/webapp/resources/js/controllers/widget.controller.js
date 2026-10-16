var wdPainelRastreabilidadeAlcadaAprovacao = SuperWidget.extend({
    init: function () {
        var host = document.getElementById('wdPainelRastreabilidadeAlcadaAprovacao_' + this.instanceId);
        if (!host || host.dataset.mounted === 'true') return;
        host.dataset.mounted = 'true';
        var api = window.WCMAPI || {};
        var companyId = host.dataset.companyId || api.organizationId || (api.getOrganizationId && api.getOrganizationId());
        if (!companyId) {
            host.innerHTML = AlcadaPanel.Alert.render({ tone: 'red', title: 'Empresa do Fluig indisponível', message: 'Não foi possível identificar a empresa da sessão atual.', icon: 'alert' });
            return;
        }
        var tenant = api.tenantCode || (window.location.pathname.match(/\/portal\/p\/([^/]+)/) || [])[1] || companyId;
        this.controller = new AlcadaPanel.FluigPanelController(host.querySelector('[data-panel-root]'), {
            host: host, instanceId: this.instanceId, companyId: companyId, tenantCode: tenant,
            logo: '/wdPainelRastreabilidadeAlcadaAprovacao/resources/images/logo-bevap.png',
            initials: AlcadaPanel.Utils.initials(api.user || (api.getUserLogin && api.getUserLogin())), home: window.location.pathname
        });
        this.controller.start();
    },
    bindings: { local: {}, global: {} }
});
