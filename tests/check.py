from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

class Links(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name not in ('src','href') or not value: continue
            u=urlsplit(value)
            if u.scheme or u.netloc or not u.path: continue
            path=Path(u.path.removeprefix('/LIVPBP1/'))
            assert (path/'index.html' if path.is_dir() else path).is_file(), value

for page in Path('.').glob('*.html'): Links().feed(page.read_text())
