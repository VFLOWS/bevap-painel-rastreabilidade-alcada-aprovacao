(function (A) {
    'use strict';
    class Modal {
        constructor(root) {
            this.dialog = document.createElement('dialog');
            this.dialog.className = 'modal';
            this.dialog.setAttribute('aria-labelledby', 'panel-modal-title');
            this.dialog.setAttribute('aria-describedby', 'panel-modal-subtitle');
            root.appendChild(this.dialog);
            this.dialog.addEventListener('click', event => {
                if (event.target.closest('[data-action="modal-close"]')) this.close();
                if (event.target === this.dialog) {
                    const bounds = this.dialog.getBoundingClientRect();
                    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.close();
                }
            });
            this.dialog.addEventListener('close', () => { A.DataTable.destroy(this.dialog); document.body.classList.remove('has-modal'); if (this.returnFocus && this.returnFocus.isConnected) this.returnFocus.focus(); });
        }
        open({ title, subtitle, icon = 'document', content, footer = '', className = '', onMount }) {
            if (!this.dialog.open) this.returnFocus = document.activeElement;
            A.DataTable.destroy(this.dialog);
            this.dialog.className = `modal ${className}`;
            this.dialog.innerHTML = `<div class="modal-header"><span class="modal-heading-icon">${A.Icon.render(icon)}</span><div class="modal-heading"><h2 id="panel-modal-title">${A.Utils.escape(title)}</h2><p id="panel-modal-subtitle">${A.Utils.escape(subtitle || '')}</p></div>${A.Button.render({ icon: 'x', title: 'Fechar janela', iconOnly: true, variant: 'ghost', action: 'modal-close' })}</div><div class="modal-content">${content}</div><div class="modal-footer">${footer || '<span></span>'}${A.Button.render({ label: 'Fechar', action: 'modal-close' })}</div>`;
            document.body.classList.add('has-modal');
            if (!this.dialog.open) this.dialog.showModal();
            A.DataTable.mount(this.dialog);
            this.dialog.querySelector('[data-action="modal-close"]').focus();
            if (onMount) onMount(this.dialog);
        }
        close() { this.dialog.close(); }
    }
    A.Modal = Modal;
})(window.AlcadaPanel);
