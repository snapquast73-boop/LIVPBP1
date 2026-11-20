"""Compare every rendered scoreboard row with the separately fetched MLB schedule."""
import json
import sys
from html.parser import HTMLParser
from pathlib import Path


class Rows(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.active = self.in_link = False

    def handle_starttag(self, tag, attrs):
        if tag == 'article':
            self.active = True
            self.rows.append([[], []])
        elif self.active and tag == 'a':
            self.in_link = True
            self.rows[-1][1].append(dict(attrs)['href'])

    def handle_endtag(self, tag):
        if tag == 'article':
            self.active = False
        if tag == 'a':
            self.in_link = False

    def handle_data(self, data):
        if self.active and not self.in_link:
            self.rows[-1][0].append(data)


schedule, dom = map(Path, sys.argv[1:])
parser = Rows()
parser.feed(dom.read_text())
games = json.loads(schedule.read_text())['dates'][0]['games']
assert games and len(parser.rows) == len(games)
for game, (text, links) in zip(games, parser.rows):
    teams = game['teams']
    names = [f"{teams[s]['team']['name']} {teams[s]['score']}" for s in ('away', 'home')]
    assert ''.join(text).strip() == ' at '.join(names) + ' · ' + game['status']['detailedState']
    assert links == [f"game.html?gamePk={game['gamePk']}&date=2024-10-30",
                     'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=linescore']
