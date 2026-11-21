// csv-reader 1.0.0 compatible fast CSV reader.
// Original implementation written from the published specification; no code is taken from the reference.

const CR = 13;
const LF = 10;
const COMMA = 44;
const QUOTE = 34;

// Counts the LF characters in a string (the only character that advances the line counter).
function countLF(s) {
  let n = 0;
  let k = 0;
  while ((k = s.indexOf('\n', k)) >= 0) {
    n++;
    k++;
  }
  return n;
}

// Rewrites every CRLF and every lone CR in a quoted chunk as one LF.
function normalizeChunk(chunk) {
  let out = '';
  let i = 0;
  const n = chunk.length;
  while (i < n) {
    const r = chunk.indexOf('\r', i);
    if (r < 0) {
      out += chunk.slice(i);
      break;
    }
    out += chunk.slice(i, r);
    out += '\n';
    i = r + 1 < n && chunk.charCodeAt(r + 1) === LF ? r + 2 : r + 1;
  }
  return out;
}

// The reading of one CSV input, {text, header}: {columns, rows, errors}.
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0;
  let line = 1;
  if (len > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  let recordLine = 1;
  let recordRow = null;

  while (true) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === LF) {
        pos++;
        line++;
      } else if (c === CR && pos + 1 < len && text.charCodeAt(pos + 1) === LF) {
        pos += 2;
        line++;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    const fields = width < 0 ? [] : new Array(width);
    let extras = null;
    let fi = 0;
    let lastQuoted = false;

    while (true) {
      let value;
      let junk = false;
      let ended;
      let needUnquoted;
      const quoted = text.charCodeAt(pos) === QUOTE;
      lastQuoted = quoted;

      if (quoted) {
        const open = pos;
        const openLine = line;
        let pieceStart = pos + 1;
        let lineDelta = 0;
        value = '';
        let q = text.indexOf('"', pieceStart);
        let closed = false;

        while (q >= 0) {
          let chunk = text.slice(pieceStart, q);
          if (chunk.indexOf('\r') >= 0) chunk = normalizeChunk(chunk);
          lineDelta += countLF(chunk);
          value += chunk;
          if (q + 1 < len && text.charCodeAt(q + 1) === QUOTE) {
            // A doubled quote is one literal quote.
            value += '"';
            pieceStart = q + 2;
            q = text.indexOf('"', pieceStart);
          } else {
            pos = q + 1;
            closed = true;
            break;
          }
        }

        if (!closed) {
          // The quote never closes: it is a literal character, and the text after it is read as unquoted.
          pos = open + 1;
          line = openLine;
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          value = '"';
          needUnquoted = true;
        } else {
          line += lineDelta;
          needUnquoted = false;
          if (pos >= len) {
            ended = 0;
          } else {
            const c = text.charCodeAt(pos);
            if (c === COMMA) {
              pos++;
              ended = 1;
            } else if (c === LF) {
              pos++;
              line++;
              ended = 2;
            } else if (c === CR && pos + 1 < len && text.charCodeAt(pos + 1) === LF) {
              pos += 2;
              line++;
              ended = 2;
            } else {
              // What follows the closing quote is appended as it stands.
              junk = true;
              needUnquoted = true;
            }
          }
        }
      } else {
        value = '';
        needUnquoted = true;
      }

      if (needUnquoted) {
        // Reads unquoted characters onto `value` up to the next comma or line break; a CR not followed by LF
        // is dropped (stray_cr).
        const initialLen = value.length;
        while (true) {
          let e = pos;
          while (e < len) {
            const cc = text.charCodeAt(e);
            if (cc === COMMA || cc === LF || cc === CR) break;
            e++;
          }
          if (value.length === 0) value = text.slice(pos, e);
          else value += text.slice(pos, e);
          if (e >= len) {
            ended = 0;
            pos = len;
            break;
          }
          const ec = text.charCodeAt(e);
          if (ec === COMMA) {
            ended = 1;
            pos = e + 1;
            break;
          }
          if (ec === LF) {
            ended = 2;
            line++;
            pos = e + 1;
            break;
          }
          if (e + 1 < len && text.charCodeAt(e + 1) === LF) {
            ended = 2;
            line++;
            pos = e + 2;
            break;
          }
          errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
          pos = e + 1;
        }
        if (junk && value.length > initialLen) {
          errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
        }
      }

      if (width < 0) fields.push(value);
      else if (fi < width) fields[fi] = value;
      else {
        if (extras === null) extras = [];
        extras.push(value);
      }
      fi++;

      if (ended === 1) continue;
      break;
    }

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fi === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fi;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fi < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fi });
      for (let k = fi; k < width; k++) fields[k] = '';
    } else if (fi > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: extras });
    }
    rows.push(fields);
  }

  return { columns: header ? columns ?? [] : null, rows, errors };
}
