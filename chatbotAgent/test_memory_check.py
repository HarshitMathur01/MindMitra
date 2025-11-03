#!/usr/bin/env python3
"""
Test script to check if memories exist in Supabase database
"""

import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

def test_memories():
    """Test if memories exist in database"""
    
    print("=" * 80)
    print("🧪 TESTING MEMORIES IN DATABASE")
    print("=" * 80)
    
    # Check environment variables
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')
    
    print(f"\n1️⃣ Environment Variables:")
    print(f"   SUPABASE_URL: {'✅ Set' if supabase_url else '❌ Missing'}")
    print(f"   SUPABASE_KEY: {'✅ Set' if supabase_key else '❌ Missing'}")
    
    if not supabase_url or not supabase_key:
        print("\n❌ Cannot proceed without Supabase credentials")
        return False
    
    # Initialize Supabase client
    print(f"\n2️⃣ Initializing Supabase client...")
    try:
        supabase = create_client(supabase_url, supabase_key)
        print(f"   ✅ Supabase client initialized")
    except Exception as e:
        print(f"   ❌ Failed to initialize: {e}")
        return False
    
    # Test 1: Check if memories table exists
    print(f"\n3️⃣ Testing 'memories' table access...")
    try:
        response = supabase.table('memories').select('*').limit(1).execute()
        print(f"   ✅ Table 'memories' is accessible")
    except Exception as e:
        print(f"   ❌ Cannot access table: {e}")
        print(f"   Make sure the 'memories' table exists in Supabase")
        print(f"   Run: supabase db push")
        return False
    
    # Test 2: Count total memories
    print(f"\n4️⃣ Counting total memories...")
    try:
        response = supabase.table('memories').select('*', count='exact').execute()
        total_count = response.count if hasattr(response, 'count') else len(response.data)
        print(f"   ✅ Total memories in database: {total_count}")
        
        if total_count == 0:
            print(f"   ⚠️ No memories found in database!")
            print(f"   This means:")
            print(f"   1. No sessions have reached 8 messages yet")
            print(f"   2. Memory extraction hasn't been triggered")
            print(f"   3. Or memory extraction failed")
            return True  # Not an error, just no data yet
    except Exception as e:
        print(f"   ❌ Error counting: {e}")
        return False
    
    # Test 3: Get unique sessions
    print(f"\n5️⃣ Checking sessions with memories...")
    try:
        response = supabase.table('memories').select('session_id').execute()
        unique_sessions = set(row['session_id'] for row in response.data if row.get('session_id'))
        print(f"   ✅ Sessions with memories: {len(unique_sessions)}")
        if unique_sessions:
            print(f"   Sample session IDs: {list(unique_sessions)[:3]}")
    except Exception as e:
        print(f"   ❌ Error fetching sessions: {e}")
        return False
    
    # Test 4: Get memory types breakdown
    print(f"\n6️⃣ Analyzing memory types...")
    try:
        response = supabase.table('memories').select('memory_type').execute()
        memory_types = {}
        for row in response.data:
            memory_type = row.get('memory_type', 'unknown')
            memory_types[memory_type] = memory_types.get(memory_type, 0) + 1
        
        if memory_types:
            print(f"   ✅ Memory breakdown:")
            for memory_type, count in memory_types.items():
                print(f"      - {memory_type}: {count}")
        else:
            print(f"   ⚠️ No memory types found")
    except Exception as e:
        print(f"   ❌ Error analyzing types: {e}")
        return False
    
    # Test 5: Sample memories
    print(f"\n7️⃣ Sample memory data:")
    try:
        response = supabase.table('memories').select('*').order('created_at', desc=True).limit(3).execute()
        if response.data:
            for i, memory in enumerate(response.data, 1):
                print(f"   Sample #{i}:")
                print(f"      Type: {memory.get('memory_type', 'N/A')}")
                print(f"      Session ID: {memory.get('session_id', 'N/A')}")
                print(f"      User ID: {memory.get('user_id', 'N/A')}")
                print(f"      Created: {memory.get('created_at', 'N/A')}")
                
                # Try to parse content
                content = memory.get('content', 'N/A')
                if isinstance(content, str) and content.startswith('{'):
                    try:
                        import json
                        parsed = json.loads(content)
                        memory_content = parsed.get('memory_content', 'N/A')
                        words = str(memory_content).split()[:20]
                        preview = ' '.join(words)
                        print(f"      Content (20 words): {preview}...")
                    except:
                        print(f"      Content: {content[:100]}...")
                else:
                    print(f"      Content: {str(content)[:100]}...")
        else:
            print(f"   ⚠️ No sample data available")
    except Exception as e:
        print(f"   ❌ Error fetching samples: {e}")
        return False
    
    print(f"\n" + "=" * 80)
    print(f"✅ MEMORY CHECK COMPLETE")
    print(f"=" * 80)
    print(f"\nNext steps:")
    print(f"1. If you see memories above, they exist in database!")
    print(f"2. If no memories, chat more to reach 8 messages")
    print(f"3. Check backend logs for memory extraction messages")
    print()
    
    return True

if __name__ == "__main__":
    import sys
    try:
        success = test_memories()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
