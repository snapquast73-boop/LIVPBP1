"""Fail when a local href/src in any published page points at a missing file.

This is the offline half of the page check (no network). The end-to-end half,
which renders every page against official MLB responses, is
`node tests/official-e2e.mjs`.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent


class Links(HTMLParser):
    def __init__(self, page):
        super().__init__()
        self.page = page
        self.missing = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name not in ('src', 'href') or not value:
                continue
            url = urlsplit(value)
            if url.scheme or url.netloc or not url.path:
                continue
            path = unquote(url.path).removeprefix('/LIVPBP1/')
            target = (ROOT / path.lstrip('/')) if path.startswith('/') else (self.page.parent / path)
            if not target.is_file():
                self.missing.append(f'{self.page.relative_to(ROOT)}: missing {name} {value}')


missing = []
for page in sorted(ROOT.glob('*.html')):
    parser = Links(page)
    parser.feed(page.read_text(encoding='utf-8'))
    missing.extend(parser.missing)
print('\n'.join(missing) if missing else 'All local HTML href/src file references exist.')
raise SystemExit(1 if missing else 0)
