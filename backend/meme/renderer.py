from __future__ import annotations

import random
import urllib.parse
from typing import Any

# Emotion -> Meme Template Mapping
MEME_TEMPLATES = {
    "happy": ["success", "doge", "awesome", "harold"],
    "sad": ["sad-biden", "crying-cat", "disastergirl", "sad-keanu"],
    "angry": ["grumpycat", "angry", "buzz", "disastergirl"],
    "surprised": ["pikachu", "yuno", "distracted-bf"],
    "neutral": ["fine", "spongebob", "philosoraptor"],
    "calm": ["lofi", "owl"],
    "anxious": ["nervous", "fry", "spiderman"],
}


def generate_meme_url(mood: str, top_text: str, bottom_text: str) -> str:
    """
    Meme URL Builder (memegen.link)
    Constructs URLs like: https://api.memegen.link/images/{template}/{top}/{bottom}.png
    """
    mood = mood.lower()
    templates = MEME_TEMPLATES.get(mood, ["fine"])
    template = random.choice(templates)
    
    def clean(t: str) -> str:
        """Rules: Replace spaces with _, URL encode, handle special chars."""
        if not t: 
            return "_"
        # memegen specific replacements
        t = t.replace("-", "--").replace("_", "__")
        t = t.replace(" ", "_").replace("?", "~q").replace("%", "~p").replace("#", "~h").replace("/", "~s")
        return urllib.parse.quote(t)

    top = clean(top_text)
    bottom = clean(bottom_text)
    
    return f"https://api.memegen.link/images/{template}/{top}/{bottom}.png"


def render_meme(top_text: str, bottom_text: str, mood: str) -> str:
    """Wrapper to maintain API compatibility, returns the URL string."""
    return generate_meme_url(mood, top_text, bottom_text)
