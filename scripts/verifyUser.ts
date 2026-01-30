
import DatabaseService from "../services/database";
import User from "../models/User";
import { disconnect } from "mongoose";

async function verifyUser() {
    try {
        await DatabaseService.connect();
        console.log("Connected to DB");

        const email = "test@acmecorp.com";
        const user = await User.findOne({ email });

        if (!user) {
            console.log("User not found: " + email);
            process.exit(1);
        }

        user.emailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationTokenExpiry = undefined;
        await user.save();

        console.log(`User ${email} verified successfully.`);
    } catch (err) {
        console.error(err);
    } finally {
        await disconnect();
        process.exit(0);
    }
}

verifyUser();
