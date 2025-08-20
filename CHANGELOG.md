# Changelog

All notable changes to ORBIT Image Forge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Open source preparation with MIT License
- Comprehensive contributing guidelines
- GitHub issue and PR templates
- Enhanced README for open source community

## [2.0.0] - 2024-08-20

### Added
- **Two-Tier Processing Architecture**: Revolutionary processing system combining speed with reliability
- **Tier 1 Fast Path**: Sub-6 second processing for standard orders
- **Tier 2 Claude Code SDK Orchestrator**: 13-15 second comprehensive processing with self-healing
- **Smart Router**: Intelligent routing system with 7 escalation triggers
- **Comprehensive Test Suite**: Organized testing infrastructure with interactive runner
- **Enhanced Error Handling**: 7-category error classification with intelligent retry logic
- **Performance Monitoring**: Real-time health checks and system assessment

### Changed
- **Architecture**: Migrated from single processing path to intelligent two-tier system
- **Processing Flow**: Enhanced with pre-flight validation and atomic processing
- **Error Recovery**: Self-healing capabilities with automatic tier escalation
- **Documentation**: Complete system documentation with workflow diagrams
- **Testing**: Organized test files into proper directory structure

### Security
- **Function Protection**: All Edge Functions use `SET search_path = public`
- **Enhanced RLS**: Comprehensive Row Level Security policies
- **Token Validation**: Improved security with usage limits and audit trails

## [1.5.0] - 2024-08-18

### Added
- **Remote MCP Architecture**: Migrated from local to remote MCP servers
- **Google Gemini Integration**: Real AI analysis replacing placeholder code
- **Enhanced Metadata Processing**: Professional XMP embedding with multiple output formats
- **Thumbnail Generation**: Multiple sizes (150px, 300px, 600px) with web optimization
- **Professional Reports**: Technical summaries and marketing briefs

### Changed
- **AI Analysis**: From placeholder to real Google Gemini API integration
- **File Processing**: PNG-to-JPEG conversion for XMP compatibility
- **Output Formats**: 9 files generated vs 3 in previous version
- **Performance**: 6.9 second processing time for complete workflow

### Fixed
- **Base64 Encoding**: Resolved stack overflow issues with large images
- **Storage Integration**: Fixed file path processing in Edge Function environment
- **Response Parsing**: Proper MCP JSON-RPC 2.0 response handling

## [1.0.0] - 2024-07-26

### Added
- **Initial Release**: AI-powered image processing platform
- **Frontend**: React + TypeScript + Tailwind CSS interface
- **Backend**: Supabase Edge Functions with PostgreSQL database
- **Authentication**: Google OAuth integration with Supabase Auth
- **Payment Processing**: Stripe integration with webhook handling
- **Email System**: Resend API integration with secure token access
- **Storage**: Supabase Storage with organized bucket structure
- **Basic AI Analysis**: Placeholder AI analysis system
- **Metadata Embedding**: Basic XMP metadata generation

### Security
- **Row Level Security**: Comprehensive RLS policies on all tables
- **Token-Based Access**: Secure email access with expiration limits
- **Input Validation**: File type and size validation
- **CORS Protection**: Proper headers and origin validation

---

## Legend

- **Added**: New features
- **Changed**: Changes in existing functionality  
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements