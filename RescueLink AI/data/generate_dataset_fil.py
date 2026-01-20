import csv
import random

OUTPUT_FILE = "emergency_dataset_fil.csv"

incident_types = {
    "Sunog": {
        "keywords": [
            "sunog sa bahay", "nasusunog na gusali", "may usok na lumalabas",
            "sunog sa kusina", "sunog sa kuryente", "nasusunog na istruktura"
        ]
    },
    "Krimen": {
        "keywords": [
            "armadong pagnanakaw", "pananakit", "lalaking may kutsilyo",
            "banta ng baril", "karahasan sa bahay", "sapilitang pasok"
        ]
    },
    "Aksidente": {
        "keywords": [
            "aksidente sa kotse", "banggaan ng motorsiklo", "salpukan ng sasakyan",
            "hit and run", "aksidente sa trak", "banggaan sa kalsada"
        ]
    },
    "Medikal": {
        "keywords": [
            "may taong bumagsak", "hindi humihinga", "pananakit ng dibdib",
            "kombulsyon", "walang malay na pasyente", "nahihirapang huminga"
        ]
    },
    "Sakunang Likas": {
        "keywords": [
            "baha", "pinsala mula sa lindol", "pagguho ng lupa",
            "epekto ng bagyo", "storm surge", "malakas na ulan"
        ]
    },
    "Iba Pa": {
        "keywords": [
            "nawawalang bata", "brownout", "hayop na na-trap",
            "hindi matukoy na emergency", "gulo sa publiko"
        ]
    }
}

severity_templates = {
    "Minor": [
        "walang nasugatan",
        "kontrolado na ang sitwasyon",
        "maliit na problema lamang",
        "walang agarang panganib"
    ],
    "Moderate": [
        "kailangan ng tulong",
        "posibleng may nasugatan",
        "lumalala ang sitwasyon",
        "kailangan ng agarang tugon"
    ],
    "Severe": [
        "may malubhang sugatan",
        "may mga taong nasaktan",
        "tumitindi ang panganib",
        "kailangan ng agarang tulong"
    ],
    "Critical": [
        "may mga taong na-trap",
        "sitwasyong nagbabanta sa buhay",
        "agarang panganib sa buhay",
        "maraming nasugatan"
    ]
}

sentence_templates = [
    "May naiulat na {incident}, {severity}.",
    "Emergency na kinasasangkutan ng {incident}, {severity}.",
    "Kailangan ng responders para sa {incident}, {severity}.",
    "Agarang sitwasyon: {incident}, {severity}.",
    "Insidente: {incident}, {severity}.",
    "Inalerto ang mga awtoridad: {incident}, {severity}.",
    "Ipadala ang mga yunit para sa {incident}, {severity}.",
    "Kritikal na alerto: {incident}, {severity}."
]

# Map incident types and severity levels to numeric labels
incident_type_labels = {name: idx for idx, name in enumerate(incident_types.keys())}
severity_labels = {name: idx for idx, name in enumerate(severity_templates.keys())}

rows = []
TARGET_ROWS = 2000
id_counter = 1

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

    rows.append([
        id_counter,
        text,
        incident_type,
        severity,
        incident_type_labels[incident_type],
        severity_labels[severity]
    ])
    id_counter += 1

with open(OUTPUT_FILE, mode="w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["id", "text", "incident_type", "severity", "type_label", "severity_label"])
    writer.writerows(rows)

print(f"Generated {len(rows)} emergency scenarios in {OUTPUT_FILE}")
