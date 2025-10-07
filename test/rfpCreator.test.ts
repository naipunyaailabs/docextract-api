import { describe, it, expect } from "bun:test";
import { createStandardRfp } from "../services/rfpCreator";

describe("RFP Creator Service", () => {
  it("should create a standard RFP with default sections", async () => {
    const title = "Software Development Project";
    const organization = "Tech Corp";
    const deadline = "2025-12-31";
    
    const rfpContent = await createStandardRfp(title, organization, deadline);
    
    // Check that the content contains the title
    expect(rfpContent.title).toBe(title);
    
    // Check that the content contains the organization
    expect(rfpContent.organization).toBe(organization);
    
    // Check that the content contains the deadline
    expect(rfpContent.deadline).toBe(deadline);
    
    // Check that the content contains standard sections
    expect(rfpContent.sections.length).toBeGreaterThan(0);
    expect(rfpContent.sections.some(section => section.title.includes("Executive Summary"))).toBe(true);
    expect(rfpContent.sections.some(section => section.title.includes("Project Background"))).toBe(true);
    expect(rfpContent.sections.some(section => section.title.includes("Scope of Work"))).toBe(true);
  }, 15000); // 15 second timeout for AI processing
  
  it("should generate valid structured content", async () => {
    const rfpContent = await createStandardRfp(
      "Test RFP",
      "Test Organization",
      "2025-12-31"
    );
    
    // Basic structure checks
    expect(rfpContent.title).toBe("Test RFP");
    expect(rfpContent.organization).toBe("Test Organization");
    expect(rfpContent.deadline).toBe("2025-12-31");
    expect(Array.isArray(rfpContent.sections)).toBe(true);
    expect(rfpContent.sections.length).toBeGreaterThan(0);
  }, 15000);
});