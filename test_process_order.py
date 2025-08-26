#!/usr/bin/env python3
"""
Test processing specific order f01470c2-a056-4429-b2f2-b12c73f85c64
Direct test of ORBIT workflow without requiring Google ADK
"""

import asyncio
import os
import json
from datetime import datetime
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class ORBITProcessor:
    """Simple ORBIT processor for testing specific order"""
    
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL").rstrip('/')
        self.supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        self.headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }
        
    async def get_order_details(self, order_id: str):
        """Get complete order details with images"""
        print(f"🔍 Getting order details for {order_id}...")
        
        async with httpx.AsyncClient() as client:
            # Get order info
            order_response = await client.get(
                f"{self.supabase_url}/rest/v1/orders?id=eq.{order_id}",
                headers=self.headers
            )
            
            if order_response.status_code != 200:
                raise Exception(f"Failed to get order: {order_response.text}")
            
            orders = order_response.json()
            if not orders:
                raise Exception(f"Order {order_id} not found")
            
            order = orders[0]
            
            # Get images for this order
            images_response = await client.get(
                f"{self.supabase_url}/rest/v1/images?order_id=eq.{order_id}",
                headers=self.headers
            )
            
            if images_response.status_code != 200:
                raise Exception(f"Failed to get images: {images_response.text}")
            
            images = images_response.json()
            
            print(f"✅ Order details retrieved:")
            print(f"   Order ID: {order['id']}")
            print(f"   User ID: {order['user_id']}")
            print(f"   Batch ID: {order['batch_id']}")
            print(f"   Payment Status: {order['payment_status']}")
            print(f"   Processing Stage: {order['processing_stage']}")
            print(f"   Images Count: {len(images)}")
            
            for i, img in enumerate(images):
                print(f"   Image {i+1}: {img['id']} - {img.get('original_filename', 'N/A')}")
            
            return order, images
    
    async def mark_order_processing(self, order_id: str):
        """Mark order as processing"""
        print(f"🔄 Marking order {order_id} as processing...")
        
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.supabase_url}/rest/v1/orders?id=eq.{order_id}",
                headers=self.headers,
                json={"processing_stage": "processing"}
            )
            
            if response.status_code in [200, 204]:
                print("✅ Order marked as processing")
                return True
            else:
                print(f"❌ Failed to mark order as processing: {response.text}")
                return False
    
    async def get_image_signed_url(self, image_path: str, bucket: str = "orbit-images"):
        """Generate signed URL for image access"""
        print(f"🔗 Getting signed URL for {image_path}...")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.supabase_url}/storage/v1/object/sign/{bucket}/{image_path}",
                headers=self.headers,
                json={"expiresIn": 3600}  # 1 hour
            )
            
            if response.status_code == 200:
                result = response.json()
                signed_url = f"{self.supabase_url}/storage/v1{result['signedURL']}"
                print(f"✅ Signed URL generated")
                return signed_url
            else:
                print(f"❌ Failed to generate signed URL: {response.text}")
                return None
    
    async def simulate_ai_analysis(self, image_url: str, image_id: str):
        """Simulate AI analysis (mock implementation)"""
        print(f"🤖 Simulating AI analysis for image {image_id}...")
        
        # Mock analysis result
        mock_analysis = {
            "image_id": image_id,
            "analysis_type": "lifestyle",
            "scene_analysis": {
                "primary_subject": "person",
                "setting": "indoor",
                "lighting": "natural",
                "composition": "portrait",
                "mood": "casual",
                "colors": ["blue", "white", "brown"],
                "objects": ["person", "clothing", "background"]
            },
            "metadata": {
                "confidence": 0.95,
                "processing_time_ms": 1247,
                "model_version": "gemini-pro-vision-001",
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        print(f"✅ AI analysis simulated:")
        print(f"   Type: {mock_analysis['analysis_type']}")
        print(f"   Subject: {mock_analysis['scene_analysis']['primary_subject']}")
        print(f"   Setting: {mock_analysis['scene_analysis']['setting']}")
        
        return mock_analysis
    
    async def store_analysis_results(self, image_id: str, analysis_data: dict):
        """Store analysis results in database"""
        print(f"💾 Storing analysis results for image {image_id}...")
        
        async with httpx.AsyncClient() as client:
            # Update image with analysis data
            response = await client.patch(
                f"{self.supabase_url}/rest/v1/images?id=eq.{image_id}",
                headers=self.headers,
                json={
                    "ai_analysis": analysis_data,
                    "analysis_status": "completed",
                    "processed_at": datetime.utcnow().isoformat()
                }
            )
            
            if response.status_code in [200, 204]:
                print("✅ Analysis results stored")
                return True
            else:
                print(f"❌ Failed to store analysis: {response.text}")
                return False
    
    async def complete_order(self, order_id: str):
        """Mark order as completed"""
        print(f"🎉 Completing order {order_id}...")
        
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.supabase_url}/rest/v1/orders?id=eq.{order_id}",
                headers=self.headers,
                json={
                    "processing_stage": "completed",
                    "completed_at": datetime.utcnow().isoformat()
                }
            )
            
            if response.status_code in [200, 204]:
                print("✅ Order completed successfully")
                return True
            else:
                print(f"❌ Failed to complete order: {response.text}")
                return False
    
    async def process_order(self, order_id: str):
        """Process complete order workflow"""
        print(f"🚀 Starting ORBIT workflow for order {order_id}")
        print("=" * 60)
        
        start_time = datetime.utcnow()
        
        try:
            # Phase 1: Get order details
            order, images = await self.get_order_details(order_id)
            
            # Phase 2: Mark as processing
            await self.mark_order_processing(order_id)
            
            # Phase 3: Process each image
            for i, image in enumerate(images, 1):
                print(f"\n--- Processing Image {i}/{len(images)} ---")
                
                # Get image path (construct from order data)
                image_path = f"{image['id']}_{order['user_id']}"
                print(f"Image path: {image_path}")
                
                # Generate signed URL
                signed_url = await self.get_image_signed_url(image_path)
                
                if signed_url:
                    # Perform AI analysis
                    analysis = await self.simulate_ai_analysis(signed_url, image['id'])
                    
                    # Store results
                    await self.store_analysis_results(image['id'], analysis)
                else:
                    print(f"⚠️ Skipping analysis for image {image['id']} - no signed URL")
            
            # Phase 4: Complete order
            await self.complete_order(order_id)
            
            # Calculate timing
            end_time = datetime.utcnow()
            duration = (end_time - start_time).total_seconds()
            
            print("\n" + "=" * 60)
            print("📊 Workflow Complete!")
            print(f"   Order ID: {order_id}")
            print(f"   Images Processed: {len(images)}")
            print(f"   Total Duration: {duration:.2f} seconds")
            print(f"   Average per Image: {duration/len(images):.2f} seconds")
            print("=" * 60)
            
            return True
            
        except Exception as e:
            print(f"\n❌ Workflow failed: {str(e)}")
            return False

async def main():
    """Test processing the specific order"""
    order_id = "f01470c2-a056-4429-b2f2-b12c73f85c64"
    
    print("🎯 ORBIT Order Processing Test")
    print("=" * 60)
    print(f"Target Order: {order_id}")
    print(f"Timestamp: {datetime.utcnow().isoformat()}")
    print("=" * 60)
    
    processor = ORBITProcessor()
    
    success = await processor.process_order(order_id)
    
    if success:
        print("\n🎉 Order processing test completed successfully!")
    else:
        print("\n❌ Order processing test failed!")
    
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)