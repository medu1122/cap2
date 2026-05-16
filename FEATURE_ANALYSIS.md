# AIMAP System - Complete Feature Analysis

## System Overview
AIMAP is an AI-powered marketing campaign automation platform for small businesses in Vietnam. It includes a backend API (FastAPI), an agent service for content generation, and a frontend (Next.js).

---

## FEATURES BY MODULE

### 1. AUTHENTICATION & USER MANAGEMENT
**Module:** `/api/routers/auth.py`

#### Features:
- **User Registration** - Email-based account creation with password hashing
  - What: Users create accounts with email and password
  - Actor: User (unauthenticated)

- **User Login** - Generate JWT access tokens for authenticated sessions
  - What: Issue bearer tokens for API access
  - Actor: User

- **Get User Profile** - Retrieve current user information
  - What: Return logged-in user details
  - Actor: User

- **Update User Preferences** - Manage user settings (email reminders)
  - What: Toggle email reminder notifications on/off
  - Actor: User

---

### 2. BRAND MANAGEMENT
**Module:** `/api/routers/brands.py`

#### Features:
- **AI Brand Description Generator** - Generate brand description using AI
  - What: Qwen/OpenAI generates marketing-focused description for a brand name
  - Actor: User

- **List User Brands** - Retrieve all brands owned by user
  - What: Get brand list with descriptions, tone, colors, etc.
  - Actor: User

- **Create Brand** - Create a new brand profile
  - What: Create brand with name, description, tone of voice, target audience, key products, forbidden words, preferred CTA
  - Actor: User

- **Get Brand Details** - Retrieve single brand profile
  - What: Get full brand information including all metadata
  - Actor: User

- **Update Brand** - Modify brand information
  - What: Update any brand fields
  - Actor: User

- **Count Brand Campaigns** - Get number of campaigns for a brand
  - What: Count campaigns before deletion
  - Actor: User

---

### 3. CAMPAIGN MANAGEMENT
**Module:** `/api/routers/campaigns.py`

#### Features:
- **AI Campaign Suggestion** - Generate campaign ideas based on campaign name
  - What: Qwen/OpenAI suggests campaign objectives, target audiences, hooks, channels
  - Actor: User

- **List Campaigns** - Get all campaigns for authenticated user
  - What: Return campaigns with pagination, filtering by status
  - Actor: User

- **Create Campaign** - Create new campaign with brief
  - What: Create campaign with objective, product, target audience, offer, deadline, channels
  - Actor: User

- **Get Campaign Details** - Retrieve full campaign information
  - What: Return campaign brief, plan, content items, execution logs
  - Actor: User

- **Execute Campaign Delivery** - Send campaign content to customers
  - What: Execute email delivery, SMS simulation, track opens/clicks
  - Actor: User (triggers delivery execution)

- **Get Campaign Delivery Summary** - View delivery statistics
  - What: Return delivery metrics (sent, opened, clicked, failed, bounced)
  - Actor: User

- **Run Campaign with AI Orchestration** - Trigger full campaign generation pipeline
  - What: Dispatch to agent service for strategy→content writing→quality review→scheduling
  - Actor: User

- **Delete Campaign** - Remove campaign
  - What: Delete campaign and associated content
  - Actor: User

- **Toggle Auto-Schedule** - Enable/disable automatic content scheduling
  - What: Auto-schedule content items across channels based on campaign deadline
  - Actor: User

---

### 4. CAMPAIGN IDEAS & SUGGESTIONS
**Module:** `/api/routers/campaign_idea.py`

#### Features:
- **Suggest Campaign Ideas** - AI generates multiple campaign suggestions
  - What: Suggest campaigns by industry, events (Tết, Valentine, etc), seasonal patterns
  - Actor: User

- **Generate Campaign Brief** - Convert suggestion to full campaign brief
  - What: AI writes comprehensive brief with title, objective, hook, channels
  - Actor: User

- **List Campaign Ideas** - Get all saved campaign ideas
  - What: Return list of idea drafts
  - Actor: User

- **Create Campaign Idea** - Save campaign idea from suggestion
  - What: Store idea in draft state for later use
  - Actor: User

- **Get Campaign Idea** - Retrieve specific idea
  - What: Return full idea details
  - Actor: User

- **Update Campaign Idea** - Modify idea fields
  - What: Update title, objective, channels, timing, segment
  - Actor: User

- **Delete Campaign Idea** - Remove idea
  - What: Delete draft idea
  - Actor: User

- **Build Email Content from Idea** - Generate email from campaign idea
  - What: AI writes subject, body for email based on idea
  - Actor: User

- **Build Social Post from Idea** - Generate Facebook post from idea
  - What: AI writes copy and hashtags for Facebook
  - Actor: User

- **Build Video Script from Idea** - Generate video script from idea
  - What: AI writes hook, body, CTA, duration estimate for video
  - Actor: User

- **Build Image Prompt from Idea** - Generate DALL-E prompt from idea
  - What: AI generates marketing-focused image prompt for campaign
  - Actor: User

---

### 5. CONTENT MANAGEMENT
**Module:** `/api/routers/content.py`

#### Features:
- **List Content Items** - Get all content with filtering
  - What: List content by campaign, channel, status
  - Actor: User

- **Get Content Item** - Retrieve specific content
  - What: Return content JSON, metadata, version
  - Actor: User

- **Update Content** - Edit content manually
  - What: Modify content JSON (copy, subject, body, etc) and reschedule
  - Actor: User

- **Approve Content** - Mark content as approved
  - What: Approve pending_approval content, trigger campaign status update if all approved
  - Actor: User

- **Reject Content** - Reject and provide feedback
  - What: Set status to rejected with rejection note
  - Actor: User

- **Schedule Content** - Set publication date
  - What: Assign scheduled_date for future delivery
  - Actor: User

- **Regenerate Content** - Request AI rewrite
  - What: Call writer agent to rewrite content for channel
  - Actor: User

---

### 6. CONTENT CALENDAR & SCHEDULING
**Module:** `/api/routers/calendar.py`

#### Features:
- **View Content Calendar** - Calendar view of scheduled content
  - What: Show approved/pending content by month with preview
  - Actor: User

- **Get Calendar for Month** - Retrieve calendar data with filtering
  - What: Filter by month, channel, status; show copy preview
  - Actor: User

- **Suggest Reschedule Dates** - AI suggests optimal posting dates
  - What: Recommend smart scheduling based on campaign deadline, channels, existing items
  - Actor: System (internal service)

- **Reschedule Content** - Move content to different date
  - What: Update scheduled_date for content
  - Actor: User

---

### 7. WORKFLOW & AUTOMATION
**Module:** `/api/routers/workflow.py`

#### Features:
- **List Workflow Presets** - Get predefined automation templates
  - What: Return available workflow types (win-back, loyalty, seasonal, etc)
  - Actor: User

- **Trigger Workflow** - Start a workflow execution
  - What: Create campaign from preset with customer targeting
  - Actor: User

- **Upload Customer List** - Import customers from CSV
  - What: Parse CSV, segment customers, store in database
  - Actor: User

- **List Workflow Jobs** - Get all triggered jobs
  - What: Return job history with status, timestamps
  - Actor: User

- **List Workflow Schedules** - Get all scheduled automations
  - What: Return recurring schedules with cron expressions
  - Actor: User

- **Create Schedule** - Setup recurring campaign generation
  - What: Create cron-based schedule (hourly, daily, weekly) for campaign generation
  - Actor: User

- **Update Schedule** - Modify schedule parameters
  - What: Change cron expression, preset type
  - Actor: User

- **Toggle Schedule** - Enable/disable automation
  - What: Set is_active flag
  - Actor: User

- **Delete Schedule** - Remove automation
  - What: Delete schedule definition
  - Actor: User

- **Auto-Execute Due Schedules** - Background job that runs scheduled campaigns
  - What: Check next_run_at, generate campaigns, update next_run_at
  - Actor: System (scheduled task)

---

### 8. CUSTOMER MANAGEMENT & ANALYSIS
**Module:** `/api/routers/workflow.py` + `services/customer_analysis_service.py`

#### Features:
- **Upload Customer File** - Import customer data
  - What: Upload CSV with customer info (name, email, phone, spend, purchase history)
  - Actor: User

- **Auto-Segment Customers** - AI-powered segmentation
  - What: Categorize customers into: inactive (60+ days), VIP (10k+ spend or 10+ orders), potential, unknown
  - Actor: System

- **Analyze Customer Rows** - Parse and extract customer analytics
  - What: Extract spend, repeat count, days since last purchase; group by segment
  - Actor: System

- **Generate Customer Analysis Narrative** - AI customer insights
  - What: Use LLM to generate business recommendations based on customer data
  - Actor: System

---

### 9. DASHBOARD & ANALYTICS
**Module:** `/api/routers/dashboard.py` + `services/dashboard_service.py`

#### Features:
- **Dashboard Statistics** - Real-time campaign metrics
  - What: Show total campaigns, content items, pending approvals, content by channel, recent campaigns, recent agent logs
  - Actor: User

- **AI Summary Generation** - Generate dashboard insights
  - What: Use LLM to generate 2-3 sentence summary with recommendations
  - Actor: System

---

### 10. INSIGHTS & DEEP ANALYSIS
**Module:** `/api/routers/insights.py`

#### Features:
- **Deep Analysis Upload** - Analyze business metrics data
  - What: Upload CSV with revenue, ad spend, orders, leads data
  - Actor: User

- **Auto-Map Columns** - Intelligent column detection
  - What: Map Vietnamese column names to standard metrics (revenue, ad_spend, orders, leads, repeat_orders)
  - Actor: System

- **Run Deep Analysis** - AI analysis of business metrics
  - What: DeepSeek/Ollama analyzes data, generates insights on:
    - Revenue trends
    - ROI analysis
    - Customer acquisition patterns
    - Churn risk identification
    - Seasonal patterns
  - Actor: System

- **Stream Deep Analysis** - Real-time analysis streaming
  - What: Return NDJSON stream of analysis progress
  - Actor: System

- **List Analysis Runs** - Get all analysis history
  - What: Return all deep analysis reports with timestamps
  - Actor: User

- **Get Analysis Result** - Retrieve specific analysis
  - What: Return full analysis data, insights, recommendations
  - Actor: User

- **Reanalyze** - Re-run analysis with new parameters
  - What: Re-analyze same dataset with different business context
  - Actor: User

- **Reanalyze Stream** - Stream re-analysis results
  - What: Return NDJSON stream of re-analysis
  - Actor: System

---

### 11. INSIGHTS CHAT & CONVERSATIONAL ANALYTICS
**Module:** `/api/routers/insights_chat.py` + `services/insight_intelligence/`

#### Features:
- **Create Data Source** - Upload analytics data for conversation
  - What: Store table data manually or from file upload
  - Actor: User

- **Update Data Source** - Modify data source
  - What: Update data or metadata
  - Actor: User

- **List Data Sources** - Get all uploaded datasets
  - What: Return data sources with preview
  - Actor: User

- **Create Chat Session** - Start conversation about data
  - What: Create InsightChat for conversational analysis
  - Actor: User

- **Send Message** - Chat with data intelligence
  - What: Process user query with multiple agents:
    - **Context Builder** - Enhance query with business context
    - **Entity Linker** - Link referenced entities to data columns
    - **Intent Classifier** - Classify query intent (KPI, trend, anomaly, comparison, visualization, guidance)
    - **Calculator Agent** - Compute KPI, trends, anomalies
    - **Data Manipulation Agent** - Transform/filter data
    - **Visualization Planner** - Suggest charts
    - **Guidance Agent** - Business recommendations
    - **Response Formatter** - Format response with insights
  - Actor: User

- **Get Chat History** - Retrieve conversation
  - What: Return all messages in chat
  - Actor: User

---

### 12. CONTENT APPROVAL WORKFLOW
**Module:** `/api/routers/content.py`

#### Features:
- **Approve/Reject Interface** - Manual content review
  - What: UI for approving or rejecting AI-generated content
  - Actor: User

- **Content Status Tracking** - Monitor content lifecycle
  - What: Track: pending_approval → approved/rejected → scheduled → executed
  - Actor: System/User

---

### 13. CAMPAIGN EXECUTION & DELIVERY
**Module:** `services/campaign_delivery_service.py`

#### Features:
- **Send Email** - Deliver campaign emails
  - What: SMTP email sending with tracking pixels and click links
  - Actor: System

- **Send SMS (Simulation)** - Mock SMS delivery
  - What: Log SMS delivery to log table (actual SMS integration pending)
  - Actor: System

- **Email Tracking** - Track opens and clicks
  - What: Pixel tracking for opens, redirect tracking for clicks
  - Actor: System (non-authenticated endpoints)

- **Merge Campaign Delivery Data** - Update delivery plan
  - What: Update campaign_plan_json with delivery metrics
  - Actor: System

---

### 14. EMAIL REMINDERS
**Module:** `services/calendar_reminder_service.py`

#### Features:
- **Daily Calendar Reminders** - Email users about today's content
  - What: Send daily email with list of content scheduled for today
  - Actor: System (scheduled task)

- **User Preference Control** - Control reminder receipt
  - What: Respect user.email_reminder_enabled flag
  - Actor: User (via auth.patch /me)

---

### 15. EMAIL & CLICK TRACKING
**Module:** `/api/routers/tracking.py`

#### Features:
- **Track Email Opens** - Pixel-based open tracking
  - What: 1x1 GIF pixel logs opened_at timestamp
  - Actor: System (mail client)

- **Track Link Clicks** - Redirect-based click tracking
  - What: Redirect to target URL while logging clicked_at
  - Actor: System (user click)

---

### 16. IMAGE GENERATION
**Module:** `services/image_prompt_generator.py`

#### Features:
- **Generate Image Prompts** - AI-powered prompt generation for DALL-E 3
  - What: Create marketing-focused prompts based on campaign context
  - Actor: System

---

### 17. AI AGENT ORCHESTRATION
**Module:** `agent/` directory

#### Components:

**Strategist Agent** (`agents/strategist.py`)
- Input: Campaign brief with brand context
- Output: Campaign strategy with:
  - Campaign summary
  - Key messages
  - Deliverables (per channel with tone hints, CTAs)
- Actor: System (called by orchestrator)

**Writer Agent** (`agents/writer.py`)
- Input: Deliverable spec, campaign strategy, brand context
- Output: Channel-specific content:
  - **Email**: subject, body
  - **Facebook**: copy, hashtags
  - **Video**: hook, body, cta, duration
- Actor: System

**Critic Agent** (`agents/critic.py`)
- Input: Draft content, campaign context, brand guidelines
- Output: Quality assessment with:
  - Status: approved/revised
  - Issues found
  - Final corrected content
- Actor: System

**Router** (`llm/router.py`)
- Intelligently routes between Qwen (local) and OpenAI (cloud) LLM
- Fallback mechanism for reliability
- Actor: System

---

### 18. INSIGHT INTELLIGENCE ENGINES
**Module:** `services/insight_intelligence/`

#### Components:

**ContextBuilder** - Builds enriched context from data sources and chat history

**IntentClassifier** - Classifies user query intent:
- kpi_query
- trend_analysis
- anomaly_detection
- comparison
- visualization_request
- guidance_request

**EntityLinker** - Links user mentions to actual data columns

**CalculatorAgent** - Computes:
- KPIs (sum, avg, max, min, count)
- Trends (growth rate, direction, peak/valley)
- Anomalies (outliers, statistical anomalies)
- Comparisons (A vs B differences)

**DataManipulationAgent** - Filters, transforms, aggregates data

**VisualizationPlanner** - Suggests appropriate charts (line, bar, pie, scatter)

**GuidanceAgent** - Business recommendations based on data insights

**ResponseFormatter** - Formats response with:
- Natural language explanation
- Computed values with units
- Visualizations/charts
- Actionable recommendations

---

## SUMMARY BY ACTOR

### USER FEATURES (40+ actions)
1. Register/Login/Profile management
2. Create and manage brands
3. Create and manage campaigns
4. View campaign details and delivery metrics
5. Approve/reject AI-generated content
6. Schedule content for publication
7. Regenerate content with AI
8. View content calendar
9. Upload and manage customer lists
10. Trigger workflow automations
11. Create scheduled campaigns (recurring)
12. Upload business metrics for analysis
13. View dashboard with analytics
14. Chat with data (insights questions)
15. Create data sources for insights
16. View campaign ideas and suggestions
17. Manage user preferences (email reminders)
18. Export/view execution logs

### SYSTEM FEATURES (15+ automated processes)
1. AI campaign suggestion
2. AI brand description generation
3. Campaign orchestration (strategy → writing → review → scheduling)
4. Content generation across 3 channels (email, social, video)
5. Quality review and content correction
6. Automatic content scheduling
7. Email delivery with tracking
8. SMS simulation
9. Open and click tracking
10. Email reminders (daily calendar)
11. Scheduled workflow execution
12. Customer segmentation
13. Deep business metrics analysis
14. Conversational data intelligence
15. Image prompt generation for DALL-E

---

## KEY WORKFLOWS

### Campaign Creation End-to-End
1. User creates campaign with brief
2. User submits for AI orchestration
3. **System**: Strategist generates campaign plan
4. **System**: Writer generates content for each channel
5. **System**: Critic reviews and corrects content
6. **System**: Smart scheduler assigns publication dates
7. **User**: Reviews calendar, approves/rejects content
8. **System**: Email reminders for scheduled content
9. **User**: Executes delivery
10. **System**: Tracks opens/clicks

### Workflow Automation
1. User uploads customer list
2. System auto-segments customers
3. User creates/selects workflow schedule
4. **System** (hourly): Checks if schedule is due
5. **System**: Generates campaign from preset
6. **System**: Runs full orchestration
7. **System**: Schedules content
8. **System**: Delivers to segment

### Data Insights
1. User uploads business metrics CSV
2. System auto-maps columns to metrics
3. System runs deep analysis (AI-powered)
4. User views analysis results
5. User asks follow-up questions via chat
6. System processes with intelligence engines
7. System returns insights with recommendations

---

## TECHNICAL NOTES

### AI/LLM Integration
- **Primary Models**: Qwen 2.5 (14B), OpenAI GPT-4o, DeepSeek
- **Deployment**: Qwen via Ollama (local), OpenAI via API (cloud)
- **Router Strategy**: Try local first, fallback to cloud

### Data Storage
- Relational: PostgreSQL with SQLAlchemy ORM
- Files: Local uploads + optional Cloudinary CDN
- Migrations: Alembic

### Real-time Features
- Streaming analysis via NDJSON
- WebSocket-ready architecture
- Background job scheduling (APScheduler)

### Integrations
- Email: SMTP (fully integrated)
- SMS: Simulation mode (ready for provider integration)
- Image Generation: DALL-E 3 (via OpenAI)
- Data Analysis: DeepSeek/Ollama

---

## CONCLUSION
AIMAP provides a comprehensive AI-driven marketing automation suite with 50+ distinct features spanning campaign management, content generation, analytics, and automation—enabling small businesses to run sophisticated marketing campaigns with minimal manual effort.
