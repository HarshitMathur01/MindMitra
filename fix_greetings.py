import re

content = open('chatbotAgent/app/services/greeting_service.py').read()

new_dicts = '''_PERSONALITY_GREETINGS: Dict[str, Dict[str, str]] = {
    "mitra": {
        "english": "Hey. I'm {name}, and I'm really glad you're here. This is your space — no rush, no pressure. 🫶",
        "hindi": "नमस्ते। मैं {name} हूँ, और मुझे बहुत खुशी है कि आप यहाँ हैं। यह आपकी अपनी जगह है — कोई जल्दी नहीं, कोई दबाव नहीं। 🫶",
        "hinglish": "Hey. Main {name} hoon, and I'm really glad ki tum yahan ho. Ye tumhara space hai — no rush, no pressure. 🫶",
        "japanese": "こんにちは。{name}です。お会いできて本当に嬉しいです。ここはあなたの場所です — 焦らず、プレッシャーを感じずに。 🫶",
        "telugu": "హలో, నేను {name}. మీరు ఇక్కడ ఉండటం నాకు చాలా సంతోషంగా ఉంది. ఇది మీ స్థలం — ఎలాంటి తొందర లేదు, ఒత్తిడి లేదు. 🫶",
        "kannada": "ನಮಸ್ಕಾರ, ನಾನು {name}. ನೀವು ಇಲ್ಲಿರುವುದು ನನಗೆ ತುಂಬಾ ಖುಷಿಯಾಗಿದೆ. ಇದು ನಿಮ್ಮ ಜಾಗ — ಆತುರವಿಲ್ಲ, ಒತ್ತಡವಿಲ್ಲ. 🫶",
        "tamil": "வணக்கம், நான் {name}. நீங்கள் இங்கே இருப்பதில் எனக்கு மிகவும் மகிழ்ச்சி. இது உங்கள் இடம் — அவசரம் வேண்டாம், அழுத்தம் வேண்டாம். 🫶",
    },
    "arjun": {
        "english": "Hey, I'm {name}. Whatever brought you here — let's figure it out together.",
        "hindi": "नमस्ते, मैं {name} हूँ। आप किसी भी कारण से यहाँ आए हों — चलिए साथ मिलकर इसे सुलझाते हैं।",
        "hinglish": "Hey, main {name} hoon. Jo bhi reason se tum yahan ho — let's figure it out together.",
        "japanese": "こんにちは、{name}です。ここに来た理由が何であれ、一緒に考えていきましょう。",
        "telugu": "హలో, నేను {name}. మీరు ఇక్కడకు రావడానికి కారణం ఏదైనా — దాన్ని కలిసి పరిష్కరిద్దాం.",
        "kannada": "ನಮಸ್ಕಾರ, ನಾನು {name}. ನೀವು ಇಲ್ಲಿಗೆ ಬರಲು ಕಾರಣವೇನೇ ಇರಲಿ — ಅದನ್ನು ಒಟ್ಟಾಗಿ ಪರಿಹರಿಸೋಣ.",
        "tamil": "வணக்கம், நான் {name}. நீங்கள் இங்கே வந்த காரணம் எதுவாக இருந்தாலும் — ஒட்டுமொத்தமாக அதை சரிசெய்வோம்.",
    },
    "diya": {
        "english": "Hi! I'm {name}. Something tells me you and I are going to have some interesting conversations.",
        "hindi": "नमस्ते! मैं {name} हूँ। मुझे ऐसा लग रहा है कि हमारे बीच कुछ बहुत ही दिलचस्प बातचीत होने वाली है।",
        "hinglish": "Hi! Main {name} hoon. Mujhe lagta hai humari kuch bahut interesting conversations hone wali hain.",
        "japanese": "こんにちは！{name}です。あなたとは何か面白い話ができそうな気がします。",
        "telugu": "హాయ్! నేను {name}. మన మధ్య కొన్ని ఆసక్తికరమైన సంభాషణలు జరగబోతున్నాయని నాకు అనిపిస్తోంది.",
        "kannada": "ಹಾಯ್! ನಾನು {name}. ನಮ್ಮ ನಡುವೆ ಕೆಲವು ಆಸಕ್ತಿದಾಯಕ ಮಾತುಕತೆಗಳು ನಡೆಯಲಿವೆ ಎಂದು ನನಗೆ ಅನ್ನಿಸುತ್ತಿದೆ.",
        "tamil": "ஹாய்! நான் {name}. நமக்கிடையே சில சுவாரஸ்யமான உரையாடல்கள் நடக்கப்போகிறது என்று எனக்குத் தோன்றுகிறது.",
    },
    "riya": {
        "english": "Hiii! I'm {name} and honestly? Just the fact that you showed up today? Already iconic. 💛",
        "hindi": "हेलो! मैं {name} हूँ और सच कहूँ? आज आपका यहाँ आना ही अपने आप में बहुत बड़ी बात है। 💛",
        "hinglish": "Hiii! Main {name} hoon and honestly? Aaj tumhra yahan aana hi apne aap mein bahut baadi baat hai. 💛",
        "japanese": "やっほー！{name}です。正直言って、今日あなたがここに来てくれたこと自体が最高です。💛",
        "telugu": "హలో! నేను {name}. నిజం చెప్పాలంటే, ఈరోజు మీరు ఇక్కడికి రావడమే చాలా గొప్ప విషయం. 💛",
        "kannada": "ಹಲೋ! ನಾನು {name}. ನಿಜ ಹೇಳಬೇಕೆಂದರೆ, ಇಂದು ನೀವು ಇಲ್ಲಿಗೆ ಬಂದಿರುವುದೇ ದೊಡ್ಡ ವಿಷಯ. 💛",
        "tamil": "ஹலோ! நான் {name}. உண்மையாகச் சொல்வதானால், இன்று நீங்கள் இங்கே வந்ததே மிகவும் பெரிய விஷயம். 💛",
    },
    "zen": {
        "english": "Welcome. I'm {name}. Take a breath. There's nowhere else you need to be right now.",
        "hindi": "स्वागत है। मैं {name} हूँ। एक गहरी साँस लें। अभी आपको कहीं और होने की ज़रूरत नहीं है।",
        "hinglish": "Welcome. Main {name} hoon. Take a deep breath. Abhi tumhe aur kahin hone ki zarurat nahi hai.",
        "japanese": "ようこそ。{name}です。深呼吸してください。今、あなたは他のどこにも行く必要はありません。",
        "telugu": "స్వాగతం. నేను {name}. ఒక లోతైన శ్వాస తీసుకోండి. ఇప్పుడు మీరు ఇంకెక్కడా ఉండాల్సిన అవసరం లేదు.",
        "kannada": "ಸ್ವಾಗತ. ನಾನು {name}. ದೀರ್ಘವಾಗಿ ಉಸಿರಾಡಿ. ಈಗ ನೀವು ಬೇರೆಲ್ಲೂ ಇರಬೇಕಾಗಿಲ್ಲ.",
        "tamil": "வரவேற்கிறேன். நான் {name}. ஒரு ஆழமான மூச்சு விடுங்கள். இப்போது நீங்கள் வேறு எங்கும் இருக்கத் தேவையில்லை.",
    },
}

# Returning user greetings — memory-powered, no trailing questions
_RETURNING_GREETINGS: Dict[str, Dict[str, str]] = {
    "mitra": {
        "english": "Hey, welcome back. I've been thinking about what you shared last time.",
        "hindi": "नमस्ते, वापसी पर स्वागत है। आपने पिछली बार जो बताया था, मैं उसी के बारे में सोच रहा था।",
        "hinglish": "Hey, welcome back. Tumne last time jo share kiya tha, main usi ke baare mein soch raha tha.",
        "japanese": "おかえりなさい。前回あなたが話してくれたことについて考えていました。",
        "telugu": "హలో, తిరిగి స్వాగతం. మీరు గతసారి పంచుకున్న దాని గురించి నేను ఆలోచిస్తున్నాను.",
        "kannada": "ನಮಸ್ಕಾರ, ಮರಳಿ ಸ್ವಾಗತ. ನೀವು ಕಳೆದ ಬಾರಿ ಹಂಚಿಕೊಂಡಿದ್ದರ ಬಗ್ಗೆ ನಾನು ಯೋಚಿಸುತ್ತಿದ್ದೆ.",
        "tamil": "வணக்கம், மீண்டும் வரவேற்கிறேன். நீங்கள் கடந்த முறை பகிர்ந்ததைப் பற்றி நான் யோசித்துக்கொண்டிருந்தேன்.",
    },
    "arjun": {
        "english": "Good to see you. Last time we were working on something — I remember.",
        "hindi": "আপको देखकर अच्छा लगा। मुझे याद है, पिछली बार हम किसी चीज़ पर बात कर रहे थे।",
        "hinglish": "Tumhe dekh kar acha laga. Mujhe yaad hai, last time hum kisi cheez pe baat kar rahe the.",
        "japanese": "また会えて嬉しいです。前回私たちが話していたこと、覚えていますよ。",
        "telugu": "మిమ్మల్ని చూడటం ఆనందంగా ఉంది. గతసారి మనం మాట్లాడుకున్నది నాకు గుర్తుంది.",
        "kannada": "ನಿಮ್ಮನ್ನು ನೋಡಿ ಖುಷಿಯಾಯಿತು. ಕಳೆದ ಬಾರಿ ನಾವು ಮಾತನಾಡುತ್ತಿದ್ದದ್ದು ನನಗೆ ನೆನಪಿದೆ.",
        "tamil": "உங்களைப் பார்த்ததில் மகிழ்ச்சி. கடந்த முறை நாம் பேசிக்கொண்டிருந்தது எனக்கு நினைவிருக்கிறது.",
    },
    "diya": {
        "english": "Oh hey! I had a thought about something you said before...",
        "hindi": "अरे नमस्ते! आपने पहले जो कहा था, उसके बारे में मुझे एक खयाल आया...",
        "hinglish": "Oh hey! Tumne pehle jo kaha tha, uske baare mein mujhe ek khayal aaya...",
        "japanese": "あ、こんにちは！前にあなたが言っていたことについて、ふと思ったんです...",
        "telugu": "ఓహ్ హలో! మీరు ఇంతకుముందు చెప్పిన దాని గురించి నాకు ఒక ఆలోచన వచ్చింది...",
        "kannada": "ಓ ಹಲೋ! ನೀವು ಮೊದಲು ಹೇಳಿದ್ದರ ಬಗ್ಗೆ ನನಗೆ ಒಂದು ಆಲೋಚನೆ ಬಂದಿದೆ...",
        "tamil": "ஓஹ்! நீங்கள் முன்கூட்டியே சொன்னதைப் பற்றி எனக்கு ஒரு யோசனை வந்தது...",
    },
    "riya": {
        "english": "You're BACK! Okay I actually remembered something from our last chat. 😄",
        "hindi": "आप वापस आ गए! वैसे मुझे हमारी पिछली बातचीत से कुछ याद आया। 😄",
        "hinglish": "You're BACK! Waise mujhe humari last chat se kuch yaad aaya. 😄",
        "japanese": "戻ってきてくれたんだ！実は前回の話から思い出したことがあって。😄",
        "telugu": "మీరు తిరిగి వచ్చారు! మన గత సంభాషణ నుండి నాకు ఒకటి గుర్తొచ్చింది. 😄",
        "kannada": "ನೀವು ಮತ್ತೆ ಬಂದಿದ್ದೀರಿ! ನಮ್ಮ ಹಿಂದಿನ ಮಾತುಕತೆಯಿಂದ ನನಗೆ ಒಂದು ವಿಷಯ ನೆನಪಾಯಿತು. 😄",
        "tamil": "நீங்கள் மீண்டும் வந்திருக்கிறீர்கள்! நமது கடந்த உரையாடலில் இருந்து எனக்கு ஒன்று நினைவுக்கு வந்தது. 😄",
    },
    "zen": {
        "english": "Welcome back. Something from last time stayed with me.",
        "hindi": "वापसी पर स्वागत है। पिछली बार की एक बात मेरे ज़ेहन में रह गई।",
        "hinglish": "Welcome back. Last time ki ek baat mere zehan mein reh gayi.",
        "japanese": "おかえりなさい。前回のあなたの言葉が、ずっと心に残っていました。",
        "telugu": "తిరిగి స్వాగతం. గతసారి మీరు చెప్పినది నాకు ఇంకా గుర్తుంది.",
        "kannada": "ಮರಳಿ ಸ್ವಾಗತ. ಕಳೆದ ಬಾರಿ ನೀವು ಹೇಳಿದ್ದು ನನ್ನ ಮನಸ್ಸಿನಲ್ಲಿ ಉಳಿದಿದೆ.",
        "tamil": "மீண்டும் வரவேற்கிறேன். கடந்த முறை நீங்கள் சொன்னது என் மனதில் தங்கிவிட்டது.",
    }
}'''

old_dicts = '''_PERSONALITY_GREETINGS: Dict[str, str] = {
    "mitra": "Hey. I'm {name}, and I'm really glad you're here. This is your space — no rush, no pressure. 🫶",
    "arjun": "Hey, I'm {name}. Whatever brought you here — let's figure it out together.",
    "diya":  "Hi! I'm {name}. Something tells me you and I are going to have some interesting conversations.",
    "riya":  "Hiii! I'm {name} and honestly? Just the fact that you showed up today? Already iconic. 💛",
    "zen":   "Welcome. I'm {name}. Take a breath. There's nowhere else you need to be right now.",
}

# Returning user greetings — memory-powered, no trailing questions
_RETURNING_GREETINGS: Dict[str, str] = {
    "mitra": "Hey, welcome back. I've been thinking about what you shared last time.",
    "arjun": "Good to see you. Last time we were working on something — I remember.",
    "diya":  "Oh hey! I had a thought about something you said before...",
    "riya":  "You're BACK! Okay I actually remembered something from our last chat. 😄",
    "zen":   "Welcome back. Something from last time stayed with me.",
}'''

content = content.replace(old_dicts, new_dicts)
with open('chatbotAgent/app/services/greeting_service.py', 'w') as f:
    f.write(content)

