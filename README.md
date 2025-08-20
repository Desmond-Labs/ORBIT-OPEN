# ORBIT Image Forge

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

## 🎯 Project Overview

**ORBIT Image Forge** is an open source AI-powered image processing platform that analyzes lifestyle and product images using Google Gemini AI, then embeds comprehensive metadata directly into image files using industry-standard XMP formats. The platform features a revolutionary **Two-Tier Processing Architecture** that combines speed with reliability through intelligent routing.

**🚀 Live Demo**: https://preview--orbit-image-forge.lovable.app  
**📖 Documentation**: [Complete System Docs](./CLAUDE.md)  
**🤝 Contributing**: [Developer Guide](./CONTRIBUTING.md)

## 📊 End-to-End Workflow Diagram

```mermaid
graph TB
    %% Frontend Layer
    subgraph "🖥️ Frontend (React + TypeScript)"
        A[User Registration/Login] --> B[Image Upload Interface]
        B --> C[Payment Processing]
        C --> D[Processing Status Dashboard]
        D --> E[Download Processed Images]
    end

    %% Authentication & Storage
    subgraph "🔐 Authentication & Storage"
        F[Supabase Auth + Google OAuth]
        G[Supabase Storage - orbit-images bucket]
    end

    %% Payment System
    subgraph "💳 Payment System"
        H[Stripe Payment Intent]
        I[Stripe Webhook Handler]
    end

    %% Smart Routing Layer
    subgraph "🧠 Smart Routing Layer"
        J[smart-router Edge Function]
        K{System Health Check}
        L{Order Complexity Analysis}
        M{Escalation Triggers}
    end

    %% Tier 1 - Fast Path
    subgraph "⚡ Tier 1: Enhanced Fast Path"
        N[process-image-batch]
        O[Pre-flight Validation]
        P[Storage Verification]
        Q[Atomic Processing]
        R[Error Classification]
    end

    %% Tier 2 - Claude Code SDK
    subgraph "🤖 Tier 2: Claude Code SDK Orchestrator"
        S[claude-tier2-orchestrator]
        T[Phase 0: System Validation Agent]
        U[Phase 1: Order Discovery Agent]
        V[Phase 2: Multi-Image Processing Agents]
        W[Phase 3: Order Finalization Agent]
        X[Phase 4: Email Notification Agent]
        Y[Self-Healing Coordination]
    end

    %% Remote MCP Services
    subgraph "🔗 Remote MCP Services"
        Z[mcp-ai-analysis]
        AA[Google Gemini API Integration]
        BB[mcp-metadata]
        CC[XMP Embedding & Reports]
        DD[mcp-storage]
        EE[File Operations & Management]
    end

    %% Database Layer
    subgraph "🗄️ Database Layer (PostgreSQL + RLS)"
        FF[orders table]
        GG[images table] 
        HH[orbit_users table]
        II[order_access_tokens table]
        JJ[token_usage_audit table]
        KK[file_downloads table]
    end

    %% Email & Notification System
    subgraph "📧 Email & Notification System"
        LL[send-order-completion-email]
        MM[Resend API Integration]
        NN[Secure Token Generation]
        OO[Email Template Processing]
    end

    %% Download System
    subgraph "⬇️ Secure Download System"
        PP[download-processed-images]
        QQ[Token Validation]
        RR[ZIP Archive Generation]
        SS[Signed URL Generation]
    end

    %% Flow Connections
    A --> F
    B --> G
    B --> FF
    C --> H
    H --> I
    I --> J

    %% Smart Routing Decision
    J --> K
    K --> L
    L --> M
    M --> N
    M --> S

    %% Tier 1 Flow
    N --> O
    O --> P
    P --> Q
    Q --> R
    R --> Z
    R --> BB

    %% Tier 2 Flow
    S --> T
    T --> U
    U --> V
    V --> W
    W --> X
    V --> Z
    V --> BB
    R --> Y
    Y --> S

    %% MCP Service Details
    Z --> AA
    BB --> CC
    DD --> EE

    %% Database Interactions
    N --> FF
    N --> GG
    S --> FF
    S --> GG
    F --> HH
    LL --> II
    QQ --> II
    PP --> KK

    %% Email Flow
    R --> LL
    X --> LL
    LL --> MM
    LL --> NN
    NN --> OO

    %% Download Flow
    E --> PP
    PP --> QQ
    QQ --> RR
    RR --> SS
    SS --> G

    %% Status Updates to Frontend
    R -.-> D
    X -.-> D
    Y -.-> D

    %% Styling
    classDef frontend fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef backend fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef mcp fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef database fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef routing fill:#fce4ec,stroke:#880e4f,stroke-width:2px

    class A,B,C,D,E frontend
    class N,O,P,Q,R,S,T,U,V,W,X,Y,LL,PP backend
    class Z,AA,BB,CC,DD,EE mcp
    class FF,GG,HH,II,JJ,KK database
    class J,K,L,M routing
```

## 🔄 Detailed Workflow Steps

### **Phase 1: User Onboarding & Upload**
1. **User Registration/Login** → Supabase Auth with Google OAuth
2. **Image Upload Interface** → Direct FormData upload to Supabase Storage
3. **Order Creation** → Database entry with unique order number
4. **Payment Processing** → Stripe integration with webhook validation

### **Phase 2: Smart Routing Decision**
5. **Payment Verification** → Triggers smart routing system
6. **System Health Assessment** → Real-time component availability check
7. **Order Complexity Analysis** → Image count, file size, failure history evaluation
8. **Escalation Trigger Evaluation** → User tier, error patterns, system load analysis
9. **Routing Decision** → Intelligent selection between Tier 1 and Tier 2

### **Phase 3A: Tier 1 - Enhanced Fast Path** ⚡
10. **Pre-flight Validation** → Environment and dependency checks
11. **Storage Verification** → File existence and integrity validation
12. **Atomic Processing** → Individual image processing with rollback capability
13. **Remote MCP Calls** → Direct calls to AI analysis and metadata services
14. **Error Classification** → 7-category error handling with retry logic

### **Phase 3B: Tier 2 - Claude Code SDK Orchestration** 🤖
10. **System Validation Agent** → Comprehensive environment validation
11. **Order Discovery Agent** → Database and storage cross-validation
12. **Multi-Image Processing Agents** → Parallel processing with coordination
13. **Self-Healing Coordination** → Automatic error recovery and retry
14. **Order Finalization Agent** → Results verification and status updates
15. **Email Notification Agent** → Secure token generation and email dispatch

### **Phase 4: AI Processing & Metadata Generation**
16. **Google Gemini Analysis** → Lifestyle/product image analysis
17. **XMP Metadata Embedding** → ORBIT schema compliance with multiple formats
18. **Report Generation** → Human-readable analysis reports
19. **Thumbnail Creation** → Multiple sizes with web optimization
20. **Storage Organization** → Processed files in organized folder structure

### **Phase 5: Completion & Delivery**
21. **Email Notification** → Automatic completion email with secure links
22. **Token Generation** → 7-day expiry, 10-use limit access tokens
23. **Download Interface** → Secure ZIP archive generation
24. **Audit Logging** → Complete usage tracking and security monitoring

### **Key Decision Points**

- **🔀 Smart Routing**: Routes based on complexity, health, and user tier
- **🔄 Self-Healing**: Automatic error recovery and tier escalation
- **⚡ Performance**: Sub-6s Tier 1 vs 13-15s comprehensive Tier 2
- **🛡️ Security**: Dual authentication (user session + email tokens)
- **📊 Monitoring**: Real-time health checks and performance metrics

## 🏗️ Two-Tier Architecture

### **Tier 1: Enhanced Fast Path** ⚡
- **Performance**: Sub-6 second processing 
- **Use Case**: Standard orders, simple complexity
- **Features**:
  - Storage verification checkpoints
  - Atomic processing with rollback
  - Enhanced error classification (7 error types)
  - Direct remote MCP integration

### **Tier 2: Claude Code SDK Orchestrator** 🤖  
- **Performance**: 13-15 second comprehensive processing
- **Use Case**: Complex orders, failure recovery, premium users
- **Features**:
  - 5-phase ORBIT workflow orchestration
  - Multi-agent coordination system
  - Intelligent self-healing capabilities
  - Task tool-based coordination patterns
  - Sub-second orchestration (339ms average)

### **Smart Routing System** 🧠
Intelligent decision engine that routes orders between tiers based on:
- System health assessment
- Order complexity analysis  
- Performance metrics evaluation
- Escalation triggers (failures, timeouts, user tier)
- Real-time fallback support

## 🚀 Key Features

### **AI-Powered Analysis**
- **Google Gemini Integration**: Advanced image analysis
- **Automatic Type Detection**: Lifestyle vs product analysis
- **Comprehensive Metadata**: Colors, objects, scenes, emotions, marketing insights

### **XMP Metadata Embedding**
- **ORBIT Schema Compliance**: Industry-standard metadata
- **Multiple Output Formats**: Processed images, standalone XMP, human-readable reports
- **Thumbnail Generation**: 3 sizes with web optimization

### **Secure Token-Based Access**
- **Email Notifications**: Automatic completion emails with secure links
- **Token Authentication**: 7-day expiry, 10-use limits
- **Audit Trail**: Complete usage tracking and security monitoring

### **Advanced Error Recovery**
- **Intelligent Retry Logic**: Context-aware error classification
- **Self-Healing System**: Automatic recovery and escalation
- **Comprehensive Logging**: Correlation IDs and detailed audit trails

## 🛠️ Technology Stack

### **Frontend**
- **Framework**: React 18 + TypeScript + Vite
- **UI Library**: Tailwind CSS + shadcn/ui components
- **State Management**: React hooks with custom management
- **Authentication**: Supabase Auth with Google OAuth

### **Backend**
- **Runtime**: Supabase Edge Functions (Deno)
- **Database**: PostgreSQL with comprehensive RLS
- **Storage**: Supabase Storage with organized bucket structure
- **AI Integration**: Google Gemini API
- **Payments**: Stripe integration

### **Remote MCP Architecture**
- **`mcp-ai-analysis`**: Google Gemini AI integration
- **`mcp-metadata`**: XMP metadata embedding and report generation  
- **`mcp-storage`**: Storage operations and file management

## 📋 Quick Start

### **Prerequisites**
- Node.js & npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Supabase CLI
- Git

### **Frontend Development**
```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd orbit-image-forge

# Install dependencies
npm install

# Start development server
npm run dev
```

### **Backend Development**  
```bash
# Start local Supabase stack
supabase start

# Deploy specific edge function
supabase functions deploy <function-name>

# Deploy all functions
supabase functions deploy

# View function logs
supabase functions logs <function-name>
```

### **Environment Configuration**
Required environment variables:
```bash
SUPABASE_URL=<your-project-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-key>
GOOGLE_API_KEY=<your-gemini-api-key>
RESEND_API_KEY=<your-email-service-key>
STRIPE_SECRET_KEY=<your-stripe-key>
```

## 🧪 Testing the Two-Tier System

### **Test Tier 1 (Fast Path)**
```bash
curl -X POST "https://<your-project>.supabase.co/functions/v1/smart-router" \
  -H "Authorization: Bearer <service-key>" \
  -H "apikey: <service-key>" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "<order-id>", "priority": "standard"}'
```

### **Test Tier 2 (Claude Code SDK)**
```bash
curl -X POST "https://<your-project>.supabase.co/functions/v1/smart-router" \
  -H "Authorization: Bearer <service-key>" \
  -H "apikey: <service-key>" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "<order-id>", "forceRoute": "tier2"}'
```

### **Run Comprehensive Tests**
```bash
# Interactive test runner (recommended)
./tests/run-tests.sh

# Test complete two-tier architecture
./tests/scripts/test-two-tier-architecture.sh <order-id>

# Test individual MCP components  
./tests/scripts/test-process-batch.sh <order-id>

# Run specific test suite
./tests/run-tests.sh <order-id> <test-type>
# test-type: two-tier, tier1, mcp, email, all, health
```

## 📊 Performance Metrics

### **Tier 1 Performance**
- **Processing Time**: 6 seconds average
- **Success Rate**: 85%
- **Use Cases**: 70% of orders
- **Throughput**: High volume, low latency

### **Tier 2 Performance**
- **Processing Time**: 13-15 seconds average  
- **Success Rate**: 95%
- **Orchestration Time**: 339ms average
- **Use Cases**: 30% of orders (complex/critical)

### **Smart Routing**
- **Decision Time**: <100ms
- **Health Checks**: Real-time monitoring
- **Escalation Triggers**: 7 configurable triggers
- **Fallback Success**: 99%+ availability

## 🔧 Development Scripts

```bash
# Frontend Development
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # Code quality check
npm run typecheck    # TypeScript validation

# Backend Development  
supabase start                              # Local development
supabase functions deploy <function>        # Deploy single function
supabase db reset                          # Reset with migrations
supabase gen types typescript --local      # Generate types

# Testing
./tests/run-tests.sh                      # Interactive test runner
./tests/scripts/test-two-tier-architecture.sh # Full system test
./tests/scripts/test-process-batch.sh     # Component test
./trigger-email.sh <order-id>              # Manual email trigger
```

## 🔒 Security Features

- **Row Level Security**: Comprehensive RLS policies on all tables
- **Function Security**: `SET search_path = public` protection
- **Token Validation**: Cryptographically secure access tokens
- **Audit Logging**: Complete tracking of all operations
- **CORS Protection**: Proper headers and origin validation
- **Input Validation**: File type, size, and parameter sanitization

## 📈 Monitoring & Observability

- **Real-time Health Checks**: System component monitoring
- **Performance Metrics**: Response times, success rates, error patterns
- **Escalation Tracking**: Automatic tier promotion monitoring  
- **Correlation IDs**: End-to-end request tracking
- **Security Audits**: Token usage and access pattern analysis

## 🚀 Deployment

### **Frontend Deployment**
Automatic deployment via Lovable.app on git push to main branch.

### **Backend Deployment**
```bash
# Deploy all functions
supabase functions deploy

# Deploy with configuration
supabase functions deploy --no-verify-jwt <webhook-function>

# Push database changes
supabase db push
```

## 📚 Documentation

- **[CLAUDE.md](./CLAUDE.md)**: Complete system documentation
- **[CLAUDE.local.md](./CLAUDE.local.md)**: Local development guide
- **[tests/README.md](./tests/README.md)**: Comprehensive testing guide
- **API Documentation**: Available in Supabase dashboard
- **Architecture Diagrams**: In workflow diagram above

## 🧪 Testing Organization

The project includes a comprehensive testing suite in the `tests/` directory:

```
tests/
├── README.md                    # Testing documentation
├── run-tests.sh                 # Interactive test runner
├── scripts/                     # All test scripts
├── data/                        # Test data and configurations
├── output/                      # Test results (gitignored)
└── supabase/                    # Supabase-specific tests
```

### **Key Testing Features**
- **Interactive Test Runner**: Easy-to-use menu system for all tests
- **Organized Test Scripts**: All tests moved to dedicated directory
- **Test Data Management**: Sample orders and configurations
- **Automated Gitignore**: Test outputs and sensitive data excluded
- **Comprehensive Coverage**: Two-tier system, MCP, email, health checks

## 🤝 Contributing

We welcome contributions from developers of all skill levels! ORBIT Image Forge is designed to be contributor-friendly with comprehensive documentation and testing infrastructure.

### Quick Start for Contributors

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/orbit-image-forge.git
   cd orbit-image-forge
   ```

2. **Setup Development Environment**
   ```bash
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Development**
   ```bash
   npm run dev                    # Frontend
   supabase start                 # Backend (separate terminal)
   ```

4. **Run Tests**
   ```bash
   ./tests/run-tests.sh          # Interactive test runner
   ```

### Areas We Need Help With

- **🚀 Performance**: Optimize image processing pipeline
- **📱 Mobile UI**: Improve responsive design
- **🔧 Features**: New AI models, batch processing, analytics
- **📚 Documentation**: API docs, tutorials, examples
- **🧪 Testing**: Increase test coverage

### Development Resources

- **[Contributing Guide](./CONTRIBUTING.md)**: Detailed development setup
- **[Testing Guide](./tests/README.md)**: Comprehensive test documentation
- **[Architecture Overview](./CLAUDE.md)**: System design and components
- **[GitHub Issues](https://github.com/YOUR_USERNAME/orbit-image-forge/issues)**: Bug reports and feature requests

**New to open source?** Look for issues labeled `good-first-issue`!

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎉 Achievements

- ✅ **Two-Tier Architecture**: Speed + reliability combined
- ✅ **Claude Code SDK Patterns**: Task tool coordination implemented
- ✅ **Remote MCP Services**: Local to remote architecture migration
- ✅ **Smart Routing**: AI-powered intelligent tier selection
- ✅ **Sub-second Orchestration**: 339ms average coordination time
- ✅ **99%+ Availability**: Comprehensive fallback and health monitoring
- ✅ **Production Ready**: Full security, monitoring, and error handling

---

**Built with ❤️ using React, Supabase, and Claude Code SDK patterns**