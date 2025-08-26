#!/usr/bin/env python3
"""
Integration test for ORBIT Python ADK with existing Supabase infrastructure
Tests connectivity and basic operations with real Supabase instance
"""

import asyncio
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import our tools
from orbit_tools import create_database_tool, create_storage_tool

async def test_database_connectivity():
    """Test basic database connectivity"""
    print("🔍 Testing database connectivity...")
    
    try:
        db_tool = create_database_tool(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_KEY")
        )
        
        # Test simple query
        result = await db_tool._execute("SELECT 1 as test_value")
        
        if result.success:
            print("✅ Database connectivity: SUCCESS")
            print(f"   Response: {result.data}")
            return True
        else:
            print(f"❌ Database connectivity: FAILED - {result.error}")
            return False
            
    except Exception as e:
        print(f"❌ Database connectivity: ERROR - {str(e)}")
        return False

async def test_orders_table():
    """Test access to orders table"""
    print("🔍 Testing orders table access...")
    
    try:
        db_tool = create_database_tool(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_KEY")
        )
        
        # Check if orders table exists and get pending count
        result = await db_tool._execute("""
            SELECT COUNT(*) as pending_count
            FROM orders 
            WHERE processing_stage = 'pending' 
            AND payment_status = 'completed'
        """)
        
        if result.success:
            count = result.data[0]['pending_count']
            print(f"✅ Orders table access: SUCCESS")
            print(f"   Pending orders: {count}")
            return True
        else:
            print(f"❌ Orders table access: FAILED - {result.error}")
            return False
            
    except Exception as e:
        print(f"❌ Orders table access: ERROR - {str(e)}")
        return False

async def test_storage_connectivity():
    """Test storage connectivity"""
    print("🔍 Testing storage connectivity...")
    
    try:
        storage_tool = create_storage_tool(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_KEY")
        )
        
        # Test listing files in orbit-images bucket
        result = await storage_tool._execute(
            operation_type="list_files",
            bucket_name="orbit-images",
            folder_path="original",
            limit=5
        )
        
        if result.success:
            file_count = len(result.data.get('files', []))
            print("✅ Storage connectivity: SUCCESS")
            print(f"   Files found in orbit-images/original: {file_count}")
            return True
        else:
            print(f"❌ Storage connectivity: FAILED - {result.error}")
            return False
            
    except Exception as e:
        print(f"❌ Storage connectivity: ERROR - {str(e)}")
        return False

async def test_complete_workflow_query():
    """Test a complete workflow discovery query"""
    print("🔍 Testing complete workflow discovery...")
    
    try:
        db_tool = create_database_tool(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_KEY")
        )
        
        # Get a pending order with images
        result = await db_tool._execute("""
            SELECT 
                o.id as order_id,
                o.user_id,
                o.batch_id,
                o.processing_stage,
                o.payment_status,
                COUNT(i.id) as image_count
            FROM orders o
            LEFT JOIN images i ON o.id = i.order_id
            WHERE o.processing_stage = 'pending' 
            AND o.payment_status = 'completed'
            GROUP BY o.id, o.user_id, o.batch_id, o.processing_stage, o.payment_status
            ORDER BY o.created_at ASC
            LIMIT 1
        """)
        
        if result.success and result.data:
            order = result.data[0]
            print("✅ Workflow discovery: SUCCESS")
            print(f"   Order ID: {order['order_id']}")
            print(f"   User ID: {order['user_id']}")
            print(f"   Batch ID: {order['batch_id']}")
            print(f"   Images: {order['image_count']}")
            return True
        else:
            print("⚠️  Workflow discovery: No pending orders found")
            print("   This is normal if all orders are processed")
            return True
            
    except Exception as e:
        print(f"❌ Workflow discovery: ERROR - {str(e)}")
        return False

async def main():
    """Run all integration tests"""
    print("🚀 ORBIT Python ADK Integration Test")
    print("=" * 50)
    print(f"Timestamp: {datetime.utcnow().isoformat()}")
    print(f"Supabase URL: {os.getenv('SUPABASE_URL')}")
    print("=" * 50)
    
    tests = [
        ("Database Connectivity", test_database_connectivity),
        ("Orders Table Access", test_orders_table),  
        ("Storage Connectivity", test_storage_connectivity),
        ("Workflow Discovery", test_complete_workflow_query)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print()
        try:
            success = await test_func()
            results.append((test_name, success))
        except Exception as e:
            print(f"❌ {test_name}: EXCEPTION - {str(e)}")
            results.append((test_name, False))
    
    # Summary
    print()
    print("=" * 50)
    print("📊 Integration Test Results")
    print("=" * 50)
    
    passed = 0
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status:<8} {test_name}")
        if success:
            passed += 1
    
    print(f"\nOverall: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("🎉 All integration tests passed! System ready for production.")
        sys.exit(0)
    else:
        print("⚠️  Some tests failed. Please check configuration and permissions.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())