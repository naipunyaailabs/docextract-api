# FormData Processing Fixes

## Issue Description
The application was experiencing FormData parsing errors with messages like:
- "FormData parse error missing final boundary"
- "Can't decode form data from body because of incorrect MIME type/boundary"

## Root Cause
The issues were caused by:

1. **Type incompatibility** between different FormData implementations (Bun vs undici-types)
2. **Multiple consumption** of the request body
3. **Incorrect MIME type/boundary** in FormData requests

## Fixes Applied

### 1. Type Compatibility Resolution
Replaced strict type checking with runtime type checking to avoid conflicts:

```typescript
// Before (causing type errors):
const formData = await req.formData();
const documentEntry = formData.get("document");
if (documentEntry instanceof File) {
  file = documentEntry;
}

// After (type-compatible):
const formData: any = await req.formData();
const documentEntry = formData.get("document");
if (documentEntry && typeof documentEntry === 'object' && documentEntry.constructor.name === 'File') {
  file = documentEntry;
}
```

### 2. Enhanced Error Handling
Added comprehensive error handling with detailed logging:

```typescript
try {
  const formData: any = await req.formData();
  // ... processing
} catch (e) {
  console.error("[Handler FormData Error]:", e);
  return createErrorResponse("Invalid form data: " + (e as Error).message, 400);
}
```

### 3. Body Consumption Checks
Added checks to prevent multiple consumption of request body:

```typescript
if (req.bodyUsed) {
  return createErrorResponse("Request body has already been consumed", 400);
}
```

### 4. Files Modified
- `docapture-api/routes/extract.ts` - Updated FormData handling and error handling
- `docapture-api/routes/summarize.ts` - Updated FormData handling and error handling
- `docapture-api/routes/upload.ts` - Updated FormData handling and error handling
- `docapture-api/routes/agui.ts` - Updated FormData handling and error handling

## Testing Approach
To test these fixes:

1. Ensure FormData is sent with correct MIME type and boundary
2. Verify that each request body is only consumed once
3. Check that File objects are properly identified using runtime type checking
4. Monitor logs for any FormData parsing errors

## Prevention
To prevent similar issues in the future:

1. Always use runtime type checking for FormData entries instead of strict instanceof checks
2. Check `req.bodyUsed` before attempting to parse FormData
3. Handle FormData parsing errors gracefully with detailed error messages
4. Log content-type headers for debugging purposes
5. Use consistent FormData handling across all routes