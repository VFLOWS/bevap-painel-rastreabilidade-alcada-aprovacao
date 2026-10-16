(function (A) {
    'use strict';
    A.ExcelExport = {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        create({ columns, rows, sheetName = 'Solicitações', sheets = [{ columns, rows, sheetName }], wrapText = false }) {
            const X = A.SpreadsheetLibrary;
            const workbook = X.utils.book_new();
            sheets.forEach(({ columns, rows, sheetName }) => {
                const sheet = X.utils.aoa_to_sheet([columns.map(column => column.label), ...rows], { UTC: true });
                sheet['!cols'] = columns.map(column => ({ wch: column.width || 20 }));
                sheet['!autofilter'] = { ref: sheet['!ref'] };
                if (wrapText) {
                    sheet['!rows'] = [{ hpt: 30 }, ...rows.map(row => {
                        const lines = Math.max(1, ...row.map((value, index) => String(value ?? '').split('\n')
                            .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / (columns[index].width || 20))), 0)));
                        return { hpt: Math.min(409, lines * 15 + 8) };
                    })];
                }
                columns.forEach((column, index) => {
                    if (!column.format) return;
                    rows.forEach((row, rowIndex) => {
                        const cell = sheet[X.utils.encode_cell({ c: index, r: rowIndex + 1 })];
                        if (cell) cell.z = column.format;
                    });
                });
                X.utils.book_append_sheet(workbook, sheet, sheetName);
            });
            const content = X.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
            if (!wrapText) return content;
            // O CE preserva os formatos numéricos, mas não escreve alinhamento.
            // Aplicamos quebra de linha aos estilos gerados, usando o ZIP da própria biblioteca.
            const archive = X.CFB.read(new Uint8Array(content), { type: 'array' });
            const entry = X.CFB.find(archive, '/xl/styles.xml');
            const xml = Array.from(entry.content, byte => String.fromCharCode(byte)).join('');
            const styled = xml.replace(/<cellXfs\b[^>]*>[\s\S]*?<\/cellXfs>/, section =>
                section.replace(/<xf\b([^>]*?)\/>/g, '<xf$1 applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'));
            X.CFB.utils.cfb_add(archive, '/xl/styles.xml', styled);
            return X.CFB.write(archive, { type: 'array', fileType: 'zip', compression: true });
        },
        download(name, content) { A.Utils.download(name, content, this.mimeType); }
    };
})(window.AlcadaPanel);
