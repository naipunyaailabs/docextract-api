import mongoose from 'mongoose';
import Service from '../models/Service';

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/docapture';
mongoose.connect(mongoUri);

const documentServices = [
  {
    id: "field-extractor",
    slug: "field-extractor",
    name: "Field Extractor",
    description: "Extract structured data from documents",
    longDescription: "Extract key-value pairs, tables, and structured information from various document types including PDFs, images, and documents. Uses advanced AI to identify and extract relevant data fields.",
    endpoint: "/extract",
    supportedFormats: ["json", "excel"],
    supportedFileTypes: [".pdf", ".jpg", ".jpeg", ".png", ".docx", ".doc", ".txt"],
    icon: "FileSearch",
    category: "Data Extraction",
    fileFieldName: "document",
    isActive: true
  },
  {
    id: "document-summarizer",
    slug: "document-summarizer",
    name: "Document Summarizer",
    description: "Generate concise summaries of documents",
    longDescription: "Create accurate and concise summaries of long documents, extracting key points and main ideas. Perfect for quickly understanding large documents or reports.",
    endpoint: "/summarize",
    supportedFormats: ["text", "json"],
    supportedFileTypes: [".pdf", ".docx", ".doc", ".txt"],
    icon: "FileText",
    category: "Document Processing",
    fileFieldName: "document",
    isActive: true
  },
  {
    id: "rfp-creator",
    slug: "rfp-creator",
    name: "RFP Creator",
    description: "Generate professional RFP documents",
    longDescription: "Create comprehensive Request for Proposal (RFP) documents with customizable sections, requirements, and formatting. Save time on proposal development with AI-assisted RFP generation.",
    endpoint: "/create-rfp",
    supportedFormats: ["docx"],
    supportedFileTypes: [".txt", ".json"],
    icon: "FilePlus",
    category: "Document Creation",
    fileFieldName: "data",
    isActive: true
  },
  {
    id: "rfp-summarizer",
    slug: "rfp-summarizer",
    name: "RFP Summarizer",
    description: "Summarize RFP documents for quick review",
    longDescription: "Extract key requirements, deadlines, and important information from RFP documents. Get a structured overview of RFP content to quickly understand submission requirements.",
    endpoint: "/summarize-rfp",
    supportedFormats: ["json", "text"],
    supportedFileTypes: [".pdf", ".docx"],
    icon: "FileBarChart",
    category: "Document Processing",
    fileFieldName: "document",
    isActive: true
  },
  {
    id: "template-uploader",
    slug: "template-uploader",
    name: "Template Uploader",
    description: "Upload and store document templates",
    longDescription: "Upload document templates for reuse in field extraction. Store templates with predefined field configurations for consistent data extraction across similar documents.",
    endpoint: "/upload",
    supportedFormats: ["json"],
    supportedFileTypes: [".pdf", ".jpg", ".jpeg", ".png", ".docx", ".doc", ".txt"],
    icon: "Upload",
    category: "Template Management",
    fileFieldName: "document",
    isActive: true
  }
];

async function addDocumentServices() {
  try {
    console.log('Adding document processing services...');
    
    for (const serviceData of documentServices) {
      // Check if service already exists
      const existingService = await Service.findOne({ id: serviceData.id });
      if (existingService) {
        console.log(`Service ${serviceData.name} already exists, updating...`);
        await Service.updateOne({ id: serviceData.id }, serviceData);
      } else {
        console.log(`Creating service: ${serviceData.name}`);
        await Service.create(serviceData);
      }
    }
    
    console.log('Document processing services added successfully!');
    
    // List all services
    const allServices = await Service.find();
    console.log(`\nTotal services in database: ${allServices.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding document services:', error);
    process.exit(1);
  }
}

addDocumentServices();