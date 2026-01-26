import csv
import random
import os

# Always save inside the data folder of RescueLink AI
OUTPUT_FILE = os.path.join("data", "emergency_dataset.csv")

# Incident types - Prioritize Filipino for city use
incident_types = {
    "Fire": {
        "fil": [
            "sunog sa bahay", "nasusunog na building", "may usok sa kusina",
            "kuryente sunog", "nagliliyab na bahay", "tumatakbo ang apoy",
            "nasusunog yung store", "may nag-aapoy na kotse", "gasoline sunog",
            "chemical fire", "sunog sa factory", "bodega nasusunog"
        ],
        "en": [
            "house fire", "building burning", "kitchen smoke",
            "electrical fire", "structure fire", "car fire"
        ]
    },
    "Crime": {
        "fil": [
            "holdap sa tindahan", "pananakit sa kalsada", "may kutsilyo",
            "binaril ang tao", "nakawan sa bahay", "hostage situation",
            "nag-aaway ng malakas", "bugbugan", "may nagnakaw",
            "pagpatay", "kidnapping", "gulo sa bar"
        ],
        "en": [
            "robbery", "assault on street", "stabbing",
            "shooting incident", "burglary", "hostage"
        ]
    },
    "Accident": {
        "fil": [
            "bangga ng kotse", "motor crash", "jeep tumama sa poste",
            "truck nasagasaan ang tao", "hit and run", "nasagasaan",
            "nahulog sa kanal", "nadulas", "naaksidente sa construction",
            "nadaganan ng gamit", "banggaan sa highway", "rollover"
        ],
        "en": [
            "car crash", "motorcycle collision", "vehicle accident",
            "hit and run", "truck accident", "road collision"
        ]
    },
    "Medical": {
        "fil": [
            "nahimatay", "hindi humihinga", "heart attack", 
            "kombulsyon", "stroke", "nahihirapang huminga",
            "duguan", "sugatan", "buntis manganak", 
            "diabetic emergency", "overdose", "allergic reaction"
        ],
        "en": [
            "collapsed person", "not breathing", "chest pain",
            "seizure", "stroke", "bleeding"
        ]
    },
    "Natural Disaster": {
        "fil": [
            "baha sa kalsada", "lindol", "landslide sa bundok",
            "bagyo wasak ang bubong", "malakas na ulan", "storm surge",
            "lupa gumuho", "puno tumama sa bahay", "hangin nilipat ang yero",
            "tubig baha sa loob", "flash flood", "ulan di tumitigil"
        ],
        "en": [
            "flooding", "earthquake", "landslide",
            "typhoon damage", "heavy rain", "storm"
        ]
    },
    "Other": {
        "fil": [
            "bata nawawala", "walang kuryente", "aso na-trap",
            "tagas ng tubig", "brownout", "nagwawala ang tao",
            "gulo sa rally", "ahas sa bahay", "nagkagulo ang mga tao",
            "sarado ang daan", "nakita ang bangkay", "suspek na pakete",
            "riot", "stampede", "gas leak", "kemikal natapon",
            "may taong inuuusapan nang walang tigil", "basag na rehistro", "suka ng agua",
            "mayroon na bukas na iwanan", "nakita ang pera sa daan", "may bayong anghang",
            "tumutunog na siren", "may kakaibang kadahilan", "taong nakadating na basta-basta",
            "may isda sa ilog", "gubat na mapapasok", "sira ang tulay",
            "maraming tao sa isang lugar", "nag-aaksidente ang pulis", "nagsumiklab ang gulo",
            "may batang umiiyak", "tumubalik na kuryente", "may gutom na tao",
            "hindi alam kung saan", "may sekswal na guro", "may ligtas na tao",
            "nawawalang alahas", "nahulog na phone", "basag na baso",
            "sirang bahay", "sira ang tubig", "maling ulam"
        ],
        "en": [
            "lost child", "power outage", "trapped animal",
            "water main break", "public disturbance", "gas leak",
            "loose animal", "broken fence", "lost person",
            "strange object", "someone acting erratic", "unknown emergency",
            "collapsed infrastructure", "suspicious activity", "unusual noise",
            "found belongings", "building damage", "reported confusion",
            "welfare check needed", "lost pet", "property damage",
            "door forced open", "broken window", "trespasser",
            "tree down", "debris blocking road", "fence collapse",
            "manhole open", "missing person", "noise complaint",
            "people gathering", "unauthorized entry", "general alarm"
        ]
    }
}

# START triage severity templates - Filipino prioritized
severity_templates = {
    "Green": {  # Minor
        "fil": [
            "walang sugat", "safe naman", "konting galos lang",
            "kaya pang maghintay", "ok lang", "minor lang"
        ],
        "en": ["no injuries", "safe to wait", "minor only"]
    },
    "Yellow": {  # Delayed
        "fil": [
            "kailangan ng tulong pero stable", "posibleng bali", 
            "kailangan tignan", "medyo masakit", "puwedeng delayed"
        ],
        "en": ["needs treatment soon", "possible fracture", "can wait"]
    },
    "Red": {  # Immediate
        "fil": [
            "malakas na dugo", "hindi makahinga", "kailangan agad",
            "critical na", "buhay ang nakataya", "agarang emergency"
        ],
        "en": ["severe bleeding", "not breathing", "life-threatening", "urgent"]
    },
    "Black": {  # Expectant  
        "fil": [
            "walang buhay", "hindi na umaandar", "patay na",
            "wala nang pulso", "deceased"
        ],
        "en": ["no signs of life", "deceased", "no pulse"]
    }
}

# Realistic emergency report templates - 1-2 sentences, Filipino priority (70%)
sentence_templates_fil = [
    "May {incident}, {severity}.",
    "{incident} dito sa {location}, {severity}!",
    "Emergency! {incident}, {severity}.",
    "Tulong! {incident}, {severity}.",
    "{incident} nangyari, {severity}. Padala agad.",
    "Grabe {incident}! {severity}. Bilisan!",
    "Boss may {incident}, {severity}.",
    "{incident} sa {location}. {severity}.",
    "Nag-report ng {incident}, {severity}.",
    "Biglaang {incident}, {severity}!"
]

sentence_templates_en = [
    "{incident}, {severity}.",
    "Emergency: {incident}, {severity}.",
    "{incident} at {location}, {severity}.",
    "Urgent - {incident}, {severity}!"
]

# Location names (Filipino city context)
locations = [
    "Barangay Centro", "Poblacion", "San Jose", "Bagong Silang",
    "highway", "palengke", "plaza", "elementary school",
    "kanto", "tabi ng simbahan", "sakayan", "market"
]

# Light imperfection injection for realism (reduced for quality)
def add_natural_variation(text):
    variations = [
        lambda s: s + " po",                        # polite marker
        lambda s: s + " pls",                       # casual
        lambda s: s.replace("!", "."),              # punctuation
        lambda s: s.lower(),                        # lowercase
        lambda s: s.upper()                         # urgent caps
    ]
    if random.random() < 0.15:  # Only 15% variation for higher quality
        func = random.choice(variations)
        return func(text)
    return text

# Label mappings
incident_type_labels = {name: idx for idx, name in enumerate(incident_types.keys())}
severity_labels = {name: idx for idx, name in enumerate(severity_templates.keys())}

# Generate dataset
rows = []
TARGET_ROWS = 15000  # High-quality synthetic dataset
id_counter = 1

while len(rows) < TARGET_ROWS:
    # Pick 1–2 incident types (multi-label) - weighted toward single label (70%)
    num_incidents = 1 if random.random() < 0.7 else 2
    incident_choices = random.sample(list(incident_types.keys()), k=num_incidents)
    
    # 80% Filipino, 20% English
    use_filipino = random.random() < 0.8
    lang = "fil" if use_filipino else "en"
    
    # Get incident phrases in chosen language
    incident_phrases = [random.choice(incident_types[it][lang]) for it in incident_choices]
    incident_text = " at ".join(incident_phrases) if lang == "fil" else " and ".join(incident_phrases)

    # Pick severity in same language
    severity = random.choice(list(severity_templates.keys()))
    severity_phrase = random.choice(severity_templates[severity][lang])
    
    # Choose template from appropriate language
    sentence_template = random.choice(sentence_templates_fil if lang == "fil" else sentence_templates_en)

    # Build sentence
    text = sentence_template.format(
        incident=incident_text,
        severity=severity_phrase,
        location=random.choice(locations) if "{location}" in sentence_template else ""
    )

    # Add light natural variation
    text = add_natural_variation(text)

    # Append row with multi-label incident types
    rows.append([
        id_counter,
        text,
        incident_choices,  # list of incident types
        severity,
        [incident_type_labels[it] for it in incident_choices],  # list of numeric labels
        severity_labels[severity],
        lang
    ])
    id_counter += 1

# Ensure data folder exists
os.makedirs("data", exist_ok=True)

# Write CSV
with open(OUTPUT_FILE, mode="w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["id", "text", "incident_types", "severity", "type_labels", "severity_label", "lang"])
    writer.writerows(rows)

print(f"Generated {len(rows)} emergency scenarios in {OUTPUT_FILE}")