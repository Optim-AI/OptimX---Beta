// Small, safe markdown renderer for agent replies: headings, lists, tables, **bold**, _italic_, links.
// Builds React elements only (no HTML injection).
import React from "react";
import colors from "@/lib/ui/colors";

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|(?:^|(?<=[\s(]))[_*][^_*\n]+[_*](?=[\s).,!?;:]|$)|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${keyBase}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k} style={{ color: colors.foreground }}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("[")) {
      const mm = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(t);
      out.push(mm ? <a key={k} href={mm[2]} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: colors.accentForeground }}>{mm[1]}</a> : t);
    } else if (t.startsWith("`")) out.push(<code key={k} className="rounded px-1 text-[0.9em]" style={{ background: colors.secondary }}>{t.slice(1, -1)}</code>);
    else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export default function AgentMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { i++; continue; }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      blocks.push(<hr key={k++} className="my-4 border-0 border-t" style={{ borderColor: colors.border }} />);
      i++; continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    if (h) {
      blocks.push(<h3 key={k++} className={`${h[1].length <= 2 ? "text-base" : "text-[15px]"} mt-4 mb-1.5 font-semibold first:mt-0`} style={{ color: colors.foreground }}>{inline(h[2].replace(/\*\*/g, ""), `h${k}`)}</h3>);
      i++; continue;
    }

    if (t.startsWith("|") && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1].trim())) {
      const head = cells(t);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={k++} className="my-3 overflow-x-auto rounded-lg border" style={{ borderColor: colors.border }}>
          <table className="w-full text-left text-[13px]">
            <thead style={{ background: colors.secondary }}>
              <tr>{head.map((c, j) => <th key={j} className="px-3 py-2 font-medium" style={{ color: colors.foreground }}>{inline(c, `th${k}${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t" style={{ borderColor: colors.border }}>
                  {r.map((c, j) => <td key={j} className="px-3 py-2 align-top">{inline(c, `td${k}${ri}${j}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^([-*•])\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
      const ordered = /^\d+[.)]\s+/.test(t);
      const items: string[] = [];
      while (i < lines.length) {
        const x = lines[i].trim();
        if (ordered ? /^\d+[.)]\s+/.test(x) : /^([-*•])\s+/.test(x)) items.push(x.replace(ordered ? /^\d+[.)]\s+/ : /^([-*•])\s+/, ""));
        else if (x && /^\s{2,}/.test(lines[i]) && items.length) items[items.length - 1] += ` ${x}`;
        else break;
        i++;
      }
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={k++} className={`my-2 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((it, j) => <li key={j}>{inline(it, `li${k}${j}`)}</li>)}
        </Tag>
      );
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|[-*•]\s|\d+[.)]\s|\||-{3,}$|\*{3,}$)/.test(lines[i].trim())) para.push(lines[i++].trim());
    if (!para.length) { para.push(t); i++; }
    blocks.push(<p key={k++} className="my-2 first:mt-0 last:mb-0">{inline(para.join(" "), `p${k}`)}</p>);
  }
  return <div className="text-[14.5px] leading-relaxed" style={{ color: colors.secondaryForeground }}>{blocks}</div>;
}
