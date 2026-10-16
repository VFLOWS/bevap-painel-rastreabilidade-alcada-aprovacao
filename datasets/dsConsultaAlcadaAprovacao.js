/* Lista paginada ou consulta por documentid, sempre na última versão do principal.
 * Constraints: page/pageNumber, pageSize, documentid, companyid e filtros do painel.
 * mode=opcoes/columnKey retorna valores distintos da coluna; columnFilters filtra seleções.
 * mode=resumo retorna indicadores para a mesma consulta e os mesmos filtros.
 * A listagem mantém F.*; fields não altera a projeção. sortKey/sortDirection ordenam o painel.
 */
var FORM_TABLE = "ML001935262";

function createDataset(fields, constraints, sortFields) {
    var dataset = DatasetBuilder.newDataset();
    var context = null, conn = null, stmt = null, rs = null;

    try {
        var documentId = getConstraintValue(constraints, "documentid");
        var companyId = getConstraintValue(constraints, "companyid");
        var page = Number(getConstraintValue(constraints, "page") || getConstraintValue(constraints, "pageNumber") || 1);
        var pageSize = Number(getConstraintValue(constraints, "pageSize") || 20);
        var mode = String(getConstraintValue(constraints, "mode") || "");
        var columnKey = getConstraintValue(constraints, "columnKey");
        var parameters = [], filter = "", pagination = "";
        if (documentId) {
            filter += " AND F.documentid = ? ";
            parameters.push(Number(documentId));
        }
        if (companyId) {
            filter += " AND F.companyid = ? ";
            parameters.push(Number(companyId));
        }
        var processStatus = "CASE WHEN F.alcada_rm_reprovado = 'S' THEN 'reprovado' " +
            "WHEN F.alcada_rm_aprovado = 'S' THEN 'aprovado' ELSE 'aberto' END";
        var approvalStatus = "CASE WHEN F.alcada_rm_reprovado = 'S' THEN 'interrompidas' " +
            "WHEN F.alcada_rm_aprovado = 'S' OR (TRY_CONVERT(int, F.alcada_total_etapas) > 0 " +
            "AND TRY_CONVERT(int, F.alcada_indice_atual) > TRY_CONVERT(int, F.alcada_total_etapas)) THEN 'concluidas' " +
            "WHEN TRY_CONVERT(int, F.alcada_total_etapas) > 0 THEN 'execucao' ELSE 'previstas' END";
        var filterColumns = {
            company: "F.tmov_codcoligada", approvalType: "F.alcada_tipoaprovacao_codigo",
            costCenter: "CONCAT(F.tmov_codcoligada, ':', F.tmov_codccusto)",
            movementType: "CONCAT(F.tmov_codcoligada, ':', F.tmov_codtmv)",
            approver: "F.alcada_aprovador_atual", processStatus: processStatus, approvalStatus: approvalStatus
        };
        // Valores canônicos das colunas; rótulos e formatação ficam na widget.
        var columnValues = {
            requestNumber: "CONVERT(nvarchar(30), P.NUM_PROCES)",
            processStatus: "CASE WHEN F.alcada_rm_reprovado = 'S' THEN N'Reprovado' WHEN F.alcada_rm_aprovado = 'S' THEN N'Aprovado' " +
                "WHEN TRY_CONVERT(int, F.alcada_total_etapas) > 0 AND TRY_CONVERT(int, F.alcada_indice_atual) > TRY_CONVERT(int, F.alcada_total_etapas) THEN N'Concluídas' " +
                "WHEN TRY_CONVERT(int, F.alcada_total_etapas) > 0 THEN N'Em execução' ELSE N'Previstas' END",
            company: "CONCAT(F.tmov_codcoligada, ' - ', F.tmov_nomecoligada)",
            approvalType: "CONCAT(F.alcada_tipoaprovacao_codigo, ' - ', F.alcada_tipoaprovacao_descricao)",
            movementType: "CONCAT(F.tmov_codtmv, ' - ', F.tmov_nometmv)",
            movementNumber: "F.tmov_numeromov", movementId: "F.tmov_idmov",
            costCenter: "CONCAT(F.tmov_codccusto, ' - ', F.tmov_nomeccusto)", supplier: "F.tmov_nomecfo",
            issuedAt: "LEFT(F.tmov_dataemissao, 10)",
            gross: "CONVERT(nvarchar(50), TRY_CONVERT(decimal(19,4), F.tmov_valorbruto))",
            net: "CONVERT(nvarchar(50), TRY_CONVERT(decimal(19,4), F.tmov_valorliquido))"
        };
        var columnFilters = JSON.parse(getConstraintValue(constraints, "columnFilters") || "{}");
        for (var key in columnValues) {
            var values = columnFilters[key] || [];
            if (!values.length || (mode === "opcoes" && key === columnKey)) continue;
            var placeholders = [];
            for (var n = 0; n < values.length; n++) { placeholders.push("?"); parameters.push(String(values[n])); }
            filter += " AND ISNULL(" + columnValues[key] + ", '') IN (" + placeholders.join(",") + ") ";
        }
        var selected = JSON.parse(getConstraintValue(constraints, "filters") || "{}");
        for (var key in filterColumns) {
            var values = selected[key] || [];
            if (!values.length) continue;
            var placeholders = [];
            for (var n = 0; n < values.length; n++) { placeholders.push("?"); parameters.push(String(values[n])); }
            filter += " AND " + filterColumns[key] + " IN (" + placeholders.join(",") + ") ";
        }
        var from = getConstraintValue(constraints, "from"), to = getConstraintValue(constraints, "to");
        if (from) { filter += " AND F.tmov_dataemissao >= ? "; parameters.push(String(from)); }
        if (to) { filter += " AND F.tmov_dataemissao < DATEADD(day, 1, CONVERT(date, ?)) "; parameters.push(String(to)); }
        var search = getConstraintValue(constraints, "search");
        if (search) {
            var searchColumns = ["P.NUM_PROCES", "F.tmov_idmov", "F.tmov_numeromov", "F.tmov_nomecfo", "F.tmov_cgccfo",
                "F.tmov_codccusto", "F.tmov_nomeccusto", "F.tmov_codtmv", "F.tmov_nometmv", "F.tmov_nomecoligada",
                "F.alcada_tipoaprovacao_codigo", "F.alcada_tipoaprovacao_descricao", "F.alcada_aprovador_atual_nome"];
            var searchTerms = [];
            for (var n = 0; n < searchColumns.length; n++) {
                searchTerms.push("CONVERT(nvarchar(max), " + searchColumns[n] + ") LIKE ?");
                parameters.push("%" + String(search).replace(/\[/g, "[[]").replace(/%/g, "[%]").replace(/_/g, "[_]") + "%");
            }
            filter += " AND (" + searchTerms.join(" OR ") + ") ";
        }
        if (getConstraintValue(constraints, "withProcess")) filter += " AND P.NUM_PROCES IS NOT NULL ";
        var sortColumns = {
            requestNumber: "P.NUM_PROCES", processStatus: processStatus, company: "F.tmov_nomecoligada",
            approvalType: "F.alcada_tipoaprovacao_descricao", movementType: "F.tmov_nometmv",
            movementNumber: "F.tmov_numeromov", movementId: "F.tmov_idmov", costCenter: "F.tmov_nomeccusto",
            supplier: "F.tmov_nomecfo", issuedAt: "F.tmov_dataemissao",
            gross: "TRY_CONVERT(decimal(19,4), F.tmov_valorbruto)", net: "TRY_CONVERT(decimal(19,4), F.tmov_valorliquido)"
        };
        var sortKey = getConstraintValue(constraints, "sortKey");
        var sortColumn = sortColumns[sortKey] || "P.NUM_PROCES";
        var direction = sortColumns[sortKey] && String(getConstraintValue(constraints, "sortDirection")) === "asc" ? "ASC" : "DESC";
        var order = sortColumn + " " + direction +
            (sortColumn === "P.NUM_PROCES" ? "" : ", P.NUM_PROCES DESC") +
            ", F.companyid DESC, F.documentid DESC, F.ID DESC";
        if (!documentId && mode !== "resumo" && mode !== "opcoes") {
            pagination = " ORDER BY " + order + " " +
                "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY ";
            parameters.push((page - 1) * pageSize, pageSize);
        }

        var base =
            " SELECT F.*, P.NUM_PROCES " +
            " FROM " + FORM_TABLE + " AS F " +
            " OUTER APPLY ( " +
            "  SELECT TOP (1) WF.NUM_PROCES FROM PROCES_WORKFLOW AS WF " +
            "  WHERE WF.COD_EMPRESA = F.companyid AND WF.NR_DOCUMENTO_CARD = F.documentid " +
            "  ORDER BY WF.NUM_PROCES DESC " +
            " ) AS P " +
            " WHERE F.tableid = 'principal' " + filter +
            "   AND F.ID = ( " +
            "    SELECT TOP (1) F2.ID FROM " + FORM_TABLE + " AS F2 " +
            "    WHERE F2.companyid = F.companyid AND F2.documentid = F.documentid " +
            "      AND F2.tableid = 'principal' " +
            "    ORDER BY F2.version DESC, F2.ID DESC " +
            "   ) ";
        var query;
        if (mode === "opcoes") {
            if (!columnValues[columnKey]) throw new Error("Coluna de filtro inválida.");
            query = "SELECT DISTINCT ISNULL(CONVERT(nvarchar(4000), " + columnValues[columnKey].replace(/P\./g, "F.") +
                "), '') AS VALOR FROM (" + base + ") AS F ORDER BY VALOR";
        } else if (mode === "resumo") {
            query = "SELECT COUNT(*) AS TOTAL, " +
                "SUM(CASE WHEN F.alcada_rm_reprovado = 'S' THEN 1 ELSE 0 END) AS REPROVADO, " +
                "SUM(CASE WHEN F.alcada_rm_reprovado = 'S' THEN 0 WHEN F.alcada_rm_aprovado = 'S' THEN 1 ELSE 0 END) AS APROVADO, " +
                "SUM(CASE WHEN ISNULL(F.alcada_rm_reprovado, '') <> 'S' AND ISNULL(F.alcada_rm_aprovado, '') <> 'S' THEN 1 ELSE 0 END) AS ABERTO, " +
                "SUM(TRY_CONVERT(decimal(19,4), F.tmov_valorliquido)) AS VALOR_LIQUIDO FROM (" + base + ") AS F";

        } else {
            query = "SELECT PAGINA.*, ATUAL.NUM_SEQ_ESTADO AS COD_ATIVIDADE_ATUAL FROM (" + base + pagination + ") AS PAGINA " +
                "OUTER APPLY ( " +
                " SELECT TOP (1) H.NUM_SEQ_ESTADO FROM HISTOR_PROCES AS H " +
                " WHERE H.COD_EMPRESA = PAGINA.companyid AND H.NUM_PROCES = PAGINA.NUM_PROCES " +
                " ORDER BY H.NUM_SEQ_MOVTO DESC " +
                ") AS ATUAL ORDER BY " + order.replace(/P\./g, "PAGINA.").replace(/F\./g, "PAGINA.");
        }

        context = new javax.naming.InitialContext();
        conn = context.lookup("/jdbc/FluigDS").getConnection();
        stmt = conn.prepareStatement(query);
        for (var i = 0; i < parameters.length; i++) {
            if (typeof parameters[i] === "number") stmt.setInt(i + 1, parameters[i]);
            else stmt.setString(i + 1, String(parameters[i]));
        }
        stmt.setFetchSize(pageSize);
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
