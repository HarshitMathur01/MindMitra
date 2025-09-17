import requests
import time

def test_optimized_performance():
    url = "http://localhost:8000/chat"
    
    test_message = "I'm feeling overwhelmed with work stress and having trouble sleeping"
    
    print("🧪 Testing optimized workflow performance...")
    
    start_time = time.time()
    
    response = requests.post(url, json={
        "user_message": test_message,
        "recent_messages": [
            {"role": "user", "content": "Hello", "created_at": "2024-01-01"},
            {"role": "assistant", "content": "Hi! How are you?", "created_at": "2024-01-01"}
        ],
        "conversation_summary": {"key_themes": "stress management"},
        "user_activities": [
            {"activity_type": "memory_game", "score": 85, "accuracy_percentage": 78}
        ],
        "user_id": "test-user",
        "session_id": "test-session"
    }, timeout=180)
    
    total_time = time.time() - start_time
    
    if response.status_code == 200:
        result = response.json()
        # print(result.keys())
        print(f"✅ SUCCESS!")
        print(f"⏱️ Total Time: {total_time:.2f}s")
        print(f"⏱️ Message: {result.get('message', '')}")
        print(f"🔧 Workflow Time: {result.get('processing_time', 0):.2f}s")
        print(f"🎯 Modality: {result.get('modality')}")
        print(f"📝 Response Quality: {len(result.get('message', ''))} chars")
        print(f"🧠 Has Insights: {bool(result.get('session_insights'))}")
    else:
        print(f"❌ Failed: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    test_optimized_performance()