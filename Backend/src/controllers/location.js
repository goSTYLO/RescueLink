const { validateLatitude, validateLongitude } = require('../utils/validation');
const { isPointInDagupan, calculateDistance, getBarangayFromCoordinates } = require('../utils/geolocation');
const Incident = require('../models/incident');
const Department = require('../models/department');

const DAGUPAN_CITY_VIEWBOX = '120.28,16.08,120.39,15.99';
const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'RescueLink/1.0 (Dagupan geocoding)';
const DAGUPAN_CITY_CENTER = { latitude: 16.0430, longitude: 120.3330 };
const DAGUPAN_LANDMARKS = [
  {
    name: 'Dagupan City Police Office',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.043037,
    longitude: 120.3323573,
    type: 'police',
    keywords: ['pnp', 'police station', 'dcpo', 'camp'],
  },
  {
    name: 'Dagupan CDRRMO',
    address: 'CDRRMC, Dagupan City, Pangasinan',
    latitude: 16.0427885,
    longitude: 120.3316185,
    type: 'government',
    keywords: ['drrmo', 'cdrmmc', 'rescue', 'operations center'],
  },
  {
    name: 'Dagupan Post Office',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.043259,
    longitude: 120.333036,
    type: 'post_office',
    keywords: ['phlpost', 'mail'],
  },
  {
    name: 'Dagupan City Hall',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.043652,
    longitude: 120.333521,
    type: 'government',
    keywords: ['municipal hall', 'city government'],
  },
  {
    name: 'Region 1 Medical Center',
    address: 'Arellano St, Dagupan City, Pangasinan',
    latitude: 16.04395,
    longitude: 120.33385,
    type: 'hospital',
    keywords: ['r1mc', 'hospital', 'medical center', 'er'],
  },
  {
    name: 'CSI City Mall Dagupan',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.04735,
    longitude: 120.3392,
    type: 'mall',
    keywords: ['csi', 'mall', 'shopping'],
  },
  {
    name: 'Nepo Mall Dagupan',
    address: 'Arellano St, Dagupan City, Pangasinan',
    latitude: 16.04528,
    longitude: 120.3321,
    type: 'mall',
    keywords: ['nepo', 'mall', 'shopping'],
  },
  {
    name: 'SM Center Dagupan',
    address: 'Calmay Rd, Dagupan City, Pangasinan',
    latitude: 16.0598,
    longitude: 120.3451,
    type: 'mall',
    keywords: ['sm', 'mall'],
  },
  {
    name: 'Tondaligan Beach',
    address: 'Tondaligan, Dagupan City, Pangasinan',
    latitude: 16.0814,
    longitude: 120.3328,
    type: 'tourism',
    keywords: ['beach', 'seaside', 'park'],
  },
  {
    name: 'Bonuan Blue Beach',
    address: 'Bonuan, Dagupan City, Pangasinan',
    latitude: 16.0769,
    longitude: 120.3359,
    type: 'tourism',
    keywords: ['blue beach', 'beach', 'bonuan'],
  },
  {
    name: 'Dagupan City Museum',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.04348,
    longitude: 120.33334,
    type: 'museum',
    keywords: ['museum', 'history'],
  },
  {
    name: 'Dagupan People\'s Astrodome',
    address: 'Herrero-Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.0446,
    longitude: 120.3323,
    type: 'sports',
    keywords: ['astrodome', 'arena', 'events'],
  },
  {
    name: 'University of Pangasinan Dagupan Campus',
    address: 'Arellano St, Dagupan City, Pangasinan',
    latitude: 16.0468,
    longitude: 120.3324,
    type: 'school',
    keywords: ['upang', 'university', 'college'],
  },
  {
    name: 'Lyceum-Northwestern University',
    address: 'Tapuac District, Dagupan City, Pangasinan',
    latitude: 16.0477,
    longitude: 120.3492,
    type: 'school',
    keywords: ['lnu', 'university', 'college'],
  },
  {
    name: 'PHINMA University of Pangasinan',
    address: 'Arellano St, Dagupan City, Pangasinan',
    latitude: 16.0463,
    longitude: 120.332,
    type: 'school',
    keywords: ['phinma', 'upang', 'university'],
  },
  {
    name: 'Colegio de Dagupan',
    address: 'Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.0442,
    longitude: 120.3339,
    type: 'school',
    keywords: ['college', 'school'],
  },
  {
    name: 'Pangasinan National High School',
    address: 'Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.0498,
    longitude: 120.3422,
    type: 'school',
    keywords: ['high school', 'pnhs'],
  },
  {
    name: 'Dagupan City National High School',
    address: 'Tapuac, Dagupan City, Pangasinan',
    latitude: 16.0508,
    longitude: 120.347,
    type: 'school',
    keywords: ['high school', 'dcnhs'],
  },
  {
    name: 'West Central Elementary School',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.0439,
    longitude: 120.334,
    type: 'school',
    keywords: ['elementary school'],
  },
  {
    name: 'St. John Cathedral',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.0441,
    longitude: 120.3332,
    type: 'church',
    keywords: ['cathedral', 'church', 'parish'],
  },
  {
    name: 'Iglesia ni Cristo Dagupan Local',
    address: 'Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.0452,
    longitude: 120.339,
    type: 'church',
    keywords: ['inc', 'church'],
  },
  {
    name: 'CSI Stadia',
    address: 'Lucao, Dagupan City, Pangasinan',
    latitude: 16.0596,
    longitude: 120.3545,
    type: 'sports',
    keywords: ['stadium', 'sports', 'events'],
  },
  {
    name: 'Dagupan Bus Terminal',
    address: 'Bonuan Binloc, Dagupan City, Pangasinan',
    latitude: 16.0722,
    longitude: 120.3398,
    type: 'transport',
    keywords: ['terminal', 'bus', 'transport'],
  },
  {
    name: 'Dagupan City Public Market',
    address: 'Galvan St, Dagupan City, Pangasinan',
    latitude: 16.0433,
    longitude: 120.3342,
    type: 'market',
    keywords: ['market', 'palengke'],
  },
  {
    name: 'Magsaysay Fish Market',
    address: 'Magsaysay, Dagupan City, Pangasinan',
    latitude: 16.0418,
    longitude: 120.3359,
    type: 'market',
    keywords: ['fish market', 'seafood market'],
  },
  {
    name: 'Bonuan Gueset Market Area',
    address: 'Bonuan Gueset, Dagupan City, Pangasinan',
    latitude: 16.0731,
    longitude: 120.3337,
    type: 'market',
    keywords: ['market', 'bonuan'],
  },
  {
    name: 'Dagupan City Hall Annex',
    address: 'Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.0446,
    longitude: 120.334,
    type: 'government',
    keywords: ['city hall', 'annex', 'government'],
  },
  {
    name: 'Dagupan Sangguniang Panlungsod',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.0437,
    longitude: 120.3337,
    type: 'government',
    keywords: ['city council', 'sangguniang panlungsod'],
  },
  {
    name: 'Pag-IBIG Fund Dagupan',
    address: 'Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.0467,
    longitude: 120.3385,
    type: 'government',
    keywords: ['pagibig', 'government office'],
  },
  {
    name: 'SSS Dagupan Branch',
    address: 'AB Fernandez East, Dagupan City, Pangasinan',
    latitude: 16.0455,
    longitude: 120.3368,
    type: 'government',
    keywords: ['sss', 'social security'],
  },
  {
    name: 'PhilHealth Dagupan LHIO',
    address: 'Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.046,
    longitude: 120.3376,
    type: 'government',
    keywords: ['philhealth', 'health insurance'],
  },
  {
    name: 'Land Transportation Office Dagupan',
    address: 'Tapuac District, Dagupan City, Pangasinan',
    latitude: 16.0494,
    longitude: 120.3478,
    type: 'government',
    keywords: ['lto', 'transportation office', 'license'],
  },
  {
    name: 'Bureau of Fire Protection Dagupan',
    address: 'Tapuac District, Dagupan City, Pangasinan',
    latitude: 16.0499,
    longitude: 120.3462,
    type: 'fire_station',
    keywords: ['bfp', 'fire station', 'fire department'],
  },
  {
    name: 'Philippine Coast Guard Sub-Station Dagupan',
    address: 'Bonuan, Dagupan City, Pangasinan',
    latitude: 16.0742,
    longitude: 120.3364,
    type: 'government',
    keywords: ['coast guard', 'pcg'],
  },
  {
    name: 'Pangasinan Provincial Library Satellite',
    address: 'Dagupan City, Pangasinan',
    latitude: 16.044,
    longitude: 120.3349,
    type: 'library',
    keywords: ['library', 'reading'],
  },
  {
    name: 'Dagupan City Library',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.0436,
    longitude: 120.3342,
    type: 'library',
    keywords: ['library', 'public library'],
  },
  {
    name: 'DBP Dagupan Branch',
    address: 'Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.0451,
    longitude: 120.3358,
    type: 'bank',
    keywords: ['dbp', 'bank'],
  },
  {
    name: 'Land Bank Dagupan',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.0449,
    longitude: 120.3349,
    type: 'bank',
    keywords: ['landbank', 'bank'],
  },
  {
    name: 'Banco de Oro Dagupan',
    address: 'Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.0457,
    longitude: 120.337,
    type: 'bank',
    keywords: ['bdo', 'bank'],
  },
  {
    name: 'Metrobank Dagupan',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.045,
    longitude: 120.3364,
    type: 'bank',
    keywords: ['metrobank', 'bank'],
  },
  {
    name: 'PNB Dagupan',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.0446,
    longitude: 120.3359,
    type: 'bank',
    keywords: ['pnb', 'bank'],
  },
  {
    name: 'Robinsons Supermarket Dagupan',
    address: 'Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.0464,
    longitude: 120.3382,
    type: 'grocery',
    keywords: ['supermarket', 'grocery', 'robinsons'],
  },
  {
    name: 'Puregold Dagupan',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.0462,
    longitude: 120.3399,
    type: 'grocery',
    keywords: ['puregold', 'grocery'],
  },
  {
    name: 'Jollibee Perez Dagupan',
    address: 'Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.046,
    longitude: 120.3379,
    type: 'restaurant',
    keywords: ['jollibee', 'fast food'],
  },
  {
    name: 'McDonald\'s Dagupan',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.0468,
    longitude: 120.339,
    type: 'restaurant',
    keywords: ['mcdonalds', 'mcdo', 'fast food'],
  },
  {
    name: 'KFC Dagupan',
    address: 'Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.0463,
    longitude: 120.3387,
    type: 'restaurant',
    keywords: ['kfc', 'fast food'],
  },
  {
    name: 'Mang Inasal Dagupan',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.0459,
    longitude: 120.3373,
    type: 'restaurant',
    keywords: ['mang inasal', 'restaurant'],
  },
  {
    name: 'Shell Lucao Dagupan',
    address: 'Lucao, Dagupan City, Pangasinan',
    latitude: 16.0562,
    longitude: 120.3534,
    type: 'fuel',
    keywords: ['shell', 'gas station', 'fuel'],
  },
  {
    name: 'Petron Bonuan Dagupan',
    address: 'Bonuan, Dagupan City, Pangasinan',
    latitude: 16.0728,
    longitude: 120.3371,
    type: 'fuel',
    keywords: ['petron', 'gas station', 'fuel'],
  },
  {
    name: 'Caltex Dagupan Perez',
    address: 'Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.0472,
    longitude: 120.3405,
    type: 'fuel',
    keywords: ['caltex', 'gas station', 'fuel'],
  },
  {
    name: 'Dagupan Doctors Villaflor Memorial Hospital',
    address: 'Arellano St, Dagupan City, Pangasinan',
    latitude: 16.0434,
    longitude: 120.3348,
    type: 'hospital',
    keywords: ['hospital', 'ddvmh', 'doctors'],
  },
  {
    name: 'Nazareth General Hospital',
    address: 'Tapuac District, Dagupan City, Pangasinan',
    latitude: 16.0501,
    longitude: 120.3467,
    type: 'hospital',
    keywords: ['hospital', 'nazareth'],
  },
  {
    name: 'Medical Centrum Dagupan',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.0447,
    longitude: 120.3355,
    type: 'clinic',
    keywords: ['clinic', 'medical center'],
  },
  {
    name: 'Dagupan City Hall Justice Hall',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.0432,
    longitude: 120.3338,
    type: 'government',
    keywords: ['justice hall', 'court'],
  },
  {
    name: 'Dagupan City Hall Plaza',
    address: 'A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.0433,
    longitude: 120.3332,
    type: 'park',
    keywords: ['plaza', 'city plaza'],
  },
  {
    name: 'Bonuan Boquig Barangay Hall',
    address: 'Bonuan Boquig, Dagupan City, Pangasinan',
    latitude: 16.0781,
    longitude: 120.334,
    type: 'government',
    keywords: ['barangay hall', 'bonuan boquig'],
  },
  {
    name: 'Bonuan Gueset Barangay Hall',
    address: 'Bonuan Gueset, Dagupan City, Pangasinan',
    latitude: 16.0736,
    longitude: 120.3332,
    type: 'government',
    keywords: ['barangay hall', 'bonuan gueset'],
  },
  {
    name: 'Bonuan Binloc Barangay Hall',
    address: 'Bonuan Binloc, Dagupan City, Pangasinan',
    latitude: 16.0708,
    longitude: 120.338,
    type: 'government',
    keywords: ['barangay hall', 'bonuan binloc'],
  },
  {
    name: 'Barangay Poblacion Oeste Hall',
    address: 'Poblacion Oeste, Dagupan City, Pangasinan',
    latitude: 16.0445,
    longitude: 120.3326,
    type: 'government',
    keywords: ['barangay hall', 'poblacion oeste'],
  },
  {
    name: 'Barangay Poblacion Norte Hall',
    address: 'Poblacion Norte, Dagupan City, Pangasinan',
    latitude: 16.0449,
    longitude: 120.333,
    type: 'government',
    keywords: ['barangay hall', 'poblacion norte'],
  },
  {
    name: 'Barangay Poblacion Sur Hall',
    address: 'Poblacion Sur, Dagupan City, Pangasinan',
    latitude: 16.0429,
    longitude: 120.3336,
    type: 'government',
    keywords: ['barangay hall', 'poblacion sur'],
  },
  {
    name: 'Dagupan City Hall Motorpool',
    address: 'Calmay, Dagupan City, Pangasinan',
    latitude: 16.0602,
    longitude: 120.344,
    type: 'government',
    keywords: ['motorpool', 'city hall'],
  },
  {
    name: 'Dagupan Port Area',
    address: 'Magsaysay, Dagupan City, Pangasinan',
    latitude: 16.0404,
    longitude: 120.3366,
    type: 'transport',
    keywords: ['port', 'wharf', 'harbor'],
  },
  {
    name: 'Downtown Dagupan',
    address: 'Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.045,
    longitude: 120.336,
    type: 'district',
    keywords: ['downtown', 'city center', 'poblacion'],
  },
  {
    name: 'Dagupan Riverwalk',
    address: 'Magsaysay River Area, Dagupan City, Pangasinan',
    latitude: 16.0412,
    longitude: 120.3354,
    type: 'park',
    keywords: ['riverwalk', 'walkway', 'promenade'],
  },
  {
    name: 'Lucao District Center',
    address: 'Lucao, Dagupan City, Pangasinan',
    latitude: 16.0561,
    longitude: 120.3519,
    type: 'district',
    keywords: ['lucao', 'district'],
  },
  {
    name: 'Tapuac District Center',
    address: 'Tapuac District, Dagupan City, Pangasinan',
    latitude: 16.0498,
    longitude: 120.3475,
    type: 'district',
    keywords: ['tapuac', 'district'],
  },
  {
    name: 'Caranglaan District Center',
    address: 'Caranglaan, Dagupan City, Pangasinan',
    latitude: 16.0507,
    longitude: 120.354,
    type: 'district',
    keywords: ['caranglaan', 'district'],
  },
  {
    name: 'Mayombo District Center',
    address: 'Mayombo, Dagupan City, Pangasinan',
    latitude: 16.0439,
    longitude: 120.3289,
    type: 'district',
    keywords: ['mayombo', 'district'],
  },
  {
    name: 'Calmay District Center',
    address: 'Calmay, Dagupan City, Pangasinan',
    latitude: 16.0608,
    longitude: 120.3448,
    type: 'district',
    keywords: ['calmay', 'district'],
  },
  {
    name: 'Salapingao District Center',
    address: 'Salapingao, Dagupan City, Pangasinan',
    latitude: 16.066,
    longitude: 120.349,
    type: 'district',
    keywords: ['salapingao', 'district'],
  },
  {
    name: 'Tambac District Center',
    address: 'Tambac, Dagupan City, Pangasinan',
    latitude: 16.0527,
    longitude: 120.3411,
    type: 'district',
    keywords: ['tambac', 'district'],
  },
  {
    name: 'Pogo Grande District Center',
    address: 'Pogo Grande, Dagupan City, Pangasinan',
    latitude: 16.0469,
    longitude: 120.343,
    type: 'district',
    keywords: ['pogo grande', 'district'],
  },
  {
    name: 'Lasip Chico District Center',
    address: 'Lasip Chico, Dagupan City, Pangasinan',
    latitude: 16.0553,
    longitude: 120.3578,
    type: 'district',
    keywords: ['lasip chico', 'district'],
  },
  {
    name: 'Lasip Grande District Center',
    address: 'Lasip Grande, Dagupan City, Pangasinan',
    latitude: 16.0589,
    longitude: 120.3587,
    type: 'district',
    keywords: ['lasip grande', 'district'],
  },
  {
    name: 'Malued District Center',
    address: 'Malued, Dagupan City, Pangasinan',
    latitude: 16.0569,
    longitude: 120.346,
    type: 'district',
    keywords: ['malued', 'district'],
  },
  {
    name: 'Bolosan District Center',
    address: 'Bolosan, Dagupan City, Pangasinan',
    latitude: 16.0609,
    longitude: 120.3511,
    type: 'district',
    keywords: ['bolosan', 'district'],
  },
  {
    name: 'Carael District Center',
    address: 'Carael, Dagupan City, Pangasinan',
    latitude: 16.0538,
    longitude: 120.3476,
    type: 'district',
    keywords: ['carael', 'district'],
  },
  {
    name: 'Mamalingling District Center',
    address: 'Mamalingling, Dagupan City, Pangasinan',
    latitude: 16.0648,
    longitude: 120.3466,
    type: 'district',
    keywords: ['mamalingling', 'district'],
  },
  {
    name: 'Sewage Treatment Plant Area',
    address: 'Bonuan, Dagupan City, Pangasinan',
    latitude: 16.0694,
    longitude: 120.3418,
    type: 'utility',
    keywords: ['stp', 'utility'],
  },
  {
    name: 'Judge Jose de Venecia Sr. Highway Junction',
    address: 'Dagupan City, Pangasinan',
    latitude: 16.0523,
    longitude: 120.3508,
    type: 'road',
    keywords: ['jvd highway', 'junction', 'highway'],
  },
  {
    name: 'A.B. Fernandez East Junction',
    address: 'A.B. Fernandez East, Dagupan City, Pangasinan',
    latitude: 16.0462,
    longitude: 120.3397,
    type: 'road',
    keywords: ['ab fernandez', 'junction'],
  },
  {
    name: 'Perez Boulevard Junction',
    address: 'Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.0456,
    longitude: 120.3384,
    type: 'road',
    keywords: ['perez boulevard', 'junction'],
  },
  {
    name: 'Arellano Street Center',
    address: 'Arellano St, Dagupan City, Pangasinan',
    latitude: 16.0449,
    longitude: 120.3331,
    type: 'road',
    keywords: ['arellano', 'street'],
  },
  {
    name: 'M.H. Del Pilar Street Center',
    address: 'M.H. Del Pilar St, Dagupan City, Pangasinan',
    latitude: 16.0435,
    longitude: 120.3346,
    type: 'road',
    keywords: ['mh del pilar', 'street'],
  },
  {
    name: 'Galvan Street Center',
    address: 'Galvan St, Dagupan City, Pangasinan',
    latitude: 16.0438,
    longitude: 120.3339,
    type: 'road',
    keywords: ['galvan', 'street'],
  },
  {
    name: 'Herrero-Perez Boulevard Center',
    address: 'Herrero-Perez Blvd, Dagupan City, Pangasinan',
    latitude: 16.0448,
    longitude: 120.3353,
    type: 'road',
    keywords: ['herrero perez', 'boulevard'],
  },
  {
    name: 'Tapuac Overpass Area',
    address: 'Tapuac District, Dagupan City, Pangasinan',
    latitude: 16.0507,
    longitude: 120.3486,
    type: 'transport',
    keywords: ['overpass', 'tapuac'],
  },
  {
    name: 'Bonuan Bridge Area',
    address: 'Bonuan, Dagupan City, Pangasinan',
    latitude: 16.0689,
    longitude: 120.3372,
    type: 'transport',
    keywords: ['bridge', 'bonuan'],
  },
  {
    name: 'Calmay Bridge Area',
    address: 'Calmay, Dagupan City, Pangasinan',
    latitude: 16.0604,
    longitude: 120.3434,
    type: 'transport',
    keywords: ['bridge', 'calmay'],
  },
  {
    name: 'Malued Bridge Area',
    address: 'Malued, Dagupan City, Pangasinan',
    latitude: 16.0572,
    longitude: 120.3456,
    type: 'transport',
    keywords: ['bridge', 'malued'],
  },
];

function toMinutes(distanceMeters, speedKmh = 35) {
  const speedMetersPerMinute = (speedKmh * 1000) / 60;
  return Math.max(1, Math.round(distanceMeters / speedMetersPerMinute));
}

function normalizeIncidentSeverityWeight(value) {
  const level = String(value || '').toLowerCase();
  if (level === 'high') return 3;
  if (level === 'medium') return 2;
  if (level === 'low') return 1;
  return 1;
}

function normalizeDepartmentUnit(department) {
  const latitude = Number(department.latitude);
  const longitude = Number(department.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    id: department.code || `dept-${department.department_id}`,
    name: department.name,
    department: department.type || 'General',
    availability: String(department.status || '').toLowerCase() === 'inactive' ? 'Inactive' : 'Available',
    latitude,
    longitude,
  };
}

function buildCompactDisplayLabel(entry) {
  const address = entry?.address || {};
  const road = address.road || address.pedestrian || address.footway || address.path || null;
  const locality = address.suburb || address.neighbourhood || address.quarter || address.city_district || null;
  const city = address.city || address.town || address.municipality || 'Dagupan';
  const state = address.state || 'Pangasinan';
  const country = address.country || 'Philippines';

  const compactParts = [road, locality, city, state, country]
    .map((part) => String(part || '').trim())
    .filter(Boolean);

  if (compactParts.length > 0) {
    return compactParts.join(', ');
  }

  return entry?.display_name || null;
}

function formatNominatimResult(entry) {
  const latitude = Number(entry?.lat);
  const longitude = Number(entry?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const inDagupan = isPointInDagupan(latitude, longitude, 3000);

  return {
    label: buildCompactDisplayLabel(entry),
    latitude,
    longitude,
    barangay: getBarangayFromCoordinates(latitude, longitude),
    inDagupan,
    osmType: entry.osm_type || null,
    osmId: entry.osm_id || null,
    type: entry.type || null,
  };
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toSlug(value) {
  return normalizeSearchText(value)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function mergeLocationResults(primary, secondary, limit) {
  const seen = new Set();
  const merged = [];

  for (const result of [...primary, ...secondary]) {
    if (!result) continue;
    const key = `${(result.label || '').toLowerCase()}|${Number(result.latitude).toFixed(6)}|${Number(result.longitude).toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(result);
    if (merged.length >= limit) break;
  }

  return merged;
}

async function fetchNominatimSearchResults(rawQuery, limit, bounded) {
  const query = String(rawQuery || '').trim();
  const url = new URL('/search', NOMINATIM_BASE_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  if (bounded) {
    url.searchParams.set('bounded', '1');
    url.searchParams.set('viewbox', DAGUPAN_CITY_VIEWBOX);
  }
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': NOMINATIM_USER_AGENT,
    },
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  const seen = new Set();
  const results = [];
  for (const entry of data) {
    const formatted = formatNominatimResult(entry);
    if (!formatted) continue;
    const key = `${formatted.osmType || 'x'}:${formatted.osmId || 'x'}:${formatted.latitude.toFixed(6)}:${formatted.longitude.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(formatted);
  }

  return results.sort((a, b) => {
    if (a.inDagupan === b.inDagupan) return 0;
    return a.inDagupan ? -1 : 1;
  });
}

async function getLocalAddressSuggestions(query, limit) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return [];

  const departments = await Department.findAll();
  if (!Array.isArray(departments)) return [];

  const seen = new Set();
  const matches = [];
  for (const dept of departments) {
    const address = String(dept?.address || '').trim();
    if (!address) continue;
    const deptName = String(dept?.name || '').trim();
    const label = deptName ? `${address} (${deptName})` : address;
    if (!label.toLowerCase().includes(needle)) continue;
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    matches.push({
      label,
      latitude: Number.isFinite(Number(dept?.latitude)) ? Number(dept.latitude) : null,
      longitude: Number.isFinite(Number(dept?.longitude)) ? Number(dept.longitude) : null,
      barangay: Number.isFinite(Number(dept?.latitude)) && Number.isFinite(Number(dept?.longitude))
        ? getBarangayFromCoordinates(Number(dept.latitude), Number(dept.longitude))
        : null,
      inDagupan: Number.isFinite(Number(dept?.latitude)) && Number.isFinite(Number(dept?.longitude))
        ? isPointInDagupan(Number(dept.latitude), Number(dept.longitude), 3000)
        : false,
      osmType: 'local',
      osmId: `department-${dept?.department_id || label}`,
      type: 'department-address',
    });
    if (matches.length >= limit) break;
  }

  return matches;
}

function searchLandmarks(query, limit) {
  const needle = normalizeSearchText(query);
  if (!needle) return [];
  const tokens = needle.split(' ').filter(Boolean);

  const scored = DAGUPAN_LANDMARKS
    .map((landmark) => {
      const normalizedName = normalizeSearchText(landmark.name);
      const normalizedAddress = normalizeSearchText(landmark.address);
      const haystack = normalizeSearchText(
        `${landmark.name} ${landmark.address} ${(landmark.keywords || []).join(' ')}`
      );

      let score = 0;
      const allTokensPresent = tokens.every((token) => haystack.includes(token));
      const someTokenPresent = tokens.some((token) => haystack.includes(token));

      if (normalizedName === needle) score += 420;
      if (normalizedName.startsWith(needle)) score += 220;
      if (normalizedName.includes(needle)) score += 130;
      if (normalizedAddress.includes(needle)) score += 40;
      if (haystack.startsWith(needle)) score += 140;
      if (haystack.includes(` ${needle} `) || haystack.endsWith(` ${needle}`)) score += 80;
      if (allTokensPresent) score += 60;
      else if (someTokenPresent) score += 20;

      for (const token of tokens) {
        if (landmark.name.toLowerCase().startsWith(token)) score += 12;
        if ((landmark.keywords || []).some((keyword) => normalizeSearchText(keyword).includes(token))) score += 10;
      }

      const centerDistance = calculateDistance(
        DAGUPAN_CITY_CENTER.latitude,
        DAGUPAN_CITY_CENTER.longitude,
        landmark.latitude,
        landmark.longitude
      );
      score += Math.max(0, 25 - Math.round(centerDistance / 450));

      return { landmark, score };
    })
    .filter((entry) => entry.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ landmark }) => ({
      label: `${landmark.name}, ${landmark.address}`,
      latitude: landmark.latitude,
      longitude: landmark.longitude,
      barangay: getBarangayFromCoordinates(landmark.latitude, landmark.longitude),
      inDagupan: isPointInDagupan(landmark.latitude, landmark.longitude, 3000),
      osmType: 'landmark',
      osmId: `landmark-${toSlug(landmark.name)}`,
      type: landmark.type,
    }));

  return scored;
}

const locationController = {
  async search(req, res) {
    const query = String(req.query?.q || '').trim();
    const limit = Number.isFinite(Number(req.query?.limit))
      ? Math.min(Math.max(Number(req.query.limit), 1), 8)
      : 5;

    try {
      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      const queryVariants = [
        query,
        `${query}, Dagupan City, Pangasinan`,
        `${query}, Pangasinan`,
        `${query}, Philippines`,
      ];

      let results = [];
      for (const variant of queryVariants) {
        results = await fetchNominatimSearchResults(variant, limit, false);
        if (results.length > 0) break;
      }

      const landmarkMatches = searchLandmarks(query, limit);
      if (landmarkMatches.length > 0) {
        results = mergeLocationResults(landmarkMatches, results, limit);
      }

      if (results.length === 0) {
        results = landmarkMatches;
      }

      if (results.length === 0) {
        results = await getLocalAddressSuggestions(query, limit);
      }

      return res.status(200).json({ success: true, count: results.length, results });
    } catch (error) {
      console.error('Error searching locations:', error);
      try {
        const landmarkFallback = searchLandmarks(query, limit);
        if (landmarkFallback.length > 0) {
          return res.status(200).json({ success: true, count: landmarkFallback.length, results: landmarkFallback });
        }
        const fallback = await getLocalAddressSuggestions(query, limit);
        return res.status(200).json({ success: true, count: fallback.length, results: fallback });
      } catch (_) {
        return res.status(500).json({ error: 'Failed to search locations' });
      }
    }
  },

  async reverse(req, res) {
    try {
      const latitude = validateLatitude(req.query?.latitude);
      const longitude = validateLongitude(req.query?.longitude);

      const url = new URL('/reverse', NOMINATIM_BASE_URL);
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '1');

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': NOMINATIM_USER_AGENT,
        },
      });

      if (!response.ok) {
        const fallbackBarangay = getBarangayFromCoordinates(latitude, longitude);
        const fallback = {
          label: fallbackBarangay
            ? `${fallbackBarangay}, Dagupan City, Pangasinan`
            : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          latitude,
          longitude,
          barangay: fallbackBarangay,
          inDagupan: isPointInDagupan(latitude, longitude, 3000),
          source: 'fallback',
        };
        return res.status(200).json({ success: true, result: fallback });
      }

      const data = await response.json();
      const result = formatNominatimResult(data) || {
        label: data?.display_name || null,
        latitude,
        longitude,
        barangay: getBarangayFromCoordinates(latitude, longitude),
        inDagupan: isPointInDagupan(latitude, longitude, 3000),
        source: 'nominatim',
      };

      return res.status(200).json({ success: true, result });
    } catch (error) {
      console.error('Error reverse geocoding location:', error);
      if (error.message.includes('Latitude') || error.message.includes('Longitude')) {
        return res.status(400).json({ error: error.message });
      }
      try {
        const latitude = validateLatitude(req.query?.latitude);
        const longitude = validateLongitude(req.query?.longitude);
        const fallbackBarangay = getBarangayFromCoordinates(latitude, longitude);
        const fallback = {
          label: fallbackBarangay
            ? `${fallbackBarangay}, Dagupan City, Pangasinan`
            : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          latitude,
          longitude,
          barangay: fallbackBarangay,
          inDagupan: isPointInDagupan(latitude, longitude, 3000),
          source: 'fallback',
        };
        return res.status(200).json({ success: true, result: fallback });
      } catch (_) {
        return res.status(500).json({ error: 'Failed to reverse geocode location' });
      }
    }
  },

  // Check if coordinates are within Dagupan city boundaries
  async checkLocation(req, res) {
    try {
      const { latitude, longitude, bufferMeters } = req.body;

      // Validate required fields
      if (latitude === undefined || latitude === null) {
        return res.status(400).json({ error: 'Latitude is required' });
      }
      if (longitude === undefined || longitude === null) {
        return res.status(400).json({ error: 'Longitude is required' });
      }

      // Validate and parse coordinates
      const validatedLat = validateLatitude(latitude);
      const validatedLng = validateLongitude(longitude);

      // Parse buffer meters (optional, default to 0)
      let buffer = 0;
      if (bufferMeters !== undefined && bufferMeters !== null) {
        buffer = parseInt(bufferMeters, 10);
        if (isNaN(buffer) || buffer < 0) {
          return res.status(400).json({ error: 'bufferMeters must be a non-negative number' });
        }
      }

      // Check if point is in Dagupan polygon with optional buffer
      const isInDagupan = isPointInDagupan(validatedLat, validatedLng, buffer);

      res.status(200).json({
        success: true,
        isInDagupan: isInDagupan,
        coordinates: {
          latitude: validatedLat,
          longitude: validatedLng
        },
        bufferMeters: buffer,
        message: isInDagupan 
          ? `The coordinates are within Dagupan city boundaries${buffer > 0 ? ` (with ${buffer}m buffer)` : ''}`
          : `The coordinates are outside Dagupan city boundaries${buffer > 0 ? ` (even with ${buffer}m buffer)` : ''}`
      });
    } catch (error) {
      console.error('Error checking location:', error);
      if (error.message.includes('must be') || error.message.includes('Latitude') || error.message.includes('Longitude')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to check location' });
    }
  },

  async closestUnits(req, res) {
    try {
      const incident = req.body?.incident || {};
      const incidentLatitude = validateLatitude(incident.latitude);
      const incidentLongitude = validateLongitude(incident.longitude);
      const requestedUnits = Array.isArray(req.body?.units) ? req.body.units : [];
      const maxResults = Number.isFinite(Number(req.body?.limit))
        ? Math.min(Math.max(Number(req.body.limit), 1), 10)
        : 5;

      const departments = await Department.findAll();
      const departmentUnits = Array.isArray(departments)
        ? departments.map(normalizeDepartmentUnit).filter(Boolean)
        : [];

      const candidateUnits = (requestedUnits.length > 0 ? requestedUnits : departmentUnits)
        .map((unit, index) => {
          try {
            const latitude = validateLatitude(unit.latitude);
            const longitude = validateLongitude(unit.longitude);
            const distanceMeters = calculateDistance(incidentLatitude, incidentLongitude, latitude, longitude);
            return {
              id: unit.id || `unit-${index + 1}`,
              name: unit.name || `Unit ${index + 1}`,
              department: unit.department || 'General',
              availability: unit.availability || unit.status || 'Available',
              latitude,
              longitude,
              distanceMeters,
              etaMinutes: toMinutes(distanceMeters),
            };
          } catch (_) {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, maxResults);

      res.status(200).json({
        success: true,
        incident: {
          latitude: incidentLatitude,
          longitude: incidentLongitude,
        },
        suggestions: candidateUnits,
      });
    } catch (error) {
      console.error('Error computing closest units:', error);
      if (error.message.includes('Latitude') || error.message.includes('Longitude')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to compute closest units' });
    }
  },

  async geofenceAlerts(req, res) {
    try {
      const bufferMeters = req.body?.bufferMeters != null ? Number(req.body.bufferMeters) : 0;
      if (!Number.isFinite(bufferMeters) || bufferMeters < 0) {
        return res.status(400).json({ error: 'bufferMeters must be a non-negative number' });
      }

      const sourceIncidents = Array.isArray(req.body?.incidents)
        ? req.body.incidents
        : await Incident.findAll({ limit: 100, offset: 0, status: 'pending' });

      const alerts = sourceIncidents
        .map((incident) => {
          const latitude = Number(incident.latitude);
          const longitude = Number(incident.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
          const inside = isPointInDagupan(latitude, longitude, bufferMeters);
          if (inside) return null;
          return {
            report_id: incident.report_id || incident.id,
            latitude,
            longitude,
            barangay: incident.barangay || getBarangayFromCoordinates(latitude, longitude) || null,
            status: incident.status || null,
            severity_level: incident.severity_level || null,
            reason: 'Incident is outside configured Dagupan geofence',
          };
        })
        .filter(Boolean);

      res.status(200).json({
        success: true,
        bufferMeters,
        alertCount: alerts.length,
        alerts,
      });
    } catch (error) {
      console.error('Error generating geofence alerts:', error);
      res.status(500).json({ error: 'Failed to generate geofence alerts' });
    }
  },

  async heatmap(req, res) {
    try {
      const limit = Number.isFinite(Number(req.query?.limit))
        ? Math.min(Math.max(Number(req.query.limit), 1), 500)
        : 200;
      const incidents = await Incident.findAll({ limit, offset: 0 });

      const byBarangay = incidents.reduce((acc, incident) => {
        const key = incident.barangay || 'Unknown';
        if (!acc[key]) {
          acc[key] = {
            barangay: key,
            incidentCount: 0,
            heatScore: 0,
            criticalCount: 0,
            warningCount: 0,
          };
        }
        acc[key].incidentCount += 1;
        const weight = normalizeIncidentSeverityWeight(incident.severity_level);
        acc[key].heatScore += weight;
        if (weight === 3) acc[key].criticalCount += 1;
        if (weight === 2) acc[key].warningCount += 1;
        return acc;
      }, {});

      const hotspots = Object.values(byBarangay)
        .sort((a, b) => b.heatScore - a.heatScore)
        .slice(0, 20);

      res.status(200).json({
        success: true,
        hotspotCount: hotspots.length,
        hotspots,
      });
    } catch (error) {
      console.error('Error generating heatmap data:', error);
      res.status(500).json({ error: 'Failed to generate heatmap data' });
    }
  }
};

module.exports = locationController;
