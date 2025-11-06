import os
import random
import re
from typing import List, Dict, Optional, Tuple, Union

# Define the notable places and their corresponding image filenames
NOTABLE_PLACES = {
    "amungan elementary school": [
        "Amungan_elementary_school.jpg",
        "Amungan_elementary_school2.jpg"
    ],
    "amungan market": [
        "Amungan_Market.jpg"
    ],
    "amungan national high school": [
        "Amungan_national_highschool.jpg",
        "amungan_national_highschool2.jpg",
        "amungan_national_highschool3.jpg"
    ],
    "barangay hall": [
        "barangay_hall.jpg",
        "barangay_hall2.jpg",
        "barangay_hall3.jpg"
    ],
    "barangay hall outside": [
        "barangay_hall_outside.jpg",
        "barangay_hall_outside2.jpg"
    ],
    "barangay health center": [
        "barangay_health_center.jpg"
    ],
    "beach resort": [
        "beach_resort.jpg",
        "beach_resort1.jpg",
        "beach_resort2.jpg",
        "beach_resort3.jpg"
    ],
    "plaza mercado": [
        "plaza_mercado.jpg",
        "plaza_mercado2.jpg",
        "plaza_mercado3.jpg",
        "plaza_mercado4.jpg",
        "plaza_mercado5.jpg"
    ]
}

# Alternative names and keywords for places
PLACE_KEYWORDS = {
    "amungan elementary school": ["elementary school", "elementary", "school", "grade school"],
    "amungan market": ["market", "palengke", "marketplace", "public market"],
    "amungan national high school": ["high school", "secondary school", "national high school", "high school"],
    "barangay hall": ["hall", "barangay office", "office", "government office"],
    "barangay hall outside": ["hall outside", "outside hall", "hall exterior", "barangay hall exterior"],
    "barangay health center": ["health center", "clinic", "medical center", "health station"],
    "plaza mercado": ["plaza", "mercado", "town plaza", "town square", "park"],
    "beach resort": ["resort", "beach resort", "beach"]
}

# Base directory for images
IMAGE_BASE_DIR = "static/images"

def detect_place_request(user_message: str) -> Optional[str]:
    message_lower = user_message.lower().strip()
    """
    Detect if the user is requesting to see a notable place in Amungan.
    
    Args:
        user_message: The user's message text
        
    Returns:
        The detected place name or None if no place is detected
    """
    # Convert to lowercase for case-insensitive matching
    message_lower = user_message.lower()
    
    # Check for direct place mentions
    for place in NOTABLE_PLACES.keys():
        if place in message_lower:
            return place
    
    # Check for keywords
    for place, keywords in PLACE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in message_lower:
                # Check if the message is asking to see/view/show the place
                view_patterns = [
                    r"(show|see|view|picture|photo|image|look at).*\b" + re.escape(keyword) + r"\b",
                    r"\b" + re.escape(keyword) + r"\b.*(show|see|view|picture|photo|image)"
                ]
                
                for pattern in view_patterns:
                    if re.search(pattern, message_lower):
                        return place
    
    return None

def get_random_images(place: str, num_images: int = 1) -> List[str]:
    """
    Get random image paths for a specific place.
    
    Args:
        place: The name of the place
        num_images: Number of images to return (default: 1)
        
    Returns:
        List of image paths
    """
    if place not in NOTABLE_PLACES:
        return []
    
    available_images = NOTABLE_PLACES[place]
    
    # Ensure we don't try to get more images than available
    num_to_select = min(num_images, len(available_images))
    
    # Randomly select images
    selected_images = random.sample(available_images, num_to_select)
    
    # Return full paths
    return [os.path.join(IMAGE_BASE_DIR, img) for img in selected_images]

def format_place_response(place: str, image_paths: List[str]) -> Dict[str, Union[str, List[str]]]:
    """
    Format a response with place information and images.
    
    Args:
        place: The name of the place
        image_paths: List of image paths
        
    Returns:
        Dictionary with response text and image paths
    """
    place_descriptions = {
        "amungan elementary school": "Here's Amungan Elementary School, one of the primary educational institutions in Barangay Amungan where young students begin their educational journey.",
        "amungan market": "This is the Amungan Market, a vibrant hub of local commerce where residents buy fresh produce, goods, and other daily necessities.",
        "amungan national high school": "Here's Amungan National High School, which provides secondary education to the youth of Barangay Amungan and nearby areas.",
        "barangay hall": "This is the Barangay Hall of Amungan, the center of local governance where barangay officials work and community services are provided.",
        "barangay hall outside": "Here's the exterior view of the Barangay Hall of Amungan, showing the building's facade and surroundings.",
        "barangay health center": "This is the Barangay Health Center, which provides basic healthcare services, consultations, and health programs to Amungan residents.",
        "plaza mercado": "Here's Plaza Mercado, a public space in Amungan where community gatherings, events, and recreational activities take place.",
        "Beach Resort" : "Here's one of the beach resort here in Barangay Amungan"
    }
    
    response_text = place_descriptions.get(place, f"Here's a view of {place.title()} in Barangay Amungan.")
    
    if len(image_paths) > 1:
        response_text += " I've included a couple of different views for you to see."
    
    return {
        "text": response_text,
        "image_paths": image_paths
    }

def handle_place_request(user_message: str) -> Optional[Dict[str, Union[str, List[str]]]]:
    """
    Main function to handle a user request for a notable place.
    
    Args:
        user_message: The user's message text
        
    Returns:
        Dictionary with response text and image paths, or None if not a place request
    """
    place = detect_place_request(user_message)
    
    if not place:
        return None
    
    # Decide how many images to show (1 or 2)
    num_images = random.choice([1, 2]) if len(NOTABLE_PLACES[place]) > 1 else 1
    
    # Get random images
    image_paths = get_random_images(place, num_images)
    
    # Format response
    return format_place_response(place, image_paths)

def is_place_request(user_message: str) -> bool:
    """
    Check if the user message is requesting to see a place.
    
    Args:
        user_message: The user's message text
        
    Returns:
        True if it's a place request, False otherwise
    """
    # Convert to lowercase for case-insensitive matching
    message_lower = user_message.lower()
    
    # Check for view/see/show keywords combined with place-related words
    view_keywords = ["show", "see", "view", "picture", "photo", "image", "itsura","patingin","look at"]
    place_related = ["place", "location", "area", "site", "spot", "landmark", "building", "school", "market", "hall", "plaza", "center","beach","resort","beach resort"]
    
    for view_word in view_keywords:
        if view_word in message_lower:
            # Check if any place-related word is in the message
            for place_word in place_related:
                if place_word in message_lower:
                    return True
            
            # Check if any specific place name is in the message
            for place in NOTABLE_PLACES.keys():
                if place in message_lower:
                    return True
                    
            # Check if any place keyword is in the message
            for keywords in PLACE_KEYWORDS.values():
                for keyword in keywords:
                    if keyword in message_lower:
                        return True
    
    return False

# Example usage:
if __name__ == "__main__":
    # Test with some example messages
    test_messages = [
        "Can you show me the barangay hall?",
        "I want to see the elementary school in Amungan",
        "What does the plaza mercado look like?",
        "Show me pictures of the health center",
        "How does the high school look?",
        "What's the weather today?",  # Not a place request
        "Can you help me with a document request?"  # Not a place request
    ]
    
    for message in test_messages:
        print(f"Message: {message}")
        result = handle_place_request(message)
        if result:
            print(f"Detected place request!")
            print(f"Response: {result['text']}")
            print(f"Images: {result['image_paths']}")
        else:
            print("Not a place request")
        print("-" * 50)
