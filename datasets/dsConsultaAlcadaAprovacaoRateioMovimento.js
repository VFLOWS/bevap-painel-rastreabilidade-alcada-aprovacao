/* Consulta direta de tb_tmovratccu, sem paginação.
 * Retorna somente filhos da última versão do principal, com ou sem masterid.
 * Todas as colunas e valores são retornados sem formatação.
 */
var FORM_TABLE = "ML001935264";
var MAIN_TABLE = "ML001935262";

function createDataset(fields, constraints, sortFields) {
    var dataset = DatasetBuilder.newDataset();
    var context = null, conn = null, stmt = null, rs = null;

    try {
        var masterId = getConstraintValue(constraints, "masterid");
        var query = "SELECT F.* FROM " + FORM_TABLE + " AS F " +
            "INNER JOIN " + MAIN_TABLE + " AS P ON P.ID = F.masterid " +
            "WHERE P.ID = ( " +
            " SELECT TOP (1) P2.ID FROM " + MAIN_TABLE + " AS P2 " +
            " WHERE P2.companyid = P.companyid AND P2.documentid = P.documentid " +
            " ORDER BY P2.version DESC, P2.ID DESC " +
            ") " + (masterId ? "AND F.masterid = ? " : "") + "ORDER BY F.ID";

        context = new javax.naming.InitialContext();
        conn = context.lookup("/jdbc/FluigDS").getConnection();
        stmt = conn.prepareStatement(query);
        if (masterId) stmt.setInt(1, Number(masterId));
        rs = stmt.executeQuery();

        var meta = rs.getMetaData(), columns = meta.getColumnCount();
        for (var i = 1; i <= columns; i++) dataset.addColumn(String(meta.getColumnLabel(i)));
        while (rs.next()) {
            var row = [];
            for (var j = 1; j <= columns; j++) row.push(rs.getString(j));
            dataset.addRow(row);
        }
    } catch (e) {
        dataset = DatasetBuilder.newDataset();
        dataset.addColumn("ERRO");
        dataset.addRow([String(e.message || e)]);
    } finally {
        closeDatasetResource(rs);
        closeDatasetResource(stmt);
        closeDatasetResource(conn);
        closeDatasetResource(context);
    }
    return dataset;
}

function getConstraintValue(constraints, name) {
    for (var i = 0; constraints && i < constraints.length; i++) {
        if (String(constraints[i].fieldName).toLowerCase() === name.toLowerCase()) return constraints[i].initialValue;
    }
    return null;
}

function closeDatasetResource(resource) {
    if (resource) try { resource.close(); } catch (e) {}
}
