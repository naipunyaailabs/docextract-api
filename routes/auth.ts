import { createErrorResponse, createSuccessResponse } from "../utils/errorHandler";
import userService from "../services/userService";
import sessionService from "../services/sessionService";
import DatabaseService from "../services/database";
import EmailService from "../services/emailService";
// @ts-ignore
import bcrypt from "bcryptjs";
import { z } from "zod";

// Validations
const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  designation: z.string().optional(),
  companyName: z.string().optional(),
  useCase: z.string().optional(),
  agreedToTerms: z.boolean().refine(val => val === true, "You must agree to terms"),
  subscribedToNewsletter: z.boolean().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const requestResetSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  userId: z.string(),
  secret: z.string(),
  password: z.string().min(8, "Password must be at least 8 characters")
});

// Connect to database
DatabaseService.connect().catch(err => {
  console.error("Failed to connect to database:", err);
});

// Use a modern password hashing approach
const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Helper function to generate verification token
function generateVerificationToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function authHandler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (req.method === "POST" && path === "register") {
      return await registerHandler(req);
    } else if (req.method === "POST" && path === "login") {
      return await loginHandler(req);
    } else if (req.method === "POST" && path === "logout") {
      return await logoutHandler(req);
    } else if (req.method === "GET" && path === "profile") {
      return await profileHandler(req);
    } else if (req.method === "GET" && path === "verify") {
      return await verifyEmailHandler(req);
    } else if (req.method === "POST" && path === "resend-verification") {
      return await resendVerificationHandler(req);
    } else if (req.method === "POST" && path === "request-password-reset") {
      return await requestPasswordResetHandler(req);
    } else if (req.method === "POST" && path === "reset-password") {
      return await resetPasswordHandler(req);
    } else {
      return createErrorResponse("Not Found", 404);
    }
  } catch (error) {
    console.error("[Auth Handler Error]:", error);
    return createErrorResponse("Internal server error", 500);
  }
}

async function registerHandler(req: Request): Promise<Response> {
  try {
    const body: any = await req.json();

    // Validate Input with Zod
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      // @ts-ignore
      return createErrorResponse(validation.error.errors[0].message, 400);
    }

    const { name, email, password, designation, companyName, useCase, subscribedToNewsletter } = validation.data;

    // Check if user already exists
    const existingUser = await userService.findUserByEmail(email);
    if (existingUser) {
      return createErrorResponse("User with this email already exists", 409);
    }

    // Create user
    const userId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const hashedPassword = await hashPassword(password);

    // Generate email verification token
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await userService.createUser({
      userId,
      name,
      email,
      password: hashedPassword,
      role: "user",
      lastLoginAt: new Date(),
      preferences: JSON.stringify({}),
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpiry: verificationTokenExpiry,
      createdAt: new Date(),
      designation: designation || null,
      companyName: companyName || null,
      useCase: useCase || null,
      subscribedToNewsletter: subscribedToNewsletter || false,
      agreedToTermsAt: new Date()
    });

    if (!user) {
      return createErrorResponse("Failed to create user", 500);
    }

    // Send verification email
    const emailSent = await EmailService.sendVerificationEmail(email, verificationToken);
    if (!emailSent) {
      console.warn("Failed to send verification email to:", email);
    }

    // Create session (user can login even before verifying email, but with limited access)
    const token = await sessionService.createSession(userId);

    const response = {
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
        preferences: user.preferences,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        designation: user.designation,
        companyName: user.companyName,
        useCase: user.useCase,
        subscribedToNewsletter: user.subscribedToNewsletter,
        agreedToTermsAt: user.agreedToTermsAt
      },
      message: "User registered successfully. Please check your email for verification."
    };

    return createSuccessResponse(response, 201);
  } catch (error) {
    console.error("[Register Handler Error]:", error);
    return createErrorResponse("Failed to register user", 500);
  }
}

async function loginHandler(req: Request): Promise<Response> {
  try {
    const body: any = await req.json();

    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse("Invalid email or password", 400);
    }

    const { email, password } = validation.data;

    // Find user
    const user = await userService.findUserByEmail(email);
    if (!user) {
      return createErrorResponse("Invalid email or password", 401);
    }

    // Validate password
    const passwordValid = await verifyPassword(password, user.password);
    if (!passwordValid) {
      return createErrorResponse("Invalid email or password", 401);
    }

    // Check if email is verified (optional: you might want to allow login but limit features)
    if (!user.emailVerified) {
      return createErrorResponse("Please verify your email address before logging in", 403);
    }

    // Update last login
    await userService.updateUserLastLogin(user.userId);

    // Create session
    const token = await sessionService.createSession(user.userId);

    const response = {
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
        preferences: user.preferences,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        designation: user.designation,
        companyName: user.companyName,
        useCase: user.useCase,
        subscribedToNewsletter: user.subscribedToNewsletter,
        agreedToTermsAt: user.agreedToTermsAt
      }
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error("[Login Handler Error]:", error);
    return createErrorResponse("Failed to login", 500);
  }
}

async function logoutHandler(req: Request): Promise<Response> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return createErrorResponse("Unauthorized", 401);
    }

    const token = authHeader.substring(7);
    // Invalidate session
    await sessionService.invalidateSession(token);

    return createSuccessResponse({ message: "Logged out successfully" });
  } catch (error) {
    console.error("[Logout Handler Error]:", error);
    return createErrorResponse("Failed to logout", 500);
  }
}

async function profileHandler(req: Request): Promise<Response> {
  try {
    // Get user from session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return createErrorResponse("Unauthorized", 401);
    }

    const token = authHeader.substring(7);
    const userId = await sessionService.getUserIdFromToken(token);
    if (!userId) {
      return createErrorResponse("Invalid session", 401);
    }

    const user = await userService.findUserById(userId);
    if (!user) {
      return createErrorResponse("User not found", 404);
    }

    const response = {
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
      preferences: user.preferences,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      designation: user.designation,
      companyName: user.companyName,
      useCase: user.useCase,
      subscribedToNewsletter: user.subscribedToNewsletter,
      agreedToTermsAt: user.agreedToTermsAt
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error("[Profile Handler Error]:", error);
    return createErrorResponse("Failed to get profile", 500);
  }
}

async function verifyEmailHandler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return createErrorResponse("Verification token is required", 400);
    }

    // Find user with this verification token
    const user = await userService.findUserByVerificationToken(token);
    if (!user) {
      return createErrorResponse("Invalid or expired verification token", 400);
    }

    // Check if token is expired
    if (user.emailVerificationTokenExpiry && user.emailVerificationTokenExpiry < new Date()) {
      return createErrorResponse("Verification token has expired", 400);
    }

    // Update user as verified
    const updatedUser = await userService.updateUser(user.userId, {
      emailVerified: true,
      emailVerificationToken: undefined,
      emailVerificationTokenExpiry: undefined
    });

    if (!updatedUser) {
      return createErrorResponse("Failed to verify email", 500);
    }

    return createSuccessResponse({
      message: "Email verified successfully. You can now login to your account."
    });
  } catch (error) {
    console.error("[Verify Email Handler Error]:", error);
    return createErrorResponse("Failed to verify email", 500);
  }
}

async function resendVerificationHandler(req: Request): Promise<Response> {
  try {
    const body: any = await req.json();
    const { email } = body;

    if (!email) {
      return createErrorResponse("Email is required", 400);
    }

    // Find user
    const user = await userService.findUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return createSuccessResponse({
        message: "If an account exists with this email, a verification email has been sent."
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return createErrorResponse("Email is already verified", 400);
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new token
    const updatedUser = await userService.updateUser(user.userId, {
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpiry: verificationTokenExpiry
    });

    if (!updatedUser) {
      return createErrorResponse("Failed to resend verification email", 500);
    }

    // Send verification email
    const emailSent = await EmailService.sendVerificationEmail(email, verificationToken);
    if (!emailSent) {
      console.warn("Failed to send verification email to:", email);
    }

    return createSuccessResponse({
      message: "Verification email sent successfully."
    });
  } catch (error) {
    console.error("[Resend Verification Handler Error]:", error);
    return createErrorResponse("Failed to resend verification email", 500);
  }
}

async function requestPasswordResetHandler(req: Request): Promise<Response> {
  try {
    const body: any = await req.json();
    const validation = requestResetSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse("Invalid email format", 400);
    }

    const { email } = validation.data;

    // Find user
    const user = await userService.findUserByEmail(email);
    if (!user) {
      // Don't reveal user existence for security
      return createSuccessResponse({
        message: "If an account exists with this email, a password reset link has been sent."
      });
    }

    // Generate reset token
    const resetToken = generateVerificationToken(); // We can reuse the same token generator
    const resetTokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    // Update user with reset token
    await userService.updateUser(user.userId, {
      resetPasswordToken: resetToken,
      resetPasswordTokenExpiry: resetTokenExpiry
    });

    // Send reset email
    const emailSent = await EmailService.sendPasswordResetEmail(email, user.userId, resetToken);
    if (!emailSent) {
      console.warn("Failed to send password reset email to:", email);
    }

    return createSuccessResponse({
      message: "If an account exists with this email, a password reset link has been sent."
    });
  } catch (error) {
    console.error("[Request Password Reset Handler Error]:", error);
    return createErrorResponse("Failed to request password reset", 500);
  }
}

async function resetPasswordHandler(req: Request): Promise<Response> {
  try {
    const body: any = await req.json();
    const validation = resetPasswordSchema.safeParse(body);
    if (!validation.success) {
      // @ts-ignore
      return createErrorResponse(validation.error.errors[0].message, 400);
    }

    const { userId, secret, password } = validation.data;

    // Find user by reset token
    const user = await userService.findUserByResetToken(userId, secret);
    if (!user) {
      return createErrorResponse("Invalid or expired reset token", 400);
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update user password and clear reset token
    const updatedUser = await userService.updateUser(user.userId, {
      password: hashedPassword,
      resetPasswordToken: undefined,
      resetPasswordTokenExpiry: undefined
    });

    if (!updatedUser) {
      return createErrorResponse("Failed to reset password", 500);
    }

    return createSuccessResponse({
      message: "Password has been reset successfully. You can now login with your new password."
    });
  } catch (error) {
    console.error("[Reset Password Handler Error]:", error);
    return createErrorResponse("Failed to reset password", 500);
  }
}