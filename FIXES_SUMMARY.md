# FormData Parse Error Fixes

## Issue Description
The error "FormData parse error missing final boundary" (ERR_FORMDATA_PARSE_ERROR) was occurring when processing requests in the extract handler. This was a follow-up error from trying to fix the "Body already used" error (ERR_BODY_ALREADY_USED).

## Root Cause
The issue was caused by attempting to parse FormData from a request body that had already been consumed or was in an invalid state. This happened when:

1. The request body was being consumed multiple times
2. There was a recursive call pattern that was trying to parse the same FormData twice
3. The FormData was being cloned improperly

## Fixes Applied

### 1. Added bodyUsed checks
Added checks in all handlers to verify if the request body has already been consumed before attempting to parse FormData:

```typescript
// Check if the body has already been used
if (req.bodyUsed) {
  return createErrorResponse("Request body has already been consumed", 400);
}
```

### 2. Enhanced error handling
Improved error handling to provide more detailed error messages:

```typescript
try {
  const formData = await req.formData();
  // ... processing
} catch (e) {
  console.error("[Handler FormData Error]:", e);
  return createErrorResponse("Invalid form data: " + (e as Error).message, 400);
}
```

### 3. Files Modified
- `docapture-api/routes/extract.ts` - Added bodyUsed check and enhanced error handling
- `docapture-api/routes/summarize.ts` - Added bodyUsed check and enhanced error handling
- `docapture-api/routes/upload.ts` - Added bodyUsed check and enhanced error handling
- `docapture-api/routes/agui.ts` - Added bodyUsed check and enhanced error handling

## Prevention
To prevent similar issues in the future:

1. Always check `req.bodyUsed` before attempting to parse FormData
2. Avoid cloning requests unnecessarily
3. Process FormData only once per request
4. Handle FormData parsing errors gracefully with detailed error messages
5. Use direct data extraction in handlers rather than passing FormData between functions

## Testing
After applying these fixes, the FormData parsing should work correctly without the "missing final boundary" error. The handlers will now properly detect when a request body has already been consumed and return appropriate error messages.