import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../services/api';

const operationStyles = {
  CREAR: 'bg-emerald-100 text-emerald-700',
  INSERT: 'bg-emerald-100 text-emerald-700',
  ACTUALIZAR: 'bg-blue-100 text-blue-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  ELIMINAR: 'bg-rose-100 text-rose-700',
  DELETE: 'bg-rose-100 text-rose-700',
  LOGIN: 'bg-cyan-100 text-cyan-700',
  LOGIN_FAILED: 'bg-rose-100 text-rose-700',
  LOGOUT: 'bg-slate-100 text-slate-700',
};

const moduleOptions = ['Todos', 'usuarios', 'bienes', 'mantenimiento', 'depreciacion', 'reportes', 'auditoria'];
const actionOptions = ['Todas', 'INSERT', 'UPDATE', 'DELETE'];

const formatAuditData = (data) => {
  if (!data) {
    return '-';
  }
  return JSON.stringify(data, null, 2);
};

const normalizeModulo = (value) => {
  if (!value) return 'Todos';
  if (String(value).toLowerCase() === 'autenticacion') return 'Autenticación';
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
};

const normalizeSearchText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const levenshteinDistance = (left, right) => {
  const distances = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = distances[0];
    distances[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const previous = distances[rightIndex];
      distances[rightIndex] = Math.min(
        distances[rightIndex] + 1,
        distances[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = previous;
    }
  }

  return distances[right.length];
};

const scoreSearchMatch = (query, value) => {
  const candidate = normalizeSearchText(value);
  const substringIndex = candidate.indexOf(query);

  if (substringIndex >= 0) {
    return substringIndex / Math.max(candidate.length, 1) / 10;
  }

  const maxErrors = query.length >= 7 ? 2 : query.length >= 4 ? 1 : 0;
  let bestScore = Infinity;

  for (let start = 0; start < candidate.length; start += 1) {
    const minLength = Math.max(1, query.length - maxErrors);
    const maxLength = Math.min(query.length + maxErrors, candidate.length - start);

    for (let length = minLength; length <= maxLength; length += 1) {
      const distance = levenshteinDistance(query, candidate.slice(start, start + length));
      if (distance <= maxErrors) {
        bestScore = Math.min(bestScore, 0.2 + distance / Math.max(query.length, 1));
      }
    }
  }

  return bestScore;
};

const getAuditSearchScore = (log, query) => [
  log.created_at ? new Date(log.created_at).toLocaleString('es-PE') : '',
  log.created_at ? new Date(log.created_at).toISOString().slice(0, 10) : '',
  log.usuario,
  log.email,
  log.tabla_afectada,
  log.operacion,
  log.registro_id,
].reduce((bestScore, value) => Math.min(bestScore, scoreSearchMatch(query, value)), Infinity);

const normalizeOperation = (operation) => {
  const normalized = String(operation || '').toUpperCase();
  if (normalized === 'CREAR' || normalized === 'INSERT') return 'INSERT';
  if (normalized === 'ACTUALIZAR' || normalized === 'UPDATE') return 'UPDATE';
  if (normalized === 'ELIMINAR' || normalized === 'DELETE') return 'DELETE';
  return normalized || 'SIN ACCIÓN';
};

const parseAuditData = (data) => {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return { valor: data };
    }
  }
  return data;
};

const flattenAuditData = (data) => {
  const fields = {};
  const visit = (value, prefix = '') => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.entries(value).forEach(([key, nestedValue]) => {
        visit(nestedValue, prefix ? `${prefix}.${key}` : key);
      });
    } else if (prefix) {
      fields[prefix] = value;
    }
  };

  visit(parseAuditData(data));
  return fields;
};

const formatAuditValue = (value) => {
  if (value === null || value === undefined || value === '') return 'Vacío';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

const isTechnicalField = (fieldName) => /ram|procesador|cpu|disco|ssd|hdd|pantalla|resolucion|video|gpu|fuente|parlantes|camara|sistema operativo|sistema_operativo/i.test(fieldName);

const getAuditEntityTitle = (moduleName) => {
  const normalized = normalizeSearchText(moduleName);
  if (normalized.includes('bien')) return 'Datos del Bien Informático';
  if (normalized.includes('usuario')) return 'Datos del Usuario';
  if (normalized.includes('mantenimiento')) return 'Datos del Mantenimiento';
  return 'Datos del Registro';
};

const exportIndividualAuditPdf = async (log) => {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const document = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const title = `Detalle de auditoría #${log.id}`;
  const previousFields = flattenAuditData(log.datos_anteriores);
  const currentFields = flattenAuditData(log.datos_nuevos);
  const fieldNames = [...new Set([...Object.keys(previousFields), ...Object.keys(currentFields)])];
  const fields = fieldNames.map((name) => ({
    name,
    label: name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' ').toLocaleUpperCase('es-PE'),
    hasPrevious: Object.hasOwn(previousFields, name),
    hasCurrent: Object.hasOwn(currentFields, name),
    previous: previousFields[name],
    current: currentFields[name],
  }));
  const technicalFields = fields.filter((field) => isTechnicalField(field.name));
  const generalFields = fields.filter((field) => !isTechnicalField(field.name));
  const exportedAt = new Date().toLocaleString('es-PE');

  const drawPageHeader = (continued = false) => {
    document.setTextColor(15, 23, 42);
    document.setFont('helvetica', 'bold');
    document.setFontSize(17);
    document.text(`${title}${continued ? ' (continuación)' : ''}`, margin, 18);
    document.setFontSize(8);
    document.setTextColor(71, 85, 105);
    document.text('TRIBUNAL CONSTITUCIONAL DEL PERÚ', pageWidth - margin, 13, { align: 'right' });
    document.setFont('helvetica', 'normal');
    document.setFontSize(9);
    document.text('Documento generado automáticamente por el sistema', margin, 25);
    document.setDrawColor(203, 213, 225);
    document.line(margin, 31, pageWidth - margin, 31);
  };

  const drawMetadataItem = (label, value, x, y, width) => {
    document.setFont('helvetica', 'bold');
    document.setFontSize(7);
    document.setTextColor(100, 116, 139);
    document.text(label.toLocaleUpperCase('es-PE'), x, y);
    document.setFont('helvetica', 'bold');
    document.setFontSize(9);
    document.setTextColor(15, 23, 42);
    document.text(document.splitTextToSize(String(value || '-'), width), x, y + 6);
  };

  let cursorY = 39;
  drawPageHeader();
  document.setFillColor(250, 250, 251);
  document.setDrawColor(226, 232, 240);
  document.roundedRect(margin, cursorY, contentWidth, 43, 3, 3, 'FD');
  const metadataColumnWidth = (contentWidth - 18) / 2;
  const leftX = margin + 7;
  const rightX = margin + 7 + metadataColumnWidth + 4;
  drawMetadataItem('Fecha', log.created_at ? new Date(log.created_at).toLocaleString('es-PE') : '-', leftX, cursorY + 9, metadataColumnWidth);
  drawMetadataItem('Usuario', `${log.usuario || '-'}${log.email ? `\n${log.email}` : ''}`, rightX, cursorY + 9, metadataColumnWidth);
  drawMetadataItem('Módulo', log.tabla_afectada || '-', leftX, cursorY + 29, metadataColumnWidth);
  drawMetadataItem('Acción / Registro', `${normalizeOperation(log.operacion)}  ·  ID: ${log.registro_id ?? '-'}`, rightX, cursorY + 29, metadataColumnWidth);
  cursorY += 53;

  const drawSection = (sectionTitle, sectionFields) => {
    if (sectionFields.length === 0) return;
    if (cursorY + 12 > pageHeight - 17) {
      document.addPage();
      drawPageHeader(true);
      cursorY = 40;
    }

    document.setFont('helvetica', 'bold');
    document.setFontSize(12);
    document.setTextColor(15, 23, 42);
    document.text(sectionTitle, margin, cursorY + 6);
    document.setDrawColor(226, 232, 240);
    document.line(margin, cursorY + 9, pageWidth - margin, cursorY + 9);
    cursorY += 14;

    const gap = 5;
    const cardWidth = (contentWidth - gap) / 2;
    const valueWidth = cardWidth - 10;
    const cardRows = [];

    for (let index = 0; index < sectionFields.length; index += 2) {
      const row = sectionFields.slice(index, index + 2).map((field) => {
        const unchanged = field.hasPrevious && field.hasCurrent
          && formatAuditValue(field.previous) === formatAuditValue(field.current);
        const values = unchanged
          ? [{ text: formatAuditValue(field.current), color: [15, 23, 42] }]
          : [
            ...(field.hasPrevious ? [{ text: `Anterior: ${formatAuditValue(field.previous)}`, color: [185, 28, 28], strike: true }] : []),
            ...(field.hasCurrent ? [{ text: `${field.hasPrevious ? 'Actual: ' : ''}${formatAuditValue(field.current)}`, color: [21, 128, 61] }] : []),
          ];

        document.setFont('helvetica', 'bold');
        document.setFontSize(7);
        const labelLines = document.splitTextToSize(field.label, valueWidth);
        const contentLines = values.map((item) => {
          document.setFont('helvetica', 'normal');
          document.setFontSize(8);
          return { ...item, lines: document.splitTextToSize(item.text, valueWidth) };
        });
        const contentLineCount = contentLines.reduce((total, item) => total + item.lines.length, 0);
        return { field, labelLines, contentLines, height: Math.max(19, 10 + labelLines.length * 3.2 + contentLineCount * 4) };
      });
      cardRows.push({ cards: row, height: Math.max(...row.map((card) => card.height)) });
    }

    cardRows.forEach(({ cards, height }) => {
      if (cursorY + height > pageHeight - 17) {
        document.addPage();
        drawPageHeader(true);
        cursorY = 40;
      }

      cards.forEach((card, index) => {
        const x = margin + index * (cardWidth + gap);
        document.setFillColor(255, 255, 255);
        document.setDrawColor(226, 232, 240);
        document.roundedRect(x, cursorY, cardWidth, height, 2, 2, 'FD');
        document.setFont('helvetica', 'bold');
        document.setFontSize(7);
        document.setTextColor(100, 116, 139);
        document.text(card.labelLines, x + 5, cursorY + 6);

        let textY = cursorY + 10 + card.labelLines.length * 3.2;
        card.contentLines.forEach((item) => {
          document.setFont('helvetica', 'normal');
          document.setFontSize(8);
          document.setTextColor(...item.color);
          item.lines.forEach((line) => {
            document.text(line, x + 5, textY);
            if (item.strike) {
              const lineWidth = Math.min(document.getTextWidth(line), valueWidth);
              document.setDrawColor(...item.color);
              document.line(x + 5, textY - 0.8, x + 5 + lineWidth, textY - 0.8);
            }
            textY += 4;
          });
        });
      });
      cursorY += height + 3;
    });
  };

  drawSection(getAuditEntityTitle(log.tabla_afectada), generalFields);
  drawSection('Especificaciones Técnicas', technicalFields);

  if (fieldNames.length === 0) {
    autoTable(document, {
      body: [['Este registro no contiene datos de cambios.']],
      startY: cursorY + 2,
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9, textColor: [100, 116, 139] },
    });
  }

  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    document.setFont('helvetica', 'normal');
    document.setFontSize(7);
    document.setTextColor(100, 116, 139);
    document.text('Este documento es una representación impresa del registro de auditoría.', margin, pageHeight - 8);
    document.text(`Generado por ${log.usuario || 'usuario del sistema'} el ${exportedAt}  ·  Página ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  document.save(`auditoria-registro-${log.id}.pdf`);
};

const exportExcel = async (logs) => {
  if (!logs.length) {
    return;
  }

  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Auditoría';
  workbook.created = new Date();

  const operations = [...new Set(logs.map((log) => normalizeOperation(log.operacion)))].sort();
  const actionTotals = new Map(operations.map((operation) => [operation, 0]));
  const moduleTotals = new Map();

  logs.forEach((log) => {
    const moduleName = log.tabla_afectada || 'Sin módulo';
    const operation = normalizeOperation(log.operacion);
    const counts = moduleTotals.get(moduleName) || Object.fromEntries([
      ...operations.map((operation) => [operation, 0]),
      ['total', 0],
    ]);

    counts[operation] += 1;
    actionTotals.set(operation, actionTotals.get(operation) + 1);
    counts.total += 1;
    moduleTotals.set(moduleName, counts);
  });

  const summary = workbook.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 4 }] });
  const summaryColumns = ['Módulo', ...operations, 'Total'];
  summary.mergeCells(1, 1, 1, summaryColumns.length);
  summary.getCell('A1').value = 'Resumen de auditoría';
  summary.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  summary.getCell('A1').alignment = { vertical: 'middle' };
  summary.getRow(1).height = 32;
  summary.mergeCells(2, 1, 2, summaryColumns.length);
  summary.getCell('A2').value = `Registros exportados: ${logs.length}`;
  summary.getCell('A2').font = { size: 11, color: { argb: 'FF475569' } };

  const moduleRows = Array.from(moduleTotals.entries())
    .sort(([first], [second]) => first.localeCompare(second, 'es'))
    .map(([moduleName, counts]) => [moduleName, ...operations.map((operation) => counts[operation]), counts.total]);
  moduleRows.push(['TOTAL GENERAL', ...operations.map((operation) => actionTotals.get(operation)), logs.length]);

  summary.addTable({
    name: 'ResumenAuditoria',
    ref: 'A4',
    headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: summaryColumns.map((name) => ({ name })),
    rows: moduleRows,
  });
  summaryColumns.forEach((_, index) => { summary.getColumn(index + 1).width = index === 0 ? 30 : 16; });
  const totalRow = summary.getRow(moduleRows.length + 4);
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  });

  const detail = workbook.addWorksheet('Detalle', { views: [{ state: 'frozen', ySplit: 1 }] });
  const isSessionExport = logs.every((log) => log.tabla_afectada?.toLowerCase() === 'autenticacion');
  const detailColumns = [
    { name: 'Fecha' },
    { name: 'Usuario' },
    { name: 'Email' },
    { name: 'Módulo' },
    { name: 'Acción' },
    { name: 'Registro ID' },
    ...(isSessionExport ? [{ name: 'Datos' }] : [{ name: 'Datos anteriores' }, { name: 'Datos nuevos' }]),
  ];
  const detailRows = logs.map((log) => [
    log.created_at ? new Date(log.created_at) : '',
    log.usuario || '',
    log.email || '',
    log.tabla_afectada || '',
    normalizeOperation(log.operacion),
    log.registro_id ?? '',
    ...(isSessionExport
      ? [log.datos_nuevos ? JSON.stringify(log.datos_nuevos, null, 2) : '']
      : [
        log.datos_anteriores ? JSON.stringify(log.datos_anteriores, null, 2) : '',
        log.datos_nuevos ? JSON.stringify(log.datos_nuevos, null, 2) : '',
      ]),
  ]);

  detail.addTable({
    name: 'DetalleAuditoria',
    ref: 'A1',
    headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: detailColumns,
    rows: detailRows,
  });
  const detailWidths = isSessionExport ? [22, 28, 32, 24, 18, 14, 64] : [22, 28, 32, 24, 16, 14, 48, 48];
  detailWidths.forEach((width, index) => { detail.getColumn(index + 1).width = width; });
  detail.getColumn(1).numFmt = 'dd/mm/yyyy hh:mm:ss';
  detailWidths.slice(6).forEach((_, index) => {
    detail.getColumn(index + 7).alignment = { vertical: 'top', wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const exportPdf = async (logs, { title = 'Registro de auditoría', filename } = {}) => {
  if (!logs.length) {
    return;
  }

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const document = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const exportedAt = new Date().toLocaleString('es-PE');

  const drawPageHeader = () => {
    document.setFont('helvetica', 'bold');
    document.setFontSize(16);
    document.setTextColor(15, 23, 42);
    document.text(title, margin, 17);
    document.setFontSize(8);
    document.setTextColor(71, 85, 105);
    document.text('TRIBUNAL CONSTITUCIONAL DEL PERÚ', pageWidth - margin, 13, { align: 'right' });
    document.setFont('helvetica', 'normal');
    document.text(`Exportado: ${exportedAt}   ·   Registros: ${logs.length}`, margin, 25);
    document.setDrawColor(203, 213, 225);
    document.line(margin, 31, pageWidth - margin, 31);
  };

  logs.forEach((log, index) => {
    if (index > 0) {
      document.addPage();
    }

    const operation = normalizeOperation(log.operacion);
    const previousFields = flattenAuditData(log.datos_anteriores);
    const currentFields = flattenAuditData(log.datos_nuevos);
    const isSessionEvent = log.tabla_afectada?.toLowerCase() === 'autenticacion';
    const isUpdate = operation === 'UPDATE';
    const isInsert = operation === 'INSERT';
    const isDelete = operation === 'DELETE';
    const fieldNames = [...new Set([...Object.keys(previousFields), ...Object.keys(currentFields)])];
    const changedFields = fieldNames.filter((name) => (
      !Object.hasOwn(previousFields, name)
      || !Object.hasOwn(currentFields, name)
      || formatAuditValue(previousFields[name]) !== formatAuditValue(currentFields[name])
    ));
    const dataFields = isUpdate ? changedFields : fieldNames;
    const sectionTitle = isSessionEvent
      ? 'Datos de sesión'
      : isUpdate
        ? 'Modificaciones detectadas'
        : isInsert
          ? 'Datos registrados'
          : isDelete
            ? 'Datos eliminados'
            : 'Datos del registro';
    const fieldGroups = [
      { title: getAuditEntityTitle(log.tabla_afectada), fields: dataFields.filter((name) => !isTechnicalField(name)) },
      { title: 'Especificaciones Técnicas', fields: dataFields.filter((name) => isTechnicalField(name)) },
    ].filter((group) => group.fields.length > 0);

    drawPageHeader();
    let cursorY = 39;
    document.setFillColor(248, 250, 252);
    document.setDrawColor(226, 232, 240);
    document.roundedRect(margin, cursorY, contentWidth, 43, 3, 3, 'FD');

    const columnWidth = (contentWidth - 18) / 2;
    const leftX = margin + 7;
    const rightX = margin + 7 + columnWidth + 4;
    const drawMetadataItem = (label, value, x, y) => {
      document.setFont('helvetica', 'bold');
      document.setFontSize(7);
      document.setTextColor(100, 116, 139);
      document.text(label.toLocaleUpperCase('es-PE'), x, y);
      document.setFontSize(9);
      document.setTextColor(15, 23, 42);
      document.text(document.splitTextToSize(String(value || '-'), columnWidth), x, y + 6);
    };

    drawMetadataItem('Fecha', log.created_at ? new Date(log.created_at).toLocaleString('es-PE') : '-', leftX, cursorY + 9);
    drawMetadataItem('Usuario', `${log.usuario || '-'}${log.email ? `\n${log.email}` : ''}`, rightX, cursorY + 9);
    drawMetadataItem('Módulo', log.tabla_afectada || '-', leftX, cursorY + 29);
    drawMetadataItem('Acción / Registro ID', `${operation}  ·  ID: ${log.registro_id ?? '-'}`, rightX, cursorY + 29);
    cursorY += 52;

    document.setFont('helvetica', 'bold');
    document.setFontSize(11);
    document.setTextColor(15, 23, 42);
    document.text(sectionTitle.toLocaleUpperCase('es-PE'), margin, cursorY + 5);
    cursorY += 9;

    if (fieldGroups.length === 0) {
      autoTable(document, {
        body: [[isUpdate ? 'No se detectaron cambios.' : 'Este registro no contiene datos adicionales.']],
        startY: cursorY,
        margin: { top: 36, right: margin, bottom: 15, left: margin },
        theme: 'plain',
        styles: { font: 'helvetica', fontSize: 9, textColor: [100, 116, 139] },
        didDrawPage: drawPageHeader,
      });
    }

    fieldGroups.forEach((group) => {
      if (fieldGroups.length > 1) {
        document.setFont('helvetica', 'bold');
        document.setFontSize(9);
        document.setTextColor(71, 85, 105);
        document.text(group.title, margin, cursorY + 5);
        cursorY += 8;
      }

      let head;
      let body;
      let columnStyles;

      if (isUpdate) {
        head = [['Campo', 'Valor anterior', '', 'Valor actual']];
        body = group.fields.map((name) => [
          name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' ').toLocaleUpperCase('es-PE'),
          Object.hasOwn(previousFields, name) ? formatAuditValue(previousFields[name]) : 'Sin dato previo',
          '→',
          Object.hasOwn(currentFields, name) ? formatAuditValue(currentFields[name]) : 'Sin dato actual',
        ]);
        columnStyles = {
          0: { cellWidth: 42, fontStyle: 'bold' },
          1: { cellWidth: 62, textColor: [185, 28, 28], fillColor: [254, 242, 242] },
          2: { cellWidth: 10, halign: 'center', textColor: [100, 116, 139] },
          3: { cellWidth: 62, textColor: [21, 128, 61], fillColor: [240, 253, 244] },
        };
      } else {
        const fieldMap = isDelete ? previousFields : currentFields;
        const valueHeading = isSessionEvent ? 'Dato' : isDelete ? 'Valor eliminado' : 'Valor registrado';
        head = [['Campo', valueHeading]];
        body = group.fields.map((name) => [
          name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' ').toLocaleUpperCase('es-PE'),
          formatAuditValue(fieldMap[name]),
        ]);
        columnStyles = {
          0: { cellWidth: 52, fontStyle: 'bold' },
          1: {
            cellWidth: 124,
            textColor: isDelete ? [185, 28, 28] : isSessionEvent ? [30, 64, 175] : [21, 128, 61],
            fillColor: isDelete ? [254, 242, 242] : isSessionEvent ? [239, 246, 255] : [240, 253, 244],
          },
        };
      }

      autoTable(document, {
        head,
        body,
        startY: cursorY,
        margin: { top: 36, right: margin, bottom: 15, left: margin },
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 3, overflow: 'linebreak', valign: 'top', lineColor: [226, 232, 240] },
        headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
        columnStyles,
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
        didDrawPage: drawPageHeader,
      });
      cursorY = document.lastAutoTable.finalY + 8;
    });
  });

  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    document.setFontSize(7);
    document.setTextColor(100, 116, 139);
    document.text('Documento oficial de auditoría.', margin, pageHeight - 8);
    document.text(`Página ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  document.save(filename || `auditoria-${new Date().toISOString().slice(0, 10)}.pdf`);
};

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfExporting, setPdfExporting] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState(() => new Set());
  const [quickSearch, setQuickSearch] = useState('');
  const [logType, setLogType] = useState('acciones');
  const logsRequestId = useRef(0);
  const [filters, setFilters] = useState({
    desde: '',
    hasta: '',
    usuario: '',
    modulo: 'Todos',
    accion: 'Todas',
  });
  const normalizedSearch = normalizeSearchText(quickSearch.trim());
  const categoryLogs = logs.filter((log) => (log.tabla_afectada?.toLowerCase() === 'autenticacion') === (logType === 'sesiones'));
  const visibleLogs = /^\d+$/.test(normalizedSearch)
    ? categoryLogs.filter((log) => String(log.registro_id ?? '') === normalizedSearch)
    : normalizedSearch
    ? categoryLogs
      .map((log) => ({ log, score: getAuditSearchScore(log, normalizedSearch) }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((first, second) => first.score - second.score)
      .map(({ log }) => log)
    : categoryLogs;
  const visibleModuleOptions = logType === 'sesiones' ? ['Todos', 'autenticacion'] : moduleOptions;
  const visibleActionOptions = logType === 'sesiones' ? ['Todas', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT'] : actionOptions;

  const toggleLogDetails = (logId) => {
    setExpandedLogs((current) => {
      const next = new Set(current);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const loadLogs = async (nextFilters = filters, nextLogType = logType) => {
    const requestId = logsRequestId.current + 1;
    logsRequestId.current = requestId;
    setLoading(true);
    setError('');

    try {
      const response = await api.getAuditoria({
        limit: 200,
        tipo: nextLogType,
        ...nextFilters,
        modulo: nextFilters.modulo === 'Todos' ? '' : nextFilters.modulo,
        accion: nextFilters.accion === 'Todas' ? '' : nextFilters.accion,
      });
      if (requestId === logsRequestId.current) {
        setLogs(response.data);
      }
    } catch (fetchError) {
      if (requestId === logsRequestId.current) {
        setError(fetchError?.response?.data?.error || 'No se pudo cargar el log de auditoría');
      }
    } finally {
      if (requestId === logsRequestId.current) {
        setLoading(false);
      }
    }
  };

  const loadUsuarios = async () => {
    try {
      const response = await api.getUsuarios();
      const usuarios = Array.isArray(response.data) ? response.data : [];
      setUsuariosDisponibles(usuarios.filter((usuario) => usuario?.estado !== 'inactivo' && usuario?.nombre));
    } catch (fetchError) {
      setUsuariosDisponibles([]);
    }
  };

  useEffect(() => {
    loadUsuarios();
    loadLogs();
  }, []);

  const canApply = useMemo(() => Object.values(filters).some((value) => value && value !== 'Todos' && value !== 'Todas'), [filters]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const clearFilters = () => {
    const reset = { desde: '', hasta: '', usuario: '', modulo: 'Todos', accion: 'Todas' };
    setFilters(reset);
    setQuickSearch('');
    loadLogs(reset, logType);
  };

  const applyFilters = () => {
    loadLogs(filters, logType);
  };

  const changeLogType = (nextLogType) => {
    const reset = { desde: '', hasta: '', usuario: '', modulo: 'Todos', accion: 'Todas' };
    setLogType(nextLogType);
    setFilters(reset);
    setQuickSearch('');
    setLogs([]);
    setExpandedLogs(new Set());
    loadLogs(reset, nextLogType);
  };

  const handleExport = async () => {
    try {
      setError('');
      await exportExcel(visibleLogs);
    } catch (exportError) {
      setError('No se pudo generar el archivo Excel de auditoría');
    }
  };

  const handleExportPdf = async () => {
    try {
      setError('');
      setPdfExporting(true);
      await exportPdf(visibleLogs);
    } catch (exportError) {
      setError('No se pudo generar el archivo PDF de auditoría');
    } finally {
      setPdfExporting(false);
    }
  };

  const handleExportLogPdf = async (log) => {
    try {
      setError('');
      await exportIndividualAuditPdf(log);
    } catch (exportError) {
      setError(`No se pudo generar el PDF del registro #${log.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Seguridad y administración</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Log de Auditoría</h2>
          <p className="mt-2 text-sm text-slate-500">Consulta la trazabilidad inmutable de las operaciones realizadas en el sistema.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={visibleLogs.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true">📤</span>
            Exportar Excel
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={visibleLogs.length === 0 || pdfExporting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true">📄</span>
            {pdfExporting ? 'Generando PDF...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      <div className="flex gap-6 border-b border-slate-200" role="tablist" aria-label="Tipo de log de auditoría">
        {[
          { id: 'acciones', label: 'Acciones' },
          { id: 'sesiones', label: 'Inicios de sesión' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={logType === tab.id}
            onClick={() => changeLogType(tab.id)}
            className={`border-b-2 px-1 pb-3 text-sm font-semibold transition ${logType === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <label htmlFor="audit-quick-search" className="mb-2 block text-sm font-medium text-slate-700">Búsqueda rápida</label>
            <div className="relative">
              <input
                id="audit-quick-search"
                type="search"
                value={quickSearch}
                onChange={(event) => setQuickSearch(event.target.value)}
                placeholder="Buscar por usuario, ID, módulo..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pl-10 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
              />
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Desde</label>
            <input
              type="date"
              name="desde"
              value={filters.desde}
              onChange={handleFilterChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Hasta</label>
            <input
              type="date"
              name="hasta"
              value={filters.hasta}
              onChange={handleFilterChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Usuario</label>
            <select
              name="usuario"
              value={filters.usuario}
              onChange={handleFilterChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
            >
              <option value="">Todos</option>
              {usuariosDisponibles.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nombre} {usuario.email ? `(${usuario.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Módulo</label>
            <select
              name="modulo"
              value={filters.modulo}
              onChange={handleFilterChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
            >
              {visibleModuleOptions.map((option) => (
                <option key={option} value={option}>{option === 'Todos' ? 'Todos' : normalizeModulo(option)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Acción</label>
            <select
              name="accion"
              value={filters.accion}
              onChange={handleFilterChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
            >
              {visibleActionOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={applyFilters}
            disabled={!canApply && !Object.values(filters).some((value) => value !== 'Todos' && value !== 'Todas')}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aplicar Filtros
          </button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-4">Fecha</th>
              <th className="px-5 py-4">Usuario</th>
              <th className="px-5 py-4">Módulo</th>
              <th className="px-5 py-4">Acción</th>
              <th className="px-5 py-4">Registro</th>
              <th className="px-5 py-4">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="6" className="px-5 py-12 text-center text-slate-500">Cargando registros...</td></tr>
            ) : visibleLogs.length === 0 ? (
              <tr><td colSpan="6" className="px-5 py-12 text-center text-slate-500">No se encontraron registros con esos filtros.</td></tr>
            ) : visibleLogs.map((log) => (
              <Fragment key={log.id}>
                <tr className="transition hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">{log.created_at ? new Date(log.created_at).toLocaleString('es-PE') : '-'}</td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{log.usuario}</p>
                    <p className="text-xs text-slate-500">{log.email || 'Correo no disponible'}</p>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-600">{log.tabla_afectada || '-'}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${operationStyles[log.operacion] || 'bg-slate-100 text-slate-700'}`}>
                      {log.operacion || '-'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{log.registro_id || '-'}</td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => toggleLogDetails(log.id)}
                      className="font-semibold text-blue-600 hover:text-blue-800"
                      aria-expanded={expandedLogs.has(log.id)}
                    >
                      {expandedLogs.has(log.id) ? 'Ocultar' : 'Ver'}
                    </button>
                  </td>
                </tr>
                {expandedLogs.has(log.id) && (
                  <tr className="bg-slate-50">
                    <td colSpan="6" className="px-5 py-5">
                      <div className="mb-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleExportLogPdf(log)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                        >
                          <span aria-hidden="true">📄</span>
                          Exportar este registro a PDF
                        </button>
                      </div>
                      {logType === 'sesiones' ? (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Datos</p>
                          <pre className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">{formatAuditData(log.datos_nuevos)}</pre>
                        </div>
                      ) : (
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Datos anteriores</p>
                            <pre className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">{formatAuditData(log.datos_anteriores)}</pre>
                          </div>
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Datos nuevos</p>
                            <pre className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">{formatAuditData(log.datos_nuevos)}</pre>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
