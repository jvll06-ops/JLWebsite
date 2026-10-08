// Minimal text extraction for the PDFs Chrome prints (Type0 / Identity-H
// fonts with ToUnicode maps), so the checks can read a resume the way an ATS
// does: the page's content stream, glyph codes mapped back to Unicode. No
// layout analysis; words come out in paint order.
import { PDFArray, PDFDict, PDFName, PDFRawStream, PDFRef, PDFStream, decodePDFRawStream } from 'pdf-lib';

const BACKSLASH = 92;

function streamBytes(stream) {
  if (stream instanceof PDFRawStream) return decodePDFRawStream(stream).decode();
  if (stream instanceof PDFStream) return stream.getContents();
  return new Uint8Array();
}

const latin1 = (bytes) => Buffer.from(bytes).toString('latin1');

/** UTF-16BE hex (from a CMap) to a string. */
function utf16(hex) {
  let out = '';
  for (let i = 0; i + 4 <= hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return out;
}

/** Parse a ToUnicode CMap into { bytes, map: Map<code, string> }. */
function parseCMap(text) {
  const map = new Map();
  let bytes = 2;
  const space = /begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(text);
  if (space) bytes = space[1].length / 2;
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) map.set(parseInt(m[1], 16), utf16(m[2]));
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      if (m[3].startsWith('[')) {
        const list = [...m[3].matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => utf16(x[1]));
        for (let c = lo; c <= hi; c++) map.set(c, list[c - lo] ?? '');
      } else {
        const hex = m[3].slice(1, -1);
        const base = utf16(hex);
        const last = base.charCodeAt(base.length - 1);
        for (let c = lo; c <= hi; c++) map.set(c, base.slice(0, -1) + String.fromCharCode(last + (c - lo)));
      }
    }
  }
  return { bytes, map };
}

function fontDecoders(doc, resources) {
  const decoders = new Map();
  const fonts = resources?.lookupMaybe(PDFName.of('Font'), PDFDict);
  if (!fonts) return decoders;
  for (const [key, ref] of fonts.entries()) {
    const font = doc.context.lookup(ref, PDFDict);
    const toUnicode = font.lookup(PDFName.of('ToUnicode'));
    decoders.set(key.decodeText(), toUnicode ? parseCMap(latin1(streamBytes(toUnicode))) : { bytes: 1, map: new Map() });
  }
  return decoders;
}

/** Tokenize a content stream into operands and operators. */
function* tokens(src) {
  const n = src.length;
  let i = 0;
  const isSpace = (c) => c === 32 || c === 10 || c === 13 || c === 9 || c === 12 || c === 0;
  const isDelim = (c) => isSpace(c) || '()<>[]{}/%'.includes(String.fromCharCode(c));
  while (i < n) {
    const c = src[i];
    if (isSpace(c)) {
      i++;
    } else if (c === 37 /* % */) {
      while (i < n && src[i] !== 10 && src[i] !== 13) i++;
    } else if (c === 40 /* ( */) {
      const out = [];
      let depth = 1;
      i++;
      while (i < n && depth > 0) {
        const d = src[i++];
        if (d === BACKSLASH) {
          const e = src[i++];
          const map = { 110: 10, 114: 13, 116: 9, 98: 8, 102: 12 };
          if (e >= 48 && e <= 55) {
            let oct = e - 48;
            for (let k = 0; k < 2 && src[i] >= 48 && src[i] <= 55; k++) oct = oct * 8 + (src[i++] - 48);
            out.push(oct & 255);
          } else if (e === 10 || e === 13) {
            if (e === 13 && src[i] === 10) i++;
          } else out.push(map[e] ?? e);
        } else {
          if (d === 40) depth++;
          if (d === 41) depth--;
          if (depth > 0) out.push(d);
        }
      }
      yield { type: 'string', bytes: out };
    } else if (c === 60 /* < */ && src[i + 1] === 60) {
      i += 2;
      yield { type: 'dict-open' };
    } else if (c === 62 /* > */ && src[i + 1] === 62) {
      i += 2;
      yield { type: 'dict-close' };
    } else if (c === 60) {
      let hex = '';
      i++;
      while (i < n && src[i] !== 62) hex += String.fromCharCode(src[i++]);
      i++;
      hex = hex.replace(/\s+/g, '');
      if (hex.length % 2) hex += '0';
      const out = [];
      for (let k = 0; k < hex.length; k += 2) out.push(parseInt(hex.slice(k, k + 2), 16));
      yield { type: 'string', bytes: out };
    } else if (c === 91 /* [ */ || c === 93 /* ] */) {
      i++;
      yield { type: c === 91 ? 'array-open' : 'array-close' };
    } else if (c === 47 /* / */) {
      let name = '';
      i++;
      while (i < n && !isDelim(src[i])) name += String.fromCharCode(src[i++]);
      yield { type: 'name', value: name };
    } else {
      let word = '';
      while (i < n && !isDelim(src[i])) word += String.fromCharCode(src[i++]);
      if (!word) {
        i++;
        continue;
      }
      if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) yield { type: 'number', value: Number(word) };
      else yield { type: 'op', value: word };
    }
  }
}

function decode(bytes, decoder) {
  if (!decoder) return '';
  let out = '';
  for (let i = 0; i + decoder.bytes <= bytes.length; i += decoder.bytes) {
    let code = 0;
    for (let k = 0; k < decoder.bytes; k++) code = code * 256 + bytes[i + k];
    out += decoder.map.get(code) ?? '';
  }
  return out;
}

function contentText(doc, bytes, resources, depth = 0) {
  const decoders = fontDecoders(doc, resources);
  const xobjects = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict);
  let text = '';
  let font;
  const stack = [];
  let array = null;
  for (const t of tokens(bytes)) {
    if (t.type === 'array-open') array = [];
    else if (t.type === 'array-close') {
      stack.push({ type: 'array', items: array ?? [] });
      array = null;
    } else if (array && t.type !== 'op') array.push(t);
    else if (t.type !== 'op') stack.push(t);
    else {
      const op = t.value;
      if (op === 'Tf') font = decoders.get(stack[stack.length - 2]?.value);
      else if (op === 'Tj' || op === "'" || op === '"') text += decode(stack[stack.length - 1]?.bytes ?? [], font);
      else if (op === 'TJ') {
        for (const item of stack[stack.length - 1]?.items ?? []) {
          if (item.type === 'string') text += decode(item.bytes, font);
          else if (item.type === 'number' && item.value < -250) text += ' ';
        }
      } else if (op === 'ET' || op === 'T*') text += '\n';
      else if (op === 'Do' && xobjects && depth < 8) {
        const xo = xobjects.lookup(PDFName.of(stack[stack.length - 1]?.value ?? ''));
        if (xo instanceof PDFStream && xo.dict.get(PDFName.of('Subtype'))?.toString() === '/Form') {
          const res = xo.dict.lookupMaybe(PDFName.of('Resources'), PDFDict) ?? resources;
          text += contentText(doc, streamBytes(xo), res, depth + 1);
        }
      }
      stack.length = 0;
    }
  }
  return text;
}

/** The text of one page (pdf-lib PDFPage), in paint order. */
export function pageText(doc, page) {
  const contents = page.node.get(PDFName.of('Contents'));
  const parts = [];
  const add = (obj) => {
    const resolved = obj instanceof PDFRef ? doc.context.lookup(obj) : obj;
    if (resolved instanceof PDFArray) for (const x of resolved.asArray()) add(x);
    else if (resolved instanceof PDFStream) parts.push(streamBytes(resolved));
  };
  if (contents) add(contents);
  const all = Buffer.concat(parts.map((p) => Buffer.from(p)).flatMap((b) => [b, Buffer.from('\n')]));
  return contentText(doc, all, page.node.Resources());
}

/** Lowercase, no whitespace, unified dashes and quotes: for "does the PDF say X" checks. */
export function squash(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‐-―]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, '');
}
