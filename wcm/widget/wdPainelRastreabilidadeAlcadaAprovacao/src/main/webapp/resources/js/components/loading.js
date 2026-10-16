(function (A) {
    'use strict';
    class Loading {
        constructor(root, { floating = false } = {}) { this.root = root; this.floating = floating; }
        static render({ title = 'Carregando…', message = '', compact = false } = {}) {
            return `<div class="panel-loading-state${compact ? ' panel-loading-state--compact' : ''}" role="status" aria-live="polite" aria-atomic="true"><span class="panel-loading-spinner" aria-hidden="true"></span><strong>${A.Utils.escape(A.Utils.titleCase(title))}</strong>${message ? `<p>${A.Utils.escape(message)}</p>` : ''}</div>`;
        }
        show(options) {
            if (!this.layer) {
                if (!this.floating) {
                    this.previousBusy = this.root.getAttribute('aria-busy');
                    this.children = [...this.root.children].map(element => ({ element, inert: element.inert }));
                    this.children.forEach(({ element }) => { element.inert = true; });
                    this.root.classList.add('panel-loading-host');
                }
                this.layer = document.createElement('div');
                this.layer.className = this.floating ? 'panel-loading-floating' : 'panel-loading-overlay';
                this.root.appendChild(this.layer);
            }
            if (!this.floating) this.root.setAttribute('aria-busy', 'true');
            this.layer.innerHTML = Loading.render(options);
        }
        hide() {
            if (!this.layer) return;
            this.layer.remove(); this.layer = null;
            if (this.floating) return;
            this.children.forEach(({ element, inert }) => { element.inert = inert; });
            this.children = [];
            this.root.classList.remove('panel-loading-host');
            if (this.previousBusy == null) this.root.removeAttribute('aria-busy');
            else this.root.setAttribute('aria-busy', this.previousBusy);
        }
    }
    A.Loading = Loading;
})(window.AlcadaPanel);
