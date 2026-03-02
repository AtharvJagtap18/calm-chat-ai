import ollama
import random

# Different supportive styles
STYLES = [
    "Speak gently and ask how they are feeling right now.",
    "Give encouragement and highlight their inner strength.",
    "Offer comfort with hopeful and soothing words.",
    "Respond like a caring friend, showing deep understanding.",
    "Give warm reassurance and invite them to share more.",
    "Acknowledge their feelings and remind them they are valued.",
    "Show kindness and remind them that healing takes time."
]

# Conversation memory
conversation_history = []

def generate_empathic_response(user_input, lang_name="English"):
    style_prompt = random.choice(STYLES)
    system_prompt = (
        f"You are a compassionate and empathetic mental health support assistant. "
        f"Reply to the user in {lang_name} only. "
        f"{style_prompt} "
        "Keep replies short (1–3 sentences). Avoid repeating the same phrases."
    )

    conversation_history.append({ "role": "user", "content": user_input })

    try:
        response = ollama.chat(
            model="llama3",
            messages=[{"role": "system", "content": system_prompt}] + conversation_history[-6:]
        )
        bot_reply = response.get("message", {}).get("content") or response.get("content")
        if not bot_reply:
            bot_reply = "⚠️ Sorry, I couldn’t generate a reply."
    except Exception as e:
        bot_reply = f"⚠️ I’m having trouble responding right now. ({str(e)})"

    conversation_history.append({ "role": "assistant", "content": bot_reply })
    return bot_reply
