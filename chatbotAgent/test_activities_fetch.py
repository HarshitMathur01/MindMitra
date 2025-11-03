#!/usr/bin/env python3
"""
Test script to verify if activities data can be fetched from Supabase
Run this to check if your database has any game/QA activities
"""

import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

def test_activities_fetch():
    """Test fetching activities from Supabase"""
    
    print("=" * 80)
    print("🧪 TESTING ACTIVITIES DATA IN DATABASE")
    print("=" * 80)
    
    # Check environment variables
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')
    
    print(f"\n1️⃣ Environment Variables:")
    print(f"   SUPABASE_URL: {'✅ Set' if supabase_url else '❌ Missing'}")
    print(f"   SUPABASE_KEY: {'✅ Set' if supabase_key else '❌ Missing'}")
    
    if not supabase_url or not supabase_key:
        print("\n❌ Cannot proceed without Supabase credentials")
        print("   Create .env file with SUPABASE_URL and SUPABASE_KEY")
        return False
    
    # Initialize Supabase client
    print(f"\n2️⃣ Initializing Supabase client...")
    try:
        supabase = create_client(supabase_url, supabase_key)
        print(f"   ✅ Supabase client initialized")
    except Exception as e:
        print(f"   ❌ Failed to initialize: {e}")
        return False
    
    # Test 1: Check if table exists
    print(f"\n3️⃣ Testing table access...")
    try:
        response = supabase.table('user_activities').select('*').limit(1).execute()
        print(f"   ✅ Table 'user_activities' is accessible")
    except Exception as e:
        print(f"   ❌ Cannot access table: {e}")
        print(f"   Make sure the 'user_activities' table exists in Supabase")
        return False
    
    # Test 2: Count total activities
    print(f"\n4️⃣ Counting total activities...")
    try:
        response = supabase.table('user_activities').select('*', count='exact').execute()
        total_count = response.count if hasattr(response, 'count') else len(response.data)
        print(f"   ✅ Total activities in database: {total_count}")
        
        if total_count == 0:
            print(f"   ⚠️ No activities found in database!")
            print(f"   This is normal if users haven't played games/QA sessions yet")
            print(f"   Try playing some games in the frontend first")
            return True  # Not an error, just no data yet
    except Exception as e:
        print(f"   ❌ Error counting: {e}")
        return False
    
    # Test 3: Get unique users
    print(f"\n5️⃣ Checking users with activities...")
    try:
        response = supabase.table('user_activities').select('user_id').execute()
        unique_users = set(row['user_id'] for row in response.data if row.get('user_id'))
        print(f"   ✅ Users with activities: {len(unique_users)}")
        if unique_users:
            sample_users = list(unique_users)[:3]
            print(f"   Sample user IDs: {sample_users}")
    except Exception as e:
        print(f"   ❌ Error fetching users: {e}")
        return False
    
    # Test 4: Get activity types
    print(f"\n6️⃣ Analyzing activity types...")
    try:
        response = supabase.table('user_activities').select('activity_type').execute()
        activity_types = {}
        for row in response.data:
            activity_type = row.get('activity_type', 'unknown')
            activity_types[activity_type] = activity_types.get(activity_type, 0) + 1
        
        if activity_types:
            print(f"   ✅ Activity breakdown:")
            for activity_type, count in activity_types.items():
                print(f"      - {activity_type}: {count}")
        else:
            print(f"   ⚠️ No activity types found")
    except Exception as e:
        print(f"   ❌ Error analyzing types: {e}")
        return False
    
    # Test 5: Sample data
    print(f"\n7️⃣ Sample activity data:")
    try:
        response = supabase.table('user_activities').select('*').order('completed_at', desc=True).limit(3).execute()
        if response.data:
            for i, activity in enumerate(response.data, 1):
                print(f"   Sample #{i}:")
                print(f"      Type: {activity.get('activity_type', 'N/A')}")
                print(f"      User ID: {activity.get('user_id', 'N/A')}")
                print(f"      Score: {activity.get('score', 'N/A')}")
                print(f"      Duration: {activity.get('game_duration', activity.get('duration', 'N/A'))}")
                print(f"      Timestamp: {activity.get('completed_at', 'N/A')}")
        else:
            print(f"   ⚠️ No sample data available")
    except Exception as e:
        print(f"   ❌ Error fetching samples: {e}")
        return False
    
    print(f"\n" + "=" * 80)
    print(f"✅ DATABASE TEST COMPLETE")
    print(f"=" * 80)
    print(f"\nNext steps:")
    print(f"1. If you see activities above, your database is working!")
    print(f"2. If no activities, play some games in the frontend first")
    print(f"3. Check that Edge Function is passing activities to backend")
    print()
    
    return True

if __name__ == "__main__":
    import sys
    try:
        success = test_activities_fetch()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
