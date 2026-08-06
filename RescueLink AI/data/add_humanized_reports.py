"""
Append humanized natural-language emergency reports to realistic_base_reports.jsonl.
Style: situational descriptions, polite address (Boss/Sir/Ma'am/Tulong), varied Filipino/Taglish phrasing.
"""
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_PATH = os.path.join(SCRIPT_DIR, "realistic_base_reports.jsonl")

# Humanized reports: longer sentences, less keyword-heavy, natural phrasing
HUMANIZED = [
    # Fire - situational descriptions
    {"text": "Boss nasusunog yung bahay ng kapitbahay namin, may usok na tumataas at hindi makalabas ang mga tao. pls.", "incident_types": ["Fire"], "severity": "Red"},
    {"text": "Sir may apoy na lumalabas sa bintana ng apartment, may tao pa raw sa loob. Padala agad.", "incident_types": ["Fire"], "severity": "Red"},
    {"text": "Ma'am yung maliit na apoy sa labas kanina, na-control na namin. Walang nasaktan.", "incident_types": ["Fire"], "severity": "Green"},
    {"text": "Tulong! May usok na galing sa kusina, baka may nasunog na ulam. Bilisan po.", "incident_types": ["Fire"], "severity": "Yellow"},
    {"text": "Boss nasusunog yung tindahan sa tabi, tumutulong na ang mga kapitbahay. pls.", "incident_types": ["Fire"], "severity": "Yellow"},
    {"text": "Sir may nagliyab na sa bubong, hindi na makababa ang mga tao. Padala agad.", "incident_types": ["Fire"], "severity": "Red"},
    {"text": "Ma'am lutong apoy lang sa kalan, na-extinguish na namin. Safe na po.", "incident_types": ["Fire"], "severity": "Green"},
    {"text": "Boss malakas na ang apoy sa bodega, may workers pa raw sa loob. Bilisan po!", "incident_types": ["Fire"], "severity": "Red"},
    {"text": "Sir may namatay sa sunog, hindi na humihinga. Padala agad.", "incident_types": ["Fire"], "severity": "Black"},
    {"text": "Tulong! May apoy sa basurahan, konti na lang pero tumutuloy pa. pls.", "incident_types": ["Fire"], "severity": "Green"},
    {"text": "Boss electrical short daw, na-unplug na namin. Walang apoy.", "incident_types": ["Fire"], "severity": "Green"},
    {"text": "Ma'am may usok sa bahay pero walang apoy pa, safe naman po.", "incident_types": ["Fire"], "severity": "Green"},
    {"text": "Sir nasunog ang bahay, may namatay na po. Bilisan po.", "incident_types": ["Fire"], "severity": "Black"},
    {"text": "Boss may bata na naiwan sa loob ng nasusunog na bahay! Padala agad.", "incident_types": ["Fire"], "severity": "Red"},
    {"text": "Tulong! Gumuho ang building dahil sa apoy, may trapped pa. pls.", "incident_types": ["Fire"], "severity": "Red"},
    # Crime - situational
    {"text": "Sir may nag-holdap sa jeep kanina, may dala daw baril at may nagsaksak po sa isang pasahero.", "incident_types": ["Crime"], "severity": "Red"},
    {"text": "Boss nakita ang biktima na wala nang pulso, parang na-stab po. Hindi na humihinga.", "incident_types": ["Crime"], "severity": "Black"},
    {"text": "Ma'am may hostage sa tindahan, may kutsilyo daw. Stable pa naman ang biktima.", "incident_types": ["Crime"], "severity": "Yellow"},
    {"text": "Tulong! May nag-holdap sa jeep, may nasaksak. Padala agad.", "incident_types": ["Crime"], "severity": "Yellow"},
    {"text": "Sir may nagnakaw ng cellphone, hinabol na ng mga tao. Nakita na ang suspect.", "incident_types": ["Crime"], "severity": "Green"},
    {"text": "Boss may binaril, malubha ang sugat. Kailangan ng ambulance agad.", "incident_types": ["Crime"], "severity": "Red"},
    {"text": "Ma'am may nag-attempt ng break-in, na-scare off na namin. Walang nasaktan.", "incident_types": ["Crime"], "severity": "Green"},
    {"text": "Sir vandalism lang, walang nasaktan. Minor lang po.", "incident_types": ["Crime"], "severity": "Green"},
    {"text": "Boss nakawan sa sari-sari store, minor lang. Nakita na ang suspect.", "incident_types": ["Crime"], "severity": "Green"},
    {"text": "Tulong! May snatcher, hinabol na ng mga tao. pls.", "incident_types": ["Crime"], "severity": "Yellow"},
    {"text": "Sir armed robbery, may nakaw na gamit. May baril ang suspect.", "incident_types": ["Crime"], "severity": "Yellow"},
    {"text": "Boss may bugbog, nasugatan ang biktima. Kailangan ng ambulance.", "incident_types": ["Crime"], "severity": "Yellow"},
    {"text": "Ma'am assault, kailangan ng ambulance. Nasugatan ang biktima.", "incident_types": ["Crime"], "severity": "Yellow"},
    {"text": "Sir fatal stabbing, wala nang pulso ang biktima. Padala agad.", "incident_types": ["Crime"], "severity": "Black"},
    {"text": "Boss multiple gunshot victims, confirmed dead na po. Bilisan po.", "incident_types": ["Crime"], "severity": "Black"},
    # Accident - situational
    {"text": "Ma'am naaksidente ang motor sa kanto, yung driver may sugat sa ulo at hindi makabangon. Padala agad.", "incident_types": ["Accident"], "severity": "Yellow"},
    {"text": "Boss jeep tumama sa poste, may pasahero na nasaktan. pls.", "incident_types": ["Accident"], "severity": "Yellow"},
    {"text": "Sir truck nasagasaan ang tao, kailangan ng ambulance. Bilisan po.", "incident_types": ["Accident"], "severity": "Yellow"},
    {"text": "Tulong! Malubhang banggaan, may hindi humihinga! Padala agad.", "incident_types": ["Accident"], "severity": "Red"},
    {"text": "Boss nasagasaan, patay na po. Padala agad.", "incident_types": ["Accident"], "severity": "Black"},
    {"text": "Ma'am bangga ng kotse sa parking, walang sugat. Minor lang.", "incident_types": ["Accident"], "severity": "Green"},
    {"text": "Sir motor crash, severe bleeding ang rider. Kailangan agad.", "incident_types": ["Accident"], "severity": "Red"},
    {"text": "Boss minor collision sa kalsada, gasgas lang. Walang nasaktan.", "incident_types": ["Accident"], "severity": "Green"},
    {"text": "Tulong! May namatay sa aksidente, wala nang pulso. pls.", "incident_types": ["Accident"], "severity": "Black"},
    {"text": "Ma'am hit and run, victim needs treatment. Nasugatan ang pedestrian.", "incident_types": ["Accident"], "severity": "Yellow"},
    {"text": "Sir fatal crash, driver deceased na po. Padala agad.", "incident_types": ["Accident"], "severity": "Black"},
    {"text": "Boss truck accident, people trapped sa loob. Bilisan po!", "incident_types": ["Accident"], "severity": "Red"},
    {"text": "Tulong! Rollover, critical ang pasahero. Padala agad.", "incident_types": ["Accident"], "severity": "Red"},
    {"text": "Ma'am car crash, may injured. Kailangan ng ambulance.", "incident_types": ["Accident"], "severity": "Yellow"},
    {"text": "Sir motor nadulas pero ok lang, minor lang. Walang sugat.", "incident_types": ["Accident"], "severity": "Green"},
    # Medical - situational
    {"text": "Tulong! May tao dito na hindi humihinga, wala na raw pulso. Kailangan ng ambulance agad.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Ma'am may matanda dito na biglang bumagsak, hindi na gumagalaw. Parang atake sa puso.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Boss may tao na hindi humihinga, CPR needed. Padala agad.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Sir severe bleeding, malakas ang dugo. Kailangan ng ambulance.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Ma'am overdose, hindi humihinga. Bilisan po.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Tulong! Choking, hindi makahinga! Padala agad.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Boss cardiac arrest, hindi na na-revive. Wala nang pulso.", "incident_types": ["Medical"], "severity": "Black"},
    {"text": "Sir CPR failed, pronounced dead na po. Padala agad.", "incident_types": ["Medical"], "severity": "Black"},
    {"text": "Ma'am walang pulso, deceased na. Hindi na humihinga.", "incident_types": ["Medical"], "severity": "Black"},
    {"text": "Boss no signs of life, patay na po. Bilisan po.", "incident_types": ["Medical"], "severity": "Black"},
    {"text": "Sir seizure, kailangan ng ambulance. Hindi pa nagigising.", "incident_types": ["Medical"], "severity": "Yellow"},
    {"text": "Ma'am may stroke victim, kailangan agad ng hospital. Padala agad.", "incident_types": ["Medical"], "severity": "Yellow"},
    {"text": "Boss elderly collapsed, needs treatment soon. Hindi pa nakakabangon.", "incident_types": ["Medical"], "severity": "Yellow"},
    {"text": "Tulong! Anaphylactic shock, walang gamot! Bilisan po.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Sir sugat malalim, kailangan tahi. May bleeding.", "incident_types": ["Medical"], "severity": "Yellow"},
    {"text": "Ma'am may nanganak na, critical. Kailangan ng ambulance.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Boss broken bone, may fracture. Kailangan ng treatment.", "incident_types": ["Medical"], "severity": "Yellow"},
    {"text": "Sir may nahihirapang huminga, asthmatic daw. Padala agad.", "incident_types": ["Medical"], "severity": "Yellow"},
    {"text": "Ma'am diabetic, low sugar lang. Na-revive na namin.", "incident_types": ["Medical"], "severity": "Green"},
    {"text": "Boss may nahimatay pero nagising na, ok na po. pls.", "incident_types": ["Medical"], "severity": "Green"},
    # Natural Disaster - situational
    {"text": "Boss tumataas na yung tubig sa kalsada, may mga bahay na naabot na po. Hindi na makalabas ang iba.", "incident_types": ["Natural Disaster"], "severity": "Yellow"},
    {"text": "Tulong! May natabunan ng lupa sa tabi ng bundok, may tao pa raw sa loob. Bilisan po!", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Sir baha mataas na, may tao na trap sa bubong. Padala agad.", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Boss flash flood, maraming hindi makalabas. Kailangan ng rescue.", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Ma'am tumataas ang tubig, need evacuation. May mga bahay na naabot.", "incident_types": ["Natural Disaster"], "severity": "Yellow"},
    {"text": "Tulong! Storm surge, may naanod! Bilisan po.", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Boss lindol kanina, may gumuho. May nasugatan sa landslide.", "incident_types": ["Natural Disaster"], "severity": "Yellow"},
    {"text": "Sir earthquake, building collapse. May people trapped.", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Ma'am volcanic ash, may nahihirapang huminga. Padala agad.", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Boss tsunami warning, nag-evacuate na. Ok pa naman.", "incident_types": ["Natural Disaster"], "severity": "Yellow"},
    {"text": "Tulong! May namatay sa baha, nakita ang bangkay. pls.", "incident_types": ["Natural Disaster"], "severity": "Black"},
    {"text": "Sir landslide victim, deceased na. Wala nang pulso.", "incident_types": ["Natural Disaster"], "severity": "Black"},
    {"text": "Boss tsunami victim, confirmed dead na po. Padala agad.", "incident_types": ["Natural Disaster"], "severity": "Black"},
    {"text": "Ma'am drowning victim, no pulse. Hindi na humihinga.", "incident_types": ["Natural Disaster"], "severity": "Black"},
    {"text": "Boss bagyo wasak ang bubong, may injured. Kailangan ng tulong.", "incident_types": ["Natural Disaster"], "severity": "Yellow"},
    {"text": "Sir storm damage sa bubong, minor lang. Walang nasaktan.", "incident_types": ["Natural Disaster"], "severity": "Green"},
    {"text": "Ma'am malakas ang ulan pero ok pa naman. Mababa pa ang tubig.", "incident_types": ["Natural Disaster"], "severity": "Green"},
    {"text": "Boss minor landslide, walang nasaktan. Konti lang ang lupa.", "incident_types": ["Natural Disaster"], "severity": "Green"},
    {"text": "Tulong! Gumuho ang lupa, may natabunan. Bilisan po!", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Sir storm surge, kailangan ng rescue. May naanod.", "incident_types": ["Natural Disaster"], "severity": "Yellow"},
    # Other - situational
    {"text": "Yung nawawalang bata kanina, nakita na po namin sa tindahan. Okay na po.", "incident_types": ["Other"], "severity": "Green"},
    {"text": "Boss may bata nawawala pa, kailangan ng tulong. Hinahanap pa.", "incident_types": ["Other"], "severity": "Yellow"},
    {"text": "Sir child missing, may suspect daw. Hinahanap pa.", "incident_types": ["Other"], "severity": "Red"},
    {"text": "Ma'am lost child found na po. Okay na.", "incident_types": ["Other"], "severity": "Green"},
    {"text": "Boss gas leak, amoy na malakas. Nag-evacuate na kami.", "incident_types": ["Other"], "severity": "Yellow"},
    {"text": "Tulong! Gas leak malakas, may nahimatay! Padala agad.", "incident_types": ["Other"], "severity": "Red"},
    {"text": "Sir power outage, maraming affected. Walang kuryente.", "incident_types": ["Other"], "severity": "Yellow"},
    {"text": "Ma'am brownout, walang kuryente. Minor lang.", "incident_types": ["Other"], "severity": "Green"},
    {"text": "Boss suspicious package, nag-evacuate na. Safe naman.", "incident_types": ["Other"], "severity": "Yellow"},
    {"text": "Tulong! Bomb threat, nag-evacuate na! pls.", "incident_types": ["Other"], "severity": "Red"},
    {"text": "Sir nakita ang bangkay sa ilog. Wala nang pulso.", "incident_types": ["Other"], "severity": "Black"},
    {"text": "Ma'am missing person found deceased. Hindi na humihinga.", "incident_types": ["Other"], "severity": "Black"},
    {"text": "Boss mass panic, maraming naapakan. May nasugatan.", "incident_types": ["Other"], "severity": "Red"},
    {"text": "Tulong! Stampede sa concert, maraming nasaktan! Padala agad.", "incident_types": ["Other"], "severity": "Red"},
    {"text": "Sir riot, may baril! Maraming nasugatan.", "incident_types": ["Other"], "severity": "Red"},
    {"text": "Ma'am animal rescue, na-save na. Okay na po.", "incident_types": ["Other"], "severity": "Green"},
    {"text": "Boss mass casualty, multiple fatalities. Padala agad.", "incident_types": ["Other"], "severity": "Black"},
]

# Additional humanized variants to reach ~400 total (we have ~80 above, need more)
MORE_FIRE = [
    {"text": "Sir may apoy sa rooftop, tumutulong na ang bumbero. pls.", "incident_types": ["Fire"], "severity": "Yellow"},
    {"text": "Boss nasusunog yung garahe, walang tao sa loob. Minor lang.", "incident_types": ["Fire"], "severity": "Green"},
    {"text": "Ma'am may usok sa attic, baka electrical. Tinitingnan pa.", "incident_types": ["Fire"], "severity": "Yellow"},
    {"text": "Tulong! May apoy sa warehouse, maraming workers pa. Bilisan po!", "incident_types": ["Fire"], "severity": "Red"},
    {"text": "Boss nasunog yung kotse, walang nasaktan. Na-control na.", "incident_types": ["Fire"], "severity": "Green"},
    {"text": "Sir may nagliyab na sa second floor, may tao pa sa loob. Padala agad.", "incident_types": ["Fire"], "severity": "Red"},
    {"text": "Ma'am sunog sa basura, na-extinguish na. Walang damage.", "incident_types": ["Fire"], "severity": "Green"},
    {"text": "Boss inferno na, hindi na makalabas ang mga tao. Kailangan ng rescue.", "incident_types": ["Fire"], "severity": "Red"},
    {"text": "Sir multiple fatalities sa sunog. Wala nang pulso.", "incident_types": ["Fire"], "severity": "Black"},
    {"text": "Boss fire victim, no pulse na po. Hindi na humihinga.", "incident_types": ["Fire"], "severity": "Black"},
]
MORE_CRIME = [
    {"text": "Ma'am may holdap sa jeep, may nasaksak. Stable pa ang biktima.", "incident_types": ["Crime"], "severity": "Yellow"},
    {"text": "Boss baril na naka-aim sa biktima! May hostage.", "incident_types": ["Crime"], "severity": "Red"},
    {"text": "Sir robbery, may baril ang suspect. May nakaw na gamit.", "incident_types": ["Crime"], "severity": "Yellow"},
    {"text": "Tulong! Stabbing, critical condition. Padala agad.", "incident_types": ["Crime"], "severity": "Red"},
    {"text": "Boss shooting incident, severe bleeding. Kailangan ng ambulance.", "incident_types": ["Crime"], "severity": "Red"},
    {"text": "Ma'am petty theft, suspect fled. Minor lang.", "incident_types": ["Crime"], "severity": "Green"},
    {"text": "Sir assault, kailangan ng ambulance. Nasugatan ang biktima.", "incident_types": ["Crime"], "severity": "Yellow"},
    {"text": "Boss active shooter, maraming nasugatan. Padala agad.", "incident_types": ["Crime"], "severity": "Red"},
    {"text": "Ma'am may patay sa shooting, wala nang pulso. Bilisan po.", "incident_types": ["Crime"], "severity": "Black"},
    {"text": "Boss pinatay ang biktima, deceased na. Padala agad.", "incident_types": ["Crime"], "severity": "Black"},
]
MORE_ACCIDENT = [
    {"text": "Sir motor naaksidente, nasugatan ang driver. May sugat sa ulo.", "incident_types": ["Accident"], "severity": "Yellow"},
    {"text": "Boss jeep tumama sa poste, may pasahero na nasaktan. Padala agad.", "incident_types": ["Accident"], "severity": "Yellow"},
    {"text": "Ma'am truck accident, people trapped sa cabin. Bilisan po.", "incident_types": ["Accident"], "severity": "Red"},
    {"text": "Tulong! Car crash, may injured. Kailangan ng ambulance.", "incident_types": ["Accident"], "severity": "Yellow"},
    {"text": "Boss malubhang banggaan, may hindi humihinga. Padala agad.", "incident_types": ["Accident"], "severity": "Red"},
    {"text": "Sir fatal crash, driver deceased. Wala nang pulso.", "incident_types": ["Accident"], "severity": "Black"},
    {"text": "Ma'am may namatay sa aksidente, wala nang pulso. Bilisan po.", "incident_types": ["Accident"], "severity": "Black"},
    {"text": "Boss hit and run, victim needs treatment. Nasugatan.", "incident_types": ["Accident"], "severity": "Yellow"},
    {"text": "Sir rollover, critical ang pasahero. Padala agad.", "incident_types": ["Accident"], "severity": "Red"},
    {"text": "Ma'am minor collision, gasgas lang. Walang nasaktan.", "incident_types": ["Accident"], "severity": "Green"},
]
MORE_MEDICAL = [
    {"text": "Boss may tao na hindi humihinga, CPR needed. Padala agad.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Sir heart attack, unconscious. Kailangan ng ambulance.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Ma'am may matanda na bumagsak, hindi na gumagalaw. Parang atake.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Tulong! Severe bleeding, malakas ang dugo! Bilisan po.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Boss overdose, not breathing. Padala agad.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Sir choking, hindi makahinga! Kailangan agad.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Ma'am cardiac arrest, hindi na na-revive. Wala nang pulso.", "incident_types": ["Medical"], "severity": "Black"},
    {"text": "Boss CPR failed, pronounced dead. Padala agad.", "incident_types": ["Medical"], "severity": "Black"},
    {"text": "Sir seizure, kailangan ng ambulance. Hindi pa nagigising.", "incident_types": ["Medical"], "severity": "Yellow"},
    {"text": "Ma'am mild allergic reaction, stable na. Ok na po.", "incident_types": ["Medical"], "severity": "Green"},
]
MORE_NATURAL = [
    {"text": "Boss tumataas na yung tubig, may bahay na naabot. Need evacuation.", "incident_types": ["Natural Disaster"], "severity": "Yellow"},
    {"text": "Sir baha na, tumataas ang tubig. May tao na trap.", "incident_types": ["Natural Disaster"], "severity": "Yellow"},
    {"text": "Ma'am may baha pero mababa pa. Ok pa naman.", "incident_types": ["Natural Disaster"], "severity": "Green"},
    {"text": "Tulong! Landslide, may na-bury na tao! Bilisan po!", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Boss may natabunan ng lupa, may tao pa raw. Padala agad.", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Sir lindol, may gumuho. May nasugatan sa landslide.", "incident_types": ["Natural Disaster"], "severity": "Yellow"},
    {"text": "Ma'am earthquake, building collapse. People trapped.", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Boss storm surge, may naanod. Kailangan ng rescue.", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Sir volcanic ash, may nahihirapang huminga. Padala agad.", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Ma'am tsunami warning, nag-evacuate na. Safe naman.", "incident_types": ["Natural Disaster"], "severity": "Yellow"},
]
MORE_OTHER = [
    {"text": "Boss may bata nawawala, nakita na. Okay na po.", "incident_types": ["Other"], "severity": "Green"},
    {"text": "Sir yung nawawalang bata, nakita na namin. Ok na.", "incident_types": ["Other"], "severity": "Green"},
    {"text": "Ma'am gas leak, amoy na malakas. Nag-evacuate na.", "incident_types": ["Other"], "severity": "Yellow"},
    {"text": "Boss power outage, maraming affected. Walang kuryente.", "incident_types": ["Other"], "severity": "Yellow"},
    {"text": "Tulong! Bomb threat, nag-evacuate! Padala agad.", "incident_types": ["Other"], "severity": "Red"},
    {"text": "Sir suspicious package, nag-evacuate na. Safe naman.", "incident_types": ["Other"], "severity": "Yellow"},
    {"text": "Ma'am missing person, hinahanap pa. Wala pa.", "incident_types": ["Other"], "severity": "Yellow"},
    {"text": "Boss nakita ang bangkay sa ilog. Wala nang pulso.", "incident_types": ["Other"], "severity": "Black"},
    {"text": "Sir mass panic, maraming naapakan. May nasugatan.", "incident_types": ["Other"], "severity": "Red"},
    {"text": "Ma'am stampede, maraming nasaktan. Padala agad.", "incident_types": ["Other"], "severity": "Red"},
]

# Extra batches to reach ~400 total new rows
EXTRA_FIRE = [
    {"text": "Boss may apoy sa roof, tumutulong na. pls.", "incident_types": ["Fire"], "severity": "Yellow"},
    {"text": "Sir nasusunog yung shed, minor lang. Na-control na.", "incident_types": ["Fire"], "severity": "Green"},
    {"text": "Ma'am may usok sa basement, tinitingnan pa. pls.", "incident_types": ["Fire"], "severity": "Yellow"},
    {"text": "Boss factory fire, maraming workers. Bilisan po.", "incident_types": ["Fire"], "severity": "Red"},
    {"text": "Sir apartment burning, may tao pa. Padala agad.", "incident_types": ["Fire"], "severity": "Red"},
    {"text": "Ma'am kitchen fire, napatay na. Safe na.", "incident_types": ["Fire"], "severity": "Green"},
    {"text": "Boss structure fire, may bata na naiwan. Padala agad.", "incident_types": ["Fire"], "severity": "Red"},
    {"text": "Sir may patay sa sunog, hindi na humihinga. Bilisan po.", "incident_types": ["Fire"], "severity": "Black"},
    {"text": "Ma'am electrical fire, na-unplug na. Ok na.", "incident_types": ["Fire"], "severity": "Green"},
    {"text": "Boss sunog sa warehouse, malakas na. Padala agad.", "incident_types": ["Fire"], "severity": "Yellow"},
]
EXTRA_CRIME = [
    {"text": "Sir holdap sa jeep, may nasaksak. Kailangan ng ambulance.", "incident_types": ["Crime"], "severity": "Yellow"},
    {"text": "Boss may baril na naka-aim, may hostage. Padala agad.", "incident_types": ["Crime"], "severity": "Red"},
    {"text": "Ma'am robbery in progress, may baril. Stable pa.", "incident_types": ["Crime"], "severity": "Yellow"},
    {"text": "Sir stabbing victim, critical. Bilisan po.", "incident_types": ["Crime"], "severity": "Red"},
    {"text": "Boss may binaril, malubha. Padala agad.", "incident_types": ["Crime"], "severity": "Red"},
    {"text": "Ma'am break-in attempt, na-scare off. Green na.", "incident_types": ["Crime"], "severity": "Green"},
    {"text": "Sir theft, suspect fled. Minor lang.", "incident_types": ["Crime"], "severity": "Green"},
    {"text": "Boss assault victim, nasugatan. Kailangan ng ambulance.", "incident_types": ["Crime"], "severity": "Yellow"},
    {"text": "Ma'am shooting, maraming nasugatan. Padala agad.", "incident_types": ["Crime"], "severity": "Red"},
    {"text": "Boss may patay sa crime, wala nang pulso. Bilisan po.", "incident_types": ["Crime"], "severity": "Black"},
]
EXTRA_ACCIDENT = [
    {"text": "Boss motor accident, driver injured. May sugat.", "incident_types": ["Accident"], "severity": "Yellow"},
    {"text": "Sir jeepney crash, may pasahero na nasaktan. Padala agad.", "incident_types": ["Accident"], "severity": "Yellow"},
    {"text": "Ma'am truck collision, people trapped. Bilisan po.", "incident_types": ["Accident"], "severity": "Red"},
    {"text": "Boss car accident, may injured. Kailangan ng ambulance.", "incident_types": ["Accident"], "severity": "Yellow"},
    {"text": "Sir severe collision, may hindi humihinga. Padala agad.", "incident_types": ["Accident"], "severity": "Red"},
    {"text": "Ma'am pedestrian hit, patay na. Bilisan po.", "incident_types": ["Accident"], "severity": "Black"},
    {"text": "Boss hit and run victim, needs treatment. Padala agad.", "incident_types": ["Accident"], "severity": "Yellow"},
    {"text": "Sir rollover accident, critical. Padala agad.", "incident_types": ["Accident"], "severity": "Red"},
    {"text": "Ma'am minor crash, gasgas lang. Ok na.", "incident_types": ["Accident"], "severity": "Green"},
    {"text": "Boss fatal accident, driver deceased. Padala agad.", "incident_types": ["Accident"], "severity": "Black"},
]
EXTRA_MEDICAL = [
    {"text": "Boss may tao na walang pulso, CPR needed. Padala agad.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Sir heart attack victim, unconscious. Bilisan po.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Ma'am elderly collapsed, hindi na gumagalaw. Parang atake.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Boss severe bleeding, malakas ang dugo. Padala agad.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Sir overdose victim, not breathing. Kailangan agad.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Ma'am choking victim, hindi makahinga. Bilisan po.", "incident_types": ["Medical"], "severity": "Red"},
    {"text": "Boss cardiac arrest, hindi na na-revive. Wala nang pulso.", "incident_types": ["Medical"], "severity": "Black"},
    {"text": "Sir CPR failed, pronounced dead. Padala agad.", "incident_types": ["Medical"], "severity": "Black"},
    {"text": "Ma'am seizure victim, kailangan ng ambulance. Padala agad.", "incident_types": ["Medical"], "severity": "Yellow"},
    {"text": "Boss allergic reaction, stable na. Ok na po.", "incident_types": ["Medical"], "severity": "Green"},
]
EXTRA_NATURAL = [
    {"text": "Boss tumataas ang tubig, need evacuation. Padala agad.", "incident_types": ["Natural Disaster"], "severity": "Yellow"},
    {"text": "Sir baha na, may tao na trap. Bilisan po.", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Ma'am flooding, mababa pa. Ok pa naman.", "incident_types": ["Natural Disaster"], "severity": "Green"},
    {"text": "Boss landslide, may natabunan. May tao pa raw. Padala agad.", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Sir gumuho ang lupa, may tao sa loob. Bilisan po.", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Ma'am earthquake damage, may nasugatan. Padala agad.", "incident_types": ["Natural Disaster"], "severity": "Yellow"},
    {"text": "Boss building collapse from lindol, people trapped. Padala agad.", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Sir storm surge, may naanod. Kailangan ng rescue.", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Ma'am volcanic ash fall, may nahihirapang huminga. Bilisan po.", "incident_types": ["Natural Disaster"], "severity": "Red"},
    {"text": "Boss tsunami evacuation, nag-evacuate na. Safe naman.", "incident_types": ["Natural Disaster"], "severity": "Yellow"},
]
EXTRA_OTHER = [
    {"text": "Boss nawawalang bata, nakita na. Ok na po.", "incident_types": ["Other"], "severity": "Green"},
    {"text": "Sir may bata nawawala pa, hinahanap. Padala agad.", "incident_types": ["Other"], "severity": "Yellow"},
    {"text": "Ma'am child missing, may suspect. Hinahanap pa.", "incident_types": ["Other"], "severity": "Red"},
    {"text": "Boss gas leak detected, amoy malakas. Nag-evacuate na.", "incident_types": ["Other"], "severity": "Yellow"},
    {"text": "Sir brownout, walang kuryente. Maraming affected.", "incident_types": ["Other"], "severity": "Yellow"},
    {"text": "Ma'am bomb threat received, nag-evacuate. Padala agad.", "incident_types": ["Other"], "severity": "Red"},
    {"text": "Boss suspicious item, nag-evacuate na. Tinitingnan pa.", "incident_types": ["Other"], "severity": "Yellow"},
    {"text": "Sir missing person, hinahanap pa. Wala pa.", "incident_types": ["Other"], "severity": "Yellow"},
    {"text": "Ma'am body found sa ilog, wala nang pulso. Padala agad.", "incident_types": ["Other"], "severity": "Black"},
    {"text": "Boss crowd panic, maraming naapakan. May nasugatan.", "incident_types": ["Other"], "severity": "Red"},
]


def main():
    all_new = (
        HUMANIZED
        + MORE_FIRE
        + MORE_CRIME
        + MORE_ACCIDENT
        + MORE_MEDICAL
        + MORE_NATURAL
        + MORE_OTHER
        + EXTRA_FIRE
        + EXTRA_CRIME
        + EXTRA_ACCIDENT
        + EXTRA_MEDICAL
        + EXTRA_NATURAL
        + EXTRA_OTHER
    )
    with open(BASE_PATH, "a", encoding="utf-8") as f:
        for row in all_new:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"Appended {len(all_new)} humanized rows to {BASE_PATH}")
    # Count total
    with open(BASE_PATH, "r", encoding="utf-8") as f:
        total = sum(1 for line in f if line.strip())
    print(f"Total rows now: {total}")


if __name__ == "__main__":
    main()
