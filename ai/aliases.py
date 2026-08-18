"""Club name reconciliation.

Football-Data.co.uk spells clubs its own way and has done since 1993. This
database spells them another way, and `public.teams.id` is scoped to a single
tournament, so it cannot be the key that joins 2016/17 to 2026/27. The
canonical name is that key.

Only clubs that appear in a live tournament need a `team_id`; historical
opponents that are no longer in the league still need a canonical name so
their matches contribute to their opponents' form.
"""
from __future__ import annotations

import re
import unicodedata

# platform team name  ->  (canonical, football-data.co.uk name, country)
LIVE_CLUBS: list[tuple[str, str, str, str]] = [
    # --- Premier League 2026/27 (as held in public.teams) ---
    ("AFC Bournemouth",            "Bournemouth",        "Bournemouth",     "ENG"),
    ("Arsenal FC",                 "Arsenal",            "Arsenal",         "ENG"),
    ("Aston Villa FC",             "Aston Villa",        "Aston Villa",     "ENG"),
    ("Brentford FC",               "Brentford",          "Brentford",       "ENG"),
    ("Brighton & Hove Albion FC",  "Brighton",           "Brighton",        "ENG"),
    ("Chelsea FC",                 "Chelsea",            "Chelsea",         "ENG"),
    ("Coventry City FC",           "Coventry",           "Coventry",        "ENG"),
    ("Crystal Palace FC",          "Crystal Palace",     "Crystal Palace",  "ENG"),
    ("Everton FC",                 "Everton",            "Everton",         "ENG"),
    ("Fulham FC",                  "Fulham",             "Fulham",          "ENG"),
    ("Hull City AFC",              "Hull",               "Hull",            "ENG"),
    ("Ipswich Town FC",            "Ipswich",            "Ipswich",         "ENG"),
    ("Leeds United FC",            "Leeds",              "Leeds",           "ENG"),
    ("Liverpool FC",               "Liverpool",          "Liverpool",       "ENG"),
    ("Manchester City FC",         "Man City",           "Man City",        "ENG"),
    ("Manchester United FC",       "Man United",         "Man United",      "ENG"),
    ("Newcastle United FC",        "Newcastle",          "Newcastle",       "ENG"),
    ("Nottingham Forest FC",       "Nott'm Forest",      "Nott'm Forest",   "ENG"),
    ("Sunderland AFC",             "Sunderland",         "Sunderland",      "ENG"),
    ("Tottenham Hotspur FC",       "Tottenham",          "Tottenham",       "ENG"),
    # --- Scottish Premiership 2026/27 ---
    ("Aberdeen",                   "Aberdeen",           "Aberdeen",        "SCO"),
    ("Celtic",                     "Celtic",             "Celtic",          "SCO"),
    ("Dundee",                     "Dundee",             "Dundee",          "SCO"),
    ("Dundee United",              "Dundee United",      "Dundee United",   "SCO"),
    ("Falkirk",                    "Falkirk",            "Falkirk",         "SCO"),
    ("Hearts",                     "Hearts",             "Hearts",          "SCO"),
    ("Hibernian",                  "Hibernian",          "Hibernian",       "SCO"),
    ("Kilmarnock",                 "Kilmarnock",         "Kilmarnock",      "SCO"),
    ("Motherwell",                 "Motherwell",         "Motherwell",      "SCO"),
    ("Rangers",                    "Rangers",            "Rangers",         "SCO"),
    ("St. Johnstone",              "St Johnstone",       "St Johnstone",    "SCO"),
    ("St. Mirren",                 "St Mirren",          "St Mirren",       "SCO"),
]

# Football-Data spellings that differ from the canonical name, for clubs that
# are not currently in either live tournament but appear in the history.
HISTORICAL_ALIASES: list[tuple[str, str, str]] = [
    # (football-data name, canonical, country)
    ("Man United",      "Man United",       "ENG"),
    ("Sheffield United","Sheffield United", "ENG"),
    ("Sheffield Weds",  "Sheffield Weds",   "ENG"),
    ("West Brom",       "West Brom",        "ENG"),
    ("West Ham",        "West Ham",         "ENG"),
    ("Wolves",          "Wolves",           "ENG"),
    ("QPR",             "QPR",              "ENG"),
    ("Luton",           "Luton",            "ENG"),
    ("Burnley",         "Burnley",          "ENG"),
    ("Southampton",     "Southampton",      "ENG"),
    ("Leicester",       "Leicester",        "ENG"),
    ("Watford",         "Watford",          "ENG"),
    ("Norwich",         "Norwich",          "ENG"),
    ("Ross County",     "Ross County",      "SCO"),
    ("Livingston",      "Livingston",       "SCO"),
    ("St Johnstone",    "St Johnstone",     "SCO"),
    ("St Mirren",       "St Mirren",        "SCO"),
    ("Hamilton",        "Hamilton",         "SCO"),
    ("Partick Thistle", "Partick Thistle",  "SCO"),
]


def source_to_canonical() -> dict[str, str]:
    """Football-Data spelling -> canonical name.

    Anything not in this map falls through to itself, which is the correct
    default: most spellings already agree. `unmapped_clubs` is what tells you
    when that default has quietly gone wrong.
    """
    mapping = {fd: canon for _, canon, fd, _ in LIVE_CLUBS}
    for fd, canon, _ in HISTORICAL_ALIASES:
        mapping.setdefault(fd, canon)
    return mapping


def canonical_for(source_name: str) -> str:
    return source_to_canonical().get(source_name, source_name)


# ---------------------------------------------------------------------------
# The Odds API is a THIRD vocabulary
#
# Football-Data writes "Nott'm Forest". This platform writes "Nottingham Forest
# FC". The Odds API writes "Nottingham Forest". None is wrong and none can be
# derived from the others by rule, so the mapping is data.
#
# Below is the hand-written part: the clubs where normalisation alone fails.
# Everything else goes through `normalise` and matches on shape. Anything that
# still fails is reported rather than guessed, because a silently unmatched
# fixture means a price attached to the wrong match, which is worse than a
# missing price.
# ---------------------------------------------------------------------------

ODDS_API_TO_CANONICAL: dict[str, str] = {
    # England, where the two providers disagree
    "Nottingham Forest": "Nott'm Forest",
    "Manchester United": "Man United",
    "Manchester City": "Man City",
    "Wolverhampton Wanderers": "Wolves",
    "Sheffield Wednesday": "Sheffield Weds",
    "West Bromwich Albion": "West Brom",
    "West Ham United": "West Ham",
    "Queens Park Rangers": "QPR",
    "Brighton and Hove Albion": "Brighton",
    "Brighton & Hove Albion": "Brighton",
    "AFC Bournemouth": "Bournemouth",
    "Newcastle United": "Newcastle",
    "Tottenham Hotspur": "Tottenham",
    "Leeds United": "Leeds",
    "Leicester City": "Leicester",
    "Norwich City": "Norwich",
    "Ipswich Town": "Ipswich",
    "Hull City": "Hull",
    "Coventry City": "Coventry",
    "Luton Town": "Luton",
    "Stoke City": "Stoke",
    "Swansea City": "Swansea",
    "Cardiff City": "Cardiff",
    "Birmingham City": "Birmingham",
    "Derby County": "Derby",
    "Preston North End": "Preston",
    "Blackburn Rovers": "Blackburn",
    "Bristol City": "Bristol City",
    "Milton Keynes Dons": "Milton Keynes Dons",
    "Peterborough United": "Peterboro",
    "Bolton Wanderers": "Bolton",
    "Charlton Athletic": "Charlton",
    "Crewe Alexandra": "Crewe",
    "Oxford United": "Oxford",
    "Wycombe Wanderers": "Wycombe",
    "Shrewsbury Town": "Shrewsbury",
    "Cheltenham Town": "Cheltenham",
    "Colchester United": "Colchester",
    "Newport County": "Newport County",
    "Notts County": "Notts County",
    "Tranmere Rovers": "Tranmere",
    "Doncaster Rovers": "Doncaster",
    "Bradford City": "Bradford",
    "Grimsby Town": "Grimsby",
    "Harrogate Town": "Harrogate",
    # A second sweep, added after the 13 August 2026 Production audit measured
    # what the first one missed. These twenty-one club spellings had no alias
    # entry AND no shape match — `normalise('Huddersfield Town')` is
    # 'huddersfield town' and the history's key is 'huddersfield' — so each was
    # scored as a club with no matches at all, exactly as Leicester was, while
    # its six hundred-odd historical rows sat under the shorter name. Every
    # canonical name on the right was read out of `ai.raw_matches` rather than
    # guessed, with its match count checked.
    "Accrington Stanley": "Accrington",
    "Bristol Rovers": "Bristol Rvs",
    "Bromley FC": "Bromley",
    "Bromley": "Bromley",
    "Burton Albion": "Burton",
    "Cambridge United": "Cambridge",
    "Chesterfield FC": "Chesterfield",
    "Chesterfield": "Chesterfield",
    "Exeter City": "Exeter",
    "Huddersfield Town": "Huddersfield",
    "Lincoln City": "Lincoln",
    "Mansfield Town": "Mansfield",
    "Northampton Town": "Northampton",
    "Oldham Athletic": "Oldham",
    "Plymouth Argyle": "Plymouth",
    "Rotherham United": "Rotherham",
    "Salford City": "Salford",
    "Stockport County FC": "Stockport",
    "Stockport County": "Stockport",
    "Swindon Town": "Swindon",
    "Wigan Athletic": "Wigan",
    "Wimbledon": "AFC Wimbledon",
    "AFC Wimbledon": "AFC Wimbledon",
    "Wrexham AFC": "Wrexham",
    "Wrexham": "Wrexham",
    "York City": "York",
    "Dundee FC": "Dundee",
    "Falkirk F.C.": "Falkirk",
    # Scotland
    "Heart of Midlothian": "Hearts",
    "Hibernian": "Hibernian",
    "St Mirren": "St Mirren",
    "St. Mirren": "St Mirren",
    "St Johnstone": "St Johnstone",
    "St. Johnstone": "St Johnstone",
    "Dundee United": "Dundee United",
    "Ross County": "Ross County",
    "Greenock Morton": "Morton",
    "Inverness Caledonian Thistle": "Inverness C",
    "Partick Thistle": "Partick",
    "Queen's Park": "Queens Park",
    "Raith Rovers": "Raith Rvs",
    "Airdrieonians": "Airdrie Utd",
    "Hamilton Academical": "Hamilton",
    "Alloa Athletic": "Alloa",
    "Cove Rangers": "Cove Rangers",
    "Peterhead": "Peterhead",
    "Elgin City": "Elgin",
    "Forfar Athletic": "Forfar",
    "Stirling Albion": "Stirling",
    "Annan Athletic": "Annan Athletic",
}

_SUFFIXES = (" fc", " afc", " football club", " f c")


def normalise(name: str) -> str:
    """Shape-only comparison key. Not a mapping — a fallback."""
    s = unicodedata.normalize("NFKD", str(name)).encode("ascii", "ignore").decode()
    s = s.lower().replace("&", "and").replace(".", "").replace("'", "")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    for suf in _SUFFIXES:
        if s.endswith(suf):
            s = s[: -len(suf)].strip()
    return s


def _canonical_index() -> dict[str, str]:
    idx: dict[str, str] = {}
    for _, canon, fd, _country in LIVE_CLUBS:
        idx.setdefault(normalise(canon), canon)
        idx.setdefault(normalise(fd), canon)
    for fd, canon, _country in HISTORICAL_ALIASES:
        idx.setdefault(normalise(fd), canon)
        idx.setdefault(normalise(canon), canon)
    for api_name, canon in ODDS_API_TO_CANONICAL.items():
        idx.setdefault(normalise(api_name), canon)
        idx.setdefault(normalise(canon), canon)
    return idx


def canonical_from_odds_api(name: str) -> tuple[str | None, str]:
    """Returns (canonical name or None, how it was matched).

    Three tiers, and the third is deliberately absent: there is no fuzzy
    edit-distance fallback. "Bristol City" and "Bristol Rovers" are two
    characters apart and are different clubs in different divisions; a
    near-miss matcher would eventually attach a price to the wrong match,
    which is worse than having no price at all.
    """
    if name in ODDS_API_TO_CANONICAL:
        return ODDS_API_TO_CANONICAL[name], "alias"
    key = normalise(name)
    idx = _canonical_index()
    if key in idx:
        return idx[key], "alias"
    return None, "unmatched"
