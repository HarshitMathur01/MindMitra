import requests
import json

def test_chatbot():
    url = "http://127.0.0.1:8000/process-chat"
    
    # Test data - this simulates a user with anxiety who played a memory game
    test_data = {
        "user_message": "what is 2+2",
        "session_data": {
            
        },
        
        "conversation_history": []
    }
    
    try:
        print("🤖 Testing MindMate Agent...")
        print("=" * 60)
        print(f"User Message: {test_data['user_message']}")
        print("=" * 60)
        
        response = requests.post(
            url, 
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=120  # 30 second timeout
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("\n✅ SUCCESS! Agent Response:")
            print("=" * 60)
            print(result["message"])
            print("=" * 60)
        else:
            print("❌ Error Response:")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Is your server running?")
        print("Run: uvicorn main:app --reload")
    except requests.exceptions.Timeout:
        print("❌ Timeout: The agent is taking too long to respond")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    test_chatbot()