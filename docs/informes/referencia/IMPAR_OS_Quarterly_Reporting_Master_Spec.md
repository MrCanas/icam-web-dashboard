# IMPAR OS — Quarterly Reporting Workspace
## Master Product Specification & Lovable Build Brief

**Version:** 1.0  
**Date:** 10 September 2026  
**Product:** Impar OS  
**Module:** Quarterly Reporting  
**Primary users:** Project Managers (PMs)  
**Secondary users:** Reviewers, Management, Finance/Legal contributors, Administrators  
**Primary output:** Investor-ready quarterly project report in PDF  
**Secondary/future output:** Editable PPTX  

---

# 1. Purpose of this document

This document is the master product brief for building a new **Quarterly Reporting Workspace** inside **Impar OS**.

The goal is to automate and standardise the creation of quarterly investor reports for real-estate projects while preserving the quality, structure, tone and visual consistency of the reports currently produced manually.

This is not intended to be a generic presentation editor and it is not intended to be a generic AI writing assistant. It must be a purpose-built workflow for Impar Capital’s quarterly project reporting process.

The central product idea is:

> **A new quarterly report should be created by starting from the previous quarter, asking the PM only what has changed, using an LLM to transform those changes into investor-ready narrative, and then allowing the PM to visually review and edit the final report before generating the PDF.**

Historical quarters must remain available. A user must be able to view, duplicate, edit and version previous reports.

The product must reduce repetitive work, minimise stale or contradictory content, maintain strict consistency between quarters, and give PMs full final control over the copy and presentation.

---

# 2. Business context

Impar Capital produces quarterly reports for dozens of real-estate projects. The reports are sent to investors and communicate project progress, milestones, execution status, risks, next steps and other non-financial project information.

The existing reports are highly structured and visually consistent. Different projects use variations of the same overall template and may include additional project-specific slides depending on the asset, investment strategy and stage of development.

Examples reviewed for this specification include reports for:

- Santa Engracia 84
- Glorieta de Quevedo 8
- Sagasta 31–33
- Padre Claret 25
- Costanilla de San Pedro 10
- Velarde 1
- Camino 1 / Palacio Residencial Pakea
- Doctor Cortezo 15
- Singular Prime II

The source material shows a recurring reporting grammar rather than one absolutely fixed deck. That distinction is important for the product architecture.

The app therefore needs:

1. a stable report framework;
2. project-specific modules;
3. repeatable slide types;
4. reusable information carried forward from previous quarters;
5. a controlled amount of visual flexibility;
6. support for exceptional information and custom slides;
7. AI-assisted drafting without factual invention;
8. strong versioning and quality assurance.

---

# 3. Product principles

## 3.1 The PM reports changes, not the whole project again

The system should never force a PM to rebuild a report from scratch every quarter.

The preferred workflow is:

**Previous quarter → duplicate → update changes → AI draft → review → approve → PDF**

The previous quarter is the baseline and the PM should mainly answer the question:

> **What changed since the last report?**

---

## 3.2 AI is allowed to write, synthesise and interpret

The LLM is not restricted to basic copy editing. It should be able to:

- combine several PM inputs into coherent investor-ready narrative;
- identify the most relevant achievements of the quarter;
- compare the new quarter with the previous one;
- produce executive summaries;
- rewrite operational notes into polished corporate language;
- shorten or expand content according to available space;
- suggest objectives for the following quarter;
- suggest risks that appear to emerge from the PM inputs;
- generate captions and explanatory copy when the underlying facts are provided;
- propose how content should be split across slides.

However, **the PM has the final decision**. All AI-generated text must remain editable.

---

## 3.3 AI must never invent project facts

The model may interpret and structure information freely, but material factual claims must come from one or more approved sources:

- project master data in Impar OS;
- previous approved reports;
- current-quarter PM inputs;
- structured KPI, milestone, risk or objective data;
- approved uploaded source documents;
- future integrations explicitly authorised as data sources.

The model must not invent dates, percentages, contractors, operators, licences, milestones, commercial performance or other material project facts.

When relevant data is missing, the model should either:

- omit the claim;
- use neutral wording;
- or surface a missing-information warning to the PM.

---

## 3.4 The report editor should be flexible, but not PowerPoint

Flexibility is important, but unrestricted pixel-level editing would make the product much more complex and would weaken visual consistency.

The recommended design model is a **structured canvas**.

A report slide is made of reusable content blocks and approved layout systems. Users can change layouts, add or remove blocks, resize certain regions, reorder slides, replace images and edit copy, but they do not get a fully freeform desktop publishing environment.

This is the recommended balance between operational simplicity and flexibility.

---

## 3.5 Photos are always provided by the PM

The system must never independently source or generate project photographs.

The PM uploads all photographs used in the report.

The system may assist with:

- image placement;
- cropping;
- aspect ratio;
- ordering;
- captions based on PM-provided context;
- slide composition;
- duplicate detection;
- quality/resolution warnings.

But the system does not choose external photos and does not fabricate project imagery.

---

## 3.6 Historical reports are first-class data

Each project must have a permanent report history.

Reports must be consultable and reusable indefinitely, subject to permissions.

Every report should support:

- View
- Edit
- Duplicate
- Create next quarter
- Download PDF
- Download PPTX when the feature becomes available
- View versions
- Restore previous version
- Compare with previous quarter

Approved reports should not be silently overwritten.

---

# 4. What the reviewed reports tell us

The reviewed material demonstrates that the reports have a stable high-level structure with project-specific variations.

## 4.1 Recurring high-level sections

Across the reviewed reports, common sections include:

1. Cover
2. Index
3. Executive Summary
4. Financial Summary — outside the PM workflow for this product
5. Financial Variance Analysis — outside the PM workflow for this product
6. Project Summary
7. Project Situation / Project Status
8. Construction / Works
9. Collaborators
10. Investment Vehicle
11. Disclaimer

Some projects omit certain sections. Some introduce additional sections.

---

## 4.2 Executive summary pattern

The project executive summary usually contains a combination of:

- short narrative overview of the quarter;
- current situation;
- key achievements / “Logros”;
- acquisition and/or financing highlights;
- operator information;
- key operating dates;
- delivery date;
- estimated exit/divestment date.

Examples in the source reports show that the executive summary is not merely a fixed text block. It synthesises the most important information from the entire project update.

Therefore, the executive summary should be **generated after the PM has completed the underlying project updates**, not before.

---

## 4.3 Project summary pattern

The “Resumen de Proyecto” section often contains:

- project strategy;
- project description;
- acquisition background;
- financing background;
- asset programme and uses;
- previous-quarter background;
- current-quarter developments;
- project calendar / milestones;
- KPIs;
- risks and mitigations;
- objectives for the following quarter.

This is the strongest recurring content framework and should be represented directly in the data model.

---

## 4.4 “Antecedentes” and “Novedades” are important

Several reports explicitly separate:

- **Antecedentes — previous quarter**
- **Novedades — current quarter**

This is exactly aligned with the desired workflow.

The product should preserve the approved previous-quarter narrative as context and ask the PM to provide the new-quarter update. The LLM can then produce a coherent “Novedades” section while retaining only the historical context that still matters.

---

## 4.5 Timelines are persistent structures

Project calendars generally include:

- historical milestones;
- a visual “current position” marker;
- future milestones;
- milestone names;
- milestone dates or months;
- sometimes a legend or phase grouping.

Examples include acquisition, licence application, licence approval, start of construction, BREEAM registration, operator agreement, CFO, LPO, handover, sales and exit.

A PM should never redraw this every quarter.

The timeline must be stored as structured project data and visually regenerated automatically.

---

## 4.6 KPIs vary by project but follow a common structure

Common examples include:

- % technical progress
- % licence process
- % BREEAM/certification
- % operator contracting
- % construction progress
- % technical expenditure
- % pre-sales / commercialisation
- % active tenant negotiations
- project duration
- completion / handover / exit date

The underlying pattern is usually:

**Indicator | Current quarter status | Next-quarter target / explanation**

Therefore KPIs must be configurable per project and not hardcoded globally.

---

## 4.7 Risks and mitigations are structured

Typical report format:

**Risk identified | Mitigation**

Examples from the reviewed reports include:

- licence delays;
- construction delays;
- structural technical issues;
- cost deviations;
- commercialisation risk;
- tenant release delays;
- BREEAM target risk;
- documentation delays for CFO/LPO;
- clashes between works and FF&E installation;
- supply connections;
- operator requirements;
- protected facade/demolition complexity.

Risks carry forward between quarters and must have lifecycle/status information.

---

## 4.8 Objectives are explicitly quarter-to-quarter

Reports frequently end a KPI/risk slide with **Objectives Q+1**.

This provides an opportunity for a strong closed-loop workflow:

1. The Q2 report defines objectives for Q3.
2. When preparing Q3, those objectives appear automatically.
3. The PM marks each as:
   - Completed
   - Partially completed
   - Not completed
   - No longer applicable
4. The explanation becomes an input to the Q3 narrative.
5. The PM then defines the Q4 objectives.

This loop should be a core product feature.

---

## 4.9 “Situación de Proyecto” is a modular container

This section changes the most between projects.

Potential modules observed include:

- Architecture
- Interior Design
- Engineering
- Licensing / planning
- Construction Management
- Project Management
- Construction progress
- Sustainability / BREEAM
- Operator
- FF&E / equipment
- Utilities and connections
- Insurance
- Project Monitoring / VIO
- Rental management
- Tenant releases / indemnities
- Marketing
- Commercialisation
- Pre-sales
- Sales
- Divestment
- Operations
- Governance
- Asset-specific technical issues

Therefore, each project should have its own **Reporting Module Configuration**.

---

## 4.10 There are multiple project archetypes

The reviewed reports suggest several recurring project archetypes that influence which modules are relevant.

### A. Development / conversion to hospitality or serviced apartments

Typical modules:

- licence
- architecture
- engineering
- construction
- operator
- FF&E
- utilities
- BREEAM
- CFO/LPO
- handover
- divestment

Examples: Santa Engracia, Costanilla, Glorieta de Quevedo.

### B. Branded residences / prime residential development

Typical modules:

- architecture
- interior design
- brand/operator coordination
- Marriott approvals
- technical design
- planning/licence
- construction
- marketing
- showroom
- pre-sales
- BREEAM

Examples: Sagasta, Camino 1.

### C. Mixed residential + hospitality development

Typical modules:

- multiple sub-assets or parcels
- multiple calendars
- residential sales
- hospitality operator
- construction packages
- licences by parcel
- BREEAM

Example: Padre Claret 25.

### D. Value-add residential / unit-by-unit sale

Typical modules:

- tenant management
- units released
- refurbishment by unit
- commercialisation
- sales
- CAPEX
- phased timeline

Example: Velarde 1.

### E. Portfolio / multi-asset investment vehicle

Typical modules:

- portfolio occupancy
- rent/income tables
- asset-by-asset status
- strategic vs non-strategic assets
- disposals
- debt profile
- governance

Example: Singular Prime II.

The application should be able to support all of these without creating a different product for each type.

---

# 5. Scope of the first version

The MVP should automate the **non-financial project reporting workflow**.

It must support the entire flow from report creation to investor-ready PDF.

It should not attempt to become the source of truth for investment financial modelling in the first version.

Financial pages that currently exist inside the overall investor report should be treated as **locked/external slides** until a later financial integration is developed.

---

# 6. Integration inside Impar OS

This module is part of **Impar OS**, not a separate standalone product.

Lovable should design the application as a module that can reuse the existing Impar OS shell where available:

- authentication;
- organisation context;
- sidebar/navigation;
- users;
- permissions;
- project master records;
- existing project IDs;
- existing file/storage conventions;
- design system where available.

If Lovable does not have direct access to the existing Impar OS codebase during initial generation, it should still build the module using clear integration boundaries and avoid duplicating project/auth concepts unnecessarily.

Recommended route structure:

```text
/reporting
/reporting/projects/:projectId
/reporting/projects/:projectId/reports/:reportId
/reporting/projects/:projectId/reports/:reportId/input
/reporting/projects/:projectId/reports/:reportId/editor
/reporting/projects/:projectId/reports/:reportId/review
/reporting/templates
/reporting/settings
```

---

# 7. User roles and permissions

## 7.1 Project Manager

Can:

- view assigned projects;
- create quarterly reports;
- duplicate previous reports;
- fill reporting inputs;
- upload project photographs;
- generate AI drafts;
- edit report copy;
- change approved layouts;
- add custom slides;
- submit for review;
- respond to requested changes.

Cannot by default:

- edit global templates;
- alter organisation-wide legal disclaimers;
- modify locked financial slides;
- publish an approved investor report unless granted permission.

---

## 7.2 Reviewer / Senior Project Lead

Can:

- review reports;
- comment;
- edit content if permissions allow;
- request changes;
- mark content as reviewed;
- approve operational content.

---

## 7.3 Management / Approver

Can:

- view all reports;
- approve reports;
- reject or request changes;
- view audit/version history;
- export final reports;
- publish to downstream systems if enabled.

---

## 7.4 Finance / Legal Contributor

Optional role.

Can manage specific locked/external sections such as:

- financial summary slides;
- variance slides;
- investment vehicle pages;
- legal text;
- disclaimers.

The role can be limited to specific sections rather than whole-report editing.

---

## 7.5 Admin

Can:

- manage report templates;
- manage slide templates;
- manage project reporting configuration;
- manage user permissions;
- manage legal boilerplate;
- configure AI behaviour;
- configure available modules;
- configure PDF/PPTX rendering settings;
- manage brand assets.

---

# 8. Primary information architecture

The main navigation items inside the module should be:

1. **Reporting Dashboard**
2. **Projects**
3. **Reports**
4. **Templates** — admin only
5. **Settings** — admin only

In most daily workflows, users should work from Dashboard → Project → Quarter.

---

# 9. Screen 1 — Reporting Dashboard

## Purpose

Give the team a clear view of the status of quarterly reporting across all projects.

## Header

Title:

**Quarterly Reporting**

Subtext:

> Create, review and publish investor project reports.

Primary CTA:

**Create quarterly report**

## Dashboard summary cards

Suggested cards:

- Reports this quarter
- Not started
- In progress
- In review
- Approved
- Overdue / attention required

## Main table

Columns:

- Project
- Project Manager
- Current reporting quarter
- Previous report
- Status
- Completion %
- Last edited
- Reviewer
- Issues / warnings
- Actions

Example statuses:

- Not started
- Draft
- Input in progress
- Generating
- Review required
- Changes requested
- Ready for approval
- Approved
- Published

## Filters

- Quarter
- Project Manager
- Project
- Status
- Project type
- Has warnings

## Actions

- Open
- Continue report
- View previous
- Duplicate
- Generate next quarter
- Download approved PDF

## UX requirement

This screen should make it possible to understand the organisation-wide reporting status in less than 10 seconds.

---

# 10. Screen 2 — Project Reporting Workspace

## Purpose

The permanent reporting home for one project.

## Project header

Display:

- project name;
- address/location;
- project type;
- strategy;
- PM;
- hero image;
- reporting configuration;
- current phase;
- next report due.

## Quarter history

Use a visual chronological sequence such as:

```text
Q4 2025 → Q1 2026 → Q2 2026 → Q3 2026
```

Each quarter card should show:

- quarter;
- report status;
- version;
- created by;
- approved by;
- date approved;
- PDF availability;
- warnings if any.

## Quarter actions

- View
- Edit
- Duplicate
- Create next quarter
- Compare
- Versions
- Download PDF
- Download PPTX (future/feature flag)

## Project settings shortcut

Admin / authorised PM should be able to access:

**Reporting configuration**

for this project.

---

# 11. Screen 3 — Create New Report

## Purpose

Create the new quarter with the correct baseline.

## Required fields

- Project
- Reporting quarter
- Report date / period end
- Base report

## Creation modes

### A. Duplicate previous quarter — default and recommended

Copies:

- slide structure;
- persistent copy;
- project data;
- timeline;
- KPIs;
- risks;
- collaborators;
- vehicle information;
- disclaimers;
- approved images where configured;
- custom sections;
- locked/external slides.

It must also create explicit links from every duplicated item to its previous-quarter source so that stale-content detection and comparisons are possible.

### B. Start from project template

Use the project’s configured reporting template without carrying over quarter-specific narrative.

### C. Start from standard Impar template

Use for a new project or exceptional case.

## After creation

Immediately create the draft and send the user to the **Quarter Update** workflow.

Do not show a blank presentation.

---

# 12. Screen 4 — Quarter Update / Input Wizard

This is the most important operational screen in the product.

The PM should feel that the system is interviewing them intelligently rather than making them complete a long bureaucratic form.

## Layout

Recommended desktop structure:

- Left: step/module navigation
- Center: input form
- Right: previous-quarter context / AI helper / related data

## Top progress bar

Show completion by module.

Example:

```text
General  ✓
Milestones ✓
KPIs  5/7
Risks  ✓
Architecture  Draft
Construction  Missing
Photos  12 uploaded
Objectives  Missing
```

## Autosave

Every input must autosave.

Never require the user to manually press Save for basic form data.

---

# 13. Input Step — General Quarter Update

Main question:

> **What happened this quarter?**

Provide a large input area where the PM can:

- type freeform notes;
- paste meeting notes;
- paste bullets;
- paste an email update;
- add several separate update items.

Suggested helper text:

> Write naturally. Include the most relevant achievements, delays, decisions, changes and next steps. The system will structure the information afterwards.

Actions:

- Add update
- Paste notes
- Structure with AI
- Clear

## AI classification

When the PM chooses **Structure with AI**, the model should classify the information into candidate categories:

- Achievement
- Current status
- Milestone
- Risk
- Issue / delay
- Decision
- Construction update
- Licence / planning
- Design / technical
- Operator
- Sustainability
- Commercialisation
- Sale / divestment
- Other

Show proposed classifications as editable cards.

The PM can:

- accept;
- change category;
- merge;
- split;
- delete;
- edit.

Do not silently commit AI interpretation.

---

# 14. Input Step — Previous Quarter Objectives

On creation of a new quarter, automatically load the previous report’s next-quarter objectives.

Example:

**Objective from Q2:** Obtain final construction licence.

Controls:

- Completed
- Partially completed
- Not completed
- No longer applicable

Additional field:

**What happened?**

Optional fields:

- completion date;
- related milestone;
- explanation;
- evidence/source.

This information becomes a first-class input for the current-quarter executive summary and achievements.

---

# 15. Input Step — Current Quarter Milestones

Show all existing project milestones chronologically.

Each item includes:

- milestone name;
- planned date;
- current expected date;
- actual date;
- status;
- phase;
- notes;
- source quarter.

Statuses:

- Planned
- In progress
- Completed
- Delayed
- Cancelled

Actions:

- Add milestone
- Edit milestone
- Move date
- Mark complete
- Mark delayed
- Add explanation
- Remove from report but keep in project history

Important distinction:

**Project milestone data should persist independently from the report slide.**

The report visual is generated from this structured data.

---

# 16. Input Step — KPIs

## KPI model

Each KPI must support:

- name;
- unit;
- current value;
- previous value;
- target / next-quarter goal;
- status;
- display format;
- notes;
- optional threshold;
- include/exclude from report;
- sort order.

Example KPI units:

- percentage;
- integer;
- currency;
- months;
- date;
- text status.

## KPI screen

Show a table with:

**Indicator | Previous | Current | Next-quarter target | Status**

Actions:

- Add KPI
- Remove KPI
- Mark N/A
- Reorder
- Copy from project defaults

## Default KPI library

Provide reusable KPI suggestions such as:

- Technical progress
- Licence progress
- BREEAM progress
- Operator contracting
- Construction progress
- Technical expenditure
- Pre-sales / commercialisation
- Units released
- Units completed
- Units sold
- Tenant negotiations
- Project duration

But projects are not required to use all of them.

---

# 17. Input Step — Risks & Mitigations

## Risk lifecycle

Risks must carry forward quarter to quarter.

Each risk contains:

- title / risk description;
- mitigation;
- status;
- severity;
- owner (optional);
- date opened;
- date resolved;
- source quarter;
- notes;
- include in report.

Statuses:

- Active
- Monitoring
- Mitigated
- Resolved
- Closed / no longer applicable

## UX

Show **Previous quarter risks** first.

For each:

- Still active
- Update
- Resolved
- Remove from report

Then allow:

**+ Add new risk**

## AI suggestions

The LLM may suggest possible new risks based on current-quarter inputs.

These suggestions must be clearly labelled:

**AI suggestion — not included until confirmed**

The PM must explicitly accept a suggested risk.

---

# 18. Input Step — Objectives for Next Quarter

The PM defines what the following quarter should achieve.

Fields:

- objective;
- category/module;
- optional target date;
- optional related KPI;
- optional related milestone;
- priority;
- include in report.

Actions:

- Add objective
- Reorder
- Delete
- Suggest with AI

AI suggestions should be based on:

- unfinished objectives;
- upcoming milestones;
- current active risks;
- project phase;
- PM updates;
- relevant project modules.

All suggestions require PM confirmation.

---

# 19. Input Step — Project Modules

Each project has a configured set of reporting modules.

The PM should only see the modules relevant to that project.

## Standard module interface

Every module starts with:

### Previous quarter

Show the approved previous-quarter content.

### Current quarter

Ask:

1. **Has anything changed in this area?**
2. **What happened this quarter?**
3. **Current status**
4. **Relevant achievements**
5. **Issues or delays**
6. **Decisions taken**
7. **Next steps**

Quick option:

**No material changes this quarter**

If selected, the system should preserve stable background information but avoid presenting the old update as if it were new.

---

# 20. Available Project Modules

The system should ship with the following module library.

## 20.1 Strategy & Project Description

Usually persistent.

Fields:

- investment/development strategy;
- asset description;
- use / programme;
- location rationale;
- positioning;
- expected exit strategy;
- current strategic changes.

Most quarters should inherit this unless the strategy changes.

---

## 20.2 Acquisition / Transaction Background

Fields:

- acquisition date;
- purchase price;
- deposit / arras;
- closing date;
- acquisition structure;
- comments.

Primarily persistent master data.

---

## 20.3 Financing

Although the MVP is focused on non-financial reporting, financing facts appear frequently in the project narrative.

Allow basic operational financing fields to be shown where necessary:

- lender;
- facility status;
- relevant financing milestone;
- construction facility availability;
- conditions that affect project execution;
- relevant changes this quarter.

Do not replace the financial model or calculate investment returns here.

---

## 20.4 Planning / Licences / Administrative Process

Fields:

- licence type;
- authority;
- application date;
- status;
- estimated approval date;
- actual approval date;
- requests / requerimientos;
- heritage/CLPH/CPPHAN milestones;
- declaration responsible status;
- current-quarter update;
- next actions.

---

## 20.5 Architecture

Fields:

- current design phase;
- responsible architect;
- project status;
- major design decisions;
- technical studies;
- current-quarter progress;
- open issues;
- next steps;
- visual assets / renders.

---

## 20.6 Interior Design

Fields:

- concept;
- designer;
- design stage;
- approvals;
- operator/brand comments;
- materials and finishes;
- current-quarter update;
- renders/images.

---

## 20.7 Engineering

Fields:

- structural engineering;
- MEP/installations;
- geotechnical;
- utilities;
- technical studies;
- current status;
- open technical issues;
- current-quarter developments.

---

## 20.8 Construction

Fields:

- overall progress;
- package/lot progress;
- contractor(s);
- work started date;
- expected completion;
- current activity;
- critical path;
- delays;
- corrective measures;
- certifications/progress measurement;
- current-quarter accomplishments;
- next activities.

Allow sub-packages such as:

- Lot 01
- Lot 02
- Demolition
- Structure
- Envelope
- MEP
- Fit-out
- FF&E

---

## 20.9 Project / Construction Management

Fields:

- PM/CM company;
- planning update;
- budget/control narrative where operationally relevant;
- coordination activity;
- monitoring;
- reporting cadence;
- issues and mitigations.

---

## 20.10 Project Monitoring / VIO

Optional module.

Fields:

- monitoring company;
- latest monitoring date;
- certified progress;
- VIO / valuation information where used operationally;
- relevant commentary.

---

## 20.11 Sustainability / BREEAM

Fields:

- certification scheme;
- target rating;
- target score;
- current score/progress;
- phase;
- advisor;
- completed credits;
- pending evidence;
- issues;
- current-quarter progress;
- next-quarter actions.

Optional detailed categories:

- Management
- Health & Wellbeing
- Energy
- Transport
- Water
- Materials
- Waste
- Land Use & Ecology
- Pollution
- Innovation / extraordinary points

Support a chart slide if detailed category data exists.

---

## 20.12 Operator

Fields:

- operator;
- contract status;
- signing date;
- term;
- guaranteed rent where relevant;
- rent-free period where relevant;
- FF&E contribution where relevant;
- technical requirements;
- design approvals;
- mobilisation / handover;
- current-quarter update.

---

## 20.13 Brand / Branded Residences

Useful for Marriott/Luxury Collection projects.

Fields:

- brand;
- agreement status;
- Concept Design approval;
- Schematic Design approval;
- technical approvals;
- marketing approvals;
- brand standards;
- current-quarter interactions;
- outstanding approvals.

---

## 20.14 Marketing

Fields:

- positioning;
- brand identity;
- marketing materials;
- website/digital;
- media plan;
- launch/prelaunch;
- buyer personas;
- brand/operator approvals;
- next actions.

---

## 20.15 Commercialisation / Pre-sales

Fields:

- commercial phase;
- launch date;
- units available;
- reservations;
- sales signed;
- leads/visits where relevant;
- pricing adjustments;
- channels;
- showroom;
- actions this quarter;
- next-quarter target.

---

## 20.16 Rental / Tenant Management

Useful for value-add projects.

Fields:

- total units;
- occupied units;
- vacant units;
- units released this quarter;
- upcoming lease expiries;
- agreements / indemnities;
- occupancy;
- rental strategy;
- current-quarter actions.

---

## 20.17 Unit Refurbishment

Fields:

- units completed;
- units in progress;
- units planned;
- average duration by type;
- scope changes;
- design changes;
- next activations;
- CAPEX commentary;
- photographs.

---

## 20.18 Sales / Divestment

Fields:

- sale process status;
- units/assets marketed;
- offers;
- sales signed;
- target exit;
- buyer process;
- exclusivity;
- deposits;
- expected closing;
- current-quarter events;
- next actions.

---

## 20.19 Utilities / Connections

Fields:

- electricity;
- water;
- gas if applicable;
- telecoms;
- temporary construction supply;
- permanent supply;
- applications/status;
- issues;
- next steps.

---

## 20.20 Insurance

Fields:

- policy type;
- insurer;
- policy status;
- effective dates;
- pending insurance requirements;
- current-quarter changes.

---

## 20.21 Governance / Legal / Vehicle Operations

Operational/project-level governance can be stored here, but vehicle/legal content may be owned by Legal/Finance depending on permissions.

---

## 20.22 Custom module

Admins and authorised users must be able to create a custom project module without development work.

Custom module fields should support:

- title;
- description;
- text input;
- bullet list;
- structured key/value fields;
- date;
- percentage;
- number;
- images;
- table;
- optional AI instructions.

---

# 21. Input Step — Photographs

The PM is responsible for selecting and uploading all project imagery.

## Upload experience

Support:

- drag & drop;
- multi-upload;
- JPEG/PNG/WebP;
- optional HEIC conversion if technically feasible;
- batch progress;
- retry failed uploads.

## Metadata per image

- caption;
- category/module;
- date taken, if provided;
- location/area;
- include in report;
- featured;
- order;
- optional photographer/source;
- alt/internal description.

## Gallery UI

Allow the PM to:

- reorder by drag and drop;
- select several images;
- assign module in bulk;
- remove from report;
- replace;
- crop;
- rotate;
- choose focal point.

## Layout suggestions

Offer approved options:

- 1 large image
- 2 images
- 3 images
- 4-image grid
- 1 hero + 2 secondary
- image + text
- image collage

## AI limits

AI may write a caption only from:

- user-provided caption/context;
- module context;
- confirmed project data.

It must not claim that a photograph depicts a particular technical milestone unless the PM has provided/confirmed that information.

---

# 22. Input Step — Additional Information

This is essential for exceptional quarterly content.

CTA:

**Add custom section**

Supported content types:

- Text
- Bullets
- Text + image
- Image gallery
- KPI table
- Data table
- Timeline
- Chart
- Two-column content
- Quote/callout
- Custom slide

The purpose is to avoid engineering a new product feature every time a project needs one exceptional slide.

---

# 23. Report generation workflow

When the PM reaches the end of the inputs, show a **Generation Summary**.

Example:

```text
Q3 2026 — Santa Engracia 84

Previous report reused: 14 slides
Sections updated: 7
Sections unchanged: 4
New sections: 2
New photographs: 12
Resolved risks: 2
New risks: 1
Previous objectives reviewed: 4/4
New objectives: 5
Warnings before generation: 1
```

Primary CTA:

**Generate report draft**

Secondary actions:

- Review missing inputs
- Save and exit

---

# 24. LLM context package

The LLM should not be sent a giant unstructured document when a structured context can be provided.

Build a structured context package containing:

```json
{
  "project": {},
  "reporting_period": {},
  "previous_report": {},
  "current_quarter_updates": [],
  "objectives_from_previous_quarter": [],
  "milestones": [],
  "kpis": [],
  "risks": [],
  "next_quarter_objectives": [],
  "modules": {},
  "images_metadata": [],
  "persistent_project_facts": {},
  "legal_boilerplate": {},
  "slide_constraints": {},
  "style_rules": {}
}
```

Only include information the model needs for the current generation task.

---

# 25. LLM system behaviour

The internal reporting LLM should follow rules equivalent to the following.

## Core role

> You are the reporting assistant for Impar Capital. Your job is to transform validated project information into concise, precise and investor-ready quarterly reporting copy while preserving the reporting structure and tone used by Impar Capital.

## Writing principles

- Professional institutional Spanish by default.
- Clear and concise.
- Factual, not promotional.
- Prefer concrete milestones and outcomes over generic statements.
- Explain why a development matters where useful.
- Avoid repetition across sections.
- Keep terminology consistent throughout the report.
- Maintain consistency with the previous quarter unless a fact has changed.
- Do not unnecessarily rewrite stable project background.
- Use quarter notation consistently (Q1 2026, Q2 2026, etc.).
- Use project names consistently.
- Preserve official names for contractors, operators, brands and authorities.

## Critical factual rule

> Never introduce a material fact that is not supported by the supplied project context. If a fact is uncertain or contradictory, flag it instead of choosing one silently.

## Time rule

The model must understand the distinction between:

- historical facts;
- previous-quarter facts;
- current-quarter facts;
- future targets/forecasts.

It must not present a future target as completed or a previous-quarter event as a current-quarter achievement.

---

# 26. AI generation should happen at block level

Do not rely on one single request to generate a 20-slide report.

Generate in manageable units such as:

1. module narratives;
2. executive-summary narrative;
3. achievements;
4. risk wording;
5. next-quarter objectives;
6. timeline labels;
7. captions;
8. slide-level summaries.

This improves:

- reliability;
- editability;
- regeneration;
- cost control;
- traceability;
- ability to re-run only one block.

---

# 27. Content provenance / traceability

Every AI-generated content block should store provenance metadata.

Example:

```json
{
  "block_id": "...",
  "generated": true,
  "sources": [
    {"type": "pm_input", "id": "..."},
    {"type": "kpi", "id": "..."},
    {"type": "previous_report_block", "id": "..."}
  ],
  "model": "...",
  "generated_at": "...",
  "edited_after_generation": true
}
```

In the UI, a user should be able to select a generated paragraph and click:

**View sources**

Show human-readable provenance, for example:

- PM update · Construction
- KPI · Construction progress 76% → 94%
- Previous report · Project Calendar
- Previous objective · Complete CFO documentation

Do not expose unnecessary model internals.

---

# 28. Report Editor — core concept

After generation, the user enters a slide editor.

Recommended three-column desktop layout:

```text
┌──────────────┬───────────────────────────────┬──────────────────┐
│ Slides       │ Canvas                        │ Properties / AI  │
│ thumbnails   │ 16:9 report slide            │                  │
│              │                               │                  │
└──────────────┴───────────────────────────────┴──────────────────┘
```

## Left panel — slides

Show:

- thumbnail;
- slide number;
- section;
- title;
- warning indicator;
- locked indicator;
- AI-updated indicator.

Actions:

- reorder;
- duplicate;
- hide;
- delete;
- add slide;
- change section.

---

# 29. Structured canvas

The center canvas should represent the actual report slide as closely as possible.

Recommended slide ratio:

**16:9**

The system should use layout templates composed of content regions.

Users can interact with individual blocks.

Supported block types:

- title;
- subtitle;
- rich text;
- bullet list;
- KPI;
- KPI grid;
- table;
- chart;
- timeline;
- risk table;
- objectives list;
- image;
- image gallery;
- caption;
- logo;
- collaborator card;
- map/image asset;
- callout;
- footer;
- legal/disclaimer;
- spacer/divider;
- locked/external content.

---

# 30. Visual flexibility rules

Users should be able to:

- change a slide layout;
- choose from approved variants;
- add a new content block;
- remove optional blocks;
- reorder content within defined regions;
- resize columns within safe limits;
- replace images;
- change image crop/focal point;
- change gallery layout;
- duplicate slides;
- create additional slides;
- hide slides;
- split a dense slide into two;
- merge compatible slides where possible;
- reorder slides.

Users should **not** initially be able to:

- arbitrarily position every object at pixel level;
- freely change brand fonts;
- freely change global colours;
- create unbounded text boxes anywhere;
- remove mandatory legal content;
- edit locked finance slides without permission.

This restriction keeps reports visually controlled while still providing meaningful flexibility.

---

# 31. Right panel — block properties and AI actions

When a text block is selected, show:

- editable text;
- text length;
- recommended maximum;
- overflow warning;
- source/provenance;
- AI controls.

AI controls:

- Rewrite
- Shorten
- Expand
- Make more executive
- Make more concise
- Improve clarity
- Convert to bullets
- Convert bullets to narrative
- Regenerate from sources
- Undo AI change

Never overwrite text immediately. Show a preview/diff or support immediate undo.

---

# 32. Slide-level AI actions

For a selected slide:

- Improve slide narrative
- Shorten to fit
- Suggest better layout
- Split into two slides
- Consolidate duplicate content
- Refresh using latest confirmed inputs
- Explain why this slide changed from previous quarter

AI should not modify the whole report when the user is working on one slide unless explicitly requested.

---

# 33. Layout Library

Create a reusable layout library.

Initial recommended layouts:

## Structural

- Cover — landscape image
- Cover — portrait/side image
- Index
- Section divider
- Disclaimer

## Narrative

- Full-width text
- Two-column text
- Text + image right
- Image left + text right
- Large image + caption
- Hero image + short narrative

## Structured information

- KPI grid
- KPI table
- Risks + mitigations + objectives
- Timeline horizontal
- Timeline multi-phase
- Table full width
- Chart + narrative
- 2 charts

## Image layouts

- 1 image
- 2 images
- 3 images
- 4-image grid
- Hero + 2 images
- Image collage

## Collaborators

- Collaborator grid
- 2-column collaborator descriptions
- Logos + descriptions

## Custom

- Blank structured slide with safe regions

Each layout must contain metadata including:

- layout ID;
- supported block types;
- required blocks;
- optional blocks;
- maximum recommended text length;
- image aspect ratios;
- min/max region width;
- brand tokens;
- export rules.

---

# 34. Template system

Separate **Report Template** from **Slide Layout**.

## Report Template

Defines:

- default section order;
- mandatory sections;
- optional sections;
- default slide layouts;
- legal/disclaimer set;
- default modules;
- default visual theme;
- financial slide placeholders;
- output naming convention.

Potential templates:

- Impar Standard Development
- Hospitality / Operator
- Branded Residences
- Value-Add Residential
- Mixed Residential + Hospitality
- Portfolio / Multi-Asset

## Project Template Configuration

Each project can override the report template with its own recurring structure.

The project’s previous report is still the preferred baseline for the next quarter.

---

# 35. Template Manager — Admin

Admin screen:

**Reporting → Templates**

Functions:

- list report templates;
- duplicate template;
- create template;
- archive template;
- preview template;
- manage section order;
- mark mandatory/optional sections;
- manage slide layouts;
- define text limits;
- configure branding;
- configure footer/disclaimer;
- configure AI instructions per slide type;
- define which user roles can edit each section.

---

# 36. PPTX template ingestion strategy

A source PPTX has been provided and the final system should use the visual logic of existing Impar decks.

However, do not make the MVP dependent on a universal arbitrary-PowerPoint importer.

Recommended approach:

## Phase 1

Manually encode the required existing Impar layouts as structured slide templates.

## Phase 2

Build an admin-assisted PPTX ingestion pipeline that can detect and map:

- text boxes;
- images;
- tables;
- charts;
- grouped objects;
- background/master elements;
- fonts;
- colours;
- positions;
- placeholders.

The importer should create a draft structured layout that an admin confirms before use.

Do not promise that every arbitrary PowerPoint file can be imported perfectly without review.

---

# 37. Financial slides — Locked / External Slides

The reviewed investor reports frequently contain financial summary and variance-analysis pages.

These are not part of the PM’s core non-financial reporting workflow.

The application should therefore support **Locked / External Slides**.

A locked slide may be:

- inherited from the previous quarter;
- uploaded by Finance;
- replaced with a new PPT/PDF/page image;
- generated by a future financial module;
- visible in the report editor but not editable by PMs.

Properties:

- source;
- owner;
- version;
- status;
- page/slide preview;
- include in final PDF;
- locked=true.

This allows the final investor report to remain complete without forcing PMs to manage financial data.

---

# 38. Collaborator library

Collaborator information repeats between quarters and projects.

Create an organisation-level collaborator library.

Fields:

- company name;
- logo;
- category;
- standard description;
- website (internal metadata only if desired);
- active/inactive;
- approved brand asset;
- default display name.

Potential categories observed:

- Architecture
- Interior Design
- Engineering
- Sustainability
- Construction
- Project Management
- Construction Management
- Operator
- Project Monitoring
- Bank / Financing
- Legal / Tax
- Insurance
- OCT
- Marketing
- Landscaping
- Other

Project configuration selects which collaborators apply to the project and may override the standard description.

Quarter updates should only ask for collaborator changes if something has changed.

---

# 39. Investment Vehicle information

Reports often include investment-vehicle details such as:

- entity/fund name;
- constitution date;
- registry date;
- registry information;
- NIF/ISIN;
- CNMV status;
- tax/mercantile status;
- next corporate obligation;
- board/shareholder meeting information;
- annual accounts status;
- next quarterly report date.

This content should be stored as persistent structured data and owned by the appropriate business function.

The PM should not retype it every quarter.

The reporting system should simply use the latest approved vehicle data at generation time.

---

# 40. Legal and disclaimer management

Legal disclaimers must be centrally managed.

Admins/Legal should be able to define:

- confidentiality footer by vehicle type;
- full disclaimer slide;
- effective date;
- entity applicability;
- previous versions;
- mandatory status.

PMs cannot edit mandatory legal copy.

The report should always store which disclaimer version was used when exported.

---

# 41. Automatic Quality Assurance

Before a report can move to “Ready for approval”, run automated checks.

## 41.1 Structural checks

- all mandatory sections present;
- all mandatory inputs complete;
- all required slides included;
- mandatory legal content present;
- required external/financial slides present if configured.

## 41.2 Period checks

Detect:

- references to wrong quarter;
- references to wrong year;
- stale phrases like “next quarter” copied from previous report;
- past milestone described as future;
- future milestone described as completed.

## 41.3 Data consistency checks

Examples:

- construction progress differs between KPI and narrative;
- handover date differs across slides;
- operator differs across sections;
- project unit count differs between project data and copy;
- BREEAM progress differs between KPI and sustainability section;
- licence status conflicts with timeline;
- exit date conflicts between executive summary and calendar.

## 41.4 Stale content checks

Compare each current slide/block with the previous approved report.

Flag, for example:

> This paragraph is 96% identical to Q2 2026 and contains a time-sensitive statement.

Differentiate between:

- expected persistent background text;
- suspicious stale quarter-specific content.

## 41.5 Text density checks

- text overflow;
- excessive bullet count;
- font-size floor triggered;
- overly dense slide;
- table overflow.

## 41.6 Image checks

- low resolution;
- unsupported format;
- extreme aspect ratio;
- duplicate image;
- missing caption where required;
- image crop likely to remove focal point.

## 41.7 Language checks

- obvious typos;
- duplicated sentences;
- inconsistent project naming;
- inconsistent quarter notation;
- inconsistent abbreviations;
- excessive repetition.

## 41.8 AI confidence / missing support

Flag generated claims for which the provenance package is weak or ambiguous.

The QA system must never silently “fix” a material project fact. It should surface the issue to a human.

---

# 42. Review screen

Provide a dedicated review experience after editing.

## Review header

Show:

- report;
- version;
- status;
- completion;
- QA score / warnings count;
- reviewer;
- last generated time.

## Review modes

### A. Full report preview

Paginated/slides view.

### B. Changes vs previous quarter

Highlight:

- added content;
- deleted content;
- modified text;
- changed KPI values;
- moved milestones;
- resolved/new risks;
- changed images;
- new/deleted slides.

This should be easy to scan.

### C. QA issues

Grouped by:

- Blocking
- Warning
- Recommendation

Each issue links directly to the relevant slide/block.

---

# 43. Comments and review workflow

Reviewers should be able to leave comments on:

- a report;
- a slide;
- a content block.

Comment features:

- @mention;
- resolve;
- reopen;
- timestamp;
- author;
- activity history.

Workflow statuses:

```text
Draft
→ Ready for review
→ Changes requested
→ Ready for approval
→ Approved
→ Published
```

Optional:

- Reopen approved report

If an approved report is edited, create a new version and revert the state appropriately rather than altering the approved artefact silently.

---

# 44. Versioning

Versioning is mandatory.

Suggested model:

```text
Q2 2026
  v1 Draft
  v2 Review
  v3 Approved
  v4 Updated after approval
```

Track at minimum:

- version number;
- created by;
- created at;
- based on version;
- status;
- approval information;
- exported PDF;
- content snapshot;
- template version;
- disclaimer version.

Provide:

- Version history
- Compare versions
- Restore version
- Download historical PDF

Never lose the approved investor-facing output that was actually published.

---

# 45. Export to PDF

The PDF output must be investor-ready and visually equivalent to the report preview.

Requirements:

- 16:9 page ratio matching presentation format;
- embedded fonts or safe font handling;
- high-resolution images;
- selectable text where technically feasible;
- correct tables;
- consistent footer/legal copy;
- page numbering;
- correct logos;
- deterministic layout;
- no browser UI artefacts;
- no clipped text;
- no unexpected page breaks.

Use a server-side generation process rather than relying purely on the user’s browser print dialog.

Store the generated PDF as an immutable artefact linked to the report version.

---

# 46. Future PPTX export

Design the internal data model so PPTX export can be added later.

Do not store reports only as flattened HTML screenshots.

Slides, blocks, layout IDs, text and images need structured representations so they can be translated into PPTX objects.

Future PPTX should ideally preserve:

- editable text;
- editable images;
- tables;
- charts when possible;
- slide masters/themes where technically feasible.

---

# 47. Publishing / downstream integrations

Design export actions so future integration can include:

- Publish to Investor Portal
- Store in SharePoint / OneDrive
- Send to defined distribution workflow
- Attach to quarterly investor communication

These integrations do not need to be fully implemented in the first build unless Impar OS already provides them, but the data model should not block them.

---

# 48. Data model — overview

Recommended core entities:

```text
projects
project_reporting_configs
reporting_modules
project_modules
reports
report_versions
report_sections
report_slides
slide_blocks
quarter_updates
kpis
kpi_values
milestones
risks
objectives
images
collaborators
project_collaborators
investment_vehicles
legal_templates
report_templates
slide_layouts
external_slides
comments
qa_issues
ai_generations
activity_log
```

---

# 49. Data model — Projects

Use existing Impar OS project table if one exists.

Relevant reporting fields may include:

```text
id
name
short_name
address
city
country
project_type
strategy
current_phase
project_manager_id
cover_image_id
vehicle_id
status
created_at
updated_at
```

Do not duplicate existing project master data if it already lives elsewhere in Impar OS.

---

# 50. Data model — Project Reporting Configuration

Suggested fields:

```text
id
project_id
report_template_id
default_language
financial_slides_mode
require_review
require_approval
report_owner_id
reviewer_id
approver_id
output_filename_pattern
created_at
updated_at
```

Plus module configuration in a join table.

---

# 51. Data model — Reports

A report is the logical quarter container.

```text
id
project_id
quarter
period_start
period_end
reporting_year
base_report_id
current_version_id
status
created_by
created_at
updated_at
```

Unique constraint recommendation:

**project_id + reporting year + quarter**

Allow exceptional duplicate logical reports only through explicit override/admin behaviour.

---

# 52. Data model — Report Versions

```text
id
report_id
version_number
based_on_version_id
status
snapshot_json
template_version_id
disclaimer_version_id
created_by
created_at
submitted_at
approved_by
approved_at
published_at
pdf_file_id
pptx_file_id
```

---

# 53. Data model — Sections and Slides

## Report section

```text
id
report_version_id
section_type
custom_title
sort_order
is_required
is_hidden
```

## Report slide

```text
id
section_id
layout_id
slide_type
sort_order
title
is_locked
is_hidden
source_slide_id
external_slide_id
created_at
updated_at
```

---

# 54. Data model — Slide Blocks

```text
id
slide_id
block_type
region_id
sort_order
content_json
style_overrides_json
source_metadata_json
is_locked
created_at
updated_at
```

`content_json` varies by block type.

Example text block:

```json
{
  "text": "...",
  "format": "rich_text",
  "max_chars": 700
}
```

Example image block:

```json
{
  "image_id": "...",
  "caption": "...",
  "fit": "cover",
  "focal_x": 0.5,
  "focal_y": 0.4
}
```

---

# 55. Data model — Quarter Updates

Store raw PM input independently from generated copy.

```text
id
report_id
module_id
update_type
raw_text
structured_json
created_by
created_at
updated_at
```

This distinction is critical. Never replace original PM input with AI-generated prose.

---

# 56. Data model — KPIs

## KPI definition

```text
id
project_id
name
unit
display_format
sort_order
is_active
```

## KPI quarter value

```text
id
kpi_id
report_id
value
status
target_next_quarter
notes
source
```

---

# 57. Data model — Milestones

```text
id
project_id
name
phase
planned_date
current_expected_date
actual_date
status
notes
created_in_report_id
updated_in_report_id
include_in_report
sort_order
```

Milestones are project-level persistent objects, not report-only text.

---

# 58. Data model — Risks

```text
id
project_id
title
description
mitigation
status
severity
owner_id
opened_at
resolved_at
created_in_report_id
updated_in_report_id
include_in_report
```

---

# 59. Data model — Objectives

```text
id
project_id
source_report_id
target_quarter
text
category
priority
target_date
related_kpi_id
related_milestone_id
status
completion_comment
completed_at
```

When the target quarter arrives, these objectives become part of the new-quarter input workflow.

---

# 60. Data model — Images

```text
id
project_id
report_id
file_path
filename
mime_type
width
height
file_size
caption
category
photo_date
featured
include_in_report
focal_x
focal_y
uploaded_by
uploaded_at
```

Use object storage.

---

# 61. Data model — QA issues

```text
id
report_version_id
issue_type
severity
slide_id
block_id
message
details_json
status
resolved_by
resolved_at
created_at
```

Severity:

- blocker
- warning
- recommendation

---

# 62. Data model — AI generation log

Record generation metadata for auditability and debugging.

```text
id
report_version_id
slide_id
block_id
generation_type
input_hash
source_ids_json
model
prompt_version
output_text
created_by
created_at
accepted
edited_after_acceptance
```

Do not expose model chain-of-thought or private reasoning. Store only operational generation metadata and source references.

---

# 63. Report generation algorithm

Recommended pipeline:

## Step 1 — Validate inputs

Check mandatory fields and contradictions.

## Step 2 — Build current-quarter facts

Create a structured, deduplicated fact set from PM inputs and project master data.

## Step 3 — Compare to previous quarter

Identify:

- new facts;
- changed facts;
- resolved items;
- unchanged persistent facts;
- stale content candidates.

## Step 4 — Generate module copy

Generate updated narrative for each active module.

## Step 5 — Generate KPI/risk/objective slides

Use structured data, not freeform model output for the underlying values.

## Step 6 — Generate timeline

Use structured milestone data.

## Step 7 — Generate executive summary

Only after the rest of the report context is ready.

## Step 8 — Map content to layouts

Choose default layouts according to block type and content density.

## Step 9 — Detect overflow

If text exceeds layout limits:

1. try concise rewrite;
2. suggest another approved layout;
3. split slide if necessary;
4. never simply shrink fonts below a safe minimum.

## Step 10 — Run QA

Create warnings/issues.

## Step 11 — Present editor

Human reviews and edits.

---

# 64. Dynamic layout selection

The system should choose layouts based on content, but users can override the choice.

Example heuristics:

```text
Narrative <= 500 chars + 1 image
→ Text + image

Narrative > 900 chars
→ Full text or split into two slides

3–6 KPIs
→ KPI row/grid

7+ KPIs
→ KPI table

2–5 risks + 3–6 objectives
→ Combined KPI/Risk/Objectives slide if space allows

1–2 images
→ Large image layout

3–4 images
→ Gallery
```

These are design heuristics, not absolute business rules.

---

# 65. Character and density limits

Every text-containing layout must define soft and hard limits.

Example conceptual configuration:

```json
{
  "executive_summary": {
    "recommended_chars": 650,
    "hard_max_chars": 900
  },
  "achievement_bullets": {
    "recommended_items": 6,
    "hard_max_items": 9
  },
  "risk_cell": {
    "recommended_chars": 140,
    "hard_max_chars": 220
  }
}
```

When exceeding a soft limit, show a warning.

When exceeding a hard limit, require a layout change, split or shortening before final export.

Do not solve overflow solely by reducing font size.

---

# 66. Tone and style guidance derived from current reports

The existing reports use an institutional, factual tone.

Typical language patterns include:

- “Durante el trimestre…”
- “Se ha avanzado…”
- “Se mantiene…”
- “En paralelo…”
- “Asimismo…”
- “El proyecto continúa…”
- “El foco continúa en…”
- “Se prevé…”
- “Se ha iniciado…”
- “Se ha formalizado…”

The model should preserve that style without mechanically repeating the same sentence constructions.

Avoid:

- exaggerated marketing language;
- unsupported positive claims;
- unnecessary adjectives;
- repetitive corporate filler;
- vague claims with no project content.

---

# 67. Executive summary generation rules

The executive summary should prioritise:

1. current project phase;
2. most material achievement(s) this quarter;
3. meaningful delays/issues and mitigation if investor-relevant;
4. movement toward the next major milestone;
5. operator/commercialisation/divestment where relevant;
6. next critical dates.

It should not simply concatenate every module update.

The summary needs an editorial hierarchy.

---

# 68. Achievement generation rules

“Logros Qx YYYY” should contain concrete items.

Good:

> Obtención de la licencia de obras el 8 de junio de 2026.

Bad:

> Se continuó trabajando en el proyecto durante el trimestre.

The LLM should select the most material confirmed developments.

Allow the PM to pin/force an input as an achievement.

---

# 69. Previous-quarter carry-forward rules

Content must be categorised as:

- **Persistent:** strategy, asset background, collaborator description, etc.
- **Quarter-specific:** “During Q2…” updates.
- **Structured dynamic:** KPIs, milestones, risks.
- **Legal/static:** disclaimers.
- **External/locked:** finance pages.

When duplicating:

### Persistent content

Carry forward automatically.

### Quarter-specific content

Carry forward only as context, not as current copy.

### Structured dynamic content

Carry forward underlying objects and request updates.

### Legal/static

Use latest applicable approved version at export, while preserving historical version in old reports.

### External/locked

Duplicate placeholder/reference according to project configuration and flag if a current-quarter replacement is required.

---

# 70. Change detection

The application should understand changes between quarters at a semantic and structured level.

Show useful indicators such as:

- New
- Updated
- Unchanged
- Resolved
- Removed
- Needs review

Do not rely only on plain text diffing.

Example:

```text
Licence status
Q2: 86% — expected September
Q3: 100% — licence obtained 12 September
→ Significant update
```

This should automatically influence the report narrative and achievements.

---

# 71. Suggested user experience for “No changes”

When a PM selects **No material changes this quarter** for a module:

1. keep persistent background;
2. do not repeat last quarter’s time-specific “current update” as new information;
3. optionally generate a short neutral statement only if the slide needs current-period context;
4. flag any previous-quarter wording containing dates/quarter names for review.

Example safe wording:

> No se han producido cambios materiales en este ámbito durante el trimestre.

But avoid adding such wording automatically everywhere; often it is better to keep only the relevant persistent content or omit the slide update.

---

# 72. Multi-subproject support

Some projects, such as Padre Claret 25, have several sub-assets/parcels with different calendars and strategies.

The product must support nested scopes:

```text
Project
  ├── Azalea
  ├── Dalia
  └── Villas
```

A module, KPI, milestone or image may apply to:

- whole project;
- one subproject;
- multiple selected subprojects.

Timelines may be:

- combined;
- or shown on separate slides.

Do not assume one project always has one simple calendar.

---

# 73. Portfolio / multi-asset support

Singular Prime II demonstrates a more complex portfolio reporting case.

The architecture should eventually support child assets:

```text
Vehicle / Project
  ├── Asset A
  ├── Asset B
  ├── Asset C
  ...
```

Potential data modules:

- occupancy by asset;
- revenue by asset/month;
- asset status;
- strategic/non-strategic category;
- disposal status;
- debt by lender/asset.

This does not need to be the first workflow optimised in the MVP, but the data model should avoid blocking it.

---

# 74. Search and reuse

Inside the report editor, users should be able to search previous approved reports for the same project.

Examples:

- search “BREEAM”;
- search “licencia”;
- search “operador”;
- reuse a previous slide layout;
- copy a historical paragraph as a starting point.

When copied, mark its origin so stale-content QA can still detect it.

---

# 75. Activity log / audit trail

Track important actions:

- report created;
- report duplicated;
- AI generation run;
- block regenerated;
- section edited;
- external slide replaced;
- report submitted;
- changes requested;
- approved;
- reopened;
- PDF generated;
- published.

Show a human-readable activity feed.

---

# 76. Notifications

If Impar OS has notifications, support events such as:

- report assigned;
- review requested;
- comment mention;
- changes requested;
- report approved;
- missing external slide;
- reporting deadline approaching.

Do not build a separate notification system if Impar OS already has one.

---

# 77. Autosave and resilience

Requirements:

- autosave form inputs;
- autosave editor changes;
- show save state;
- recover unsaved local changes if network failure occurs;
- retry image uploads;
- generation jobs should be idempotent where practical;
- long-running PDF generation should expose progress/status.

---

# 78. Empty states

Design high-quality empty states.

Examples:

## No reports yet

> This project does not have any quarterly reports yet.

CTA:

**Create first report**

## No current-quarter risks

> No active risks have been added for this quarter.

CTA:

**Add risk**

## No photos

> Add the project photographs you want to include in this quarter’s report.

CTA:

**Upload photos**

---

# 79. Error states

Handle:

- failed AI generation;
- partial AI generation;
- PDF generation failure;
- unsupported image;
- upload timeout;
- missing template;
- deleted collaborator;
- missing external slide;
- report conflict/concurrent edits.

Errors must never cause user inputs to disappear.

---

# 80. Concurrency

If multiple users edit a report:

- display presence where possible;
- avoid silent last-write-wins on major content;
- use optimistic concurrency/version checks;
- warn if a block changed since the user opened it;
- preserve version history.

MVP can use block-level or form-level conflict warnings rather than full Google Docs-style collaborative editing.

---

# 81. Responsive behaviour

Primary optimisation: desktop/laptop.

The full slide editor does not need to be ideal on mobile.

Mobile/tablet should still support:

- dashboard viewing;
- report status;
- comments;
- simple input updates;
- photo upload;
- review/approval.

For the editor on narrow screens, use a simplified preview + properties flow rather than squeezing the three-column interface.

---

# 82. Accessibility

- semantic form labels;
- keyboard navigation for major actions;
- adequate contrast;
- visible focus states;
- do not rely on colour alone for statuses;
- accessible tooltips;
- meaningful image alt text in the web app.

---

# 83. Security and confidentiality

Quarterly reports contain confidential investor/project information.

Requirements:

- authenticated access only;
- role-based permissions;
- project-level access controls;
- secure object storage;
- signed/private file URLs;
- server-side AI/API calls;
- no API keys exposed to browser;
- audit log;
- least-privilege access;
- deleted/archived report rules;
- ability to revoke access immediately through Impar OS user permissions.

If Supabase is used, implement Row Level Security appropriately rather than relying only on frontend checks.

---

# 84. AI data security

LLM calls must be performed from trusted server-side infrastructure.

Log:

- model used;
- prompt version;
- source references;
- generation timestamp.

Do not log confidential report content unnecessarily in generic application logs.

Create a clear abstraction for the AI provider so the provider/model can be changed without rebuilding the reporting workflow.

---

# 85. Suggested technical architecture

Use the existing Impar OS architecture where possible.

If a fresh Lovable implementation is required, a sensible architecture is:

## Frontend

- React
- TypeScript
- Tailwind CSS
- component library consistent with Impar OS / shadcn-style primitives if appropriate

## Backend / database

- Supabase/Postgres if aligned with current Impar OS
- Row Level Security
- object storage for photos, exports and template assets

## Server functions

Use server-side functions / Edge Functions / backend endpoints for:

- LLM requests;
- report generation orchestration;
- PDF rendering;
- future PPTX export;
- expensive QA checks;
- file processing.

## Job architecture

Long operations should use persisted job records:

```text
queued → processing → completed / failed
```

This avoids making the UI depend on one long HTTP request.

---

# 86. PDF rendering architecture

Recommended approach:

1. Store report in structured slide/block JSON.
2. Render the same slide components in a dedicated print/export route.
3. Use deterministic dimensions equivalent to 16:9.
4. Generate server-side PDF from the export route using a headless browser or equivalent renderer.
5. Validate output.
6. Store PDF in private storage linked to report version.

Important:

The web preview and export renderer should share the same layout components wherever possible to avoid visual drift.

---

# 87. Avoid screenshot-only architecture

Do not make the report a collection of rasterised screenshots in the database.

The report should remain structured so users can:

- edit copy;
- swap images;
- change layout;
- export future PPTX;
- run data QA;
- compare blocks between quarters.

Rasterisation may be used during PDF production where needed, but it should not be the source format.

---

# 88. Suggested visual direction for the Impar OS module

The module itself should feel like a premium internal operating tool, not like the investor report itself.

Recommended UI characteristics:

- calm;
- professional;
- information-dense but clean;
- strong hierarchy;
- neutral workspace background;
- clear project/report status colours;
- generous use of whitespace;
- high-quality table design;
- minimal decorative UI.

Inside the **slide canvas**, faithfully use the investor-report brand styles.

The surrounding Impar OS interface should remain separate from the report’s visual identity.

---

# 89. Investor report design cues observed in source material

The existing reports use a recognisable visual language including:

- dark navy cover backgrounds;
- architectural/project imagery;
- large editorial serif-style report titles;
- Impar Capital logo placement;
- clean white content pages;
- dark blue section headings;
- fine grey rules in tables;
- compact KPI icons;
- timelines;
- image-led architecture/construction pages;
- small confidentiality/legal footer text;
- consistent page numbering;
- structured section numbering.

The initial template library should reproduce these cues rather than inventing a new investor-report brand.

---

# 90. Project configuration screen

Path concept:

**Project → Reporting settings**

Tabs:

## General

- reporting template;
- report language;
- PM;
- reviewer;
- approver;
- financial/external slide requirements.

## Modules

Enable/disable and reorder modules.

## KPIs

Define project KPIs and ordering.

## Collaborators

Select project collaborators.

## Vehicle / Legal

Select vehicle and legal template.

## Report structure

Define recurring custom slides/sections.

## Branding/assets

Cover image, project logo if any, map/image assets.

---

# 91. Project setup wizard for new projects

When reporting is enabled for a new project, guide the admin/PM through:

1. Choose report template.
2. Choose project archetype.
3. Select modules.
4. Configure KPIs.
5. Configure timeline.
6. Add collaborators.
7. Link investment vehicle.
8. Upload cover image.
9. Configure external financial slides.
10. Preview default report structure.

This setup happens once, not every quarter.

---

# 92. Report content status at block level

Each block can have a small status:

- inherited;
- updated by user;
- AI generated;
- AI generated + edited;
- locked;
- needs review;
- approved.

This helps reviewers understand what changed.

Do not overload the UI; show these through subtle badges/tooltips when relevant.

---

# 93. AI “Generate report” should not be all-or-nothing

Generation should be resumable.

If 15 of 18 slides generate successfully and 3 fail, show the 15 successful slides and allow retry of only the failed blocks/slides.

Do not throw away a report draft because one model request failed.

---

# 94. Manual content is always authoritative

If the PM manually edits AI-generated content, future generation must not automatically overwrite it.

Mark manually edited blocks as:

**User edited**

When “Refresh whole report” is requested, prompt:

- Keep manual edits — default
- Regenerate selected manual blocks
- Regenerate everything

---

# 95. Regeneration diff

When regenerating a block, show:

**Current** vs **Suggested**

Actions:

- Replace
- Insert selected changes
- Keep current

At minimum, provide undo if a full diff UI is too complex for MVP.

---

# 96. Report completeness score

Show a progress/completeness percentage based on required inputs, not arbitrary slide count.

Example weights:

- previous objectives reviewed;
- current updates completed;
- required modules completed;
- KPI updates complete;
- risk review complete;
- next objectives complete;
- required photos present;
- QA blockers resolved.

Do not treat optional modules as missing work.

---

# 97. Reporting deadline support

Report records may have:

- due date;
- target review date;
- target approval date.

Dashboard can show:

- on track;
- due soon;
- overdue.

This should integrate with Impar OS notifications later.

---

# 98. Search and filtering in report history

Allow users to filter project reports by:

- year;
- quarter;
- status;
- version;
- author.

Allow full-text search across report titles and current project report content later if useful.

---

# 99. File naming

Support a configurable naming convention such as:

```text
YYYYMMDD_PROJECT_QX YYYY_Informe Trimestral Inversores.pdf
```

Examples from the existing material use conventions similar to:

```text
20260630_PC25_Q2 2026_Informe Trimestral Inversores.pdf
```

The system should generate this automatically from project configuration and report period.

---

# 100. Recommended MVP boundaries

## Must have

- integrated reporting dashboard;
- project report history;
- duplicate previous quarter;
- report/input wizard;
- general update;
- objectives loop;
- milestones;
- configurable KPIs;
- risks and mitigations;
- configurable project modules;
- photo upload and layout;
- LLM-generated copy;
- structured slide editor;
- approved layout library;
- custom slides;
- versioning;
- review status;
- comments or at least review notes;
- automated QA;
- PDF generation;
- private storage;
- project/module configuration;
- admin template library;
- locked external slides.

## Should have

- compare with previous quarter;
- content provenance UI;
- advanced AI rewrite controls;
- collaborator library;
- legal version management;
- reviewer/approver workflow;
- multi-subproject support.

## Later

- universal PPTX import;
- full editable PPTX export;
- live multi-user editing;
- automatic integrations with PlanRadar/Monday/etc.;
- financial model automation;
- portfolio-specific analytics engine;
- direct Investor Portal publishing;
- automated source ingestion from connected project systems.

---

# 101. MVP user journey — target experience

The ideal PM journey should be approximately:

```text
1. Open Quarterly Reporting
2. Select project
3. Click “Create Q3 2026”
4. Duplicate Q2 2026
5. Explain what changed this quarter
6. Review previous objectives
7. Update milestones
8. Update KPIs
9. Review risks
10. Complete only changed project modules
11. Add next-quarter objectives
12. Upload photographs
13. Generate report draft
14. Review slides
15. Fix QA warnings
16. Submit for review
17. Apply comments if required
18. Approve
19. Generate/download PDF
```

The user should never need to recreate static project information.

---

# 102. Example — how a quarter should evolve

Illustrative scenario:

### Previous quarter

- Construction progress: 76%
- Lift installation delayed
- CFO targeted for August
- Operator handover September
- Exit October

### PM Q3 inputs

- Works reached 96%
- Lift installation completed
- CFO signed 18 September
- LPO documentation submitted
- Operator handover moved to October
- Exit expected November

### System behaviour

Automatically identify:

- construction KPI changed 76% → 96%;
- previous lift risk can be marked resolved;
- CFO milestone moved from forecast to completed;
- handover date changed;
- exit date changed;
- executive summary needs to mention the new critical path;
- old Q2 references to “CFO in August” are stale;
- timeline needs to redraw;
- Q2 objective “complete CFO documentation” can be marked completed.

Then generate the updated report without the PM manually hunting through 20 slides.

This is the experience the product should optimise for.

---

# 103. Example — value-add residential project

Illustrative Velarde-type workflow:

PM updates:

- 4 additional units released;
- 2 refurbishments completed;
- 3 units under construction;
- sales pricing revised;
- first unit sold;
- 5 active tenant negotiations;

System should update:

- rental/tenant module;
- refurbishment module;
- sales/commercialisation module;
- unit timeline;
- KPI table;
- achievements;
- active risks;
- executive summary.

A generic “construction development” form would not be sufficient for this use case, hence the modular architecture.

---

# 104. Example — branded residences project

Illustrative Camino/Sagasta-type workflow:

PM updates:

- Marriott approved Schematic Design;
- licence submitted;
- new structural consultant appointed;
- showroom design started;
- pre-sales launch moved one month;

System should update:

- architecture;
- interior design;
- brand/Marriott;
- licensing;
- collaborators;
- marketing/commercialisation;
- timeline;
- risks/objectives;
- executive summary.

---

# 105. Acceptance criteria — report creation

The feature is acceptable when:

- a PM can create a new quarter from the previous approved report;
- the previous report is preserved unchanged;
- the new draft correctly links to its baseline;
- persistent data is inherited;
- quarter-specific copy is treated as context, not automatically presented as new;
- previous objectives are automatically loaded for review;
- active risks are carried forward;
- milestones persist;
- KPIs display previous values.

---

# 106. Acceptance criteria — AI

AI functionality is acceptable when:

- it can generate polished copy from natural PM notes;
- it can generate module updates independently;
- the PM can edit every non-locked generated text block;
- regenerating one block does not change unrelated blocks;
- generated copy has source references;
- unsupported facts are not deliberately invented;
- contradictions are flagged;
- character limits are respected or overflow is surfaced;
- user edits are not silently overwritten.

---

# 107. Acceptance criteria — editor

The editor is acceptable when a user can:

- view a slide preview;
- edit text;
- replace a photo;
- crop/reposition a photo;
- change to another approved layout;
- add/delete/duplicate/reorder slides;
- add a custom slide;
- see warnings;
- identify locked slides;
- preserve report branding.

It does not need pixel-level free positioning for MVP.

---

# 108. Acceptance criteria — QA

QA is acceptable when it can detect at least:

- wrong-quarter references;
- inconsistent dates across structured data and narrative;
- stale copied text from previous quarter;
- missing required inputs;
- text overflow;
- missing required external slides;
- low-resolution images;
- conflicting KPI/narrative values where values are explicitly detectable.

---

# 109. Acceptance criteria — export

Export is acceptable when:

- generated PDF visually matches preview;
- no content is clipped;
- correct report version is embedded/exported;
- correct legal copy is included;
- PDF file is stored and linked to the version;
- previously approved PDFs remain available;
- file naming is automatic.

---

# 110. Demo data Lovable should create

Create realistic demo records so the prototype is understandable immediately.

Use fictitious/demo-safe versions of these project patterns:

### Project A — Hospitality development

- 33 units
- construction progress 76%
- BREEAM target “Muy Bueno”
- operator contracted
- handover upcoming

### Project B — Branded residences

- licence recently obtained
- project executive complete
- Marriott/brand approvals in progress
- construction packages being tendered
- pre-sales underway

### Project C — Value-add residential

- 28 units
- occupied + vacant units
- phased tenant releases
- several units refurbished
- commercialisation active

This will demonstrate that the product supports distinct project types without building separate applications.

Do not hardcode the actual confidential project data from the provided reports into a public/demo environment.

---

# 111. Suggested dashboard demo states

Create sample cards/table rows representing:

- Draft 68%
- Ready for review
- Changes requested
- Approved
- Not started

Include a few QA warning examples so the product concept is visible.

---

# 112. Important implementation principle — configuration over hardcoding

Whenever a requirement differs between projects, prefer configuration.

Examples:

- active modules;
- KPI set;
- collaborators;
- slide order;
- project-specific custom sections;
- required external slides;
- review workflow.

Avoid building conditional frontend code such as:

```text
if project == Padre Claret...
```

The same product should serve future projects not yet known.

---

# 113. Important implementation principle — structured truth + generated presentation

The product must separate:

## Structured truth

- milestones;
- KPI values;
- risks;
- objectives;
- project metadata;
- collaborators;
- dates;
- images;
- status.

from:

## Generated presentation

- prose;
- selected achievements;
- slide layouts;
- explanatory narrative;
- captions;
- summary.

Whenever possible, the report should render values directly from structured truth rather than asking the LLM to repeat/recalculate them.

---

# 114. Important implementation principle — source-of-truth hierarchy

When sources conflict, do not let the LLM silently decide.

Recommended hierarchy:

1. Explicit current-quarter PM confirmed input
2. Current structured project master data
3. Current structured KPI/milestone/risk/objective records
4. Approved current source documents
5. Previous approved quarterly report

If two sources at the same priority conflict, create a QA warning.

Allow an authorised user to choose the correct value.

---

# 115. Important implementation principle — immutable published artefacts

A generated and approved PDF is evidence of what investors received.

Once published:

- keep the PDF immutable;
- keep the version snapshot immutable;
- if corrections are needed, create a new report version;
- preserve who approved and when.

---

# 116. Suggested implementation phases

## Phase 1 — Functional reporting engine

- data model;
- dashboard;
- project history;
- duplicate quarter;
- inputs;
- structured modules;
- LLM drafting;
- basic templates;
- PDF.

## Phase 2 — Strong editor + QA

- structured canvas;
- layout variants;
- comments/review;
- change comparison;
- advanced QA;
- provenance.

## Phase 3 — Admin scale

- template manager;
- collaborator library;
- legal versioning;
- multi-subproject improvements;
- portfolio reporting improvements.

## Phase 4 — Integrations

- data ingestion from project tools;
- investor portal publishing;
- SharePoint/OneDrive;
- financial integration;
- PPTX export/import enhancements.

---

# 117. What Lovable should build now

Lovable should generate a polished, working product shell covering the complete MVP workflow, not merely static mock screens.

At minimum, implement:

1. Navigation/routes
2. Dashboard
3. Project workspace
4. Report history
5. Create-report flow
6. Quarter update wizard
7. Objectives review
8. Milestones
9. KPI editor
10. Risk editor
11. Project module forms
12. Photo manager
13. Custom section creation
14. Generation summary
15. AI generation service abstraction
16. Slide editor
17. Layout selector
18. Slide/block editing
19. QA review
20. Review/approval status flow
21. Version history
22. PDF export pipeline/interface
23. Project reporting configuration
24. Template manager
25. Locked/external slides
26. Demo data
27. Loading/empty/error states
28. Permission-aware UI

The application should be fully navigable with realistic state transitions.

---

# 118. Detailed Lovable build instruction

Treat this specification as the source of truth.

Do not simplify the product into a single form followed by a generated text preview.

The key product differentiation is the combination of:

- historical quarter inheritance;
- structured project data;
- modular PM inputs;
- AI generation;
- reusable slide templates;
- flexible structured editor;
- automated QA;
- versioned investor-ready export.

Build the system around those concepts.

---

# 119. UX copy recommendations

Use concise product language.

Preferred labels:

- Quarterly Reporting
- Create report
- Create next quarter
- Duplicate previous quarter
- Quarter update
- What changed this quarter?
- Previous quarter
- Current quarter
- No material changes
- Structure with AI
- Suggest with AI
- Generate report draft
- Report editor
- Change layout
- View sources
- Run quality check
- Ready for review
- Request changes
- Approve report
- Generate PDF
- Version history

Avoid calling the product a “PowerPoint generator”.

---

# 120. Final product success definition

The project succeeds if a PM can produce a high-quality quarterly report by spending most of their time **confirming what changed**, rather than copying, rewriting and reformatting a previous PowerPoint.

The system should make the quarterly reporting process:

- faster;
- easier;
- more consistent;
- less repetitive;
- less error-prone;
- traceable;
- scalable across dozens of projects;
- flexible enough to support project-specific information;
- visually consistent with Impar Capital standards.

The intended operating model is:

> **Human supplies facts and judgement → system structures context → AI drafts → human edits and approves → system validates and publishes.**

That principle should guide every product and technical decision.

---

# 121. Build priority summary

If trade-offs are required, prioritise in this order:

1. **Quarter-to-quarter inheritance and change-based workflow**
2. **Correct structured data and no factual invention**
3. **Simple PM input experience**
4. **High-quality AI drafting**
5. **Reliable structured slide generation**
6. **Human editing flexibility**
7. **QA and consistency checking**
8. **Versioning and auditability**
9. **Perfect reproduction of every historical visual edge case**
10. **Advanced PowerPoint-like editing**

Do not sacrifice operational usability in order to build unrestricted slide-editing functionality.

---

# 122. Open architecture decisions to keep configurable

Do not hardcode the following assumptions permanently:

- which LLM provider/model is used;
- whether PPTX export is enabled;
- whether external financial slides are mandatory;
- exact approval chain;
- exact list of modules;
- exact KPI list;
- exact report template;
- exact legal disclaimer;
- exact destination for published PDFs;
- exact storage provider if Impar OS changes infrastructure.

Use abstractions/configuration so these can evolve.

---

# 123. Closing instruction to Lovable

Build **Quarterly Reporting** as a serious internal operating system module for a professional real-estate investment manager.

It should feel closer to a purpose-built reporting workflow combining the strengths of a project-management system, an AI document assistant and a lightweight controlled presentation editor than to a generic form builder.

The PM should not need to understand templates, prompt engineering or document automation internals.

The interface should guide them through the business process naturally:

> **What changed? → confirm data → generate → review → approve → export.**

Preserve the underlying report history, preserve investor-facing quality, and make every future quarter easier than the previous one.

