(function (A) {
    'use strict';
    // Único ponto de acesso aos datasets: usa a sessão autenticada do Fluig.
    A.FluigDataset = {
        get(name, values = {}, fields = null) {
            return new Promise((resolve, reject) => {
                if (!window.DatasetFactory) { reject(new Error('DatasetFactory não está disponível. Abra esta widget no Fluig.')); return; }
                const constraints = Object.entries(values).filter(([, value]) => value != null && value !== '').map(([key, value]) =>
                    DatasetFactory.createConstraint(key, String(value), String(value), ConstraintType.MUST));
                DatasetFactory.getDataset(name, fields, constraints, null, {
                    success(dataset) {
                        const rows = dataset && dataset.values;
                        if (!Array.isArray(rows)) { reject(new Error('Retorno inválido do dataset ' + name + '.')); return; }
                        const error = rows.find(row => row.ERRO || row.ERROR);
                        if (error) reject(new Error(error.ERRO || error.ERROR)); else resolve(rows);
                    },
                    error(xhr, status, error) { reject(new Error(error || status || 'Falha ao consultar ' + name + '.')); }
                });
            });
        }
    };
})(window.AlcadaPanel);
