import csv
import random
import os

# Always save inside the data folder of RescueLink AI
OUTPUT_FILE = os.path.join("data", "emergency_dataset.csv")

# Incident types with expanded "Other"
incident_types = {
    "Fire": {
        "keywords": [
            "house fire", "building on fire", "smoke coming out",
            "kitchen fire", "electrical fire", "burning structure",
            "sunog sa bahay", "nasusunog na gusali", "may usok na lumalabas",
            "sunog sa kusina", "sunog sa kuryente", "nasusunog na istruktura",
            "may fire sa bahay", "building on fire na", "smoke lumalabas"
        ]
    },
    "Crime": {
        "keywords": [
            "armed robbery", "assault", "man with a knife",
            "gun threat", "domestic violence", "break-in",
            "armadong pagnanakaw", "pananakit", "lalaking may kutsilyo",
            "banta ng baril", "karahasan sa bahay", "sapilitang pasok",
            "may holdap", "nag-assault", "may break-in sa bahay"
        ]
    },
    "Accident": {
        "keywords": [
            "car accident", "motorcycle crash", "vehicle collision",
            "hit and run", "truck accident", "road crash",
            "aksidente sa kotse", "banggaan ng motorsiklo", "salpukan ng sasakyan",
            "aksidente sa trak", "banggaan sa kalsada",
            "nag-crash yung kotse", "may accident sa road", "truck bangga"
        ]
    },
    "Medical": {
        "keywords": [
            "person collapsed", "not breathing", "chest pain",
            "seizure", "unconscious patient", "difficulty breathing",
            "may taong bumagsak", "hindi humihinga", "pananakit ng dibdib",
            "kombulsyon", "walang malay na pasyente", "nahihirapang huminga",
            "tao bumagsak", "nahihirapan huminga", "may seizure yung pasyente"
        ]
    },
    "Natural Disaster": {
        "keywords": [
            "flooding", "earthquake damage", "landslide",
            "typhoon impact", "storm surge", "heavy rainfall",
            "baha", "pinsala mula sa lindol", "pagguho ng lupa",
            "epekto ng bagyo", "malakas na ulan",
            "may flood", "earthquake damage na", "landslide nangyari"
        ]
    },
    "Other": {
        "keywords": [
            # Existing
            "lost child", "power outage", "animal trapped",
            "unknown emergency", "public disturbance",
            "nawawalang bata", "brownout", "hayop na na-trap",
            "hindi matukoy na emergency", "gulo sa publiko",
            "may lost child", "brownout sa area", "animal na-trap",

            # Crowd & disturbance
            "crowd panic", "stampede", "riot", "protest turned violent",
            "tao nagwawala", "maraming tao nagkakagulo", "may rally",

            # Environmental / utility
            "gas leak", "chemical spill", "toxic smell", "radiation alert",
            "tagas ng gas", "natapon na kemikal", "amoy na nakakalason",

            # Unusual noises / unknown
            "loud explosion sound", "mysterious noise", "unknown smell",
            "malakas na putok", "hindi matukoy na tunog", "may kakaibang amoy",

            # Missing / stranded
            "missing person", "stranded passengers", "lost hiker",
            "nawawalang tao", "naiwang pasahero", "nawalang mountaineer",

            # Animal / wildlife
            "wild animal loose", "snake sighting", "dog attack",
            "aso nanakit", "may ahas", "hayop gumagala",

            # Infrastructure / misc
            "bridge collapse", "building evacuation", "road blockage",
            "gumuhong tulay", "inilikas ang gusali", "sarado ang kalsada"
        ]
    }
}

severity_templates = {
    "Minor": [
        "no injuries reported",
        "situation under control",
        "minor issue only",
        "no immediate danger",
        "walang nasugatan",
        "kontrolado na ang sitwasyon",
        "maliit na problema lamang",
        "walang agarang panganib"
    ],
    "Moderate": [
        "needs assistance",
        "possible injuries",
        "situation worsening",
        "requires response",
        "kailangan ng tulong",
        "posibleng may nasugatan",
        "lumalala ang sitwasyon",
        "kailangan ng agarang tugon"
    ],
    "Severe": [
        "serious injuries reported",
        "people are injured",
        "danger increasing rapidly",
        "urgent assistance needed",
        "may malubhang sugatan",
        "may mga taong nasaktan",
        "tumitindi ang panganib",
        "kailangan ng agarang tulong"
    ],
    "Critical": [
        "people trapped",
        "life-threatening situation",
        "immediate danger to life",
        "multiple casualties reported",
        "may mga taong na-trap",
        "sitwasyong nagbabanta sa buhay",
        "agarang panganib sa buhay",
        "maraming nasugatan"
    ]
}

sentence_templates = [
    "There is a {incident} reported, {severity}.",
    "Emergency reported involving {incident}, {severity}.",
    "Responders needed for {incident}, {severity}.",
    "Urgent situation: {incident}, {severity}.",
    "Incident reported: {incident}, {severity}.",
    "Authorities alerted: {incident}, {severity}.",
    "Dispatch units for {incident}, {severity}.",
    "Critical alert: {incident}, {severity}.",
    "May naiulat na {incident}, {severity}.",
    "Emergency na kinasasangkutan ng {incident}, {severity}.",
    "Kailangan ng responders para sa {incident}, {severity}.",
    "Agarang sitwasyon: {incident}, {severity}.",
    "Insidente: {incident}, {severity}.",
    "Inalerto ang mga awtoridad: {incident}, {severity}.",
    "Ipadala ang mga yunit para sa {incident}, {severity}.",
    "Kritikal na alerto: {incident}, {severity}.",
    "Grabe, {incident}! {severity}.",
    "Help! {incident}, {severity}.",
    "Narinig ko ang {incident}, {severity}.",
    "Parang may {incident}, {severity}."
]

# Imperfection injection
def dirty_text(text):
    noise_options = [
        lambda s: s.replace("a", ""),               # drop a letter
        lambda s: s + " uhm",                       # add filler
        lambda s: s.replace(" ", ""),               # remove spaces
        lambda s: s.replace("fire", "fyr"),         # typo
        lambda s: "may " + s,                       # prepend Tagalog filler
        lambda s: s.split(" ")[0],                  # truncate to first word
        lambda s: s + " pls help",                  # add casual plea
        lambda s: "uhm " + s,                       # spoken filler
        lambda s: s.replace("accident", "aksdn")    # heavy typo
    ]
    if random.random() < 0.4:  # 40% chance to dirty text
        func = random.choice(noise_options)
        return func(text)
    return text

# Detect language based on keywords
def detect_lang(incident_phrase, severity_phrase, sentence_template):
    if any(word in incident_phrase for word in ["sunog", "aksidente", "baha", "karahasan", "kombulsyon", "walang", "nawawalang", "brownout", "gumuhong"]):
        return "fil"
    elif any(word in incident_phrase for word in ["may", "nag", "uhm"]) or "Help!" in sentence_template or "Grabe" in sentence_template:
        return "tag"
    else:
        return "en"

# Map incident types and severity levels to numeric labels
incident_type_labels = {name: idx for idx, name in enumerate(incident_types.keys())}
severity_labels = {name: idx for idx, name in enumerate(severity_templates.keys())}

rows = []
TARGET_ROWS = 6000  # larger dataset for robustness
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

    text = dirty_text(text)  # inject imperfections
    lang = detect_lang(incident_phrase, severity_phrase, sentence_template)

    rows.append([
        id_counter,
        text,
        incident_type,
        severity,
        incident_type_labels[incident_type],
        severity_labels[severity],
        lang
    ])
    id_counter += 1

# Ensure data folder exists
os.makedirs("data", exist_ok=True)

with open(OUTPUT_FILE, mode="w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["id", "text", "incident_type", "severity", "type_label", "severity_label", "lang"])
    writer.writerows(rows)

print(f"Generated {len(rows)} emergency scenarios in {OUTPUT_FILE}")

