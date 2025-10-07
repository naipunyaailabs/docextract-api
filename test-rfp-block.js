const { createRfpWordDocumentFromBlock } = require('./services/rfpCreator');

async function testRfpBlock() {
  try {
    // Example RFP content as a single block
    const rfpContent = {
      title: 'Website Development',
      organization: 'Zoho Corp',
      deadline: '2025-09-26',
      content: `## Executive Summary

Zoho Corp is seeking a qualified vendor to design, develop, and deploy a new website that showcases our company's products and services, enhances user experience, and aligns with our strategic goals. The purpose of this Request for Proposal (RFP) is to solicit proposals from qualified vendors to provide website development services. The expected outcomes of this project include a modern, responsive, and secure website that meets our business needs, improves customer engagement, and supports our marketing efforts.

The business need for this project arises from our current website's limitations in terms of functionality, user experience, and scalability. A new website will enable us to effectively communicate our brand message, provide a seamless user experience, and stay competitive in the market. Responding vendors are expected to provide a comprehensive solution that meets our technical, functional, and business requirements.

## Project Background and Objectives

Zoho Corp is a leading software company that offers a range of cloud-based business applications. Our current website was launched several years ago and has become outdated in terms of design, functionality, and user experience. The website is not optimized for mobile devices, and its content management system is no longer supported by the vendor.

The objectives of this project are to:

* Design and develop a modern, responsive, and secure website that showcases our products and services
* Enhance user experience and engagement through intuitive navigation, clear content, and interactive features
* Improve search engine optimization (SEO) and online visibility
* Integrate with our existing marketing automation and customer relationship management (CRM) systems
* Ensure scalability, flexibility, and ease of maintenance

The success criteria for this project include:

* A visually appealing and user-friendly website that meets our brand guidelines
* Improved website traffic, engagement, and conversion rates
* Seamless integration with our existing systems and tools
* Timely delivery and deployment of the website

## Scope of Work

The scope of work for this project includes:

* Design and development of a modern, responsive, and user-friendly website
* Development of a content management system (CMS)
* Integration with existing systems and third-party services
* Testing and quality assurance
* Deployment and launch
* Training and support

The deliverables for this project include:

* A fully functional and tested website
* A content management system
* Comprehensive documentation and training materials
* A project plan and timeline

The following technical specifications and performance requirements must be met:

* The website must be built using a modern web development framework (e.g., React, Angular, Vue.js)
* The website must be responsive and provide a seamless user experience across different devices and browsers
* The website must be optimized for search engines and meet accessibility standards
* The content management system must be user-friendly and enable easy content updates and management

The following items are excluded from the project scope:

* Ongoing website maintenance and updates
* Content creation and strategy
* Digital marketing and promotion

## Technical Requirements

The technical requirements for this project include:

* Content management system (CMS) that is scalable, flexible, and easy to use
* Responsive design that adapts to different devices and screen sizes
* Compatibility with major browsers and operating systems
* Secure socket layer (SSL) encryption and HTTPS protocol
* Integration with our existing marketing automation and CRM systems using APIs and web services
* Compliance with web accessibility standards (WCAG 2.1)

The existing systems that need to be integrated with the new website include:

* Marketing automation system (Marketo)
* Customer relationship management (CRM) system (Salesforce)

## Submission Requirements

The submission requirements for this RFP include:

* Proposal format: PDF or Microsoft Word document
* Proposal content: detailed description of the vendor's approach, methodology, and technical solution; team composition and qualifications; project timeline and milestones; pricing and payment terms
* Proposal structure: introduction, technical approach, project plan, team composition, pricing and payment terms, conclusion
* Documentation: vendors must provide a comprehensive documentation of their proposal, including all assumptions, dependencies, and risks

The submission deadline for this RFP is:
2025-09-26

Proposals must be submitted electronically to:
[Insert contact email or online submission portal]

Vendors may be required to provide a presentation or demonstration of their proposal to our evaluation team.

## Evaluation Criteria and Scoring

The evaluation criteria for this RFP include:

* Technical approach and methodology (30%)
* Team composition and qualifications (20%)
* Project timeline and milestones (15%)
* Pricing and payment terms (20%)
* Presentation and demonstration (15%)

Proposals will be scored and ranked based on the evaluation criteria. The evaluation process will include:

* Initial review of proposals for completeness and responsiveness
* Technical evaluation of proposals by our evaluation team
* Business evaluation of proposals by our procurement team
* Presentation and demonstration by shortlisted vendors

## Project Timeline and Milestones

The project timeline and milestones for this project include:

* Requirements gathering: 2 weeks
* Design and development: 12 weeks
* Testing and quality assurance: 4 weeks
* Deployment and launch: 2 weeks

The critical path items for this project include:

* Completion of requirements gathering and analysis
* Design and development of the website
* Integration with existing systems and tools
* Testing and quality assurance

## Terms and Conditions

The contractual terms and conditions for this project include:

* Intellectual property rights: Zoho Corp retains all intellectual property rights to the website and its content
* Confidentiality: vendors must maintain confidentiality of all project-related information
* Warranties: vendors must provide a comprehensive warranty for the website and its functionality
* Liability limitations: vendors' liability is limited to the total project value
* Payment terms: payments will be made based on project milestones and deliverables
* Termination conditions: Zoho Corp reserves the right to terminate the contract for cause or convenience

## Budget and Pricing Structure

The available budget range for this project is:
$100,000 - $200,000

Vendors are requested to provide a detailed pricing structure, including:

* Breakdown of costs for different components (design, development, testing, deployment)
* Payment milestones and terms
* Any cost escalation clauses

## Vendor Qualifications and Experience

The required qualifications, experience, and capabilities for responding vendors include:

* Proven experience in website development and design
* Expertise in CMS platforms and responsive design
* Strong technical skills in HTML, CSS, JavaScript, and APIs
* Experience with marketing automation and CRM systems
* Excellent communication and project management skills

The minimum financial threshold for responding vendors is:
$1 million in annual revenue

Vendors must provide:

* A comprehensive overview of their company and experience
* A detailed description of their team composition and qualifications
* A list of relevant references and case studies
* A copy of their business license and certification documents`
    };

    // Generate the Word document
    const buffer = await createRfpWordDocumentFromBlock(rfpContent);
    await Bun.write('test_rfp_block.docx', buffer);
    console.log('RFP document created successfully!');
  } catch (error) {
    console.error('Error creating RFP document:', error);
  }
}

testRfpBlock();