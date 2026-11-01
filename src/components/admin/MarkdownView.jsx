import React from 'react';

/** 인라인 마크다운 (볼드 **, 이탤릭 *, 인라인코드 `) 파싱 */
function parseInline(text) {
    if (!text) return null;
    const tokens = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
    let lastIndex = 0;
    let match;
    let keyIdx = 0;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            tokens.push(text.substring(lastIndex, match.index));
        }
        const token = match[0];
        if (token.startsWith('**') && token.endsWith('**')) {
            tokens.push(
                <strong key={`b-${keyIdx++}`} style={{ color: '#0f172a', fontWeight: 700 }}>
                    {token.slice(2, -2)}
                </strong>
            );
        } else if (token.startsWith('`') && token.endsWith('`')) {
            tokens.push(
                <code
                    key={`c-${keyIdx++}`}
                    style={{
                        background: '#f1f5f9',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontSize: '0.85em',
                        color: '#0369a1',
                        fontFamily: 'monospace',
                    }}
                >
                    {token.slice(1, -1)}
                </code>
            );
        } else if (token.startsWith('*') && token.endsWith('*')) {
            tokens.push(<em key={`i-${keyIdx++}`}>{token.slice(1, -1)}</em>);
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
        tokens.push(text.substring(lastIndex));
    }
    return tokens;
}

/** 마크다운 텍스트를 블록 단위로 파싱 */
function parseMarkdownBlocks(text) {
    if (!text) return [];
    const lines = text.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (!line.trim()) {
            i++;
            continue;
        }

        // 코드 블록
        if (line.trim().startsWith('```')) {
            const lang = line.trim().slice(3).trim();
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            if (i < lines.length) i++;
            blocks.push({ type: 'code', lang, text: codeLines.join('\n') });
            continue;
        }

        // 마크다운 표 감지 (| 기호 및 다음 줄 구분선 |---|)
        if (
            line.includes('|') &&
            i + 1 < lines.length &&
            /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[i + 1])
        ) {
            const headerLine = line;
            const alignLine = lines[i + 1];
            const alignTokens = alignLine
                .split('|')
                .map((s) => s.trim())
                .filter((s, idx, arr) => !(idx === 0 && s === '') && !(idx === arr.length - 1 && s === ''));
            const aligns = alignTokens.map((t) => {
                if (t.startsWith(':') && t.endsWith(':')) return 'center';
                if (t.endsWith(':')) return 'right';
                return 'left';
            });

            const parseRow = (r) => {
                const parts = r.split('|');
                let start = 0;
                let end = parts.length;
                if (parts[0].trim() === '') start = 1;
                if (parts[parts.length - 1].trim() === '') end = parts.length - 1;
                return parts.slice(start, end).map((c) => c.trim());
            };

            const headers = parseRow(headerLine);
            const rows = [];
            i += 2;
            while (i < lines.length && lines[i].includes('|')) {
                rows.push(parseRow(lines[i]));
                i++;
            }
            blocks.push({ type: 'table', headers, aligns, rows });
            continue;
        }

        // 수평선 (--- 또는 ***)
        if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line.trim())) {
            blocks.push({ type: 'hr' });
            i++;
            continue;
        }

        // 제목 (# ~ ######)
        const headMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headMatch) {
            blocks.push({ type: 'heading', level: headMatch[1].length, text: headMatch[2] });
            i++;
            continue;
        }

        // 인용구 (>)
        if (line.startsWith('>')) {
            const quoteLines = [];
            while (i < lines.length && lines[i].startsWith('>')) {
                quoteLines.push(lines[i].replace(/^>\s?/, ''));
                i++;
            }
            blocks.push({ type: 'blockquote', text: quoteLines.join('\n') });
            continue;
        }

        // 순서 없는 목록 (- 또는 * 또는 +)
        const isUl = /^[-*+]\s+(.*)$/.test(line.trim());
        const isOl = /^\d+\.\s+(.*)$/.test(line.trim());
        if (isUl || isOl) {
            const listType = isUl ? 'ul' : 'ol';
            const items = [];
            const regex = isUl ? /^[-*+]\s+(.*)$/ : /^\d+\.\s+(.*)$/;
            while (i < lines.length && regex.test(lines[i].trim())) {
                const match = lines[i].trim().match(regex);
                items.push(match[1]);
                i++;
            }
            blocks.push({ type: listType, items });
            continue;
        }

        // 일반 문단 (다음 특수 블록이 나오기 전까지 모음)
        const pLines = [];
        while (
            i < lines.length &&
            lines[i].trim() &&
            !lines[i].trim().startsWith('```') &&
            !lines[i].trim().startsWith('>') &&
            !lines[i].trim().startsWith('#') &&
            !/^(\*{3,}|-{3,}|_{3,})\s*$/.test(lines[i].trim()) &&
            !(
                lines[i].includes('|') &&
                i + 1 < lines.length &&
                /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[i + 1])
            ) &&
            !/^[-*+]\s+/.test(lines[i].trim()) &&
            !/^\d+\.\s+/.test(lines[i].trim())
        ) {
            pLines.push(lines[i]);
            i++;
        }
        blocks.push({ type: 'paragraph', text: pLines.join('\n') });
    }
    return blocks;
}

/** 표 셀 스마트 렌더링 (현재고, 추천수량, 주거래처 등 하이라이트) */
function SmartTableCell({ header, value }) {
    const raw = String(value || '').trim();
    // 볼드 마크다운 제거하여 순수 텍스트 값 검사
    const clean = raw.replace(/\*\*/g, '').trim();

    const isStockHeader = header.includes('재고') || header.includes('현재고');
    const isQtyHeader = header.includes('추천') || header.includes('수량') || header.includes('발주');
    const isVendorHeader = header.includes('거래처');

    // 현재고/재고 컬럼
    if (isStockHeader) {
        const num = parseFloat(clean.replace(/[^0-9.-]/g, ''));
        if (!isNaN(num)) {
            if (num < 0) {
                return (
                    <span
                        style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            borderRadius: '4px',
                            fontWeight: 800,
                            fontSize: '0.76rem',
                        }}
                    >
                        {clean}
                    </span>
                );
            }
            if (num === 0) {
                return (
                    <span
                        style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            background: '#ffedd5',
                            color: '#c2410c',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '0.76rem',
                        }}
                    >
                        0 (품절)
                    </span>
                );
            }
            return <span style={{ color: '#15803d', fontWeight: 600 }}>{clean}</span>;
        }
    }

    // 추천 수량 컬럼
    if (isQtyHeader) {
        return (
            <span
                style={{
                    display: 'inline-block',
                    padding: '2px 7px',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    borderRadius: '4px',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                }}
            >
                {clean}
            </span>
        );
    }

    // 주거래처 컬럼
    if (isVendorHeader) {
        if (clean === '-' || clean === '미지정' || !clean) {
            return <span style={{ color: '#94a3b8' }}>-</span>;
        }
        return <span style={{ color: '#334155', fontWeight: 600 }}>{clean}</span>;
    }

    return parseInline(raw);
}

/** 마크다운 표 렌더러 */
function MarkdownTable({ block, onAction }) {
    const { headers, aligns, rows } = block;

    // 주거래처 목록 추출 (빠른 액션 버튼용)
    const vendorColIdx = headers.findIndex((h) => h.includes('거래처'));
    let vendors = [];
    if (vendorColIdx !== -1) {
        const set = new Set();
        rows.forEach((r) => {
            const val = (r[vendorColIdx] || '').replace(/\*\*/g, '').trim();
            if (val && val !== '-' && val !== '미지정' && val !== '없음') {
                set.add(val);
            }
        });
        vendors = Array.from(set);
    }

    return (
        <div style={{ margin: '10px 0' }}>
            <div
                style={{
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
            >
                <table
                    style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.78rem',
                        textAlign: 'left',
                    }}
                >
                    <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                            {headers.map((h, hi) => (
                                <th
                                    key={hi}
                                    style={{
                                        padding: '7px 8px',
                                        color: '#334155',
                                        fontWeight: 700,
                                        fontSize: '0.75rem',
                                        textAlign: aligns[hi] || 'left',
                                        whiteSpace: 'nowrap',
                                        borderRight: hi < headers.length - 1 ? '1px solid #e2e8f0' : 'none',
                                    }}
                                >
                                    {parseInline(h)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, ri) => (
                            <tr
                                key={ri}
                                style={{
                                    background: ri % 2 === 1 ? '#f8fafc' : '#ffffff',
                                    borderBottom: ri < rows.length - 1 ? '1px solid #e2e8f0' : 'none',
                                    transition: 'background 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f1f5f9';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = ri % 2 === 1 ? '#f8fafc' : '#ffffff';
                                }}
                            >
                                {row.map((cell, ci) => (
                                    <td
                                        key={ci}
                                        style={{
                                            padding: '6px 8px',
                                            textAlign: aligns[ci] || 'left',
                                            fontSize: '0.75rem',
                                            whiteSpace: 'nowrap',
                                            color: '#1e293b',
                                            borderRight: ci < row.length - 1 ? '1px solid #f1f5f9' : 'none',
                                        }}
                                    >
                                        <SmartTableCell header={headers[ci] || ''} value={cell} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 거래처별 빠른 발주서 작성 버튼 칩 */}
            {vendors.length > 0 && onAction && (
                <div
                    style={{
                        marginTop: '8px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        alignItems: 'center',
                    }}
                >
                    <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                        ⚡ 바로 발주서 초안 작성:
                    </span>
                    {vendors.map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => onAction(`${v} 발주서 초안 작성해줘`)}
                            style={{
                                border: '1px solid #bfdbfe',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                borderRadius: '14px',
                                padding: '3px 9px',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#dbeafe';
                                e.currentTarget.style.borderColor = '#93c5fd';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#eff6ff';
                                e.currentTarget.style.borderColor = '#bfdbfe';
                            }}
                        >
                            <span>📝</span> {v}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/** 마크다운 전체 뷰 컴포넌트 */
export default function MarkdownView({ text, onAction }) {
    if (!text) return null;
    const blocks = parseMarkdownBlocks(text);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.86rem', lineHeight: 1.6 }}>
            {blocks.map((block, idx) => {
                switch (block.type) {
                    case 'table':
                        return <MarkdownTable key={idx} block={block} onAction={onAction} />;

                    case 'heading': {
                        const Tag = `h${Math.min(block.level, 4)}`;
                        const sizes = { 1: '1.08rem', 2: '0.98rem', 3: '0.92rem', 4: '0.86rem' };
                        return (
                            <Tag
                                key={idx}
                                style={{
                                    fontSize: sizes[block.level] || '0.9rem',
                                    fontWeight: 700,
                                    margin: '8px 0 2px',
                                    color: '#0f172a',
                                }}
                            >
                                {parseInline(block.text)}
                            </Tag>
                        );
                    }

                    case 'ul':
                        return (
                            <ul key={idx} style={{ margin: '4px 0 6px 18px', padding: 0, color: '#334155' }}>
                                {block.items.map((item, ii) => (
                                    <li key={ii} style={{ margin: '2px 0' }}>
                                        {parseInline(item)}
                                    </li>
                                ))}
                            </ul>
                        );

                    case 'ol':
                        return (
                            <ol key={idx} style={{ margin: '4px 0 6px 18px', padding: 0, color: '#334155' }}>
                                {block.items.map((item, ii) => (
                                    <li key={ii} style={{ margin: '2px 0' }}>
                                        {parseInline(item)}
                                    </li>
                                ))}
                            </ol>
                        );

                    case 'blockquote':
                        return (
                            <div
                                key={idx}
                                style={{
                                    borderLeft: '3px solid #3b82f6',
                                    padding: '6px 12px',
                                    margin: '6px 0',
                                    background: '#eff6ff',
                                    borderRadius: '0 6px 6px 0',
                                    color: '#1e40af',
                                    fontSize: '0.84rem',
                                }}
                            >
                                {parseInline(block.text)}
                            </div>
                        );

                    case 'code':
                        return (
                            <pre
                                key={idx}
                                style={{
                                    background: '#0f172a',
                                    color: '#f8fafc',
                                    padding: '10px 12px',
                                    borderRadius: '6px',
                                    overflowX: 'auto',
                                    fontSize: '0.78rem',
                                    fontFamily: 'monospace',
                                    margin: '6px 0',
                                }}
                            >
                                <code>{block.text}</code>
                            </pre>
                        );

                    case 'hr':
                        return (
                            <hr
                                key={idx}
                                style={{
                                    border: 'none',
                                    borderTop: '1px solid #e2e8f0',
                                    margin: '10px 0',
                                }}
                            />
                        );

                    case 'paragraph':
                    default:
                        return (
                            <div key={idx} style={{ whiteSpace: 'pre-line', color: '#1e293b' }}>
                                {parseInline(block.text)}
                            </div>
                        );
                }
            })}
        </div>
    );
}
