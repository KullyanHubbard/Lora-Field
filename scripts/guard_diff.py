"""Pengaman diff untuk agen non-Claude: gagal kalau perubahan melanggar aturan GEMINI.md.

Hanya membaca (git diff, git ls-files), tidak mengubah apa pun. Yang diperiksa hanya baris yang
ditambahkan, jadi pelanggaran lama di repo tidak ikut dihitung.

  python scripts/guard_diff.py --head HASH [--allow PATH ...]
      HASH = hasil `git log --oneline -1` yang dicatat di awal tugas (gagal kalau HEAD bergeser,
      artinya ada commit). PATH = izin eksplisit user (file atau awalan folder).
  python scripts/guard_diff.py --selftest
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
SRC = 'frontend/src/'
# Di dalam frontend/src tapi terkunci: cermin kontrak API dan komponen shadcn.
LOCKED = ('frontend/src/components/ui/', 'frontend/src/lib/api.ts', 'frontend/src/types/index.ts')
# Boleh diubah, tapi wajib rencana dan persetujuan user dulu.
SENSITIVE = re.compile(r'features/auth/|lib/token\.ts|app/router\.tsx|valve', re.I)
TEXT_EXT = ('.ts', '.tsx', '.json', '.css', '.md', '.py', '.html')
FETCH_OK = ('frontend/src/lib/api.ts', 'frontend/src/features/weather/openMeteo.ts')
MAX_LINES = 300
# File cadangan atau coretan yang tidak boleh tertinggal di repo.
TEMP_NAME = re.compile(r'\.(bak|orig|tmp|old|rej)$|(^|/)(tmp|temp|scratch)\d*\.[a-z]+$|[ _-](copy|backup)\b', re.I)

# (pola, alasan, file yang dikecualikan)
FAIL_RULES = [
    (re.compile(r':\s*any\b|\bas any\b|<any>'), 'memakai any', ()),
    (re.compile(r'eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck'), 'melemahkan cek', ()),
    (re.compile(r'\bconsole\.'), 'console', ()),
    (re.compile(r'dangerouslySetInnerHTML|\beval\(|new Function'), 'kode berbahaya', ()),
    (re.compile(r'#[0-9a-fA-F]{3,8}\b'), 'warna hex, pakai token tema', ()),
    (re.compile(r"from '\.\./"), "import '../', pakai alias @/", ()),
    (re.compile(r'\bfetch\('), 'fetch di luar lib/api.ts, pakai hook queries.ts', FETCH_OK),
    (re.compile(r'(?:local|session)Storage.*token', re.I), 'token di storage, pakai lib/token.ts',
     ('frontend/src/lib/token.ts',)),
]
# Boleh, tapi harus dijelaskan di laporan.
REVIEW_RULES = [
    (re.compile(r'style=\{\{'), 'inline style (hanya nilai dinamis)'),
    (re.compile(r'\buseEffect\('), 'useEffect (hanya sinkronisasi sistem luar)'),
    (re.compile(r'TODO|FIXME'), 'TODO baru'),
]
# Alasan yang tetap dicek di baris komentar (bentuk aslinya memang komentar).
IN_COMMENTS = {'melemahkan cek', 'TODO baru'}
EM_DASH = chr(0x2014)
PLURAL = re.compile(r'_(zero|one|two|few|many|other)$')


def run(*args):
    return subprocess.run(['git', '-c', 'core.quotepath=false', *args], cwd=ROOT, capture_output=True,
                          text=True, encoding='utf-8', check=True).stdout


def scan(path, lines):
    """Kembalikan (gagal, perlu_alasan): daftar (alasan, baris)."""
    fails, reviews = [], []
    is_code = path.endswith(('.ts', '.tsx'))
    for line in lines:
        code = line.strip()
        if EM_DASH in line:
            fails.append(('em dash', code))
        if not is_code:
            continue
        comment = code.startswith(('//', '*', '/*', '{/*'))
        fails += [(why, code) for pat, why, ok in FAIL_RULES
                  if pat.search(code) and path not in ok and (not comment or why in IN_COMMENTS)]
        reviews += [(why, code) for pat, why in REVIEW_RULES
                    if pat.search(code) and (not comment or why in IN_COMMENTS)]
    return fails, reviews


def check_path(path, allow):
    if any(path == a or path.startswith(a) for a in allow):
        return None
    if not path.startswith(SRC):
        return 'di luar frontend/src, butuh izin user'
    if path.startswith(LOCKED):
        return 'file terkunci, butuh izin user'
    return None


def size_verdict(now, before, is_new):
    """File baru lewat batas: gagal. File lama yang membesar lewat batas: perlu alasan."""
    if now <= MAX_LINES:
        return None
    if is_new:
        return 'fail'
    return 'review' if now > before else None


def i18n_keys(file):
    def flat(d, prefix=''):
        for k, v in d.items():
            if isinstance(v, dict):
                yield from flat(v, prefix + k + '.')
            else:
                yield PLURAL.sub('', prefix + k)
    return set(flat(json.loads((ROOT / 'frontend/src/i18n/locales' / file).read_text(encoding='utf-8'))))


def added_lines(path, status):
    if status == '?':
        return (ROOT / path).read_text(encoding='utf-8', errors='replace').splitlines()
    out = run('diff', 'HEAD', '-U0', '--', path).splitlines()
    return [x[1:] for x in out if x.startswith('+') and not x.startswith('+++')]


def main(allow, head):
    changed = {}
    for row in run('diff', 'HEAD', '--name-status').splitlines():
        parts = row.split('\t')
        changed[parts[-1]] = parts[0][0]
    for p in run('ls-files', '--others', '--exclude-standard').splitlines():
        changed[p] = '?'

    fails, reviews = [], []
    if not run('rev-parse', 'HEAD').startswith(head):
        fails.append(('git', 'HEAD bergeser dari ' + head + ', ada commit. Commit hanya oleh user', ''))
    for path in run('diff', '--cached', '--name-only').splitlines():
        fails.append((path, 'di-stage, git add dilarang', ''))
    for path, st in sorted(changed.items()):
        if (why := check_path(path, allow)):
            fails.append((path, why, ''))
        if st == '?' and TEMP_NAME.search(path):
            fails.append((path, 'file cadangan atau coretan, hapus', ''))
        if st == 'D':
            reviews.append((path, 'file dihapus', ''))
            continue
        if SENSITIVE.search(path):
            reviews.append((path, 'zona sensitif, butuh rencana dan izin user', ''))
        if path.endswith(TEXT_EXT):
            if b'\r' in (ROOT / path).read_bytes():
                fails.append((path, 'akhir baris CRLF, repo memakai LF', ''))
            f, r = scan(path, added_lines(path, st))
            fails += [(path, why, line) for why, line in f]
            reviews += [(path, why, line) for why, line in r]
        if path.endswith(('.ts', '.tsx')):
            now = len((ROOT / path).read_text(encoding='utf-8', errors='replace').splitlines())
            before = 0 if st in '?A' else len(run('show', 'HEAD:' + path).splitlines())
            verdict = size_verdict(now, before, st in '?A')
            if verdict:
                bucket = fails if verdict == 'fail' else reviews
                bucket.append((path, f'{now} baris (batas {MAX_LINES}), pecah jadi file lebih kecil', ''))

    id_keys, en_keys = i18n_keys('id.json'), i18n_keys('en.json')
    for k in sorted(id_keys ^ en_keys):
        fails.append(('i18n', 'key hanya ada di ' + ('id.json' if k in id_keys else 'en.json'), k))

    for path, why, line in reviews:
        print(f'PERLU ALASAN  {path}: {why}  {line}')
    for path, why, line in fails:
        print(f'GAGAL         {path}: {why}  {line}')
    print(f'{len(changed)} file berubah, {len(fails)} gagal, {len(reviews)} perlu alasan.')
    return 1 if fails else 0


def selftest():
    bad = lambda path, line: bool(scan(path, [line])[0])
    tsx = 'frontend/src/features/x/A.tsx'
    assert bad(tsx, 'const a: any = 1;')
    assert bad(tsx, 'const a = b as any;')
    assert not bad(tsx, '// kenapa pakai any di sini')
    assert bad(tsx, '// eslint-disable-next-line x') and bad(tsx, '// @ts-ignore')
    assert scan(tsx, ['// TODO: nanti'])[1]
    assert bad(tsx, 'console.log(1)')
    assert bad(tsx, '<div className="text-[#fff]" />')
    assert not bad(tsx, "const u = '#email=' + e;")
    assert bad(tsx, "import x from '../y';") and not bad(tsx, "import x from '@/y';")
    assert bad(tsx, 'const r = await fetch(url);') and not bad(FETCH_OK[0], 'await fetch(url);')
    assert bad(tsx, "localStorage.setItem('token', t)") and not bad('frontend/src/lib/token.ts',
                                                                    "localStorage.setItem('token', t)")
    assert bad(tsx, 'const s = "a ' + EM_DASH + ' b";') and bad('frontend/src/i18n/locales/id.json', '"a": "b ' + EM_DASH + ' c"')
    assert not bad(tsx, 'const total = items.length;')
    assert scan(tsx, ['<div style={{ width: p }} />'])[1] and scan(tsx, ['useEffect(() => {'])[1]
    assert check_path('frontend/package.json', ()) and check_path('backend/app/main.py', ())
    assert check_path('frontend/src/lib/api.ts', ()) and check_path(LOCKED[0] + 'card.tsx', ())
    assert not check_path('frontend/src/lib/api.ts', ('frontend/src/lib/api.ts',))
    assert not check_path(tsx, ())
    assert SENSITIVE.search('frontend/src/features/auth/LoginPage.tsx') and SENSITIVE.search('a/ValveStatCard.tsx')
    assert not SENSITIVE.search(tsx)
    assert PLURAL.sub('', 'time.daysAgo_other') == 'time.daysAgo'
    assert size_verdict(301, 0, True) == 'fail' and size_verdict(300, 0, True) is None
    assert size_verdict(456, 455, False) == 'review' and size_verdict(455, 455, False) is None
    assert size_verdict(200, 100, False) is None
    assert all(TEMP_NAME.search(n) for n in ('a/B.tsx.bak', 'a/B copy.tsx', 'a/tmp.ts', 'a/scratch1.tsx'))
    assert not any(TEMP_NAME.search(n) for n in ('a/Template.tsx', 'a/copyText.ts', 'a/Attempt.ts'))
    print('selftest ok')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--head', help='hash HEAD yang dicatat di awal tugas')
    ap.add_argument('--allow', nargs='*', default=[], help='path yang diizinkan user')
    ap.add_argument('--selftest', action='store_true')
    args = ap.parse_args()
    if args.selftest:
        selftest()
    elif not args.head:
        ap.error('--head wajib: hash dari `git log --oneline -1` yang dicatat di awal tugas')
    else:
        sys.exit(main([a.replace('\\', '/') for a in args.allow], args.head))
