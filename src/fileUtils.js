/* ------------------------------------------------------------------ *
 * 檔案匯入（CSV / TXT / Excel，含 Big5 編碼處理）與匯出（CSV / Excel）
 * ------------------------------------------------------------------ */

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

// ---------- 編碼處理 ----------
export function decodeBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes), encoding: 'UTF-16' };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes), encoding: 'UTF-16' };
  }
  // 先嚴格嘗試 UTF-8；失敗代表很可能是 Big5（舊版 Excel 另存的 CSV 常見）
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text: text.replace(/^\uFEFF/, ''), encoding: 'UTF-8' };
  } catch {
    /* fall through */
  }
  try {
    return { text: new TextDecoder('big5').decode(bytes), encoding: 'Big5' };
  } catch {
    throw new Error('無法辨識檔案編碼，請另存為 UTF-8 的 CSV，或直接使用 Excel (.xlsx) 檔。');
  }
}

// ---------- CSV 解析（支援引號、逗號 / Tab 分隔）----------
export function parseDelimited(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (!firstLine.includes(',') && firstLine.includes('，')) delimiter = '，';
  else if (!firstLine.includes(',') && firstLine.includes(';')) delimiter = ';';

  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell); cell = '';
    } else if (ch === '\n') {
      row.push(cell); rows.push(row); row = []; cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ---------- 讀取上傳檔案 ----------
export async function parseListFile(file) {
  if (file.size === 0) throw new Error('檔案是空的，沒有任何內容。');
  if (file.size > MAX_FILE_SIZE) throw new Error('檔案過大（上限 5 MB），請拆分後再上傳。');
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const buffer = await file.arrayBuffer();

  if (['csv', 'txt', 'tsv'].includes(ext)) {
    const { text, encoding } = decodeBuffer(buffer);
    if (text.includes('\uFFFD')) {
      throw new Error('檔案內容有無法辨識的亂碼，請另存為 UTF-8 的 CSV，或直接使用 Excel (.xlsx) 檔。');
    }
    return { rows: parseDelimited(text), encoding };
  }
  if (['xlsx', 'xls'].includes(ext)) {
    let XLSX;
    try {
      XLSX = await import('xlsx');
    } catch {
      throw new Error('Excel 讀取模組載入失敗，請確認已執行 npm install，或改用 CSV 檔。');
    }
    let wb;
    try {
      wb = XLSX.read(buffer, { type: 'array' });
    } catch {
      throw new Error('無法讀取此 Excel 檔，檔案可能已損毀或有密碼保護。');
    }
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) throw new Error('Excel 檔裡沒有任何工作表。');
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    return { rows, encoding: 'Excel' };
  }
  throw new Error('不支援的檔案格式，請上傳 .csv、.txt、.xlsx 或 .xls。');
}

// ---------- 把資料列轉成邀請名單，並做格式檢查 ----------
const HEADER_ALIASES = {
  name: ['姓名', '名字', '來賓', '來賓姓名', 'name'],
  unit: ['單位', '服務單位', '機關', '學校', '機關單位', 'unit', 'organization'],
  title: ['職稱', '職務', 'title'],
};

export function rowsToInvitees(rows) {
  const numbered = rows
    .map((r, i) => ({ cells: r.map((c) => String(c ?? '').trim()), line: i + 1 }))
    .filter((x) => x.cells.some((c) => c !== ''));

  if (numbered.length === 0) {
    return { invitees: [], errors: [{ line: 0, message: '檔案裡沒有任何資料列。' }], duplicates: 0 };
  }
  if (numbered.length > MAX_ROWS) {
    return { invitees: [], errors: [{ line: 0, message: `一次最多匯入 ${MAX_ROWS} 筆，請拆分檔案。` }], duplicates: 0 };
  }

  const head = numbered[0].cells.map((c) => c.toLowerCase());
  const findCol = (key) => head.findIndex((c) => HEADER_ALIASES[key].map((a) => a.toLowerCase()).includes(c));
  const nameCol = findCol('name');
  const unitCol = findCol('unit');
  const titleCol = findCol('title');

  let map = { name: 0, unit: 1, title: 2 };
  let start = 0;
  if (nameCol !== -1) {
    map = { name: nameCol, unit: unitCol, title: titleCol };
    start = 1;
  } else if (unitCol !== -1 || titleCol !== -1) {
    return {
      invitees: [],
      errors: [{ line: numbered[0].line, message: '標題列找不到「姓名」欄位，請確認欄位名稱為：姓名、單位、職稱。' }],
      duplicates: 0,
    };
  }

  const errors = [];
  const invitees = [];
  const seen = new Set();
  let duplicates = 0;

  numbered.slice(start).forEach(({ cells, line }) => {
    const name = cells[map.name] || '';
    const unit = map.unit >= 0 ? cells[map.unit] || '' : '';
    const title = map.title >= 0 ? cells[map.title] || '' : '';
    if (!name) { errors.push({ line, message: '缺少姓名' }); return; }
    if (name.length > 50) { errors.push({ line, message: `姓名過長（${name.length} 字）` }); return; }
    if (unit.length > 100 || title.length > 100) { errors.push({ line, message: '單位或職稱過長（上限 100 字）' }); return; }
    const key = `${name}|${unit}|${title}`;
    if (seen.has(key)) { duplicates += 1; return; }
    seen.add(key);
    invitees.push({ name, unit, title });
  });

  return { invitees, errors, duplicates };
}

// ---------- 匯出 ----------
const csvEscape = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // 避免 Excel 公式注入
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
};

export function buildCSV(rows) {
  // 加上 UTF-8 BOM，Excel 才能正確顯示中文
  return `\uFEFF${rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')}`;
}

export function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });

const safeName = (s) => String(s || '活動').replace(/[\\/:*?"<>|]/g, '_').trim() || '活動';
const todayStamp = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }).replace(/-/g, '');

const guestRows = (guests) => [
  ['序號', '姓名', '單位', '職稱', '簽到時間'],
  ...guests.map((g) => [g.seq_num, g.name, g.unit || '', g.title || '', g.sign_in_time ? formatDateTime(g.sign_in_time) : '']),
];

export function exportGuestsCSV(guests, eventName) {
  downloadBlob(buildCSV(guestRows(guests)), `${safeName(eventName)}_簽到紀錄_${todayStamp()}.csv`, 'text/csv;charset=utf-8');
}

export async function exportGuestsXLSX(guests, eventName) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(guestRows(guests));
  ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '簽到紀錄');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(out, `${safeName(eventName)}_簽到紀錄_${todayStamp()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export function downloadTemplate() {
  const rows = [
    ['姓名', '單位', '職稱'],
    ['王小明', '教育局', '科長'],
    ['陳美玲', '青山里辦公室', '里長'],
  ];
  downloadBlob(buildCSV(rows), '邀請名單範本.csv', 'text/csv;charset=utf-8');
}
