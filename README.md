# Advanced Exam Application

A comprehensive, production-ready exam platform built with Next.js 15, React 19, and Supabase. Features a light-only minimal UI, complete admin management system, WhatsApp integration, and robust student exam flow with Arabic/English localization support.

## Key Features

### 🎯 Core Functionality
- **Secure Exam Delivery**: Multiple access methods (open, code-based, IP-restricted)
- **Enhanced Device Tracking**: Comprehensive device information collection with WebRTC IP discovery
- **Advanced Score Calculation**: Centralized calculation engine with weighted components
- **Real-time Monitoring**: Live tracking of exam attempts and submissions
- **Multi-language Support**: Full Arabic and English localization with RTL layout
- **Comprehensive Analytics**: Detailed score breakdowns and performance metrics

### 📊 Score Calculation System
- **Centralized Engine**: Single source of truth for all score calculations
- **Weighted Components**: Flexible exam and extra field weighting
- **Batch Processing**: Efficient bulk calculations for large student populations
- **Performance Optimized**: 50%+ faster than legacy systems with intelligent caching
- **Property-Based Testing**: 22+ correctness properties ensure calculation accuracy

### 🔒 Enhanced Device Tracking
- **WebRTC IP Discovery**: Captures actual device local IP addresses (not router IPs)
- **User-Agent Client Hints**: Accurate device model and platform information
- **Hardware Detection**: CPU, RAM, screen, GPU, and touch capability
- **Security Indicators**: Automation detection and risk scoring
- **Canvas Fingerprinting**: Device identification across exam attempts
- **Optional APIs**: Geolocation, network info, and battery status
- **Browser Compatibility**: Works across Chrome, Firefox, Safari, and mobile browsers

### 🔧 Administrative Tools
- **Complete Exam Management**: Create, edit, duplicate, publish, and archive exams
- **Student Management**: Global student registry with bulk import/export
- **Results Analytics**: Comprehensive scoring with detailed breakdowns
- **Audit Logging**: Complete activity trail for security and compliance
- **WhatsApp Integration**: Automated code delivery with customizable templates

### 🌐 Technical Architecture
- **Next.js 15** with App Router and React 19
- **Supabase** backend with PostgreSQL and real-time subscriptions
- **TypeScript** throughout for type safety
- **Tailwind CSS** for responsive, accessible design
- **Property-Based Testing** for mathematical correctness
- **Materialized Views** and caching for optimal performance

## Documentation

### Core Documentation
- **[Enhanced Device Tracking](ENHANCED_DEVICE_TRACKING.md)** - Complete device tracking documentation
- **[Score Calculation Architecture](SCORE_CALCULATION_ARCHITECTURE.md)** - Technical overview of the calculation system
- **[API Changes Documentation](API_CHANGES_DOCUMENTATION.md)** - Complete API reference with examples
- **[Migration Guide](SCORE_CALCULATION_MIGRATION_GUIDE.md)** - Migration from legacy systems

### Additional Resources
- **[Breaking Changes](BREAKING_CHANGES.md)** - Important changes and compatibility notes
- **[Project Summary](PROJECT_SUMMARY.md)** - High-level project overview
- **[Roadmap](ROADMAP.md)** - Future development plans

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database (via Supabase)
- Environment variables configured

### Installation
```bash
# Install dependencies
npm ci --legacy-peer-deps

# Set up environment
cp .env.example .env.local
# Configure your Supabase credentials

# Initialize database
npm run setup:database
npm run setup:storage

# Start development server
npm run dev
```

### Database Setup
```bash
# Run database migrations
npm run setup:database

# Set up storage buckets
npm run setup:storage

# Create admin user
npm run create:admin
```

## Score Calculation System

The application features a sophisticated score calculation system that combines exam scores and extra field scores using configurable weights and calculation modes.

### Key Features
- **Weighted Components**: Separate exam and extra field components with configurable weights
- **Multiple Calculation Modes**: Best score or average score for exam components
- **Flexible Extra Fields**: Support for number, text, and boolean field types with custom scoring
- **Performance Optimized**: Batch processing and caching for large datasets
- **Comprehensive Testing**: Property-based tests ensure mathematical correctness

### Calculation Formula
```
Final Score = (Exam Component × Exam Weight + Extra Component × Extra Weight) / Total Weight
```

Where:
- **Exam Component**: Best or average of included exam scores
- **Extra Component**: Weighted combination of normalized extra field scores
- **Weights**: Configurable per component and field

### API Endpoints
- `GET /api/admin/summaries` - Bulk student score calculations
- `GET /api/public/summary` - Individual student score lookup
- `GET /api/admin/summaries/export` - CSV export with detailed breakdowns
- `GET /api/admin/summaries/export-xlsx` - Excel export with metadata

## Performance

### Benchmarks
- **50%+ faster** than legacy calculation systems
- **Single database query** for bulk operations (vs N+1 queries)
- **Intelligent caching** with 85%+ hit rates
- **Constant memory usage** regardless of dataset size

### Optimization Features
- Materialized database views for aggregated data
- Batch processing with configurable batch sizes
- Automatic cache invalidation on data changes
- Optimized indexes for frequently queried data

## Testing

### Comprehensive Test Suite
- **Unit Tests**: 100% coverage for core calculation engine and device tracking
- **Property-Based Tests**: 48+ properties ensuring mathematical correctness and device tracking accuracy
- **Integration Tests**: End-to-end API and workflow testing
- **Performance Tests**: Benchmarks for various dataset sizes

### Key Properties Tested
- Calculation determinism (same input → same output)
- Score range validation (all scores ∈ [0, 100])
- Device info collection completeness and structure
- WebRTC IP discovery timeout and fallback behavior
- Backward compatibility with legacy data formats
- Export format consistency

## Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make changes with appropriate tests
4. Run the full test suite
5. Submit a pull request

### Code Standards
- TypeScript strict mode
- ESLint configuration enforced
- Property-based tests for mathematical functions
- Comprehensive error handling

## License

This project is proprietary software. All rights reserved.

## Support

For technical support or questions:
- Review the comprehensive documentation
- Check the test suite for expected behavior
- Consult the troubleshooting guides
- Contact the development team

