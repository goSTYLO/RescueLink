import re
from typing import Optional, Tuple, Dict, List

# --- Crime (grouped; public-safety subset drops false Fire) ---

CRIME_FIGHT_KEYWORDS = [
    "suntok",
    "sinuntok",
    "suntukan",
    "nagsusuntukan",
    "nagsuntukan",
    "nag-aaway",
    "nag-away",
    "nagaaway",
    "inaaway",
    "may away",
    "rambol",
    "nagrarambol",
    "rambulan",
    "sapak",
    "sapakan",
    "nagsasapakan",
    "gulpi",
    "ginugulpi",
    "bakbakan",
    "people fighting",
    "group fighting",
    "group of people fighting",
    "street fight",
    "in a fight",
    "physical fight",
    "brawl",
]

CRIME_WEAPON_KEYWORDS = [
    "amok",
    "nag-aamok",
    "nag aamok",
    "nagaamok",
    "itak",
    "patalim",
    "kutsilyo",
    "saksak",
    "nagsaksak",
    "nasaksak",
    "na-stab",
    "stabbing",
    "binaril",
    "baril",
    "shooting",
    "gunshot",
    "hostage",
    "may dalang itak",
    "may dalang baril",
    "armed robbery",
]

CRIME_THEFT_KEYWORDS = [
    "nakaw",
    "nagnakaw",
    "nakawan",
    "theft",
    "holdap",
    "robbery",
    "snatcher",
    "snatch",
]

CRIME_ASSAULT_KEYWORDS = [
    "assault",
    "crime",
]

CRIME_PUBLIC_SAFETY_KEYWORDS = [
    *CRIME_FIGHT_KEYWORDS,
    *CRIME_WEAPON_KEYWORDS,
]

FIRE_KEYWORDS = [
    "sunog",
    "fire",
    "usok",
    "smoke",
    "apoy",
    "nasusunog",
    "nasunog",
    "nagliyab",
    "may apoy",
    "lumalabas ang apoy",
    "nasunog na kotse",
    "usok sa kusina",
    "may usok",
]

ACCIDENT_KEYWORDS = [
    "aksidente",
    "accident",
    "naaksidente",
    "bangga",
    "nagbanggaan",
    "banggaan",
    "nakabangga",
    "bumangga",
    "malubhang banggaan",
    "collision",
    "crash",
    "jeep",
    "kotse",
    "trak",
    "nasagasaan",
    "hit and run",
    "nadulas",
    "rollover",
    "tumama sa poste",
    "nahulog",
    "nahulog sa trabaho",
    "gumuho ang pader",
    "minor collision",
    "gasgas",
]

MEDICAL_KEYWORDS = [
    "dugo",
    "bleeding",
    "hika",
    "asthma",
    "atake",
    "atake sa puso",
    "heart attack",
    "medical",
    "hinimatay",
    "nahimatay",
    "sugat",
    "nasugatan",
    "nasaktan",
    "may sugat",
    "may sugat ang",
    "hindi humihinga",
    "walang pulso",
    "wala nang pulso",
    "cpr",
    "cardiac arrest",
    "stroke",
    "kombulsyon",
    "seizure",
    "nanganak",
    "nahihirapang huminga",
]

NATURAL_DISASTER_KEYWORDS = [
    "baha",
    "flood",
    "flash flood",
    "bagyo",
    "storm surge",
    "landslide",
    "gumuho",
    "natabunan ng lupa",
    "lindol",
    "earthquake",
    "tsunami",
    "volcanic ash",
    "tumataas ang tubig",
    "tumataas na yung tubig",
    "natumbang puno",
    "puno bumagsak",
    "storm damage",
    "disaster",
]

OTHER_KEYWORDS = [
    "nawawala",
    "nawawalang",
    "lost child",
    "missing person",
    "missing child",
    "magulang",
    "hinahanap",
    "hahanapin",
    "pumahanap",
    "walang kasama",
    "nawawalang bata",
    "nawawalang tao",
    "lost person",
    "child missing",
    "gas leak",
    "amoy gas",
    "brownout",
    "power outage",
    "walang kuryente",
    "animal rescue",
    "dog attack",
    "aso nanakit",
]

FALLBACK_INCIDENT_KEYWORDS = {
    "Fire": FIRE_KEYWORDS,
    "Crime": [
        *CRIME_THEFT_KEYWORDS,
        *CRIME_ASSAULT_KEYWORDS,
        *CRIME_PUBLIC_SAFETY_KEYWORDS,
    ],
    "Accident": ACCIDENT_KEYWORDS,
    "Medical": MEDICAL_KEYWORDS,
    "Natural Disaster": NATURAL_DISASTER_KEYWORDS,
    "Other": OTHER_KEYWORDS,
}

FALLBACK_SEVERITY_KEYWORDS = {
    "Red": [
        "hindi humihinga",
        "not breathing",
        "critical",
        "critical condition",
        "malubha",
        "severe bleeding",
        "unconscious",
        "kailangan ng agarang tugon",
        "agarang tugon",
    ],
    "Yellow": [
        "nasugatan",
        "injured",
        "urgent",
        "kailangan agad",
        "delayed",
        "needs treatment",
    ],
    "Green": [
        "minor",
        "gasgas",
        "stable",
        "kalmado",
        "non urgent",
        "walang nasaktan",
        "ok na po",
    ],
    "Black": [
        "deceased",
        "patay",
        "no pulse",
        "wala nang pulso",
        "walang pulso",
        "namatay",
        "no signs of life",
        "confirmed dead",
        "pronounced dead",
    ],
}


def _normalize_text(text: str) -> str:
    return (text or "").strip().lower()


def _keyword_in_text(keyword: str, normalized_text: str) -> bool:
    """Match keywords on word boundaries to avoid false positives (e.g. baha in bahay)."""
    token = (keyword or "").strip().lower()
    if not token or not normalized_text:
        return False
    if " " in token:
        return token in normalized_text
    pattern = rf"(?<![a-z0-9]){re.escape(token)}(?![a-z0-9])"
    return re.search(pattern, normalized_text) is not None


def _resolve_label(label: str, available_labels: Optional[List[str]]) -> str:
    labels = available_labels or []
    if label in labels:
        return label

    target = "".join(label.lower().split())
    for candidate in labels:
        if "".join(candidate.lower().split()) == target:
            return candidate

    return labels[0] if labels else label


def decide_fallback_reason(
    max_confidence: float,
    no_types_above_threshold: bool,
    threshold: float,
    model_error: bool = False,
) -> Optional[str]:
    if model_error:
        return "model_error"
    if max_confidence < threshold:
        return "low_confidence"
    if no_types_above_threshold:
        return "no_type_above_threshold"
    return None


def _type_has_keyword_evidence(incident_type: str, normalized_text: str) -> bool:
    keywords = FALLBACK_INCIDENT_KEYWORDS.get(incident_type, [])
    return any(_keyword_in_text(keyword, normalized_text) for keyword in keywords)


def _has_crime_public_safety_evidence(normalized_text: str) -> bool:
    return any(_keyword_in_text(keyword, normalized_text) for keyword in CRIME_PUBLIC_SAFETY_KEYWORDS)


def detect_keyword_matched_types(
    text: str,
    incident_labels: Optional[List[str]] = None,
) -> List[str]:
    """Return incident types whose keywords appear in text (most matches first)."""
    normalized = _normalize_text(text)
    type_matches: Dict[str, List[str]] = {}

    for incident_type, keywords in FALLBACK_INCIDENT_KEYWORDS.items():
        matched = [keyword for keyword in keywords if _keyword_in_text(keyword, normalized)]
        if matched:
            type_matches[incident_type] = matched

    if not type_matches:
        return []

    ordered = sorted(type_matches.keys(), key=lambda item: len(type_matches[item]), reverse=True)
    return [_resolve_label(item, incident_labels) for item in ordered]


def resolve_confidence_for_type(
    incident_type: Optional[str],
    confidence_scores: Dict[str, float],
) -> float:
    if not incident_type or not confidence_scores:
        return 0.0
    if incident_type in confidence_scores:
        return float(confidence_scores[incident_type])

    target = incident_type.strip().lower()
    for key, value in confidence_scores.items():
        if str(key).strip().lower() == target:
            return float(value)
    return 0.0


def rank_and_promote_incident_types(
    text: str,
    confidence_scores: Dict[str, float],
    threshold: float,
    incident_labels: Optional[List[str]] = None,
) -> Tuple[List[str], bool, bool]:
    """
    Build ranked incident type list:
    1. Types with model confidence >= threshold
    2. Keyword-matched types missing from that list (keeps model score)
    3. Sort by confidence descending

    Returns (ranked_types, keyword_promoted, no_types_above_threshold).
    no_types_above_threshold reflects model scores only (before keyword promotion).
    """
    labels = incident_labels or []
    above_threshold = [
        label
        for label in labels
        if confidence_scores.get(label, 0.0) >= threshold
    ]
    no_types_above_threshold = len(above_threshold) == 0

    selected = set(above_threshold)
    keyword_promoted = False
    normalized = _normalize_text(text)
    keyword_matched = detect_keyword_matched_types(text, incident_labels=labels)
    keyword_matched_set = set(keyword_matched)

    for matched_type in keyword_matched:
        if matched_type not in selected:
            selected.add(matched_type)
            keyword_promoted = True

    fire_competing_types = {"Accident", "Medical", "Other"}
    suppress_false_fire = (
        keyword_matched_set.intersection(fire_competing_types)
        or _has_crime_public_safety_evidence(normalized)
    )
    if suppress_false_fire:
        if (
            "Fire" in selected
            and "Fire" not in keyword_matched_set
            and not _type_has_keyword_evidence("Fire", normalized)
        ):
            selected.discard("Fire")

    if not selected:
        return [], keyword_promoted, no_types_above_threshold

    ranked = sorted(
        selected,
        key=lambda label: (
            0 if label in keyword_matched_set else 1,
            -confidence_scores.get(label, 0.0),
        ),
    )
    return ranked, keyword_promoted, no_types_above_threshold


def apply_keyword_fallback(
    text: str,
    incident_labels: Optional[List[str]] = None,
    severity_labels: Optional[List[str]] = None,
) -> Tuple[List[str], str, Dict[str, List[str]]]:
    normalized = _normalize_text(text)
    type_matches: Dict[str, List[str]] = {}
    severity_matches: Dict[str, List[str]] = {}

    for incident_type, keywords in FALLBACK_INCIDENT_KEYWORDS.items():
        matched = [keyword for keyword in keywords if _keyword_in_text(keyword, normalized)]
        if matched:
            type_matches[incident_type] = matched

    for severity_level, keywords in FALLBACK_SEVERITY_KEYWORDS.items():
        matched = [keyword for keyword in keywords if _keyword_in_text(keyword, normalized)]
        if matched:
            severity_matches[severity_level] = matched

    selected_types = sorted(type_matches.keys(), key=lambda item: len(type_matches[item]), reverse=True)
    if not selected_types:
        selected_types = ["Other"]

    if severity_matches:
        selected_severity = max(severity_matches.items(), key=lambda item: len(item[1]))[0]
    else:
        selected_severity = "Yellow"

    resolved_types = [_resolve_label(item, incident_labels) for item in selected_types]
    resolved_severity = _resolve_label(selected_severity, severity_labels)

    return resolved_types, resolved_severity, {
        "incident_type_matches": [f"{key}:{','.join(values)}" for key, values in type_matches.items()],
        "severity_matches": [f"{key}:{','.join(values)}" for key, values in severity_matches.items()],
    }
