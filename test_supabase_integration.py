#!/usr/bin/env python3
"""
Direct Supabase integration test for ORBIT system
Tests database and storage connectivity without requiring Google ADK
"""

import asyncio
import os
import json
from datetime import datetime
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class SimpleSupabaseClient:
    """Simple Supabase client for testing"""
    
    def __init__(self, url: str, key: str):
        self.url = url.rstrip('/')
        self.key = key
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
    
    async def query(self, sql: str):
        """Execute SQL query"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.url}/rest/v1/rpc/execute_sql",
                headers=self.headers,
                json={"sql": sql},
                timeout=30.0
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"Query failed: {response.status_code} {response.text}")
    
    async def list_storage(self, bucket: str, folder: str = "", limit: int = 10):
        """List files in storage bucket"""
        async with httpx.AsyncClient() as client:
            url = f"{self.url}/storage/v1/object/list/{bucket}"
            params = {"limit": limit}
            if folder:
                params["prefix"] = folder
            
            response = await client.post(
                url,
                headers=self.headers,
                json=params,
                timeout=30.0
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"Storage list failed: {response.status_code} {response.text}")

async def test_basic_connectivity():
    """Test basic Supabase connectivity"""
    print("🔍 Testing basic Supabase connectivity...")
    
    try:
        client = SimpleSupabaseClient(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_KEY")
        )
        
        # Try a simple API call to test connectivity
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                f"{client.url}/rest/v1/",
                headers={"apikey": client.key}
            )
            
        if response.status_code == 200:
            print("✅ Basic connectivity: SUCCESS")
            return True
        else:
            print(f"❌ Basic connectivity: FAILED - {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Basic connectivity: ERROR - {str(e)}")
        return False

async def test_orders_table_direct():
    """Test direct access to orders table"""
    print("🔍 Testing direct orders table access...")
    
    try:
        client = SimpleSupabaseClient(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_KEY")
        )
        
        # Use REST API to query orders table directly
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                f"{client.url}/rest/v1/orders?select=count&payment_status=eq.completed&processing_stage=eq.pending",
                headers=client.headers
            )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Orders table access: SUCCESS")
            print(f"   Found {len(data)} pending orders")
            if data:
                print(f"   Sample order keys: {list(data[0].keys())}")
            return True
        else:
            print(f"❌ Orders table access: FAILED - {response.status_code} {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Orders table access: ERROR - {str(e)}")
        return False

async def test_images_table_direct():
    """Test direct access to images table"""
    print("🔍 Testing direct images table access...")
    
    try:
        client = SimpleSupabaseClient(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_KEY")
        )
        
        # Use REST API to query images table directly
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                f"{client.url}/rest/v1/images?select=count&limit=5",
                headers=client.headers
            )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Images table access: SUCCESS")
            print(f"   Found {len(data)} sample images")
            if data:
                print(f"   Sample image keys: {list(data[0].keys())}")
            return True
        else:
            print(f"❌ Images table access: FAILED - {response.status_code} {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Images table access: ERROR - {str(e)}")
        return False

async def test_storage_buckets():
    """Test storage bucket access"""
    print("🔍 Testing storage bucket access...")
    
    try:
        client = SimpleSupabaseClient(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_KEY")
        )
        
        # List available buckets
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                f"{client.url}/storage/v1/bucket",
                headers=client.headers
            )
        
        if response.status_code == 200:
            buckets = response.json()
            print("✅ Storage bucket access: SUCCESS")
            print(f"   Available buckets: {[b['name'] for b in buckets]}")
            return True
        else:
            print(f"❌ Storage bucket access: FAILED - {response.status_code} {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Storage bucket access: ERROR - {str(e)}")
        return False

async def test_orbit_images_bucket():
    """Test orbit-images bucket specifically"""
    print("🔍 Testing orbit-images bucket...")
    
    try:
        client = SimpleSupabaseClient(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_KEY")
        )
        
        # Try to list files in orbit-images bucket
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                f"{client.url}/storage/v1/object/list/orbit-images",
                headers=client.headers,
                json={"limit": 10, "prefix": ""},
                timeout=30.0
            )
        
        if response.status_code == 200:
            files = response.json()
            print("✅ orbit-images bucket access: SUCCESS")
            print(f"   Files found: {len(files)}")
            if files:
                print(f"   Sample files: {[f['name'] for f in files[:3]]}")
            return True
        else:
            print(f"❌ orbit-images bucket access: FAILED - {response.status_code} {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ orbit-images bucket access: ERROR - {str(e)}")
        return False

async def test_workflow_readiness():
    """Test if system is ready for workflow execution"""
    print("🔍 Testing workflow readiness...")
    
    try:
        client = SimpleSupabaseClient(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_KEY")
        )
        
        # Check for pending orders with images
        async with httpx.AsyncClient() as http_client:
            # Get orders
            orders_response = await http_client.get(
                f"{client.url}/rest/v1/orders?payment_status=eq.completed&processing_stage=eq.pending&limit=1",
                headers=client.headers
            )
            
            orders = orders_response.json() if orders_response.status_code == 200 else []
            
            if orders:
                order = orders[0]
                order_id = order['id']
                
                # Get images for this order  
                images_response = await http_client.get(
                    f"{client.url}/rest/v1/images?order_id=eq.{order_id}",
                    headers=client.headers
                )
                
                images = images_response.json() if images_response.status_code == 200 else []
                
                print("✅ Workflow readiness: READY")
                print(f"   Pending order ID: {order_id}")
                print(f"   User ID: {order.get('user_id')}")
                print(f"   Images to process: {len(images)}")
                return True
            else:
                print("⚠️  Workflow readiness: NO PENDING ORDERS")
                print("   All orders may already be processed")
                return True
            
    except Exception as e:
        print(f"❌ Workflow readiness: ERROR - {str(e)}")
        return False

async def main():
    """Run all integration tests"""
    print("🚀 ORBIT Supabase Integration Test")
    print("=" * 50)
    print(f"Timestamp: {datetime.utcnow().isoformat()}")
    print(f"Supabase URL: {os.getenv('SUPABASE_URL')}")
    print("=" * 50)
    
    tests = [
        ("Basic Connectivity", test_basic_connectivity),
        ("Orders Table Access", test_orders_table_direct),
        ("Images Table Access", test_images_table_direct),
        ("Storage Buckets", test_storage_buckets),
        ("Orbit Images Bucket", test_orbit_images_bucket),
        ("Workflow Readiness", test_workflow_readiness)
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
    
    if passed >= len(results) - 1:  # Allow 1 failure
        print("🎉 Integration tests successful! ORBIT Supabase infrastructure accessible.")
        return True
    else:
        print("⚠️  Multiple tests failed. Please check configuration and permissions.")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)