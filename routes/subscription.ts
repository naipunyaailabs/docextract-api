
import { createErrorResponse, createSuccessResponse } from "../utils/errorHandler";
import { authenticateRequest } from "../utils/auth";
import sessionService from "../services/sessionService";
import userService from "../services/userService";
// No config needed for now, or import specific constants
import { NODE_ENV } from "../utils/config";

// Mock subscription plans - ideally this should be in a database or config
const PLANS: Record<string, { id: string; name: string; limit: number }> = {
    trial: { id: "trial", name: "Trial", limit: 5 },
    basic: { id: "basic", name: "Basic", limit: 100 },
    pro: { id: "pro", name: "Pro", limit: 500 },
    enterprise: { id: "enterprise", name: "Enterprise", limit: -1 }
};

export async function subscriptionHandler(req: Request): Promise<Response> {
    try {
        // Apply authentication
        const authError = await authenticateRequest(req);
        if (authError) return authError;

        const url = new URL(req.url);
        const path = url.pathname.split("/").pop(); // e.g., "usage", "current", "increment"

        if (req.method === "GET" && path === "usage") {
            return await getUsageStatus(req);
        } else if (req.method === "GET" && path === "current") {
            return await getUserSubscription(req);
        } else if (req.method === "POST" && path === "increment") {
            return await incrementUsage(req);
        } else {
            return createErrorResponse("Not Found", 404);
        }
    } catch (error) {
        console.error("[Subscription Handler Error]:", error);
        return createErrorResponse("Internal server error", 500);
    }
}

async function getUsageStatus(req: Request): Promise<Response> {
    try {
        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.substring(7) || "";
        const userId = await sessionService.getUserIdFromToken(token);

        if (!userId) return createErrorResponse("Unauthorized", 401);

        const user = await userService.findUserById(userId);
        if (!user) return createErrorResponse("User not found", 404);

        // Ensure defaults if fields are missing (for existing users)
        const documentsUsed = user.documentsUsed || 0;
        const planId = user.planId || "trial";
        const plan = PLANS[planId as keyof typeof PLANS] || PLANS.trial;

        if (!plan) {
            return createErrorResponse("Invalid plan configuration", 500);
        }

        const canProcess = plan.limit === -1 || documentsUsed < plan.limit;

        return createSuccessResponse({
            canProcess,
            documentsUsed,
            documentsLimit: plan.limit,
            planId: plan.id,
            planName: plan.name,
            message: canProcess ? "You can process documents." : "Limit reached."
        });
    } catch (error) {
        console.error("Failed to fetch usage status:", error);
        return createErrorResponse("Failed to fetch usage status", 500);
    }
}

async function getUserSubscription(req: Request): Promise<Response> {
    try {
        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.substring(7) || "";
        const userId = await sessionService.getUserIdFromToken(token);

        if (!userId) return createErrorResponse("Unauthorized", 401);

        const user = await userService.findUserById(userId);
        if (!user) return createErrorResponse("User not found", 404);

        const planId = user.planId || "trial";
        const plan = PLANS[planId as keyof typeof PLANS] || PLANS.trial;

        if (!plan) {
            return createErrorResponse("Invalid plan configuration", 500);
        }

        return createSuccessResponse({
            id: `sub_${userId.substring(0, 8)}`,
            userId: user.userId,
            planId: planId,
            documentsUsed: user.documentsUsed || 0,
            currentPeriodStart: new Date().toISOString(),
            status: "active"
        });
    } catch (error) {
        return createErrorResponse("Failed to fetch subscription", 500);
    }
}

async function incrementUsage(req: Request): Promise<Response> {
    try {
        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.substring(7) || "";
        const userId = await sessionService.getUserIdFromToken(token);

        if (!userId) return createErrorResponse("Unauthorized", 401);

        const user = await userService.findUserById(userId);
        if (!user) return createErrorResponse("User not found", 404);

        const currentUsage = user.documentsUsed || 0;
        const planId = user.planId || "trial";
        const plan = PLANS[planId as keyof typeof PLANS] || PLANS.trial;

        if (!plan) {
            return createErrorResponse("Invalid plan configuration", 500);
        }

        if (plan.limit !== -1 && currentUsage >= plan.limit) {
            return createErrorResponse("Usage limit reached. Please upgrade your plan.", 403);
        }

        const updatedUser = await userService.updateUser(userId, {
            documentsUsed: currentUsage + 1
        });

        if (!updatedUser) {
            return createErrorResponse("Failed to update usage", 500);
        }

        return createSuccessResponse({
            message: "Usage incremented",
            documentsUsed: updatedUser.documentsUsed
        });
    } catch (error) {
        console.error("Error incrementing usage:", error);
        return createErrorResponse("Internal server error", 500);
    }
}
