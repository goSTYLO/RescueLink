from typing import Optional, Tuple, Dict, List

FALLBACK_INCIDENT_KEYWORDS = {
    "Fire": ["sunog", "fire", "usok", "smoke", "apoy", "nasusunog"],
    "Crime": ["nakaw", "theft", "holdap", "robbery", "baril", "shooting", "crime", "assault"],
    "Accident": ["aksidente", "accident", "bangga", "collision", "nahulog", "crash"],
    "Medical": ["dugo", "bleeding", "hika", "asthma", "atake", "heart attack", "medical", "hinimatay"],
    "Natural Disaster": ["baha", "flood", "bagyo", "storm", "landslide", "lindol", "earthquake", "disaster"],
}

FALLBACK_SEVERITY_KEYWORDS = {
    "Red": ["hindi humihinga", "not breathing", "critical", "critical condition", "malubha", "severe bleeding", "unconscious"],
    "Yellow": ["nasugatan", "injured", "urgent", "kailangan agad", "delayed"],
    "Green": ["minor", "gasgas", "stable", "kalmado", "non urgent"],
    "Black": ["deceased", "patay", "no pulse"],
}


def _normalize_text(text: str) -> str:
    return (text or "").strip().lower()


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


def apply_keyword_fallback(
    text: str,
    incident_labels: Optional[List[str]] = None,
    severity_labels: Optional[List[str]] = None,
) -> Tuple[List[str], str, Dict[str, List[str]]]:
    normalized = _normalize_text(text)
    type_matches: Dict[str, List[str]] = {}
    severity_matches: Dict[str, List[str]] = {}

    for incident_type, keywords in FALLBACK_INCIDENT_KEYWORDS.items():
        matched = [keyword for keyword in keywords if keyword in normalized]
        if matched:
            type_matches[incident_type] = matched

    for severity_level, keywords in FALLBACK_SEVERITY_KEYWORDS.items():
        matched = [keyword for keyword in keywords if keyword in normalized]
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
