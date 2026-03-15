"""
Create realistic_base_reports.jsonl with curated Filipino/Taglish emergency reports.
No location references (GPS collected separately).
Run: python data/create_base_reports.py
"""
import json
import os
import random

OUTPUT = os.path.join(os.path.dirname(__file__), "realistic_base_reports.jsonl")
SEED = 42
random.seed(SEED)

# Incident types and severities (must match training schema)
INCIDENT_TYPES = ["Fire", "Crime", "Accident", "Medical", "Natural Disaster", "Other"]
SEVERITIES = ["Green", "Yellow", "Red", "Black"]

# Realistic Filipino/Taglish base phrases per incident type and severity
# Format: (incident_type, severity) -> list of (text, lang) where lang in ("fil", "tl", "en")
BASE_PHRASES = {
    # Fire
    ("Fire", "Green"): [
        ("May usok sa kusina pero walang apoy pa, safe naman.", "fil"),
        ("Sunog sa basurahan lang, konti na lang.", "fil"),
        ("Small fire sa labas, na-control na.", "tl"),
        ("May smoke sa bahay pero minor lang po.", "tl"),
        ("Kitchen fire, napatay na namin.", "en"),
        ("Electrical short, na-unplug na.", "tl"),
        ("Lutong apoy sa kalan, na-extinguish na.", "fil"),
    ],
    ("Fire", "Yellow"): [
        ("May sunog sa bahay, kailangan ng fire truck!", "fil"),
        ("Nasusunog yung tindahan, may nasugatan.", "fil"),
        ("House fire, need help!", "tl"),
        ("Sunog sa bodega, malakas na ang apoy.", "fil"),
        ("Building burning, may tao pa sa loob.", "tl"),
        ("Apartment fire, may usok na tumataas.", "tl"),
        ("Sunog sa warehouse, tumutulong ang mga tao.", "fil"),
    ],
    ("Fire", "Red"): [
        ("May sunog sa bahay, may tao na trap sa loob!", "fil"),
        ("Malakas na sunog, hindi makahinga ang mga tao!", "fil"),
        ("Fire sa apartment, people trapped inside!", "tl"),
        ("Sunog sa factory, maraming workers pa sa loob!", "fil"),
        ("Structure fire, may bata na naiwan!", "tl"),
        ("Inferno, hindi na makalabas ang mga tao!", "fil"),
        ("Building collapse from fire, may trapped!", "tl"),
    ],
    ("Fire", "Black"): [
        ("May patay sa sunog, hindi na humihinga.", "fil"),
        ("Nasunog ang bahay, may namatay na.", "fil"),
        ("Fire victim, no pulse na po.", "tl"),
        ("Multiple fatalities sa sunog.", "tl"),
    ],
    # Crime
    ("Crime", "Green"): [
        ("May nagnakaw ng cellphone, nakita na namin ang suspect.", "fil"),
        ("Nakawan sa sari-sari store, minor lang.", "fil"),
        ("Petty theft reported, suspect fled.", "en"),
        ("May nag-attempt ng break-in, na-scare off na.", "tl"),
        ("Vandalism lang, walang nasaktan.", "fil"),
    ],
    ("Crime", "Yellow"): [
        ("Holdap sa jeep, may nasaksak.", "fil"),
        ("May bugbog, nasugatan ang biktima.", "fil"),
        ("Robbery, may baril ang suspect.", "tl"),
        ("Assault, kailangan ng ambulance.", "fil"),
        ("May hostage sa tindahan, stable pa naman.", "tl"),
        ("Armed robbery, may nakaw na gamit.", "tl"),
        ("Snatcher, hinabol na ng mga tao.", "fil"),
    ],
    ("Crime", "Red"): [
        ("May binaril, malubha!", "fil"),
        ("Holdap may baril, may nasaktan!", "fil"),
        ("Shooting incident, severe bleeding!", "tl"),
        ("Stabbing, critical condition!", "tl"),
        ("Hostage situation, may kutsilyo!", "fil"),
        ("Active shooter, maraming nasugatan!", "tl"),
        ("Baril na naka-aim sa biktima!", "fil"),
    ],
    ("Crime", "Black"): [
        ("May patay sa shooting, wala nang pulso.", "fil"),
        ("Pinatay ang biktima, deceased na.", "fil"),
        ("Fatal stabbing, victim pronounced dead.", "tl"),
        ("Multiple gunshot victims, confirmed dead.", "tl"),
    ],
    # Accident
    ("Accident", "Green"): [
        ("Bangga ng kotse sa parking, walang sugat.", "fil"),
        ("Minor collision sa kalsada, gasgas lang.", "fil"),
        ("Car accident, no injuries reported.", "en"),
        ("Motor nadulas pero ok lang, minor lang.", "tl"),
    ],
    ("Accident", "Yellow"): [
        ("Motor naaksidente, nasugatan ang driver.", "fil"),
        ("Truck nasagasaan ang tao, kailangan ng ambulance.", "fil"),
        ("Car crash, may injured.", "tl"),
        ("Jeep tumama sa poste, may pasahero na nasaktan.", "fil"),
        ("Hit and run, victim needs treatment.", "tl"),
    ],
    ("Accident", "Red"): [
        ("Malubhang banggaan, may hindi humihinga!", "fil"),
        ("Motor crash, severe bleeding ang rider!", "fil"),
        ("Truck accident, people trapped!", "tl"),
        ("Rollover, critical ang pasahero!", "fil"),
    ],
    ("Accident", "Black"): [
        ("May namatay sa aksidente, wala nang pulso.", "fil"),
        ("Fatal crash, driver deceased.", "tl"),
        ("Nasagasaan, patay na po.", "fil"),
    ],
    # Medical
    ("Medical", "Green"): [
        ("May nahimatay pero nagising na, ok na.", "fil"),
        ("Mild allergic reaction, stable na.", "tl"),
        ("May sumakit ang ulo, minor lang.", "fil"),
        ("Diabetic, low sugar lang, na-revive na.", "tl"),
        ("Slight fever, nawala na.", "fil"),
    ],
    ("Medical", "Yellow"): [
        ("May stroke victim, kailangan agad ng hospital.", "fil"),
        ("Heart attack, stable pa pero urgent.", "fil"),
        ("Seizure, kailangan ng ambulance.", "tl"),
        ("May nahihirapang huminga, asthmatic.", "fil"),
        ("Elderly collapsed, needs treatment soon.", "tl"),
        ("Sugat malalim, kailangan tahi.", "fil"),
        ("Broken bone, may fracture.", "tl"),
    ],
    ("Medical", "Red"): [
        ("Hindi humihinga ang tao, CPR needed!", "fil"),
        ("Severe bleeding, malakas ang dugo!", "fil"),
        ("Heart attack, unconscious!", "tl"),
        ("May nanganak na, critical!", "fil"),
        ("Overdose, not breathing!", "tl"),
        ("Choking, hindi makahinga!", "fil"),
        ("Anaphylactic shock, walang gamot!", "tl"),
    ],
    ("Medical", "Black"): [
        ("Walang pulso, deceased na.", "fil"),
        ("No signs of life, patay na po.", "fil"),
        ("CPR failed, pronounced dead.", "tl"),
        ("Cardiac arrest, hindi na na-revive.", "fil"),
    ],
    # Natural Disaster
    ("Natural Disaster", "Green"): [
        ("Malakas ang ulan pero ok pa naman.", "fil"),
        ("May baha pero mababa pa.", "fil"),
        ("Storm damage sa bubong, minor lang.", "tl"),
        ("Minor landslide, walang nasaktan.", "fil"),
    ],
    ("Natural Disaster", "Yellow"): [
        ("Baha na, tumataas ang tubig.", "fil"),
        ("Lindol kanina, may mga nasugatan sa landslide.", "fil"),
        ("Flooding, need evacuation.", "tl"),
        ("Bagyo wasak ang bubong, may injured.", "fil"),
        ("Storm surge, kailangan ng rescue.", "tl"),
        ("Tsunami warning, nag-evacuate na.", "tl"),
    ],
    ("Natural Disaster", "Red"): [
        ("Baha mataas na, may tao na trap sa bubong!", "fil"),
        ("Landslide, may na-bury na tao!", "fil"),
        ("Earthquake, building collapse, people trapped!", "tl"),
        ("Flash flood, maraming hindi makalabas!", "fil"),
        ("Volcanic ash, may nahihirapang huminga!", "tl"),
        ("Storm surge, may naanod!", "fil"),
    ],
    ("Natural Disaster", "Black"): [
        ("May namatay sa baha, nakita ang bangkay.", "fil"),
        ("Landslide victim, deceased na.", "tl"),
        ("Drowning victim, no pulse.", "en"),
        ("Tsunami victim, confirmed dead.", "tl"),
    ],
    # Other
    ("Other", "Green"): [
        ("May bata nawawala, nakita na.", "fil"),
        ("Brownout, walang kuryente.", "fil"),
        ("Lost child found na po.", "tl"),
        ("Gas leak reported, minor lang.", "en"),
        ("Animal rescue, na-save na.", "tl"),
    ],
    ("Other", "Yellow"): [
        ("May bata nawawala pa, kailangan ng tulong.", "fil"),
        ("Suspicious package, nag-evacuate na.", "fil"),
        ("Missing person, hinahanap pa.", "tl"),
        ("Riot sa rally, may nasugatan.", "fil"),
        ("Power outage, maraming affected.", "tl"),
        ("Gas leak, amoy na malakas.", "fil"),
    ],
    ("Other", "Red"): [
        ("Stampede sa concert, maraming nasaktan!", "fil"),
        ("Gas leak malakas, may nahimatay!", "fil"),
        ("Child missing, may suspect!", "tl"),
        ("Riot, may baril!", "fil"),
        ("Mass panic, maraming naapakan!", "tl"),
        ("Bomb threat, nag-evacuate!", "fil"),
    ],
    ("Other", "Black"): [
        ("Nakita ang bangkay sa ilog.", "fil"),
        ("Missing person found deceased.", "tl"),
        ("Mass casualty, multiple fatalities.", "tl"),
    ],
}

# No location references - GPS data is collected separately

# Paraphrase prefixes/suffixes for variety
PREFIXES_FIL = ["Tulong! ", "Emergency! ", "Boss ", "Sir ", "Ma'am ", ""]
PREFIXES_TL = ["Help! ", "Urgent! ", ""]
SUFFIXES_FIL = [" Padala agad.", " Bilisan po.", " pls.", ""]
SUFFIXES_TL = [" Please respond.", " ASAP.", ""]


def expand_phrase(text: str, lang: str, incident: str, severity: str) -> list[str]:
    """Return text as single variant (no location injection - GPS collected separately)."""
    return [text]


def main():
    rows = []
    seen = set()
    target = 1000

    # Build flat list of (incident, severity, text, lang)
    pool = []
    for (incident, severity), phrases in BASE_PHRASES.items():
        for text, lang in phrases:
            for v in expand_phrase(text, lang, incident, severity):
                key = (v.strip(), incident, severity)
                if key not in seen:
                    seen.add(key)
                    pool.append({"text": v.strip(), "incident_types": [incident], "severity": severity, "lang": lang})

    # Add multi-label combinations (10% of total)
    multi_pool = []
    incidents = list(INCIDENT_TYPES)
    for _ in range(200):
        combo = random.sample(incidents, 2)
        sev = random.choice(SEVERITIES)
        templates = [
            f"May {combo[0].lower()} at {combo[1].lower()}, {sev.lower()}.",
            f"{combo[0]} and {combo[1]} reported, {sev.lower()}.",
            f"{combo[0]} plus {combo[1]}, {sev.lower()}.",
        ]
        t = random.choice(templates)
        key = (t, tuple(combo), sev)
        if key not in seen:
            seen.add(key)
            multi_pool.append({"text": t, "incident_types": combo, "severity": sev, "lang": "tl"})

    pool.extend(multi_pool)
    random.shuffle(pool)

    # Repeat/paraphrase to reach 1000
    while len(rows) < target:
        for p in pool:
            if len(rows) >= target:
                break
            text = p["text"]
            # Add prefix/suffix variation
            if p["lang"] == "fil" and random.random() < 0.2:
                text = random.choice(PREFIXES_FIL) + text + random.choice(SUFFIXES_FIL)
            elif p["lang"] == "tl" and random.random() < 0.2:
                text = random.choice(PREFIXES_TL) + text + random.choice(SUFFIXES_TL)
            text = text.strip()
            key = (text, tuple(p["incident_types"]), p["severity"])
            if key not in seen:
                seen.add(key)
                rows.append({
                    "text": text,
                    "incident_types": p["incident_types"],
                    "severity": p["severity"],
                })

    # If still short, duplicate with light variation
    idx = 0
    while len(rows) < target and idx < len(rows):
        r = rows[idx]
        t = r["text"]
        if random.random() < 0.3:
            t = t + " pls" if not t.endswith("pls") else t[:-4]
        elif random.random() < 0.3:
            t = t.replace("!", ".").replace(".", "!")
        if (t, tuple(r["incident_types"]), r["severity"]) not in seen:
            seen.add((t, tuple(r["incident_types"]), r["severity"]))
            rows.append({"text": t, "incident_types": r["incident_types"], "severity": r["severity"]})
        idx += 1

    rows = rows[:target]
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"Created {len(rows)} base reports in {OUTPUT}")
    # Quick distribution check
    from collections import Counter
    inc_counts = Counter()
    sev_counts = Counter()
    for r in rows:
        for it in r["incident_types"]:
            inc_counts[it] += 1
        sev_counts[r["severity"]] += 1
    print("Incident distribution:", dict(inc_counts))
    print("Severity distribution:", dict(sev_counts))


if __name__ == "__main__":
    main()
