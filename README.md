# DoCaptureAI

## Installation

To install dependencies:

```bash
bun install
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```
GROQ_API_KEY=your_groq_api_key
API_KEY=your_api_key_for_authentication
MONGODB_URI=your_mongodb_connection_string # Optional, defaults to mongodb://localhost:27017/docapture

# SMTP Configuration for email verification
SMTP_HOST=your_smtp_host # e.g., smtp.gmail.com
SMTP_PORT=587 # or 465 for SSL
SMTP_SECURE=false # true for SSL (port 465), false for TLS (port 587)
SMTP_USER=your_smtp_username # e.g., your-email@gmail.com
SMTP_PASS=your_smtp_password # e.g., your-app-password
SMTP_FROM="Docapture" <admin@docapture.com>
FRONTEND_URL=http://localhost:3000 # Frontend URL for email verification links
```

Note: Qdrant and OpenAI are no longer required as we've removed vector storage and template matching features.

## MongoDB Setup

The application uses MongoDB for data persistence. You can either:

1. Install MongoDB locally:
   - Download and install MongoDB from [mongodb.com](https://www.mongodb.com/try/download/community)
   - Start the MongoDB service

2. Use a cloud MongoDB service like MongoDB Atlas:
   - Create a cluster and get the connection string
   - Add the connection string to your `.env` file as `MONGODB_URI`

If MongoDB is not available, the application will fall back to in-memory storage for development purposes.

## Email Verification

The application includes email verification functionality for new user registrations:

1. After registration, users receive a verification email with a link
2. Users must click the link to verify their email address
3. Verified users can then log in to the application
4. Users can request a new verification email if needed

To use email verification:
1. Configure your SMTP settings in the `.env` file
2. Ensure your SMTP server is properly configured to send emails
3. Test the email functionality during development

## Running the Application

To run in production mode:

```bash
bun start
```

To run in development mode with hot reloading:

```bash
bun dev
```

To run directly:

```bash
bun run index.ts
```

## Building for Production

To build the application for production:

```bash
bun build
```

To preview the built application:

```bash
bun preview
```

## Testing

To run tests:

```bash
bun test
```

To run tests in watch mode:

```bash
bun test:watch
```

To run tests with coverage:

```bash
bun test:coverage
```

## Seeding Services

To seed the database with the default services:

```bash
bun run seed:services
```

## API Authentication

All API endpoints require authentication using an API key. Include the API key in the Authorization header:

```
Authorization: Bearer your_api_key
```

For development purposes, if no API_KEY is set in the environment variables, authentication will be disabled.

## API Endpoints

### Authentication

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login with email and password
- `POST /auth/logout` - Logout current session
- `GET /auth/profile` - Get current user profile
- `GET /auth/verify` - Verify email address (requires token query parameter)
- `POST /auth/resend-verification` - Resend verification email

### Services

- `GET /services` - List all available services
- `GET /services/{id}` - Get a specific service by ID or slug

### Document Processing

- `POST /upload` - Upload and store document templates
- `POST /extract` - Extract information from documents
- `POST /summarize` - Summarize document content
- `POST /summarize-rfp` - Summarize RFP documents
- `POST /create-rfp` - Create RFP documents