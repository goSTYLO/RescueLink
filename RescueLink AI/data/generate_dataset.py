import csv
import random

OUTPUT_FILE = "emergency_dataset.csv"

incident_types = {
    "Fire": {
        "keywords": [
            "house fire", "building on fire", "smoke coming out",
            "kitchen fire", "electrical fire", "burning structure"
        ]
    },
    "Crime": {
        "keywords": [
            "armed robbery", "assault", "man with a knife",
            "gun threat", "domestic violence", "break-in"
        ]
    },
    "Accident": {
        "keywords": [
            "car accident", "motorcycle crash", "vehicle collision",
            "hit and run", "truck accident", "road crash"
        ]
    },
    "Medical": {
        "keywords": [
            "person collapsed", "not breathing", "chest pain",
            "seizure", "unconscious patient", "difficulty breathing"
        ]
    },
    "Natural Disaster": {
        "keywords": [
            "flooding", "earthquake damage", "landslide",
            "typhoon impact", "storm surge", "heavy rainfall"
        ]
    },
    "Other": {
        "keywords": [
            "lost child", "power outage", "animal trapped",
            "unknown emergency", "public disturbance"
        ]
    }
}

severity_templates = {
    "Minor": [
        "no injuries reported",
        "situation under control",
        "minor issue only",
        "no immediate danger"
    ],
    "Moderate": [
        "needs assistance",
        "possible injuries",
        "situation worsening",
        "requires response"
    ],
    "Severe": [
        "serious injuries reported",
        "people are injured",
        "danger increasing rapidly",
        "urgent assistance needed"
    ],
    "Critical": [
        "people trapped",
        "life-threatening situation",
        "immediate danger to life",
        "multiple casualties reported"
    ]
}

sentence_templates = [
    "There is a {incident} reported, {severity}.",
    "Emergency reported involving {incident}, {severity}.",
    "Responders needed for {incident}, {severity}.",
    "Urgent situation: {incident}, {severity}.",
    "Incident reported: {incident}, {severity}."
]

rows = []
TARGET_ROWS = 2000

while len(rows) < TARGET_ROWS:
    incident_type = random.choice(list(incident_types.keys()))
    incident_phrase = random.choice(incident_types[incident_type]["keywords"])
    severity = random.choice(list(severity_templates.keys()))
    severity_phrase = random.choice(severity_templates[severity])
    sentence_template = random.choice(sentence_templates)

    text = sentence_template.format(
        incident=incident_phrase,
        severity=severity_phrase
    )

    rows.append([text, incident_type, severity])

with open(OUTPUT_FILE, mode="w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["text", "incident_type", "severity"])
    writer.writerows(rows)

print(f"Generated {len(rows)} emergency scenarios in {OUTPUT_FILE}")
