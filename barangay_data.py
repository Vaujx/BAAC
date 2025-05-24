"""
Barangay Amungan Data Module
Contains all hardcoded information about barangay officials and population data
"""

# Hardcoded Barangay Officials Information
BARANGAY_OFFICIALS_INFO = """
Barangay Amungan Officials:

Punong Barangay (also called Captain, Kapitan, Cap, or Kap): Richard N. Redondo

Barangay Kagawad (Councilors):
- Joseph D. Flauta
- Walter L. Olipane
- Richard D. Arquero
- Arnold R. Lonzanida
- Jesieline C. Sibug
- Darius S. Susa Sr.
- Russel S. Aramay

Barangay Secretary: Darrel Castrence
Barangay Treasurer: Rodalyn E. Gutierrez

Sangguniang Kabataan (SK) Officials (in hierarchical order):
- Carl Eric B. Rico (SK Chairperson)
- Arnel Jake E. Mercado
- Danica D. Barried
- Marjurine R. Dagsaan
- Grace E. Ednalaga
- Christian Lloyd R. Susa
- Criezel Mae P. Santos
- Gabriel Vonz M. Macalinao
- Patricia Leigh M. Rebultan
- Ellysa Famisan

Purok Presidents (Barangay Amungan has a total of 14 puroks):
- Purok 1: Felimon V. Aramay Jr.
- Purok 2: Joselyn Alarma
- Purok 3: Alvin Abadam
- Purok 4: Moises S. Castrence
- Purok 5: Carlos B. Dagun
- Purok 6: Lelyrose Arcino
- Purok 7: Belen A. Famisan
- Purok 8: Marissa Cristobal
- Purok 9: Jean Abad
- Purok 10: Gilbert Baluyot
- Purok 11: Jerry P. Cristobal
- Purok 12: Henry Adona
- Purok 13: Nelsa T. Aramay
- Purok 14: Jayson Mora

Population Information of Barangay Amungan by Age Range:

Under 5 Years Old
Male: 443
Female: 412
Total: 855

5 - 9 Years Old
Male: 481
Female: 488
Total: 969

10 - 14 Years Old
Male: 571
Female: 533
Total: 1,104

15 - 19 Years Old
Male: 581
Female: 563
Total: 1,144

20 - 24 Years Old
Male: 629
Female: 561
Total: 1,190

25 - 29 Years Old
Male: 591
Female: 607
Total: 1,198

30 - 34 Years Old
Male: 517
Female: 510
Total: 1,027

35 - 39 Years Old
Male: 490
Female: 438
Total: 928

40 - 44 Years Old
Male: 401
Female: 422
Total: 823

45 - 49 Years Old
Male: 345
Female: 393
Total: 738

50 - 54 Years Old
Male: 285
Female: 294
Total: 579

55 - 59 Years Old
Male: 268
Female: 300
Total: 568

60 - 64 Years Old
Male: 257
Female: 230
Total: 487

65 - 69 Years Old
Male: 201
Female: 192
Total: 393

70 - 74 Years Old
Male: 124
Female: 152
Total: 276

75 - 79 Years Old
Male: 63
Female: 88
Total: 151

80 Years Old and Over
Male: 43
Female: 97
Total: 140
"""

# Available document types
AVAILABLE_DOCUMENTS = ["barangay clearance", "barangay indigency", "barangay residency"]

# Helper functions for checking query types
def is_about_officials(query):
    """Check if a query is about barangay officials"""
    query_lower = query.lower()

    # Check for general terms about officials
    official_terms = [
        "official", "officials", "barangay official", "barangay officials",
        "kagawad", "councilor", "council", "secretary", "treasurer",
        "captain", "kapitan", "chairman", "punong", "kap ", "cap ",
        "sk", "sangguniang kabataan", "youth council", "youth",
        "purok", "purok president", "purok leader", "president"
    ]

    # Check for specific names of officials
    official_names = [
        "redondo", "flauta", "olipane", "arquero", "lonzanida", 
        "sibug", "susa", "aramay", "castrence", "gutierrez",
        "rico", "mercado", "barried", "dagsaan", "ednalaga",
        "santos", "macalinao", "rebultan", "famisan",
        "alarma", "abadam", "dagun", "arcino", "abad",
        "baluyot", "cristobal", "adona", "mora"
    ]

    # Check if any term is in the query
    for term in official_terms:
        if term in query_lower:
            return True

    # Check if any name is in the query
    for name in official_names:
        if name in query_lower:
            return True

    return False

def is_about_population(query):
    """Check if a query is about population information"""
    query_lower = query.lower()

    # Check for population-related terms
    population_terms = [
        "population", "demographics", "residents", "people", "citizens",
        "age", "gender", "male", "female", "men", "women", "boys", "girls",
        "statistics", "census", "how many people", "total population"
    ]

    # Check if any term is in the query
    for term in population_terms:
        if term in query_lower:
            return True

    return False

def detect_document_type(query):
    """Helper function to detect document type in a query"""
    query_lower = query.lower()

    # Check for barangay clearance
    if "clearance" in query_lower:
        return "barangay clearance"

    # Check for barangay indigency (including common misspellings)
    if any(word in query_lower for word in ["indigency", "indengency", "indengecy", "indegency"]):
        return "barangay indigency"

    # Check for barangay residency
    if "residency" in query_lower:
        return "barangay residency"

    # If no specific document type is found, check for general document mentions
    for doc_type in AVAILABLE_DOCUMENTS:
        if doc_type in query_lower:
            return doc_type

    return None
