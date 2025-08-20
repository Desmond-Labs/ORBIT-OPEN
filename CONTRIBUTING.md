# Contributing to ORBIT Image Forge

Thank you for your interest in contributing to ORBIT Image Forge! This document provides guidelines for contributing to this AI-powered image processing platform.

## 🚀 Quick Start for Contributors

### Prerequisites
- Node.js 18+ and npm
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Git knowledge
- Basic understanding of React, TypeScript, and Edge Functions

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/orbit-image-forge.git
   cd orbit-image-forge
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration (see setup guide below)
   ```

4. **Start Development**
   ```bash
   # Frontend
   npm run dev
   
   # Backend (separate terminal)
   supabase start
   ```

## 🛠️ Development Environment Setup

### Required Services

#### 1. Supabase Setup
- Create account at [supabase.com](https://supabase.com)
- Create new project
- Get your project URL and service role key
- Enable Storage and create `orbit-images` bucket

#### 2. Google Gemini API
- Get API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
- Add to environment variables

#### 3. Stripe (for payments)
- Use test keys from [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)

#### 4. Resend (for emails)
- Get API key from [resend.com](https://resend.com)

### Complete .env Configuration
```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Configuration
GOOGLE_API_KEY=your_gemini_api_key

# Payment Processing
STRIPE_SECRET_KEY=sk_test_your_test_key

# Email Service
RESEND_API_KEY=your_resend_key
FRONTEND_URL=http://localhost:5173
```

## 🏗️ Project Architecture

### Two-Tier Processing System
- **Tier 1**: Fast Path (6s processing)
- **Tier 2**: Claude Code SDK Orchestrator (15s with self-healing)
- **Smart Router**: Intelligent tier selection

### Key Components
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase Edge Functions (Deno)
- **AI Processing**: Google Gemini API
- **Metadata**: XMP embedding with ORBIT schema
- **Storage**: Supabase Storage with organized structure

## 📝 Contributing Guidelines

### Types of Contributions

1. **🐛 Bug Reports**
   - Use GitHub Issues with bug report template
   - Include reproduction steps and environment details
   - Check existing issues first

2. **✨ Feature Requests**
   - Use GitHub Issues with feature request template
   - Explain use case and expected behavior
   - Consider backwards compatibility

3. **📖 Documentation**
   - Improve setup guides, API docs, or code comments
   - Fix typos or unclear explanations
   - Add examples and use cases

4. **🔧 Code Contributions**
   - Bug fixes
   - New features
   - Performance improvements
   - Test coverage improvements

### Development Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Follow existing code style
   - Add tests for new functionality
   - Update documentation if needed

3. **Test Your Changes**
   ```bash
   # Run test suite
   ./tests/run-tests.sh
   
   # Test specific components
   ./tests/run-tests.sh order-id tier1
   ```

4. **Commit Changes**
   ```bash
   git commit -m "feat: add your feature description"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create PR through GitHub interface
   ```

### Code Style Guidelines

#### TypeScript/JavaScript
- Use TypeScript strict mode
- Prefer const over let
- Use meaningful variable names
- Add type annotations for function parameters
- Handle errors explicitly

#### React Components
- Use functional components with hooks
- Keep components small and focused
- Use proper prop typing
- Follow existing naming conventions

#### Edge Functions
- Always use `SET search_path = public` for security
- Implement proper error handling
- Use correlation IDs for tracking
- Follow JSON-RPC 2.0 for MCP servers

### Testing Requirements

- **New Features**: Must include tests
- **Bug Fixes**: Add regression tests
- **API Changes**: Update integration tests
- **Run Full Suite**: `./tests/run-tests.sh all`

### Commit Message Format

Use conventional commits:
```
type(scope): description

feat(storage): add batch upload functionality
fix(auth): resolve token validation issue
docs(readme): update installation instructions
test(mcp): add metadata processing tests
```

## 🧪 Testing Guide

### Test Organization
```
tests/
├── scripts/          # Test execution scripts
├── data/            # Test data and configurations
└── output/          # Test results (gitignored)
```

### Running Tests
```bash
# Interactive test runner (recommended)
./tests/run-tests.sh

# Specific test types
./tests/run-tests.sh order-id two-tier    # Two-tier system
./tests/run-tests.sh order-id tier1       # Fast path only
./tests/run-tests.sh order-id mcp         # MCP servers
./tests/run-tests.sh order-id email       # Email system
./tests/run-tests.sh order-id health      # Health checks
```

### Creating Test Orders
1. Upload images through frontend
2. Complete payment flow
3. Use order ID in tests
4. Check `tests/data/test-orders/` for examples

## 🎯 Areas We Need Help With

### High Priority
- [ ] **Performance Optimization**: Reduce Tier 1 processing time
- [ ] **Mobile UI**: Responsive design improvements  
- [ ] **Error Handling**: Enhanced user feedback
- [ ] **Documentation**: API documentation and examples

### Medium Priority
- [ ] **New AI Models**: Additional analysis providers
- [ ] **Batch Processing**: Multiple order handling
- [ ] **Analytics**: Usage metrics and insights
- [ ] **Security**: Additional audit and hardening

### Good First Issues
- [ ] **UI Polish**: Small design improvements
- [ ] **Test Coverage**: Add unit tests
- [ ] **Documentation**: Fix typos and improve clarity
- [ ] **Examples**: Add usage examples and tutorials

## 🔒 Security Guidelines

### Never Commit
- API keys or secrets
- User data or test data with PII
- `.env` files
- Debug logs with sensitive information

### Security Best Practices
- Use environment variables for all secrets
- Validate all inputs
- Use RLS (Row Level Security) for database
- Implement proper CORS policies
- Regular security audits

## 📋 Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code follows project style guidelines
- [ ] Tests pass locally (`./tests/run-tests.sh`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow convention
- [ ] No sensitive data committed
- [ ] PR description explains changes clearly
- [ ] Breaking changes are noted

## 🤝 Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) Code of Conduct. By participating, you agree to uphold this code.

### Our Standards
- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other contributors

## 📞 Getting Help

- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: General questions and community chat
- **Documentation**: Check README.md and CLAUDE.md first

## 🎉 Recognition

Contributors are recognized in:
- GitHub contributor graph
- Release notes for significant contributions
- Special thanks in project documentation

## 📚 Additional Resources

- [Project README](./README.md) - Complete project overview
- [System Documentation](./CLAUDE.md) - Detailed technical docs  
- [Testing Guide](./tests/README.md) - Comprehensive testing info
- [Two-Tier Architecture](./README.md#-two-tier-architecture) - System design

---

**Happy contributing! 🚀** 

We're excited to see what you'll build with ORBIT Image Forge!