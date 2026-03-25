import * as XLSX from 'xlsx';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { logger } from './logger.js';

/**
 * 写入 CSV 文件
 */
export async function writeCsv(filePath, headers, records) {
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: headers.map(h => ({ id: h.id, title: h.title })),
    encoding: 'utf-8',
    append: false,
  });
  
  // 写 BOM 以支持 Excel 打开中文
  fs.writeFileSync(filePath, '\uFEFF', 'utf-8');
  
  const csvWriterAppend = createObjectCsvWriter({
    path: filePath,
    header: headers.map(h => ({ id: h.id, title: h.title })),
    encoding: 'utf-8',
    append: true,
  });
  
  // 先写表头（用原始 writer 会自动写表头）
  // 处理 BOM + 表头
  const headerLine = headers.map(h => h.title).join(',');
  fs.writeFileSync(filePath, '\uFEFF' + headerLine + '\n', 'utf-8');
  
  // 追加数据行
  if (records.length > 0) {
    const dataLines = records.map(r => {
      return headers.map(h => {
        const val = String(r[h.id] || '');
        // 包含逗号、换行、引号的字段需要用引号包裹
        if (val.includes(',') || val.includes('\n') || val.includes('"')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',');
    }).join('\n');
    fs.appendFileSync(filePath, dataLines + '\n', 'utf-8');
  }
  
  logger.info(`已写入 CSV: ${filePath} (${records.length} 条记录)`);
}

/**
 * 读取 CSV 文件
 */
export function readCsv(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  // 移除 BOM
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
}

/**
 * 写入 Excel 文件
 */
export function writeExcel(filePath, sheetName, data) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filePath);
  logger.info(`已写入 Excel: ${filePath} (${data.length} 条记录)`);
}

/**
 * 读取 Excel 文件
 */
export function readExcel(filePath, sheetIndex = 0) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[sheetIndex]];
  return XLSX.utils.sheet_to_json(ws);
}
