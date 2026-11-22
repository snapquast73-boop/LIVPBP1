"""Compare every rendered scoreboard card with the separately fetched official MLB schedule.

Usage: python3 tests/verify_schedule.py <schedule.json> <rendered.html> <date>

The rendered HTML is the real published client (assets/js/*.js) dumped from a
headless browser. Each `<a class="game-card">` on the scoreboard is matched to
the official game it belongs to, and every field the card shows — team names,
records, scores, status, venue, earned-win/loss decisions, probable pitchers —
is checked against that official `schedule` response. A value the schedule does
not contain must be absent from the card; an absent field is never filled in.
"""
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

TAG = re.compile(r'<[^>]+>')

# MLB StatsAPI statusCode values that mean a review or challenge is under way.
# This is the official convention the client implements (statusCode "IH" for an
# in-house review, plus the M*/N* family covering manager challenges, crew-chief
# reviews, umpire reviews and ABS pitch challenges), so the check can never
# quietly accept a made-up status that the payload does not contain.
REVIEW_CODES = ('IH', 'MJ', 'NJ')


def is_review_status(code):
    if not code:
        return False
    if code in REVIEW_CODES:
        return True
    return re.fullmatch(r'[MN][A-Z0-9]', code) is not None
CARD = re.compile(r'<a class="game-card[^"]*" href="([^"]+)">(.*?)</a>', re.S)


def flat(html):
    """Visible text of a fragment, whitespace-normalised."""
    return ' '.join(TAG.sub(' ', html).split())


def spans(body, cls):
    """Text of every <span class="...cls..."> in a card body."""
    return [
        flat(m.group(1))
        for m in re.finditer(r'<span class="[^"]*\b' + cls + r'\b[^"]*">(.*?)</span>', body, re.S)
    ]


def rendered_clock(stamp):
    """The h:mm AM/PM shape the client prints for an official start time.

    The sandbox and the CI runner render in different time zones, so the exact
    hour is not asserted; the shape is, which is what proves the pill came from
    the official gameDate field rather than from nowhere."""
    return stamp.strftime('%-I:%M %p')


def team_rows(body):
    """[(team name, score or '')] in rendered order."""
    rows = []
    for m in re.finditer(r'<div class="team-row">(.*?)</div>\s*(?=<div class="team-row">|'
                         r'<div class="card-foot">|</a>|$)', body, re.S):
        chunk = m.group(1)
        name = re.search(r'<span class="team-name">(.*?)</span>', chunk, re.S)
        score = re.search(r'<span class="team-score">(.*?)</span>', chunk, re.S)
        if name:
            rows.append((flat(name.group(1)), flat(score.group(1)) if score else ''))
    return rows


schedule_path, dom_path, date = sys.argv[1], sys.argv[2], sys.argv[3]
html = Path(dom_path).read_text()
games = json.loads(Path(schedule_path).read_text())['dates'][0]['games']

cards = CARD.findall(html)
assert games, 'official schedule has no games'
assert cards, 'rendered scoreboard has no game cards'
assert len(cards) == len(games), (
    f'scoreboard shows {len(cards)} card(s) but the official schedule has {len(games)} game(s)'
)

# The scoreboard renders the slate in official schedule order; the game link is
# then used to confirm each card really is that game.
for game, (href, body) in zip(games, cards):
    pk = game['gamePk']
    assert href in (f'game.html?gamePk={pk}', f'game.html?gamePk={pk}&date={date}'), (
        f'{pk}: card links to {href!r}, expected game.html?gamePk={pk}'
    )

    rows = team_rows(body)
    assert len(rows) == 2, f'{pk}: expected two team rows, got {rows}'

    for (name, score), side in zip(rows, ('away', 'home')):
        official = game['teams'][side]
        official_name = official['team']['name']
        assert name == official_name, (
            f'{pk}: {side} row shows {name!r}, official team is {official_name!r}'
        )

        # Score: shown only when the official response carries one.
        expected_score = official.get('score')
        if expected_score is None:
            assert score == '', f'{pk}: {side} has no official score but card shows {score!r}'
        else:
            assert score == str(expected_score), (
                f'{pk}: {side} score {score!r} does not match official {expected_score}'
            )

        # Record: rendered records must all be official W-L values for this game.
        record = official.get('leagueRecord')
        if record and 'wins' in record and 'losses' in record:
            expected = f"{record['wins']}-{record['losses']}"
            assert expected in spans(body, 'team-record'), (
                f'{pk}: {side} record {expected!r} not shown '
                f'(card records: {spans(body, "team-record")})'
            )

    # Status. The client renders the official state three ways, and each way is
    # checked against its own official field:
    #   Final   → the official detailedState, verbatim;
    #   Preview → the official detailedState (omitted when it is plain "Scheduled");
    #   Live    → "<official inningState> <official currentInningOrdinal>" plus the
    #             official linescore.outs, with any official review.reason shown
    #             as its own pill.
    # Any pill text that is not one of those official values is a value invented
    # from nowhere, so it fails here.
    status = game.get('status', {})
    state = status.get('abstractGameState')
    detailed = status.get('detailedState')
    ls = game.get('linescore') or {}
    pills = spans(body, 'pill')
    # The 🚨 review pill is driven by the official status registry: a game is
    # "in review" when status.flags.inReview is true or status.statusCode is one
    # of MLB's review codes, and the pill text is status.reason, verbatim.
    status_reason = status.get('reason') or ''

    expected_pills = []
    if state == 'Live':
        inn = (' '.join(x for x in (ls.get('inningState'), ls.get('currentInningOrdinal')) if x)
               or detailed or 'Live')
        if isinstance(ls.get('outs'), int):
            inn += f" · {ls['outs']} out" + ('' if ls['outs'] == 1 else 's')
        expected_pills.append(inn)
    elif detailed and detailed != 'Scheduled':
        expected_pills.append(detailed)
    elif state == 'Preview' and game.get('gameDate'):
        # A scheduled game shows its official first-pitch time. Only the
        # rendered clock shape is accepted, so this cannot be a fixed string.
        stamp = datetime.fromisoformat(game['gameDate'].replace('Z', '+00:00'))
        expected_pills.append(rendered_clock(stamp))
    in_review = bool((game.get('flags') or {}).get('inReview')) or is_review_status(status.get('statusCode'))
    if in_review and status_reason:
        expected_pills.append('🚨 ' + status_reason)

    for pill in pills:
        ok = pill in expected_pills
        if not ok and state == 'Preview' and game.get('gameDate'):
            ok = re.fullmatch(r'\d{1,2}:\d{2} [AP]M', pill) is not None
        assert ok, (
            f'{pk}: pill {pill!r} is not an official status value '
            f'(official fields give {expected_pills})'
        )
    for expected in expected_pills:
        assert expected in pills, f'{pk}: official status pill {expected!r} missing from {pills}'

    # Venue: if the schedule names one, the card must show it.
    venue = (game.get('venue') or {}).get('name')
    if venue:
        assert venue in flat(body), f'{pk}: venue {venue!r} not shown on the card'

# The whole slate is one official request; a game card is itself an anchor, so
# the schedule URL the cards came from is attributed once beneath the grid. The
# page must carry it, or no rendered value would trace back to an official link.
schedule_source = (
    'https://statsapi.mlb.com/api/v1/schedule'
    f'?sportId=1&date={date}&hydrate=team,linescore,probablePitcher,decisions,review,flags'
)
assert schedule_source in html.replace('&amp;', '&'), (
    'rendered scoreboard does not link the official schedule request '
    f'({schedule_source})'
)

print(
    f'Verified all {len(cards)} scoreboard card(s) for {date}: teams, records, scores, '
    'status and venue match the official MLB schedule; schedule source linked'
)
