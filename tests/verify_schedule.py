"""Compare every rendered scoreboard card with the separately fetched MLB schedule.

Each card must report the feed's own team names and scores exactly (blank when the
schedule reports none — never zero-filled), and Final games must show their official
detailedState. Usage: python3 tests/verify_schedule.py <schedule.json> <rendered.html>
"""
import json
import sys
from html.parser import HTMLParser
from pathlib import Path


class Cards(HTMLParser):
    """Collect per-card text of .team-name / .team-score / .pill spans."""

    def __init__(self):
        super().__init__()
        self.cards = []
        self.in_card = False
        self.capture = None       # class key whose span text we are capturing

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = (a.get('class') or '').split()
        if tag == 'a' and 'game-card' in classes:
            self.cards.append({'href': a.get('href', ''), 'names': [], 'scores': [], 'pills': []})
            self.in_card = True
            self.capture = None
            return
        if self.in_card and tag == 'span' and self.capture is None:
            for cls, key in (('team-name', 'names'), ('team-score', 'scores'), ('pill', 'pills')):
                if cls in classes:
                    self.capture = key
                    break

    def handle_endtag(self, tag):
        if tag == 'span' and self.capture:
            self.capture = None
        elif tag == 'a' and self.in_card:
            self.in_card = False

    def handle_data(self, data):
        if self.in_card and self.capture and self.cards:
            self.cards[-1][self.capture].append(data)


schedule, dom = map(Path, sys.argv[1:])
games = json.loads(schedule.read_text())['dates'][0]['games']
parser = Cards()
parser.feed(dom.read_text())
assert games, 'schedule has no games'
assert len(parser.cards) == len(games), f'{len(parser.cards)} rendered cards vs {len(games)} scheduled games'

for game, card in zip(games, parser.cards):
    pk = game['gamePk']
    assert card['href'] == f"game.html?gamePk={pk}", f'card {pk} link'
    teams = game['teams']
    names = [teams[s]['team']['name'] for s in ('away', 'home')]
    got_names = [card['names'][0] if card['names'] else '', card['names'][1] if len(card['names']) > 1 else '']
    assert got_names == names, f'card {pk} team names: {got_names} vs {names}'
    scores = [
        str(teams[s]['score']) if isinstance(teams[s].get('score'), (int, float)) else ''
        for s in ('away', 'home')
    ]
    got_scores = [card['scores'][0] if card['scores'] else '',
                  card['scores'][1] if len(card['scores']) > 1 else '']
    assert got_scores == scores, f'card {pk} scores: {got_scores} vs {scores} (reported only)'
    if game['status'].get('abstractGameState') == 'Final':
        pill = card['pills'][0] if card['pills'] else ''
        assert game['status']['detailedState'] in pill, f'card {pk} status pill: {pill!r}'
print(f"Verified {len(games)} scoreboard cards against {schedule}")
