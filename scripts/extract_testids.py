#!/usr/bin/env python3
"""
extract_testids.py — scan all TSX files under mobile/src and emit a matrix of
every element that carries testID, accessibilityLabel, or data-testid.

Output columns (TSV / Markdown):
  Filename | Element Type | data-testid | accessibilityLabel | testID | Container ID | File Path

Usage:
  python3 scripts/extract_testids.py [--project-root DIR] [--out-dir DIR]

Defaults:
  --project-root  directory containing this script's parent (auto-detected)
  --out-dir       docs/
"""

import argparse
import json
import os
import re
import sys

# ---------------------------------------------------------------------------
# Attribute extraction helpers
# ---------------------------------------------------------------------------

def extract_attr(text: str, attr_name: str) -> str:
    """Return the string value of a JSX attribute, or '' if absent."""
    escaped = re.escape(attr_name)
    # attr="value"
    m = re.search(rf'{escaped}="([^"]*)"', text)
    if m:
        return m.group(1)
    # attr={"value"} or attr={'value'}
    m = re.search(rf"{escaped}=" + r"""[{]['"]([^'"]*)['"]}""", text)
    if m:
        return m.group(1)
    # attr={`value`}
    m = re.search(rf"{escaped}=" + r"""\{`([^`]*)`\}""", text)
    if m:
        return m.group(1)
    return ''


def extract_style(text: str) -> str:
    """
    Return the style class name portion from style={styles.X} or
    style={[styles.X, styles.Y]} with "styles." stripped, joined with "/".
    """
    m = re.search(r'style=\{styles\.(\w+)\}', text)
    if m:
        return m.group(1)
    m = re.search(r'style=\{\[([^\]]+)\]\}', text)
    if m:
        parts = re.findall(r'styles\.(\w+)', m.group(1))
        return '/'.join(parts) if parts else ''
    return ''


# ---------------------------------------------------------------------------
# Per-file parser
# ---------------------------------------------------------------------------

TARGET_ATTRS = ('testID', 'accessibilityLabel', 'data-testid')


def parse_file(filepath: str, project_root: str) -> list[dict]:
    with open(filepath, encoding='utf-8') as f:
        lines = f.readlines()

    rel_path = os.path.relpath(filepath, project_root)
    filename = os.path.basename(filepath)
    records = []

    # Collect line indices that contain at least one target attribute
    target_lines: set[int] = set()
    for i, line in enumerate(lines):
        if any(f'{attr}=' in line for attr in TARGET_ATTRS):
            target_lines.add(i)

    if not target_lines:
        return records

    processed: set[tuple[int, int]] = set()

    for tline in sorted(target_lines):
        # Walk backwards from the attribute line to find the opening JSX tag
        elem_start = None
        for j in range(tline, max(-1, tline - 50), -1):
            stripped = lines[j].lstrip()
            if (re.match(r'<[A-Za-z]', stripped)
                    and not stripped.startswith('</')
                    and not stripped.startswith('<!--')):
                elem_start = j
                break

        if elem_start is None:
            continue

        # Walk forward to find the end of the opening tag (> or />)
        elem_end = elem_start
        for j in range(elem_start, min(len(lines), elem_start + 100)):
            test_line = lines[j].rstrip()
            if '/>' in test_line or (
                test_line.rstrip().endswith('>')
                and not test_line.strip().startswith('</')
            ) or test_line.strip() == '>':
                elem_end = j
                break

        key = (elem_start, elem_end)
        if key in processed:
            continue
        processed.add(key)

        elem_text = ''.join(lines[elem_start:elem_end + 1])

        if not any(f'{attr}=' in elem_text for attr in TARGET_ATTRS):
            continue

        m = re.match(r'\s*<(\w[\w.]*)', lines[elem_start])
        if not m:
            continue
        tag = m.group(1)

        style = extract_style(elem_text)
        element_type = f"{tag}/{style}" if style else tag

        test_id    = extract_attr(elem_text, 'testID')
        data_tid   = extract_attr(elem_text, 'data-testid')
        acc_label  = extract_attr(elem_text, 'accessibilityLabel')

        # Container ID: search backwards for the nearest enclosing element
        # whose opening tag has a target attribute and closes after elem_start.
        container_id = ''
        for j in range(elem_start - 1, max(-1, elem_start - 200), -1):
            stripped = lines[j].lstrip()
            if not (re.match(r'<[A-Za-z]', stripped) and not stripped.startswith('</')):
                continue
            # Determine where this candidate's opening tag ends
            close_line = j
            for k in range(j, min(len(lines), j + 30)):
                if '/>' in lines[k] or (
                    lines[k].rstrip().endswith('>')
                    and not lines[k].strip().startswith('</')
                ) or lines[k].strip() == '>':
                    close_line = k
                    break
            # If the parent tag closes at or after elem_start, it is a true container
            if close_line >= elem_start:
                p_text = ''.join(lines[j:min(len(lines), j + 30)])
                container_val = (extract_attr(p_text, 'testID')
                                 or extract_attr(p_text, 'data-testid')
                                 or extract_attr(p_text, 'accessibilityLabel'))
                if container_val:
                    container_id = (container_val[:30] + '...'
                                    if len(container_val) > 30
                                    else container_val)
                break

        records.append({
            'filename':          filename,
            'elementType':       element_type,
            'dataTestId':        data_tid,
            'accessibilityLabel': acc_label,
            'testID':            test_id,
            'containerId':       container_id,
            'filePath':          rel_path,
        })

    return records


# ---------------------------------------------------------------------------
# Output writers
# ---------------------------------------------------------------------------

HEADERS = ['Filename', 'Element Type', 'data-testid',
           'accessibilityLabel', 'testID', 'Container ID', 'File Path']


def to_row(r: dict) -> list[str]:
    return [
        r['filename'],
        r['elementType'],
        r['dataTestId'],
        r['accessibilityLabel'],
        r['testID'],
        r['containerId'],
        r['filePath'],
    ]


def write_tsv(records: list[dict], path: str) -> None:
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\t'.join(HEADERS) + '\n')
        for r in records:
            f.write('\t'.join(to_row(r)) + '\n')


def write_markdown(records: list[dict], path: str) -> None:
    rows = [to_row(r) for r in records]

    widths = [len(h) for h in HEADERS]
    for row in rows:
        for i, v in enumerate(row):
            widths[i] = max(widths[i], len(v))

    def fmt_row(cells):
        return '| ' + ' | '.join(
            v.replace('|', '\\|').ljust(w)
            for v, w in zip(cells, widths)
        ) + ' |'

    sep = '| ' + ' | '.join('-' * w for w in widths) + ' |'

    with open(path, 'w', encoding='utf-8') as f:
        f.write(fmt_row(HEADERS) + '\n')
        f.write(sep + '\n')
        for row in rows:
            f.write(fmt_row(row) + '\n')


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def find_tsx_files(root: str) -> list[str]:
    result = []
    for dirpath, _, files in os.walk(root):
        for name in files:
            if name.endswith('.tsx'):
                result.append(os.path.join(dirpath, name))
    return sorted(result)


def main() -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_root = os.path.dirname(script_dir)

    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--project-root', default=default_root,
                    help='Project root (default: parent of scripts/)')
    ap.add_argument('--out-dir', default=None,
                    help='Output directory (default: <project-root>/docs)')
    ap.add_argument('--json', action='store_true',
                    help='Also write raw JSON to <out-dir>/maestro_testids.json')
    args = ap.parse_args()

    project_root = os.path.abspath(args.project_root)
    mobile_src = os.path.join(project_root, 'mobile', 'src')
    out_dir = os.path.abspath(args.out_dir) if args.out_dir else os.path.join(project_root, 'docs')

    if not os.path.isdir(mobile_src):
        sys.exit(f"ERROR: mobile/src not found at {mobile_src}")

    os.makedirs(out_dir, exist_ok=True)

    tsx_files = find_tsx_files(mobile_src)
    print(f"Scanning {len(tsx_files)} TSX files under {mobile_src} ...")

    all_records: list[dict] = []
    errors: list[str] = []
    for fp in tsx_files:
        try:
            all_records.extend(parse_file(fp, project_root))
        except Exception as e:
            errors.append(f"  {fp}: {e}")

    if errors:
        print("Parse errors:")
        for msg in errors:
            print(msg)

    all_records.sort(key=lambda r: (r['filename'],
                                    r['testID'] or r['dataTestId'] or r['accessibilityLabel']))

    tsv_path = os.path.join(out_dir, 'maestro_testids.tsv')
    md_path  = os.path.join(out_dir, 'maestro_testids.md')
    write_tsv(all_records, tsv_path)
    write_markdown(all_records, md_path)

    if args.json:
        json_path = os.path.join(out_dir, 'maestro_testids.json')
        with open(json_path, 'w') as f:
            json.dump(all_records, f, indent=2)
        print(f"JSON:     {json_path}")

    print(f"TSV:      {tsv_path}")
    print(f"Markdown: {md_path}")
    print(f"\nSummary:")
    print(f"  Total elements : {len(all_records)}")
    print(f"  Has testID     : {sum(1 for r in all_records if r['testID'])}")
    print(f"  Has data-testid: {sum(1 for r in all_records if r['dataTestId'])}")
    print(f"  Has a11y label : {sum(1 for r in all_records if r['accessibilityLabel'])}")
    print(f"  Has container  : {sum(1 for r in all_records if r['containerId'])}")
    print(f"  Unique files   : {len(set(r['filename'] for r in all_records))}")
    if errors:
        print(f"  Parse errors   : {len(errors)}")


if __name__ == '__main__':
    main()
