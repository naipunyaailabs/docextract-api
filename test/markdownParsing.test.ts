import { describe, it, expect } from "bun:test";
import { parseMarkdownResponse } from "../services/rfpCreator";

describe("Markdown Parsing", () => {
  it("should parse markdown content into sections", () => {
    const markdownContent = `# Test RFP Title

## Executive Summary

This is an enhanced executive summary with detailed content about the project.
It includes multiple lines of professional content.

## Project Background and Objectives

This section provides background information and clearly defined objectives.
The project aims to achieve specific goals and outcomes.

## Scope of Work

The scope includes detailed deliverables and milestones.
- Deliverable 1
- Deliverable 2
- Deliverable 3`;

    const originalSections = [
      { title: "Executive Summary", content: "Original executive summary content" },
      { title: "Project Background and Objectives", content: "Original background content" },
      { title: "Scope of Work", content: "Original scope content" }
    ];

    const parsedSections = parseMarkdownResponse(markdownContent, originalSections);

    expect(parsedSections.length).toBe(3);
    // Check that we preserved the original section titles
    if (parsedSections[0]) {
      expect(parsedSections[0].title).toBe("Executive Summary");
      expect(parsedSections[0].content).toContain("enhanced executive summary");
    }
    if (parsedSections[1]) {
      expect(parsedSections[1].title).toBe("Project Background and Objectives");
      expect(parsedSections[1].content).toContain("background information");
    }
    if (parsedSections[2]) {
      expect(parsedSections[2].title).toBe("Scope of Work");
      expect(parsedSections[2].content).toContain("detailed deliverables");
    }
  });

  it("should fallback to original sections when parsing fails", () => {
    const markdownContent = "Invalid markdown content without proper headings";
    const originalSections = [
      { title: "Executive Summary", content: "Original content" }
    ];

    const parsedSections = parseMarkdownResponse(markdownContent, originalSections);

    expect(parsedSections.length).toBe(1);
    if (parsedSections[0]) {
      expect(parsedSections[0].title).toBe("Executive Summary");
      expect(parsedSections[0].content).toBe("Original content");
    }
  });
  
  it("should handle empty or malformed markdown", () => {
    const markdownContent = "";
    const originalSections = [
      { title: "Executive Summary", content: "Original content" }
    ];

    const parsedSections = parseMarkdownResponse(markdownContent, originalSections);

    expect(parsedSections.length).toBe(1);
    if (parsedSections[0]) {
      expect(parsedSections[0].title).toBe("Executive Summary");
      expect(parsedSections[0].content).toBe("Original content");
    }
  });
});