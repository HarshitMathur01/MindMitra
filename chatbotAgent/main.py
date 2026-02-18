from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import logging
import os
import threading
import asyncio
from collections import defaultdict
from dotenv import load_dotenv
from supabase import create_client, Client
from workflow import process_user_chat, get_workflow_instance
import jwt
from datetime import datetime
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Verify Google Cloud credentials - support both file path and base64 encoding
GOOGLE_CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
GOOGLE_CREDENTIALS_BASE64 = os.getenv("GOOGLE_CREDENTIALS_BASE64")
key = os.getenv("SUPABASE_KEY")
if key:
    print(f"✅ Supabase Key loaded: {key[:5]}...")
else:
    print("❌ Supabase Key is MISSING or NONE")

# Handle base64-encoded credentials (Railway/production deployment)
if GOOGLE_CREDENTIALS_BASE64:
    try:
        import base64
        import tempfile
        
        logger.info("🔐 [INIT] Decoding Google Cloud credentials from GOOGLE_CREDENTIALS_BASE64...")
        
        # Decode base64 to JSON string
        creds_json = base64.b64decode(GOOGLE_CREDENTIALS_BASE64).decode('utf-8')
        
        # Write to temporary file for Google Cloud SDK
        temp_creds = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        temp_creds.write(creds_json)
        temp_creds.close()
        
        # Set environment variable for Google Cloud SDK
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = temp_creds.name
        GOOGLE_CREDENTIALS_PATH = temp_creds.name
        
        logger.info(f"✅ [INIT] Google Cloud credentials loaded from GOOGLE_CREDENTIALS_BASE64: {temp_creds.name}")
    except Exception as e:
        logger.error(f"❌ [INIT] Failed to decode GOOGLE_CREDENTIALS_BASE64: {e}")
        logger.warning("⚠️ [INIT] Google Cloud TTS will not be available (will use gTTS fallback)")
elif GOOGLE_CREDENTIALS_PATH and os.path.exists(GOOGLE_CREDENTIALS_PATH):
    logger.info(f"✅ [INIT] Google Cloud credentials loaded from file: {GOOGLE_CREDENTIALS_PATH}")
else:
    logger.warning(f"⚠️ [INIT] Google Cloud credentials not found")
    logger.warning(f"   Set either GOOGLE_APPLICATION_CREDENTIALS (file path) or GOOGLE_CREDENTIALS_BASE64 (base64 string)")
    logger.warning("   Google Cloud TTS will not be available (will use gTTS fallback)")

app = FastAPI(title="MindMitra Chatbot Agent", version="1.0.0")

# In-memory message counter as fallback (survives across requests)
session_message_counters = defaultdict(int)

# Add CORS middleware - using regex pattern to cover all Vercel deployments and localhost
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https://.*\.vercel\.app$|^http://localhost:\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    user_message: str
    session_id: Optional[str] = None
    voice_analysis: Optional[Dict[str, Any]] = None  # Voice analysis is optional
    avatar_visible: bool = True  # Whether avatar is visible (controls TTS generation)
    # Context will be fetched by backend, not passed from frontend

class ChatResponse(BaseModel):
    message: str
    audio: Optional[str] = None  # Base64 MP3 audio
    lipsync: Optional[Dict[str, Any]] = None  # Phoneme timing data
    animation: Optional[str] = "Idle"  # Avatar animation name
    facial_expression: Optional[str] = "default"  # Sentiment-based expression
    modality: str
    confidence: float
    session_insights: Optional[Dict[str, Any]] = None

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")  # SERVICE_ROLE_KEY for backend operations
supabase_client = None
if supabase_url and supabase_key:
    supabase_client = create_client(supabase_url, supabase_key)
    logger.info("✅ [MAIN] Supabase client initialized with SERVICE_ROLE_KEY")
else:
    logger.warning("⚠️ [MAIN] Supabase credentials not found - memory features disabled")

# JWT configuration for auth validation
JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")  # From Supabase project settings
if not JWT_SECRET:
    logger.warning("⚠️ [MAIN] JWT_SECRET not set - will skip strict JWT validation")

# Development auth bypass (set SKIP_AUTH=true to skip token validation locally)
SKIP_AUTH = os.getenv("SKIP_AUTH", "false").lower() in ("1", "true", "yes")
DEV_USER_ID = os.getenv("DEV_USER_ID", "dev-user")

# ===== TTS AND LIPSYNC FUNCTIONS =====
import base64
import io
import tempfile
import subprocess
import json
import time
import httpx
from gtts import gTTS
from google.cloud import texttospeech

# ElevenLabs configuration
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "vT0wMbLG5dssaBsksrb6")
ELEVENLABS_MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_v3")

# Feature flag for Google Cloud TTS
ENABLE_GOOGLE_TTS = True
ENABLE_ELEVENLABS_TTS = bool(ELEVENLABS_API_KEY)

if ENABLE_ELEVENLABS_TTS:
    logger.info(
        f"✅ [INIT] ElevenLabs enabled (voice_id={ELEVENLABS_VOICE_ID}, model_id={ELEVENLABS_MODEL_ID})"
    )
else:
    logger.warning("⚠️ [INIT] ElevenLabs disabled: ELEVENLABS_API_KEY missing")

def _is_elevenlabs_credit_exhausted(status_code: int, response_text: str) -> bool:
    """Detect ElevenLabs credit/quota exhaustion from API response."""
    text = (response_text or "").lower()
    indicators = [
        "insufficient",
        "credit",
        "quota",
        "limit",
        "payment",
        "free tier",
        "character_limit",
    ]
    return status_code in (401, 402, 403, 429) and any(ind in text for ind in indicators)


def generate_elevenlabs_tts(text: str, emotion: str = 'neutral', language_style: str = 'english') -> Optional[str]:
    """
    Generate TTS audio using ElevenLabs API.

    Returns:
        Base64-encoded MP3 audio, or None on failure.
    """
    if not ELEVENLABS_API_KEY:
        logger.info("⏭️ [ElevenLabs TTS] ELEVENLABS_API_KEY not set, skipping ElevenLabs")
        return None

    if not ELEVENLABS_VOICE_ID:
        logger.error("❌ [ElevenLabs TTS] Missing ELEVENLABS_VOICE_ID")
        return None

    emotion_voice_settings = {
        'happy': {'stability': 0.0, 'similarity_boost': 0.8, 'style': 0.35, 'use_speaker_boost': True},
        'sad': {'stability': 1.0, 'similarity_boost': 0.85, 'style': 0.1, 'use_speaker_boost': True},
        'angry': {'stability': 0.5, 'similarity_boost': 0.75, 'style': 0.45, 'use_speaker_boost': True},
        'surprised': {'stability': 0.0, 'similarity_boost': 0.8, 'style': 0.4, 'use_speaker_boost': True},
        'neutral': {'stability': 0.5, 'similarity_boost': 0.8, 'style': 0.2, 'use_speaker_boost': True},
    }

    settings = emotion_voice_settings.get(emotion, emotion_voice_settings['neutral'])

    try:
        logger.info(f"🔊 [ElevenLabs TTS] Generating audio for text ({len(text)} chars): {text[:50]}...")
        logger.info(f"🎭 [ElevenLabs TTS] Emotion: {emotion}, Language Style: {language_style}")

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
        headers = {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "model_id": ELEVENLABS_MODEL_ID,
            "output_format": "mp3_44100_128",
            "voice_settings": settings,
        }

        with httpx.Client(timeout=35.0) as client:
            response = client.post(url, headers=headers, json=payload)

        if response.status_code == 200 and response.content:
            audio_base64 = base64.b64encode(response.content).decode('utf-8')
            audio_size_kb = len(audio_base64) / 1024
            logger.info(f"✅ [ElevenLabs TTS] Audio generated successfully: {audio_size_kb:.2f} KB (base64 MP3)")
            return audio_base64

        response_text = response.text[:600]
        logger.error(f"❌ [ElevenLabs TTS] API failed with {response.status_code}: {response_text}")
        if _is_elevenlabs_credit_exhausted(response.status_code, response_text):
            logger.warning("⚠️ [ElevenLabs TTS] Credits exhausted or quota exceeded (see error above)")
        return None

    except Exception as e:
        logger.error(f"❌ [ElevenLabs TTS] Failed to generate audio: {e}")
        logger.error(f"   Text was: {text[:100]}")
        return None

def generate_google_cloud_tts(text: str, emotion: str = 'neutral', language_style: str = 'english') -> Optional[str]:
    """
    Generate TTS audio using Google Cloud Text-to-Speech with WaveNet voices.
    
    Args:
        text: Text to convert to speech
        emotion: Emotion for voice modulation (neutral, happy, sad, angry, surprised)
        language_style: Language style to determine voice (english, hindi-mixed, hinglish)
    
    Returns:
        Base64-encoded WAV string, or None on failure
    """
    try:
        logger.info(f"🔊 [Google Cloud TTS] Generating audio for text ({len(text)} chars): {text[:50]}...")
        logger.info(f"🎭 [Google Cloud TTS] Emotion: {emotion}, Language Style: {language_style}")
        
        # Initialize Google Cloud TTS client
        logger.info(f"🔌 [Google Cloud TTS] Initializing TextToSpeechClient...")
        client = texttospeech.TextToSpeechClient()
        logger.info(f"✅ [Google Cloud TTS] Client initialized successfully")
        
        # Configure voice parameters based on emotion
        emotion_configs = {
            'happy': {'speaking_rate': 1.1, 'pitch': 2.0},
            'sad': {'speaking_rate': 0.9, 'pitch': -2.0},
            'angry': {'speaking_rate': 1.05, 'pitch': -1.0},
            'surprised': {'speaking_rate': 1.15, 'pitch': 3.0},
            'neutral': {'speaking_rate': 1.0, 'pitch': 0.0}
        }
        
        config = emotion_configs.get(emotion, emotion_configs['neutral'])
        
        # Set up synthesis input
        synthesis_input = texttospeech.SynthesisInput(text=text)
        
        # Determine voice based on language style
        language_code = "en-US"
        voice_name = "en-US-Wavenet-F"
        
        if language_style in ["hindi-mixed", "hinglish"]:
            language_code = "hi-IN"
            voice_name = "hi-IN-Neural2-A"
            logger.info(f"🇮🇳 [Google Cloud TTS] Using Hindi/Hinglish voice: {voice_name}")
        
        # Configure voice (WaveNet/Neural2 based on language)
        voice = texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=voice_name,
            ssml_gender=texttospeech.SsmlVoiceGender.FEMALE
        )
        
        # Configure audio output (WAV format for Rhubarb compatibility)
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.LINEAR16,  # WAV PCM
            sample_rate_hertz=16000,  # 16kHz for Rhubarb
            speaking_rate=config['speaking_rate'],
            pitch=config['pitch']
        )
        
        # Perform TTS request
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )
        
        # Convert WAV bytes to base64
        audio_base64 = base64.b64encode(response.audio_content).decode('utf-8')
        audio_size_kb = len(audio_base64) / 1024
        
        logger.info(f"✅ [Google Cloud TTS] Audio generated successfully: {audio_size_kb:.2f} KB (base64 WAV)")
        return audio_base64
        
    except Exception as e:
        logger.error(f"❌ [Google Cloud TTS] Failed to generate audio: {e}")
        logger.error(f"   Text was: {text[:100]}")
        return None  # Will trigger fallback

def generate_tts_audio(text: str, lang: str = 'en') -> Optional[str]:
    """
    Generate TTS audio using gTTS (fallback method) and return base64 MP3.
    
    Args:
        text: Text to convert to speech
        lang: Language code (default: 'en')
    
    Returns:
        Base64-encoded MP3 string, or None on failure
    """
    try:
        logger.info(f"🔊 [gTTS] Generating audio for text ({len(text)} chars): {text[:50]}...")
        logger.info(f"🌍 [gTTS] Language: {lang}")
        
        # Generate TTS with gTTS (creates MP3 directly)
        logger.info(f"🎙️ [gTTS] Creating TTS object...")
        tts = gTTS(text=text, lang=lang, slow=False)
        logger.info(f"✅ [gTTS] TTS object created")
        
        # Save to in-memory bytes buffer
        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        
        # Convert to base64
        audio_base64 = base64.b64encode(audio_buffer.read()).decode('utf-8')
        audio_size_kb = len(audio_base64) / 1024
        
        logger.info(f"✅ [gTTS] Audio generated successfully: {audio_size_kb:.2f} KB (base64)")
        return audio_base64
        
    except Exception as e:
        logger.error(f"❌ [gTTS] Failed to generate audio: {e}")
        logger.error(f"   Text was: {text[:100]}")
        return None  # Graceful degradation

def generate_tts_audio_v2(text: str, emotion: str = 'neutral', language_style: str = 'english') -> Optional[str]:
    """
    Generate TTS audio with fallback chain: ElevenLabs -> Google Cloud TTS -> gTTS.
    
    Args:
        text: Text to convert to speech
        emotion: Emotion for voice modulation
        language_style: Language style to determine voice (english, hindi-mixed, hinglish)
    
    Returns:
        Base64-encoded audio string (WAV or MP3), or None on complete failure
    """
    # Try ElevenLabs first
    if ENABLE_ELEVENLABS_TTS:
        logger.info(f"🚀 [TTS v2] Attempting ElevenLabs TTS (emotion: {emotion}, lang: {language_style})...")
        audio = generate_elevenlabs_tts(text, emotion, language_style)
        if audio:
            logger.info("✅ [TTS v2] ElevenLabs TTS succeeded")
            return audio
        logger.warning("⚠️ [TTS v2] ElevenLabs TTS failed, falling back to Google Cloud TTS...")
    else:
        logger.info("⏭️ [TTS v2] ElevenLabs TTS disabled (missing API key), trying Google Cloud TTS")

    # Try Google Cloud TTS first (if enabled)
    if ENABLE_GOOGLE_TTS:
        logger.info(f"🚀 [TTS v2] Attempting Google Cloud TTS (emotion: {emotion}, lang: {language_style})...")
        audio = generate_google_cloud_tts(text, emotion, language_style)
        if audio:
            logger.info(f"✅ [TTS v2] Google Cloud TTS succeeded")
            return audio
        logger.warning("⚠️ [TTS v2] Google Cloud TTS failed, falling back to gTTS...")
    else:
        logger.info(f"⏭️ [TTS v2] Google Cloud TTS disabled, using gTTS directly")
    
    # Fallback to gTTS
    logger.info(f"🔄 [TTS v2] Attempting gTTS fallback...")
    return generate_tts_audio(text)

def generate_lipsync_from_audio(audio_base64: str, text_fallback: str) -> Dict[str, Any]:
    """
    Generate lip-sync data from audio using Rhubarb Lip-Sync CLI tool.
    Falls back to text-based generation on error.
    Handles both WAV (Google Cloud TTS) and MP3 (gTTS) formats.
    
    Args:
        audio_base64: Base64-encoded audio (WAV or MP3)
        text_fallback: Text to use for fallback if Rhubarb fails
    
    Returns:
        Dictionary with mouthCues array
    """
    temp_file = None
    try:
        start_time = time.time()
        logger.info(f"🎤 [RHUBARB] Starting audio-based lip-sync analysis...")
        
        # Decode base64 to bytes
        audio_bytes = base64.b64decode(audio_base64)
        
        # Detect audio format by checking base64 prefix or file header
        # WAV files start with "RIFF" (52 49 46 46)
        # MP3 files start with ID3 tag or FF FB/FF FA sync word
        is_wav = audio_bytes[:4] == b'RIFF'
        file_extension = '.wav' if is_wav else '.mp3'
        
        logger.info(f"🎵 [RHUBARB] Detected audio format: {file_extension.upper()}")
        
        # Save to temporary file with correct extension
        temp_file = tempfile.NamedTemporaryFile(suffix=file_extension, delete=False)
        temp_file.write(audio_bytes)
        temp_file.close()
        
        logger.info(f"💾 [RHUBARB] Saved audio to temp file: {temp_file.name}")
        
        # Get Rhubarb binary path (relative to main.py)
        rhubarb_path = os.path.join(os.path.dirname(__file__), 'bin', 'rhubarb')
        
        if not os.path.exists(rhubarb_path):
            raise FileNotFoundError(f"Rhubarb binary not found at {rhubarb_path}")
        
        # Call Rhubarb CLI
        logger.info(f"🎙️ [RHUBARB] Executing: {rhubarb_path} -f json {temp_file.name}")
        result = subprocess.run(
            [rhubarb_path, '-f', 'json', temp_file.name],
            capture_output=True,
            text=True,
            timeout=10  # 10 second timeout
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"Rhubarb failed with code {result.returncode}: {result.stderr}")
        
        # Parse JSON output
        rhubarb_output = json.loads(result.stdout)
        
        # Rhubarb outputs A-H, X mouth shapes directly - NO REMAPPING NEEDED!
        # Rhubarb: A(closed), B(clenched), C(open), D(wide), E(rounded), F(puckered), G(f/v), H(L/th), X(rest)
        # These map directly to Avatar.jsx viseme targets - pass through as-is
        
        # Convert Rhubarb mouthCues format to Avatar format (no value transformation)
        mouth_cues = []
        if 'mouthCues' in rhubarb_output:
            for cue in rhubarb_output['mouthCues']:
                mouth_cues.append({
                    'start': cue['start'],
                    'end': cue['end'],
                    'value': cue['value']  # Pass through directly - already correct!
                })
        
        # Validation logging
        if mouth_cues:
            unique_shapes = set(cue['value'] for cue in mouth_cues)
            logger.info(f"📊 [RHUBARB] Unique shapes detected: {sorted(unique_shapes)}")
            logger.info(f"📊 [RHUBARB] Sample sequence (first 10): {[c['value'] for c in mouth_cues[:10]]}")
        
        elapsed_time = time.time() - start_time
        logger.info(f"✅ [RHUBARB] Generated {len(mouth_cues)} mouth cues in {elapsed_time:.2f}s")
        logger.info(f"⏱️ [RHUBARB] Processing time: {elapsed_time:.2f}s")
        
        return {'mouthCues': mouth_cues}
        
    except subprocess.TimeoutExpired:
        logger.error(f"❌ [RHUBARB] Timeout after 10 seconds - falling back to text-based")
        return generate_lipsync_from_text(text_fallback)
    except FileNotFoundError as e:
        logger.error(f"❌ [RHUBARB] Binary not found: {e} - falling back to text-based")
        return generate_lipsync_from_text(text_fallback)
    except Exception as e:
        logger.error(f"❌ [RHUBARB] Failed: {e} - falling back to text-based")
        logger.error(f"   Error details: {type(e).__name__}: {str(e)}")
        return generate_lipsync_from_text(text_fallback)
    finally:
        # Clean up temp file
        if temp_file and os.path.exists(temp_file.name):
            try:
                os.unlink(temp_file.name)
                logger.info(f"🗑️ [RHUBARB] Cleaned up temp file")
            except Exception as e:
                logger.warning(f"⚠️ [RHUBARB] Failed to delete temp file: {e}")

def generate_lipsync_from_text(text: str, audio_duration: Optional[float] = None) -> Dict[str, Any]:
    """
    Generate lip-sync data from text using phoneme mapping (FALLBACK METHOD).
    
    Args:
        text: Text to generate lip-sync for
        audio_duration: Optional audio duration for timing calibration
    
    Returns:
        Dictionary with mouthCues array
    """
    try:
        logger.info(f"👄 [LIPSYNC-TEXT] Generating text-based lip-sync for ({len(text)} chars)")
        
        # Phoneme mapping (matches Avatar.jsx viseme mapping)
        phoneme_map = {
            'a': 'D', 'e': 'E', 'i': 'C', 'o': 'E', 'u': 'F',
            'p': 'A', 'b': 'A', 'm': 'A',
            'f': 'G', 'v': 'G',
            't': 'B', 'd': 'B', 'k': 'B', 'g': 'B',
            's': 'X', 'z': 'X', 'r': 'X', 'l': 'X', 'n': 'X', 'h': 'X',
            'w': 'F', 'y': 'C'
        }
        
        mouth_cues = []
        current_time = 0.0
        phoneme_duration = 0.15  # 150ms per phoneme
        word_pause = 0.1  # 100ms between words
        
        words = text.split(' ')
        
        for word_idx, word in enumerate(words):
            word_lower = word.lower()
            char_idx = 0
            
            while char_idx < len(word_lower):
                char = word_lower[char_idx]
                
                # Check for digraphs (th)
                if char_idx < len(word_lower) - 1 and char + word_lower[char_idx + 1] == 'th':
                    mouth_cues.append({
                        "start": current_time,
                        "end": current_time + phoneme_duration,
                        "value": "H"
                    })
                    current_time += phoneme_duration
                    char_idx += 2
                    continue
                
                # Map character to phoneme
                if char in phoneme_map:
                    mouth_cues.append({
                        "start": current_time,
                        "end": current_time + phoneme_duration,
                        "value": phoneme_map[char]
                    })
                    current_time += phoneme_duration
                elif char.isalpha():
                    # Unknown letter - use neutral mouth
                    mouth_cues.append({
                        "start": current_time,
                        "end": current_time + phoneme_duration * 0.5,
                        "value": "X"
                    })
                    current_time += phoneme_duration * 0.5
                
                char_idx += 1
            
            # Add pause between words
            if word_idx < len(words) - 1:
                mouth_cues.append({
                    "start": current_time,
                    "end": current_time + word_pause,
                    "value": "X"
                })
                current_time += word_pause
        
        total_duration = current_time
        logger.info(f"✅ [LIPSYNC] Generated {len(mouth_cues)} mouth cues, duration: {total_duration:.2f}s")
        
        # If audio duration provided, calibrate timing
        if audio_duration and audio_duration > 0:
            scale_factor = audio_duration / total_duration
            logger.info(f"🎯 [LIPSYNC] Calibrating timing with scale factor: {scale_factor:.3f}")
            for cue in mouth_cues:
                cue["start"] *= scale_factor
                cue["end"] *= scale_factor
        
        return {"mouthCues": mouth_cues}
        
    except Exception as e:
        logger.error(f"❌ [LIPSYNC] Failed to generate lip-sync: {e}")
        return {"mouthCues": []}  # Return empty array on failure

def get_session_message_count(session_id: str) -> int:
    """Get total message count for a session from database"""
    if not supabase_client or not session_id:
        logger.warning(f"⚠️ [DB_COUNT] Cannot query - Supabase: {bool(supabase_client)}, Session: {session_id}")
        return 0
    
    try:
        logger.info(f"🔍 [DB_COUNT] Querying database for session: {session_id}")
        response = supabase_client.table('chat_messages').select('id', count='exact').eq('session_id', session_id).execute()
        count = response.count if hasattr(response, 'count') else len(response.data or [])
        
        logger.info(f"📊 [DB_COUNT] Database returned {count} messages for session {session_id}")
        
        if count == 0:
            logger.warning(f"⚠️ [DB_COUNT] Database has 0 messages - messages may not be saved yet")
            # Check if any messages exist at all
            try:
                total_response = supabase_client.table('chat_messages').select('id', count='exact').limit(1).execute()
                total_count = total_response.count if hasattr(total_response, 'count') else 0
                logger.info(f"📊 [DB_COUNT] Total messages in entire database: {total_count}")
            except:
                pass
        
        return count
    except Exception as e:
        logger.error(f"❌ [DB_COUNT] Error getting message count: {e}")
        return 0

def get_hybrid_message_count(session_id: str) -> int:
    """Get message count using both database and in-memory counter"""
    if not session_id:
        return 0
    
    # Try database first
    db_count = get_session_message_count(session_id)
    
    # Get in-memory count
    memory_count = session_message_counters.get(session_id, 0)
    
    logger.info(f"🔢 [HYBRID_COUNT] Session '{session_id}':")
    logger.info(f"   📊 Database count: {db_count}")
    logger.info(f"   💾 In-memory count: {memory_count}")
    
    # Use whichever is higher (database might lag or messages might not be saved)
    final_count = max(db_count, memory_count)
    logger.info(f"   ✅ Using final count: {final_count}")
    
    return final_count

async def validate_user_token(authorization: str) -> str:
    """Validate JWT token and return user_id. Raises HTTPException if invalid.

    Supports a development bypass controlled by `SKIP_AUTH` environment variable.
    If `SKIP_AUTH` is true the function returns `DEV_USER_ID` without validating tokens.
    """
    # Development bypass
    if SKIP_AUTH:
        logger.warning("⚠️ [AUTH] SKIP_AUTH enabled - bypassing token validation for local development")
        return DEV_USER_ID

    if not authorization:
        logger.error("❌ [AUTH] No authorization header provided")
        raise HTTPException(status_code=401, detail="Authorization header required")

    if not authorization.startswith("Bearer "):
        logger.error("❌ [AUTH] Invalid authorization format")
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    token = authorization.replace("Bearer ", "")

    # Validate using Supabase client
    if not supabase_client:
        logger.error("❌ [AUTH] Supabase client not initialized")
        raise HTTPException(status_code=500, detail="Authentication service unavailable")

    try:
        # Use Supabase to validate the token
        user_response = supabase_client.auth.get_user(token)
        if not user_response or not getattr(user_response, 'user', None):
            logger.error("❌ [AUTH] Invalid token - user not found")
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        user_id = user_response.user.id
        logger.info(f"✅ [AUTH] User authenticated: {user_id}")
        return user_id
    except Exception as e:
        logger.error(f"❌ [AUTH] Token validation failed: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

async def fetch_user_context(user_id: str, session_id: str) -> Dict[str, Any]:
    """Fetch user's activities, messages, and summaries from Supabase."""
    logger.info(f"🔍 [CONTEXT] Fetching context for user {user_id}, session {session_id}")
    
    if not supabase_client:
        logger.warning("⚠️ [CONTEXT] Supabase client not available")
        return {
            "user_activities": [],
            "recent_messages": [],
            "conversation_summary": {}
        }
    
    try:
        # Fetch user activities (last 50)
        activities_response = supabase_client.table('user_activities').select('*').eq('user_id', user_id).order('completed_at', desc=True).limit(50).execute()
        user_activities = activities_response.data or []
        logger.info(f"📊 [CONTEXT] Fetched {len(user_activities)} activities")
        
        # Fetch recent messages for this session (last 10)
        messages_response = supabase_client.table('chat_messages').select('*').eq('session_id', session_id).order('created_at', desc=True).limit(10).execute()
        recent_messages_raw = messages_response.data or []
        
        # Format messages for workflow
        recent_messages = []
        for msg in reversed(recent_messages_raw):  # Reverse to get chronological order
            recent_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })
        logger.info(f"💬 [CONTEXT] Fetched {len(recent_messages)} messages")
        
        # Fetch conversation summary
        conversation_summary = {}
        try:
            summary_response = supabase_client.table('message_summaries').select('*').eq('session_id', session_id).order('created_at', desc=True).limit(1).execute()
            
            if summary_response.data:
                summary_data = summary_response.data[0]
                conversation_summary = {
                    "summary": summary_data.get("summary", ""),
                    "key_points": summary_data.get("key_points", []),
                    "emotional_state": summary_data.get("emotional_state", "neutral"),
                    "topics_discussed": summary_data.get("topics_discussed", [])
                }
                logger.info(f"📝 [CONTEXT] Fetched conversation summary")
            else:
                logger.info(f"📝 [CONTEXT] No summary found for session")
        except Exception as e:
            # Handle missing table gracefully (PGRST205)
            if "PGRST205" in str(e) or "does not exist" in str(e):
                logger.warning(f"⚠️ [CONTEXT] Table 'message_summaries' not found (PGRST205) - skipping summary fetch")
            else:
                logger.warning(f"⚠️ [CONTEXT] Error fetching conversation summary: {e}")
        
        return {
            "user_activities": user_activities,
            "recent_messages": recent_messages,
            "conversation_summary": conversation_summary
        }
    
    except Exception as e:
        logger.error(f"❌ [CONTEXT] Error fetching user context: {e}")
        return {
            "user_activities": [],
            "recent_messages": [],
            "conversation_summary": {}
        }

@app.get("/")
async def root():
    return {"message": "MindMitra Chatbot Agent is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "mindmitra-agent"}

@app.get("/chat/greeting")
async def get_greeting(
    session_id: str = None,
    user_id: str = None,
    authorization: str = Header(None)
):
    """
    Generate a personalized greeting for a new chat session.
    Called by frontend when user clicks 'New Session'.
    """
    try:
        # Validate authentication (reuse existing validation)
        authenticated_user_id = await validate_user_token(authorization)
        
        # Use authenticated user_id (don't trust query param)
        final_user_id = authenticated_user_id
        
        if not session_id:
            logger.warning("⚠️ [GREETING] No session_id provided, using default greeting")
            return {
                "greeting": "Hey! What's on your mind?",
                "show_greeting": True,
                "language_used": "english",
                "time_slot": "day"
            }
        
        # Check cache first (prevent regeneration on page reload)
        cache_key = f"{session_id}_{final_user_id}"
        if cache_key in _greeting_cache:
            logger.info(f"✅ [GREETING] Using cached greeting for session {session_id[:8]}...")
            return _greeting_cache[cache_key]
        
        # Generate new greeting
        from workflow import generate_greeting
        greeting_data = generate_greeting(final_user_id, session_id)
        
        # Cache for 10 minutes
        _greeting_cache[cache_key] = greeting_data
        
        logger.info(f"✅ [GREETING] Generated new greeting for session {session_id[:8]}...")
        return greeting_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [GREETING] Error: {e}")
        # Safe fallback - never fail
        return {
            "greeting": "Hey! What's on your mind?",
            "show_greeting": True,
            "language_used": "english",
            "time_slot": "day"
        }

# Simple cache for greetings (session_id_user_id -> greeting_data)
_greeting_cache = {}

@app.post("/chat")
async def process_chat(
    request: ChatRequest,
    authorization: str = Header(None)
):
    try:
        logger.info("=" * 80)
        logger.info("🚀 [MAIN] NEW CHAT REQUEST RECEIVED (DIRECT BACKEND MODE)")
        logger.info("=" * 80)
        
        # Validate authentication
        user_id = await validate_user_token(authorization)
        logger.info(f"👤 [MAIN] Authenticated User: {user_id}")
        logger.info(f"🔗 [MAIN] Session: {request.session_id}")
        logger.info(f"💬 [MAIN] Message: '{request.user_message[:150]}{'...' if len(request.user_message) > 150 else ''}'")
        
        # Fetch user context from Supabase
        context = await fetch_user_context(user_id, request.session_id)
        user_activities = context["user_activities"]
        recent_messages = context["recent_messages"]
        conversation_summary = context["conversation_summary"]
        
        # Detailed activities logging with content preview
        logger.info(f"🎮 [MAIN] User activities: {len(user_activities)} total")
        if user_activities:
            logger.info("✅ [MAIN] ✅ ✅ BACKEND HAS RECEIVED USER ACTIVITIES! ✅ ✅")
            
            # Count by type
            activity_types = {}
            for activity in user_activities:
                activity_type = activity.get('activity_type', 'unknown')
                activity_types[activity_type] = activity_types.get(activity_type, 0) + 1
            
            logger.info(f"   Activity breakdown:")
            for activity_type, count in activity_types.items():
                logger.info(f"   - {activity_type}: {count}")
            
            # Log each activity with 20-word preview
            logger.info(f"\n📋 [MAIN] Detailed Activities Content (20 words each):")
            for i, activity in enumerate(user_activities[:5], 1):  # Show first 5
                logger.info(f"\n   Activity #{i}:")
                logger.info(f"   Type: {activity.get('activity_type', 'N/A')}")
                logger.info(f"   Score: {activity.get('score', 'N/A')}")
                logger.info(f"   Duration: {activity.get('game_duration', activity.get('duration', 'N/A'))}")
                logger.info(f"   Difficulty: {activity.get('difficulty_level', 'N/A')}")
                logger.info(f"   Timestamp: {activity.get('completed_at', 'N/A')}")
                
                # Show 20 words of activity_data if available
                activity_data = activity.get('activity_data', {})
                if activity_data:
                    activity_str = str(activity_data)
                    words = activity_str.split()[:20]
                    preview = ' '.join(words)
                    logger.info(f"   📄 Content (20 words): {preview}...")
                
                # Show evaluation data if available
                evaluation_data = activity.get('evaluation_data', {})
                if evaluation_data:
                    eval_str = str(evaluation_data)
                    words = eval_str.split()[:20]
                    preview = ' '.join(words)
                    logger.info(f"   📊 Evaluation (20 words): {preview}...")
                
                # Show insights if available
                insights = activity.get('insights_generated', '')
                if insights:
                    words = str(insights).split()[:20]
                    preview = ' '.join(words)
                    logger.info(f"   💡 Insights (20 words): {preview}...")
            
            if len(user_activities) > 5:
                logger.info(f"\n   ... and {len(user_activities) - 5} more activities")
        else:
            logger.warning("⚠️ [MAIN] ❌ ❌ NO ACTIVITIES DATA RECEIVED! ❌ ❌")
            logger.warning("   Check if Edge Function is fetching activities from Supabase")
        
        logger.info(f"📝 [MAIN] Recent messages: {len(recent_messages)} messages")
        logger.info(f"🎤 [MAIN] Voice analysis: {'✅ Provided' if request.voice_analysis else '❌ Not provided'}")
        
        if request.voice_analysis:
            logger.info(f"   Voice details:")
            logger.info(f"   - Emotional tone: {request.voice_analysis.get('emotional_tone', 'N/A')}")
            logger.info(f"   - Stress level: {request.voice_analysis.get('stress_level', 'N/A')}")
        
        logger.info("=" * 80)
        
        # Process with the workflow using fetched context
        result = process_user_chat(
            user_message=request.user_message,
            recent_messages=recent_messages,
            conversation_summary=conversation_summary,
            user_activities=user_activities,
            user_patterns={},  # Can be extended later
            voice_analysis=request.voice_analysis or {},
            user_id=user_id,
            session_id=request.session_id
        )
        
        logger.info(f"✅ [MAIN] Chat processing completed successfully")
        logger.info(f"📝 [MAIN] Response length: {len(result.get('message', ''))} characters")
        
        # ===== GENERATE TTS AND LIP-SYNC FOR AVATAR (CONDITIONAL) =====
        ai_message_text = result.get('message', '')
        logger.info("=" * 80)
        logger.info("🎙️ [AVATAR PIPELINE] TTS Generation Decision")
        logger.info("=" * 80)
        logger.info(f"🔍 [AVATAR] Avatar visible: {request.avatar_visible}")
        logger.info(f"📝 [AVATAR] AI message length: {len(ai_message_text)} chars")
        
        audio_base64 = None
        lipsync_data = None
        animation = "Idle"
        facial_expression = "default"
        
        # ⚡ OPTIMIZATION: Skip TTS/Rhubarb if avatar is hidden (saves 2-3 seconds)
        if not request.avatar_visible:
            logger.info("⚡ [AVATAR] Avatar hidden - skipping TTS generation (latency optimization)")
            logger.info("⏱️ [AVATAR] Saved ~2-3 seconds by skipping audio processing")
        elif ai_message_text:
            # Detect emotion for TTS voice modulation
            text_lower = ai_message_text.lower()
            emotion = 'neutral'
            if any(word in text_lower for word in ['happy', 'great', 'wonderful', 'amazing', 'excited', 'proud', 'joy']):
                emotion = 'happy'
                facial_expression = "smile"
            elif any(word in text_lower for word in ['sad', 'sorry', 'difficult', 'hard', 'anxious', 'worried']):
                emotion = 'sad'
                facial_expression = "sad"
            elif any(word in text_lower for word in ['angry', 'frustrated', 'annoyed']):
                emotion = 'angry'
                facial_expression = "angry"
            elif any(word in text_lower for word in ['wow', 'really', 'surprised', 'incredible', 'amazing']):
                emotion = 'surprised'
                facial_expression = "surprised"
            
            logger.info(f"🎭 [AVATAR] Detected emotion: {emotion}, Expression: {facial_expression}")
            
            # Extract language style for TTS voice selection
            try:
                session_insights = result.get('session_insights', {})
                cultural_context = session_insights.get('cultural_context', {}) if session_insights else {}
                language_style = cultural_context.get('language_style', 'english')
                logger.info(f"🗣️ [AVATAR] Language style: {language_style}")
            except Exception as e:
                logger.warning(f"⚠️ [AVATAR] Could not extract language style: {e}")
                language_style = 'english'
            
            # Generate TTS audio with emotion (Google Cloud TTS or gTTS fallback)
            audio_base64 = generate_tts_audio_v2(ai_message_text, emotion, language_style)
            
            if audio_base64:
                logger.info("✅ [AVATAR] TTS audio generated successfully")
                animation = "Talking_0"  # Trigger talking animation
                
                # Generate lip-sync using Rhubarb (audio-based analysis)
                lipsync_data = generate_lipsync_from_audio(audio_base64, ai_message_text)
            else:
                logger.warning("⚠️ [AVATAR] TTS failed - using text-based lip-sync")
                animation = "Talking_0"  # Still show talking animation
                
                # Fallback to text-based lip-sync when no audio
                lipsync_data = generate_lipsync_from_text(ai_message_text)
            
            if lipsync_data and lipsync_data.get('mouthCues'):
                logger.info(f"✅ [AVATAR] Lip-sync generated: {len(lipsync_data['mouthCues'])} cues")
            else:
                logger.warning("⚠️ [AVATAR] Lip-sync generation failed - avatar will stay idle")
                lipsync_data = None
                animation = "Idle"
            
            logger.info(f"🎭 [AVATAR] Animation: {animation}, Expression: {facial_expression}")

        
        logger.info("=" * 80)
        
        # Add to result dictionary
        result['audio'] = audio_base64
        result['lipsync'] = lipsync_data
        result['animation'] = animation
        result['facial_expression'] = facial_expression
        result['text'] = ai_message_text  # For frontend head movement analysis
        
        logger.info(f"📦 [AVATAR] Final response package:")
        logger.info(f"   - Audio: {'✅ ' + str(len(audio_base64)) + ' chars' if audio_base64 else '❌ None'}")
        logger.info(f"   - Lipsync: {'✅ ' + str(len(lipsync_data.get('mouthCues', []))) + ' cues' if lipsync_data else '❌ None'}")
        logger.info(f"   - Animation: {animation}")
        logger.info(f"   - Facial Expression: {facial_expression}")
        logger.info(f"   - Text length: {len(ai_message_text)} chars")
        
        # Trigger memory extraction every 8 messages
        if result and request.session_id:
            try:
                # Increment in-memory counter for this session
                session_message_counters[request.session_id] += 1
                logger.info(f"📈 [COUNTER] Incremented counter for session {request.session_id}")
                
                # Get hybrid count (database + in-memory fallback)
                count = get_hybrid_message_count(request.session_id)
                
                messages_until_memory = 12 - (count % 12) if count % 12 != 0 else 12
                
                logger.info("=" * 80)
                logger.info("🧠 [MEMORY TRIGGER] Memory Extraction Status")
                logger.info("=" * 80)
                logger.info(f"📊 [MEMORY] Current session message count: {count}")
                logger.info(f"🎯 [MEMORY] Memory extraction triggers every 12 messages")
                
                if count > 0 and count % 12 == 0:
                    logger.info(f"🔔 [MEMORY] ✅ ✅ TRIGGERING MEMORY EXTRACTION NOW! ✅ ✅")
                    logger.info(f"   This is message #{count} - memory extraction will run in background")
                    
                    workflow = get_workflow_instance()
                    # Run in background thread
                    threading.Thread(
                        target=workflow.trigger_memory_extraction,
                        args=(request.session_id, request.user_id),
                        daemon=True
                    ).start()
                    logger.info(f"✅ [MEMORY] Memory extraction started in background thread")
                else:
                    logger.info(f"⏳ [MEMORY] {messages_until_memory} messages remaining until next memory extraction")
                    next_milestone = ((count // 12) + 1) * 12
                    logger.info(f"   Next extraction will happen at message #{next_milestone}")
                
                logger.info("=" * 80)
            except Exception as e:
                logger.error(f"❌ [MAIN] Error checking memory extraction: {e}")
        
        # Return complete response with avatar data
        return ChatResponse(
            message=result.get('message', ''),
            audio=result.get('audio'),
            lipsync=result.get('lipsync'),
            animation=result.get('animation', 'Idle'),
            facial_expression=result.get('facial_expression', 'default'),
            modality=result.get('modality', 'therapy'),
            confidence=result.get('confidence', 0.8),
            session_insights=result.get('session_insights')
        )
        
    except Exception as e:
        logger.error(f"❌ [MAIN] Error processing chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")


@app.post("/chat/stream")
async def process_chat_stream(
    request: ChatRequest,
    authorization: str = Header(None)
):
    """
    ⚡ P0 OPTIMIZATION: Streaming endpoint that returns AI text immediately,
    then streams TTS/lipsync data asynchronously if avatar is visible.
    
    SSE Format:
    - event: text_chunk -> AI text response (immediate)
    - event: audio_ready -> TTS audio generated (async)
    - event: lipsync_ready -> Lip-sync data generated (async)
    - event: complete -> All processing done
    """
    try:
        logger.info("=" * 80)
        logger.info("🚀 [STREAM] NEW STREAMING CHAT REQUEST")
        logger.info("=" * 80)
        
        # Validate authentication
        user_id = await validate_user_token(authorization)
        logger.info(f"👤 [STREAM] User: {user_id}, Session: {request.session_id}")
        logger.info(f"💬 [STREAM] Message: '{request.user_message[:100]}'")
        logger.info(f"🎭 [STREAM] Avatar visible: {request.avatar_visible}")
        
        async def event_generator():
            try:
                # Phase 1: Generate AI response text (high priority)
                logger.info("⚡ [STREAM] Phase 1: Generating AI text response...")
                
                context = await fetch_user_context(user_id, request.session_id)
                result = process_user_chat(
                    user_message=request.user_message,
                    recent_messages=context["recent_messages"],
                    conversation_summary=context["conversation_summary"],
                    user_activities=context["user_activities"],
                    user_patterns={},
                    voice_analysis=request.voice_analysis or {},
                    user_id=user_id,
                    session_id=request.session_id
                )
                
                ai_message_text = result.get('message', '')
                logger.info(f"✅ [STREAM] AI text ready ({len(ai_message_text)} chars)")
                
                # Send text immediately via SSE
                import json
                yield f"event: text_chunk\\ndata: {json.dumps({'message': ai_message_text, 'modality': result.get('modality'), 'confidence': result.get('confidence', 0.8)})}\\n\\n"
                
                # Phase 2: Generate TTS/lipsync ONLY if avatar visible (async)
                if request.avatar_visible and ai_message_text:
                    logger.info("🎙️ [STREAM] Phase 2: Generating TTS + lip-sync (async)...")
                    
                    # Detect emotion
                    text_lower = ai_message_text.lower()
                    emotion = 'neutral'
                    facial_expression = "default"
                    if any(word in text_lower for word in ['happy', 'great', 'wonderful', 'amazing', 'excited']):
                        emotion = 'happy'
                        facial_expression = "smile"
                    elif any(word in text_lower for word in ['sad', 'sorry', 'difficult', 'hard', 'anxious']):
                        emotion = 'sad'
                        facial_expression = "sad"
                    
                    # Generate TTS
                    audio_base64 = generate_tts_audio_v2(ai_message_text, emotion)
                    
                    if audio_base64:
                        logger.info("✅ [STREAM] TTS audio ready")
                        yield f"event: audio_ready\\ndata: {json.dumps({'audio': audio_base64, 'animation': 'Talking_0', 'facial_expression': facial_expression})}\\n\\n"
                        
                        # Generate lipsync
                        lipsync_data = generate_lipsync_from_audio(audio_base64, ai_message_text)
                        if lipsync_data:
                            logger.info(f"✅ [STREAM] Lipsync ready ({len(lipsync_data.get('mouthCues', []))} cues)")
                            yield f"event: lipsync_ready\\ndata: {json.dumps({'lipsync': lipsync_data})}\\n\\n"
                else:
                    logger.info("⏭️ [STREAM] Skipping TTS (avatar hidden or no text)")
                
                # Phase 3: Trigger memory extraction
                if request.session_id:
                    session_message_counters[request.session_id] += 1
                    count = get_hybrid_message_count(request.session_id)
                    if count > 0 and count % 8 == 0:
                        logger.info(f"🧠 [STREAM] Triggering memory extraction (message #{count})")
                        workflow = get_workflow_instance()
                        threading.Thread(
                            target=workflow.trigger_memory_extraction,
                            args=(request.session_id, user_id),
                            daemon=True
                        ).start()
                
                # Send completion event
                yield f"event: complete\\ndata: {json.dumps({'status': 'success'})}\\n\\n"
                logger.info("✅ [STREAM] Streaming complete")
                
            except Exception as e:
                logger.error(f"❌ [STREAM] Error in event generator: {e}")
                import json
                yield f"event: error\\ndata: {json.dumps({'error': str(e)})}\\n\\n"
        
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ [STREAM] Streaming setup failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Streaming failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")