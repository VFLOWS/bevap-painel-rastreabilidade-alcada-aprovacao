(function (A) {
    'use strict';
    class TableLayout {
        constructor({ element, api, columns, resizable = true, onResize }) {
            this.element = element; this.api = api; this.columns = columns; this.onResize = onResize;
            this.header = element.tHead; this.viewport = element.closest('.table-scroll');
            this.originalStyle = { width: element.style.width, minWidth: element.style.minWidth };
            this.handles = []; this.widths = null;
            this.schedule = () => {
                if (this.destroyed || this.frame) return;
                this.frame = requestAnimationFrame(() => { this.frame = null; this.refresh(); });
            };
            this.sizing = () => { this.applyWidths(); this.schedule(); };
            this.preventSort = event => {
                if (event.target.closest('.column-resize-handle')) { event.preventDefault(); event.stopImmediatePropagation(); }
            };
            this.pointerDown = event => {
                const handle = event.target.closest('.column-resize-handle');
                if (!handle || event.button !== 0) return;
                event.preventDefault(); event.stopImmediatePropagation();
                this.captureWidths(); const index = Number(handle.dataset.column);
                this.drag = { id: event.pointerId, handle, index, x: event.clientX, width: this.widths[index] };
                handle.focus({ preventScroll: true }); handle.setPointerCapture(event.pointerId);
                this.element.classList.add('is-resizing-columns');
            };
            this.pointerMove = event => {
                if (!this.drag || this.drag.id !== event.pointerId) return;
                event.preventDefault();
                this.setWidth(this.drag.index, this.drag.width + event.clientX - this.drag.x);
            };
            this.pointerEnd = event => {
                if (!this.drag || this.drag.id !== event.pointerId) return;
                const handle = this.drag.handle; this.drag = null;
                this.element.classList.remove('is-resizing-columns');
                if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
                this.refresh();
            };
            this.keyDown = event => {
                const handle = event.target.closest('.column-resize-handle');
                if (!handle || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                event.preventDefault(); event.stopImmediatePropagation(); this.captureWidths();
                const index = Number(handle.dataset.column), step = event.shiftKey ? 25 : 10;
                this.setWidth(index, this.widths[index] + (event.key === 'ArrowRight' ? step : -step));
            };
            if (resizable) columns.forEach((column, index) => {
                if (column.resizable === false) return;
                const handle = document.createElement('span');
                handle.className = 'column-resize-handle'; handle.dataset.column = String(index); handle.tabIndex = 0;
                handle.setAttribute('role', 'separator'); handle.setAttribute('aria-orientation', 'vertical');
                handle.setAttribute('aria-label', 'Ajustar largura de ' + column.label);
                handle.setAttribute('aria-valuemin', '48'); handle.setAttribute('aria-valuemax', '2000');
                api.column(index).header().appendChild(handle); this.handles.push(handle);
            });
            this.header.addEventListener('click', this.preventSort, true);
            this.header.addEventListener('pointerdown', this.pointerDown, true);
            this.header.addEventListener('pointermove', this.pointerMove);
            this.header.addEventListener('pointerup', this.pointerEnd);
            this.header.addEventListener('pointercancel', this.pointerEnd);
            this.header.addEventListener('lostpointercapture', this.pointerEnd);
            this.header.addEventListener('keydown', this.keyDown, true);
            this.api.on('column-sizing.dt.alcadaLayout', this.sizing);
            window.addEventListener('resize', this.schedule);
            if (typeof ResizeObserver !== 'undefined') {
                this.observer = new ResizeObserver(this.schedule);
                this.observer.observe(element); this.observer.observe(this.viewport);
            }
            if (document.fonts) {
                document.fonts.ready.then(this.schedule);
                document.fonts.addEventListener('loadingdone', this.schedule);
            }
            this.refresh();
        }
        captureWidths() {
            if (!this.widths) this.widths = this.api.columns().header().toArray().map(cell => cell.getBoundingClientRect().width);
        }
        setWidth(index, width) {
            this.widths[index] = Math.max(48, Math.min(2000, width));
            this.applyWidths(); this.refresh();
        }
        applyWidths() {
            if (!this.widths) return;
            const cols = this.element.querySelectorAll('colgroup col');
            this.widths.forEach((width, index) => { if (cols[index]) cols[index].style.width = width + 'px'; });
            const total = this.widths.reduce((sum, width) => sum + width, 0);
            this.element.style.width = total + 'px'; this.element.style.minWidth = total + 'px';
        }
        refresh() {
            if (this.destroyed) return;
            this.applyWidths();
            this.handles.forEach(handle => handle.setAttribute('aria-valuenow', String(Math.round(this.api.column(Number(handle.dataset.column)).header().getBoundingClientRect().width))));
            for (const cell of this.element.querySelectorAll('tbody td')) {
                const texts = [];
                for (const candidate of [cell, ...cell.querySelectorAll('*')]) {
                    if (!(candidate instanceof HTMLElement) || !candidate.clientWidth || !candidate.clientHeight) continue;
                    const style = getComputedStyle(candidate);
                    const ellipsis = style.textOverflow === 'ellipsis' && /^(hidden|clip)$/.test(style.overflowX);
                    const clamped = Number.parseInt(style.webkitLineClamp, 10) > 0 && style.overflowY === 'hidden';
                    if (!ellipsis && !clamped) continue;
                    candidate.removeAttribute('title');
                    if (candidate.scrollWidth > candidate.clientWidth + 1 || candidate.scrollHeight > candidate.clientHeight + 1) texts.push(candidate.textContent.trim());
                }
                const title = [...new Set(texts)].filter(Boolean).join('\n');
                if (title) cell.setAttribute('title', title); else cell.removeAttribute('title');
            }
            if (this.onResize) this.onResize();
        }
        destroy() {
            this.destroyed = true;
            if (this.frame) cancelAnimationFrame(this.frame);
            if (this.observer) this.observer.disconnect();
            window.removeEventListener('resize', this.schedule);
            if (document.fonts) document.fonts.removeEventListener('loadingdone', this.schedule);
            this.api.off('column-sizing.dt.alcadaLayout', this.sizing);
            this.header.removeEventListener('click', this.preventSort, true);
            this.header.removeEventListener('pointerdown', this.pointerDown, true);
            this.header.removeEventListener('pointermove', this.pointerMove);
            this.header.removeEventListener('pointerup', this.pointerEnd);
            this.header.removeEventListener('pointercancel', this.pointerEnd);
            this.header.removeEventListener('lostpointercapture', this.pointerEnd);
            this.header.removeEventListener('keydown', this.keyDown, true);
            this.handles.forEach(handle => handle.remove());
            this.element.classList.remove('is-resizing-columns');
            this.element.style.width = this.originalStyle.width; this.element.style.minWidth = this.originalStyle.minWidth;
        }
    }
    A.TableLayout = TableLayout;
})(window.AlcadaPanel);
