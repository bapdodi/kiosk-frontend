// 거래명세서 생성/인쇄 유틸
import * as XLSX from 'xlsx';

const SUPPLIER_NAME = '동광배관자재';

/** 상호가 "0" 인 손님은 부가세 없이(합계만) 발행한다. */
const isVatExempt = (order) => String(order?.customerName ?? '').trim() === '0';

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const won = (n) => Number(n || 0).toLocaleString('ko-KR');

/**
 * 동일 품목/옵션을 합쳐 명세서 행으로 변환한다.
 * 단가는 실청구가(chargedPrice) 우선, 없으면 소비자가(finalPrice).
 */
export const buildStatementRows = (items = []) => Object.values(
    items.reduce((acc, item) => {
        const key = `${item.name}-${item.selectedOption || ''}`;
        const unitPrice = (item.chargedPrice ?? item.finalPrice) || 0;
        const quantity = item.quantity || 1;

        if (!acc[key]) {
            acc[key] = {
                name: item.name,
                option: item.selectedOption || '',
                unitPrice,
                quantity,
                amount: unitPrice * quantity
            };
        } else {
            acc[key].quantity += quantity;
            acc[key].amount += unitPrice * quantity;
        }
        return acc;
    }, {})
);

const formatDate = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`;
};

const MIN_ROWS = 12;

// 단가(chargedPrice)는 ERP 의 거래처 DANGA 단가 = 부가세 별도 공급가액이다.
// ERP(ErpSyncService) 는 라인별로 GUM = 단가×수량, VAT = GUM/10 을 적재하므로
// 명세서도 라인 단위 절사로 동일하게 계산해 ERP 청구액과 어긋나지 않게 한다.
const computeStatementAmounts = (order, rows) => {
    const items = order.items || [];
    const showVat = !isVatExempt(order);
    const supplyAmount = rows.reduce((sum, r) => sum + r.amount, 0);
    const vatAmount = showVat
        ? items.reduce((sum, item) => {
            const unitPrice = (item.chargedPrice ?? item.finalPrice) || 0;
            return sum + Math.floor((unitPrice * (item.quantity || 1)) / 10);
        }, 0)
        : 0;
    return { showVat, supplyAmount, vatAmount, total: supplyAmount + vatAmount };
};

export const buildStatementHtml = (order) => {
    const items = order.items || [];
    const rows = buildStatementRows(items);
    const { showVat, supplyAmount, vatAmount, total } = computeStatementAmounts(order, rows);

    const bodyRows = rows.map((r) => `
        <tr>
            <td class="c-name">${escapeHtml(r.name)}</td>
            <td class="c-spec">${escapeHtml(r.option)}</td>
            <td class="c-num">${won(r.quantity)}</td>
            <td class="c-num">${won(r.unitPrice)}</td>
            <td class="c-num">${won(r.amount)}</td>
        </tr>`).join('');

    const padRows = Array.from(
        { length: Math.max(0, MIN_ROWS - rows.length) },
        () => '<tr><td class="c-name">&nbsp;</td><td></td><td></td><td></td><td></td></tr>'
    ).join('');

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>거래명세서 - ${escapeHtml(order.customerName)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Malgun Gothic", "맑은 고딕", AppleGothic, sans-serif;
    color: #000; margin: 0; font-size: 12px;
  }
  h1 { text-align: center; font-size: 26px; letter-spacing: 14px; margin: 0 0 4px; font-weight: 800; }
  .subtitle { text-align: center; font-size: 11px; color: #444; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; }
  .head td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
  .head .label { background: #f2f2f2; text-align: center; width: 26px; font-weight: 700; }
  .head .key { background: #f8f8f8; text-align: center; width: 58px; white-space: nowrap; }
  .head .val { padding-left: 8px; }
  .head-wrap { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 10px; }
  .head-wrap > div { flex: 1; }
  .total-box { border: 1px solid #000; padding: 8px 10px; margin-bottom: 10px; display: flex;
    justify-content: space-between; align-items: center; background: #f8f8f8; }
  .total-box .amount { font-size: 20px; font-weight: 800; }
  .items th, .items td { border: 1px solid #000; padding: 5px 6px; }
  .items th { background: #f2f2f2; text-align: center; font-weight: 700; }
  .items .c-name { width: 40%; }
  .items .c-spec { width: 20%; }
  .items .c-num { text-align: right; white-space: nowrap; }
  .items tfoot td { font-weight: 800; background: #f8f8f8; }
  .footer { margin-top: 12px; text-align: right; font-size: 11px; color: #333; }
  .sign { margin-top: 26px; text-align: right; font-size: 12px; }
</style>
</head>
<body>
  <h1>거 래 명 세 서</h1>
  <div class="subtitle">(공급받는자 보관용)</div>

  <div class="head-wrap">
    <div>
      <table class="head">
        <tr>
          <td class="label" rowspan="3">공급<br/>받는<br/>자</td>
          <td class="key">상호</td>
          <td class="val">${escapeHtml(order.customerName)}</td>
        </tr>
        <tr><td class="key">거래일자</td><td class="val">${escapeHtml(formatDate(order.timestamp))}</td></tr>
        <tr><td class="key">전표번호</td><td class="val">${escapeHtml(order.id)}</td></tr>
      </table>
    </div>
    <div>
      <table class="head">
        <tr>
          <td class="label">공급자</td>
          <td class="key">상호</td>
          <td class="val">${escapeHtml(SUPPLIER_NAME)}</td>
        </tr>
      </table>
    </div>
  </div>

  <div class="total-box">
    <span>합계금액${showVat ? ' (부가세 포함)' : ''}</span>
    <span class="amount">₩ ${won(total)}</span>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>품목</th>
        <th>규격/옵션</th>
        <th style="width:12%">수량</th>
        <th style="width:14%">단가</th>
        <th style="width:16%">금액</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
      ${padRows}
    </tbody>
    <tfoot>
      ${showVat ? `
      <tr><td colspan="4" style="text-align:right">공급가액</td><td class="c-num">${won(supplyAmount)}</td></tr>
      <tr><td colspan="4" style="text-align:right">부가세</td><td class="c-num">${won(vatAmount)}</td></tr>` : ''}
      <tr><td colspan="4" style="text-align:right">합계</td><td class="c-num">${won(total)}</td></tr>
    </tfoot>
  </table>

  <div class="footer">인쇄일: ${escapeHtml(formatDate(new Date().toISOString()))}</div>

  <div class="sign">인수자 : ______________________ (서명)</div>
</body>
</html>`;
};

/**
 * 숨김 iframe 으로 인쇄한다. (팝업 차단 영향 없음)
 */
export const printStatement = (order) => {
    const html = buildStatementHtml(order);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const cleanup = () => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    iframe.onload = () => {
        const win = iframe.contentWindow;
        if (!win) {
            cleanup();
            return;
        }
        win.focus();
        win.print();
        // 인쇄 대화상자가 닫힌 뒤 정리 (브라우저별 타이밍 편차 대비)
        window.setTimeout(cleanup, 1000);
    };

    const doc = iframe.contentWindow?.document;
    if (!doc) {
        cleanup();
        return;
    }
    doc.open();
    doc.write(html);
    doc.close();
};

/**
 * 거래명세서를 엑셀(.xlsx) 파일로 내려받는다.
 */
export const exportStatementXlsx = (order) => {
    const rows = buildStatementRows(order.items || []);
    const { showVat, supplyAmount, vatAmount, total } = computeStatementAmounts(order, rows);

    const aoa = [
        ['거래명세서'],
        [],
        ['공급받는자', order.customerName, '', '거래일자', formatDate(order.timestamp)],
        ['공급자', SUPPLIER_NAME, '', '전표번호', order.id],
        [],
        ['품목', '규격/옵션', '수량', '단가', '금액'],
        ...rows.map((r) => [r.name, r.option, r.quantity, r.unitPrice, r.amount]),
        [],
        ...(showVat ? [['', '', '', '공급가액', supplyAmount], ['', '', '', '부가세', vatAmount]] : []),
        ['', '', '', '합계', total]
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 8 }, { wch: 12 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '거래명세서');
    XLSX.writeFile(wb, `거래명세서_${order.customerName}_${order.id}.xlsx`);
};
