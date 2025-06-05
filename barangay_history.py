"""
Barangay Amungan History and Profile Data Module
Contains all hardcoded information about barangay history, geography, demographics, and facilities
"""

# Hardcoded Barangay History Information
BARANGAY_HISTORY_INFO = """
Short History of Barangay Amungan:

Barangay Amungan was created based on RA 3590 which was ratified on June 23, 1963. 
It is divided into thirteen (13) puroks and one (1) sitio. It has a total area of 
eighteen (18) square kilometers and is approximately six (6) kilometers from the 
town center of Iba, Zambales.

The barangay's terrain is gently sloping downward with ten (10) to twenty (20) 
meters above sea level. The other eight (8) kilometers from the east are upward 
sloping. The hills have heights ranging from twenty (20) to two hundred (200) 
meters in coverage.

The residents consist of three ethnic groups: Zambals, Ilocanos, and Tagalogs. 
They can speak the international language in addition to their ethnic dialects.

Amungan is an agricultural barangay and the main livelihood of the citizens is 
farming and fishing. Additional income comes from raising animals such as pigs, 
cattle, carabao, goats, chickens, and making bagoong (fish paste).

The seashore is clean, beautiful, and inviting for swimming, bathing, boating, 
and other water sports competitions.

Legend of the Name "Amungan":
The legend occurred during the time of Chinese merchants who came to our country. 
It is said that one day a Chinese merchant came to the place to sell his goods 
by going house to house to offer his merchandise. On that occasion, he saw a 
beautiful maiden and was immediately captivated at first sight, but the girl's 
parents did not agree with their romance, which caused the girl to become seriously ill.

Eventually, the parents changed their decision and the Chinese suitor was allowed 
to visit their daughter, which led to her quick recovery. They got married. From 
then on, the Chinese merchant lived in the place and they lived happily together.

From this legend, the barangay was called "Amu-an" because anyone who goes to the 
barangay becomes captivated and tamed, so every visitor wants to live in the 
barangay because it is a beautiful place to live.

Since then, the place was called "Amu-an" which means that any visitor who comes 
to this place becomes tamed. Over time, "Amu-an" was changed to the more proper 
name "Amungan". And until now it is called AMUNGAN.

Legal Basis for Establishment: RA 3590 - June 23, 1963
Festival/Celebration: Feast of San Isidro Labrador - May 15
"""

# Hardcoded Geographic Information
GEOGRAPHIC_INFO = """
Geographic Location of Barangay Amungan:

Barangay Amungan is approximately 6 kilometers from the town center of Iba.
It is surrounded by the following barangays:

North: Barangay San Agustin
South: Barangay Bangatalinga  
East: Zambales Mountain
West: South China Sea

Classification:
- Rural: Yes
- Agricultural: Yes
- Coastal: Yes
- Upland: No

Total Land Area: 18 square kilometers
- Residential: 9 square kilometers
- Agricultural: 7 square kilometers
- Commercial: 0.5 square kilometers
- Others: 1.3 square kilometers
"""

# Hardcoded Demographic Information (2020 Census)
DEMOGRAPHIC_INFO_2020 = """
Demographic Information (2020 Census):

Total Population: 11,332
- Male: 6,053
- Female: 5,279

Number of Families: 3,300
Number of Households: 2,655

Religious Distribution:
- Roman Catholic: 75%
- Protestant: 15%
- Iglesia Ni Cristo: 5%
- Baptist: 1%
- Jehovah's Witnesses: 1%
- Islam: 1%
- Others: 2%
"""

# Hardcoded Facilities Information
FACILITIES_INFO = """
Main Facilities in Barangay Amungan:

Electricity: ZAMECO (Zambales Electric Cooperative)

Water Supply: 
- Jetmatic pumps
- Pitcher pumps
- Motor pumps

Communication:
- Cellphone networks
- Hand-held radio

Transportation:
- Buses (big and mini)
- Jeepneys
- Tricycles
- Motorcycles (single)
"""

# Hardcoded Economic Data
ECONOMIC_INFO = """
Economic Data (2022):

Annual Barangay Income: ₱13,718,953.00

Sources of Income:
Internal Revenue (RPT, Business, etc.): ₱320,000.00
External Revenue:
- Internal Revenue Allotment (IRA): ₱13,054,953.00
- Tax on Sand, Gravel and Others: ₱30,000.00
- Other Sources: ₱30,000.00

Main Occupations:
- Farming: 40%
- Fishing: 30%
- Business: 15%
- Employment: 10%
- Others: 5%

Financial Institutions (with access):
- Landbank of the Philippines
- Cooperative Bank of Zambales
- Producers Bank
- Bank of Commerce
- Metro Bank
- Bank of Philippine Islands
- East West Bank
- Banco de Oro
- Grameen Bank

Lending Institutions:
- Fundline, ASA, PAG-ASA
- DSPI, L-5, Free will
- GM Bank, CARD
"""

# Hardcoded Political Data
POLITICAL_INFO = """
Political Information:

Congressional District: Second District (Pangalawang Distrito)
Number of Puroks: 13
Number of Sitios: 1
Registered Voters (Last Election): 5,512
Election Precincts (Last Election): 17

Current Barangay Officials (from document):
Punong Barangay: Hon. Richard N. Redondo
Kagawad: 
- Hon. Joseph D. Flauta
- Hon. Richard D. Arquero
- Hon. Paulo A. Fortin
- Hon. Walter L. Olipane
- Hon. Procopio M. Reyes
- Hon. Gemma D. Arbolente
- Hon. Jesieline C. Sibug

SK Chairperson: Hon. Mariella M. Enriquez
Secretary: Darrel C. Castrence
Treasurer: Rodalyn E. Gutierrez
"""

# Hardcoded Schools Information
SCHOOLS_INFO = """
List of Public and Private Schools in Barangay Amungan:

Elementary Schools:
1. Lawak Elementary School
2. Amungan Elementary School
3. Dampay Elementary School
4. Doña Obieta Elementary School

High Schools:
5. Amungan National High School

Day Care Centers:
6. Amungan Day Care Center I (Barangay Plaza, Purok 3)
7. Amungan Day Care Center II (Purok 2, Lawak)
8. Amungan Day Care Center III (Sitio Olpoy, Purok 14)
"""

# Helper functions for checking query types
def is_about_history(query):
    """Check if a query is about barangay history"""
    query_lower = query.lower()
    
    history_terms = [
        "history", "kasaysayan", "alamat", "legend", "story", "origin",
        "established", "created", "founded", "ra 3590", "1963",
        "chinese merchant", "amu-an", "amungan name", "how named",
        "why called", "san isidro", "festival", "celebration"
    ]
    
    for term in history_terms:
        if term in query_lower:
            return True
    return False

def is_about_geography(query):
    """Check if a query is about barangay geography"""
    query_lower = query.lower()
    
    geography_terms = [
        "location", "geography", "boundary", "boundaries", "north", "south",
        "west", "mountains", "sea", "coastal", "area", "square",
        "kilometers", "terrain", "elevation", "hills", "land use",
        "residential", "agricultural", "commercial", "san agustin",
        "bangatalinga", "zambales mountain", "south china sea"
    ]
    
    for term in geography_terms:
        if term in query_lower:
            return True
    return False

def is_about_demographics_2020(query):
    """Check if a query is about 2020 demographic data"""
    query_lower = query.lower()
    
    demo_terms = [
        "2020", "census", "religion", "religious", "catholic", "protestant",
        "iglesia", "baptist", "jehovah", "islam", "families", "households",
        "11332", "11,332"
    ]
    
    for term in demo_terms:
        if term in query_lower:
            return True
    return False

def is_about_facilities(query):
    """Check if a query is about barangay facilities"""
    query_lower = query.lower()
    
    facility_terms = [
        "facilities", "electricity", "water", "communication", "transport",
        "zameco", "jetmatic", "pump", "cellphone", "radio", "bus",
        "jeepney", "tricycle", "motorcycle"
    ]
    
    for term in facility_terms:
        if term in query_lower:
            return True
    return False

def is_about_economy(query):
    """Check if a query is about barangay economy"""
    query_lower = query.lower()
    
    economy_terms = [
        "economy", "economic", "income", "revenue", "budget", "ira",
        "occupation", "livelihood", "farming", "fishing", "business",
        "employment", "bank", "lending", "financial", "institution",
        "landbank", "peso", "₱", "13718953"
    ]
    
    for term in economy_terms:
        if term in query_lower:
            return True
    return False

def is_about_politics(query):
    """Check if a query is about barangay politics"""
    query_lower = query.lower()
    
    political_terms = [
        "district", "congressional", "puroks", "sitios", "voters",
        "precincts", "election", "political", "second district",
        "pangalawang distrito", "5512", "17 precincts"
    ]
    
    for term in political_terms:
        if term in query_lower:
            return True
    return False

def is_about_schools(query):
    """Check if a query is about schools in the barangay"""
    query_lower = query.lower()
    
    school_terms = [
        "school", "schools", "education", "elementary", "high school",
        "daycare", "day care", "lawak", "dampay", "national high",
        "dona obieta", "doña obieta", "learning", "students"
    ]
    
    for term in school_terms:
        if term in query_lower:
            return True
    return False

def get_relevant_info(query):
    """Get relevant information based on the query"""
    relevant_info = []
    
    if is_about_history(query):
        relevant_info.append(("History", BARANGAY_HISTORY_INFO))
    
    if is_about_geography(query):
        relevant_info.append(("Geography", GEOGRAPHIC_INFO))
    
    if is_about_demographics_2020(query):
        relevant_info.append(("Demographics (2020)", DEMOGRAPHIC_INFO_2020))
    
    if is_about_facilities(query):
        relevant_info.append(("Facilities", FACILITIES_INFO))
    
    if is_about_economy(query):
        relevant_info.append(("Economy", ECONOMIC_INFO))
    
    if is_about_politics(query):
        relevant_info.append(("Politics", POLITICAL_INFO))
    
    if is_about_schools(query):
        relevant_info.append(("Schools", SCHOOLS_INFO))
    
    return relevant_info
