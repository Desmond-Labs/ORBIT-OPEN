# Test Data Directory

## 📁 Structure

- `sample-images/` - Sample images for testing (committed to repo)
- `test-orders/` - Test order configurations and templates
- `sensitive/` - Sensitive test data (gitignored, never commit)

## 🖼️ Sample Images

Place test images here for consistent testing across the team. Recommended:
- Small file sizes (<2MB for fast testing)
- Various formats (JPEG, PNG, WebP)
- Different content types (lifestyle, product, mixed)

## 📋 Test Orders

JSON templates for creating test orders with various configurations:
- Simple orders (1 image, basic processing)
- Complex orders (multiple images, edge cases)
- Error scenarios (invalid data, missing files)

## 🔒 Sensitive Data

**NEVER COMMIT** files to the `sensitive/` directory. Use for:
- Real customer data (if testing with production copies)
- API keys or tokens in test files
- Personal information or proprietary images

The `sensitive/` directory is automatically gitignored.