# Architecture

How the Product Manual Assistant is built.

## Overview

The app is a single-page application that runs entirely in the browser. No backend server needed — it calls external APIs directly and stores data in localStorage.

Key design decisions:

- **Client-side PDF processing** — PDF.js handles parsing in the browser
- **External AI services** — ScaleDown for compression, Gemini for categorization and chat
- **Local storage** — Manuals, annotations, and settings persist in localStorage
- **No build step** — Plain HTML/CSS/JS, just open index.html

### Design Principles

1. **Client-Side Processing**: All PDF parsing and rendering happens in the browser
2. **Stateless Backend**: No server required; uses external APIs directly
3. **Local Persistence**: User data stored in localStorage
4. **Progressive Enhancement**: Core features work without APIs; AI enhances experience
5. **Responsive Design**: Adapts to desktop, tablet, and mobile viewports

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Header  │ │  Chat    │ │  Panels  │ │  Modals  │           │
│  │  + Nav   │ │  Panel   │ │ (Slide)  │ │ (Overlay)│           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LOGIC                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │   PDF    │ │ Knowledge│ │   Chat   │ │Annotation│           │
│  │ Handler  │ │ Extractor│ │  System  │ │  Engine  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                 │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │   State Object   │    │   localStorage   │                  │
│  │   (Runtime)      │◄──►│   (Persistence)  │                  │
│  └──────────────────┘    └──────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │  PDF.js  │ │ScaleDown │ │  Gemini  │                        │
│  │  (CDN)   │ │   API    │ │   API    │                        │
│  └──────────┘ └──────────┘ └──────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### UI Components

#### 1. Header (`glass-header`)
- Logo and branding
- Action buttons (Search All, Metrics, Feedback)
- Library and Configuration triggers
- Theme toggle

#### 2. Side Navigation (`side-nav`)
- Panel triggers (Visuals, Knowledge, Troubleshoot, Annotate)
- Active state management
- Responsive collapse on mobile

#### 3. Chat Panel (`chat-panel`)
- Message display area
- Quick action chips
- Image preview area
- Input with attachment menu

#### 4. Slide Panels (`slide-panel`)
- **Visuals**: Page gallery with search
- **Knowledge**: Categorized knowledge cards
- **Troubleshoot**: Issue selector and workflow
- **Annotate**: Canvas and tools

#### 5. Modal Overlays
- Configuration modal
- Library modal
- Safety/Warranty/Parts modals
- Metrics dashboard
- Survey form
- Cross-search modal
- Image viewer

### CSS Architecture

The stylesheet follows a component-based organization:

```css
/* 1. CSS Variables (Theming) */
:root { ... }
[data-theme="dark"] { ... }

/* 2. Reset & Base Styles */
* { ... }
body { ... }

/* 3. Background & Decorations */
.background-blobs { ... }
.blob { ... }

/* 4. Layout Components */
.app-container { ... }
.glass-header { ... }
.side-nav { ... }
.main-content { ... }

/* 5. UI Components */
.glass-card { ... }
.primary-btn { ... }
.icon-btn { ... }

/* 6. Feature-Specific Styles */
.chat-container { ... }
.knowledge-list { ... }
.annotation-layer { ... }

/* 7. Responsive Breakpoints */
@media (max-width: 991px) { ... }
@media (max-width: 480px) { ... }
```

---

## Data Flow

### PDF Processing Pipeline

```
┌──────────┐
│ PDF File │
└────┬─────┘
     │ FileReader API
     ▼
┌──────────────────┐
│ ArrayBuffer Data │
└────────┬─────────┘
         │ PDF.js getDocument()
         ▼
┌──────────────────┐
│   PDF Document   │
│   (numPages, etc)│
└────────┬─────────┘
         │ Loop through pages
         ▼
┌──────────────────────────────────────────┐
│              Per Page:                    │
│  ┌─────────────┐    ┌─────────────────┐  │
│  │getTextContent│    │render(canvas)   │  │
│  │             │    │                  │  │
│  │ Text Items  │    │ Thumbnail Image │  │
│  └──────┬──────┘    └────────┬────────┘  │
│         │                    │           │
│         ▼                    ▼           │
│  ┌──────────────────────────────────┐   │
│  │        extractStructuredText()   │   │
│  │        - Group by Y position     │   │
│  │        - Sort by X position      │   │
│  │        - Handle columns/tables   │   │
│  └──────────────────────────────────┘   │
└──────────────────────────────────────────┘
         │
         ▼ If text < 100 chars
┌──────────────────┐
│  OCR Fallback    │
│  (Gemini Vision) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   state.pdfPages │
│   [{pageNum,     │
│     text,        │
│     imageSrc,    │
│     links}]      │
└──────────────────┘
```

### Knowledge Extraction Pipeline

```
┌─────────────────┐
│  state.pdfPages │
└────────┬────────┘
         │ For each page
         ▼
┌─────────────────────────┐
│      ScaleDown API      │
│  - Compress text (95%)  │
│  - Preserve structure   │
│  - Clean formatting     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│    Compressed Pages     │
│  [{page, text}, ...]    │
└───────────┬─────────────┘
            │ Concatenate
            ▼
┌─────────────────────────┐
│      Gemini API         │
│  - Categorize content   │
│  - Extract to JSON      │
│  - Split by category    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  processStructuredKnowledge()
│  - Normalize entries    │
│  - Filter placeholders  │
│  - Build buckets        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ state.knowledgeBuckets  │
│  {safety: [...],        │
│   parts: [...],         │
│   warranty: [...], ...} │
└─────────────────────────┘
```

### Chat (RAG) Pipeline

```
┌──────────────┐
│ User Query   │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│   Intent Detection   │
│  - Match keywords    │
│  - Determine category│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Context Retrieval   │
│  - Get category items│
│  - Fallback to all   │
│  - Build context str │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│    Prompt Building   │
│  - System context    │
│  - Manual content    │
│  - User question     │
│  - Image (if any)    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│      Gemini API      │
│  - Generate response │
│  - Include references│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  marked.parse()      │
│  - Render markdown   │
│  - Display to user   │
└──────────────────────┘
```

---

## State Management

### State Object Structure

```javascript
const state = {
    // ═══════════════════════════════════════════════
    // API CONFIGURATION
    // ═══════════════════════════════════════════════
    scaledownKey: "",       // ScaleDown API key
    scaledownModel: "",     // ScaleDown model (e.g., "gpt-4o")
    geminiKey: "",          // Google Gemini API key
    geminiModel: "",        // Selected Gemini model
    
    // ═══════════════════════════════════════════════
    // PDF DATA
    // ═══════════════════════════════════════════════
    pdfPages: [
        {
            pageNum: 1,
            text: "Extracted text...",
            imageSrc: "data:image/jpeg;base64,...",
            links: ["https://..."]
        }
    ],
    
    // ═══════════════════════════════════════════════
    // EXTRACTED KNOWLEDGE
    // ═══════════════════════════════════════════════
    knowledgeBuckets: {
        safety: [{ page: 1, text: "..." }],
        parts: [{ page: 2, text: "..." }],
        warranty: [...],
        procedures: [...],
        errors: [...],
        video: [...]
    },
    
    // ═══════════════════════════════════════════════
    // MANUAL LIBRARY
    // ═══════════════════════════════════════════════
    manualLibrary: [
        {
            id: "1234567890",
            name: "Product_Manual.pdf",
            pageCount: 50,
            dateAdded: "2024-01-01T00:00:00Z",
            pages: [...] // Same structure as pdfPages
        }
    ],
    currentManualId: null,
    
    // ═══════════════════════════════════════════════
    // UI STATE
    // ═══════════════════════════════════════════════
    isProcessing: false,
    theme: "light",         // "light" | "dark"
    currentTool: "select",  // Annotation tool
    annotationColor: "#ff4d4f",
    
    // ═══════════════════════════════════════════════
    // CHAT STATE
    // ═══════════════════════════════════════════════
    chatImageData: {
        base64: "...",
        mimeType: "image/jpeg",
        preview: "data:image/jpeg;base64,..."
    },
    
    // ═══════════════════════════════════════════════
    // ANNOTATIONS
    // ═══════════════════════════════════════════════
    annotations: {
        1: [  // Page number as key
            {
                id: 1234567890,
                type: "rect",  // rect|circle|arrow|marker|text
                x1: 100, y1: 100, x2: 200, y2: 200,
                color: "#ff4d4f"
            },
            {
                id: 1234567891,
                type: "marker",
                x: 150, y: 150,
                label: "Component A",
                color: "#1890ff"
            }
        ]
    },
    
    // ═══════════════════════════════════════════════
    // METRICS & ANALYTICS
    // ═══════════════════════════════════════════════
    metrics: {
        totalQueries: 0,
        resolvedQueries: 0,
        ticketsPrevented: 0,
        categoryStats: {
            safety: 0,
            parts: 0,
            warranty: 0,
            procedures: 0,
            errors: 0,
            video: 0
        },
        ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        activityLog: [
            {
                time: "2024-01-01T00:00:00Z",
                type: "query",
                description: "Asked about warranty"
            }
        ],
        surveys: [...]
    },
    
    // ═══════════════════════════════════════════════
    // SURVEY STATE (Temporary)
    // ═══════════════════════════════════════════════
    surveyData: {
        found: null,
        rating: 0,
        support: null,
        comments: ""
    }
};
```

### localStorage Keys

| Key | Content | Size Estimate |
|-----|---------|---------------|
| `mn_scaledown_key` | ScaleDown API key | ~50 bytes |
| `mn_scaledown_model` | Model selection | ~20 bytes |
| `mn_gemini_key` | Gemini API key | ~50 bytes |
| `mn_gemini_model` | Model selection | ~30 bytes |
| `mn_theme` | Theme preference | ~10 bytes |
| `mn_annotations` | All page annotations | Variable |
| `mn_metrics` | Usage metrics | Variable |
| `mn_manual_library` | Stored manuals | **Large** (5-10MB) |

---

## Module Breakdown

### Core Modules

#### 1. Initialization (`initializeApp`)
```javascript
function initializeApp() {
    // 1. Apply saved theme
    // 2. Load saved API keys to form
    // 3. Fetch available Gemini models
    // 4. Render manual library
    // 5. Update metrics display
    // 6. Setup all event listeners
}
```

#### 2. PDF Processing (`handlePDF`)
```javascript
async function handlePDF(file) {
    // 1. Validate file type
    // 2. Read as ArrayBuffer
    // 3. Load with PDF.js
    // 4. Loop through pages:
    //    - Extract text
    //    - Generate thumbnail
    //    - OCR fallback if needed
    // 5. Save to library
    // 6. Trigger knowledge extraction
}
```

#### 3. Knowledge Extraction (`extractKnowledge`)
```javascript
async function extractKnowledge(pages) {
    // 1. Compress each page via ScaleDown
    // 2. Build combined context
    // 3. Send to Gemini for categorization
    // 4. Process and normalize results
    // 5. Update UI (graph, list)
}
```

#### 4. Chat System (`handleChat`)
```javascript
async function handleChat() {
    // 1. Get user query
    // 2. Detect intent/category
    // 3. Retrieve relevant context
    // 4. Build prompt with context
    // 5. Call Gemini API
    // 6. Render response with Marked.js
    // 7. Update metrics
}
```

#### 5. Annotation Engine
```javascript
// Tool selection
function selectAnnotationTool(tool)

// Page loading
function loadPageForAnnotation(pageNum)

// Drawing handlers
function setupAnnotationHandlers(canvas, layer, pageNum)

// Shape creation
function createShapeElement(tool, x, y)
function updateShapeElement(el, tool, x1, y1, x2, y2)

// Annotation persistence
function saveAnnotation(pageNum, annotation)
function loadAnnotationsForPage(pageNum)
function renderAnnotation(layer, ann)

// Export
function exportAnnotatedImage()
function getAnnotatedPageImage()
```

### Utility Functions

```javascript
// UI Helpers
function showToast(message, type)
function openModal(id)
function closeModal(id)
function openSlidePanel(panelId)
function closeSlidePanel(panelId)

// Data Helpers
function downloadFile(content, filename, type)
function escapeHtml(text)
function highlightSearchTerm(html, query)

// API Calls
async function callScaleDown(context, prompt, model, rate)
async function callGemini(prompt, imageData)
async function callGeminiJSON(prompt)

// Parsing
function parseJSONFromResponse(response)
function extractStructuredText(items, viewport)
function formatPartText(text)
```

---

## External Dependencies

### CDN Resources

| Library | Version | URL | Purpose |
|---------|---------|-----|---------|
| PDF.js | 3.11.174 | cdnjs | PDF parsing |
| PDF.js Worker | 3.11.174 | cdnjs | Background processing |
| Font Awesome | 6.4.0 | cdnjs | Icons |
| Marked.js | 9.1.2 | cdnjs | Markdown rendering |
| Google Fonts | - | fonts.googleapis.com | Outfit font |

### External APIs

#### ScaleDown API
- **Base URL**: `https://api.scaledown.xyz`
- **Endpoint**: `/compress/raw/`
- **Authentication**: API key in `x-api-key` header
- **Rate Limits**: Per API plan

#### Gemini API
- **Base URL**: `https://generativelanguage.googleapis.com`
- **Endpoints**:
  - `/v1beta/models` - List models
  - `/v1beta/models/{model}:generateContent` - Generate content
- **Authentication**: API key in query parameter
- **Rate Limits**: Per Google Cloud quotas

---

## Security Considerations

### API Key Storage

- Keys stored in localStorage (client-side only)
- Never sent to third-party servers
- User responsible for key security
- Consider using environment variables in production

### Data Privacy

- All PDF processing happens client-side
- Manual content sent to APIs for processing
- No server-side storage
- User data stays in browser

### Content Security

- User-generated content escaped with `escapeHtml()`
- Markdown rendered with Marked.js (sanitized)
- No `eval()` or `innerHTML` with raw user input
- Cross-origin requests only to trusted APIs

### Recommendations

1. **API Keys**: Use restricted API keys with domain limits
2. **Storage**: Clear localStorage when switching users
3. **Network**: Use HTTPS for all API calls (default)
4. **Updates**: Keep dependencies updated for security patches

---

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Panels load content on demand
2. **Image Compression**: Thumbnails at 0.5x scale, JPEG 80%
3. **Debounced Search**: Filter inputs debounced
4. **Virtual Scrolling**: Consider for large libraries
5. **Worker Thread**: PDF.js uses web worker

### Memory Management

- Large manuals stored in localStorage (limit: ~5-10MB)
- Images as base64 in memory
- Clear old data with library delete function
- Consider IndexedDB for larger storage needs

### Bundle Size

Current implementation uses CDN resources:
- No build step required
- Trade-off: Network dependent
- Consider bundling for offline use

---

## Future Architecture Considerations

### Potential Improvements

1. **Service Worker**: Offline capability
2. **IndexedDB**: Larger storage for manuals
3. **Web Workers**: Background processing
4. **Module System**: ES modules for code splitting
5. **Build Process**: Bundling and minification
6. **Testing**: Unit and integration tests
7. **TypeScript**: Type safety
8. **PWA**: Installable app experience

### Scalability

Current architecture supports:
- Multiple manuals (limited by localStorage)
- Single user (no multi-user)
- Browser-based (no server)

For enterprise use, consider:
- Backend service for storage
- User authentication
- Shared libraries
- Analytics service