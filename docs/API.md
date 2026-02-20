# API Reference

Documentation for the external APIs and internal functions used in Product Manual Assistant.

## ScaleDown API

Used to compress manual text while keeping the important stuff — specs, warnings, procedures.

### Endpoint

```
POST https://api.scaledown.xyz/compress/raw/
```

### Authentication

Include your API key in the request header:

```
x-api-key: your-api-key-here
```

### Request Format

```json
{
    "context": "string",
    "prompt": "string",
    "model": "string",
    "scaledown": {
        "rate": number
    }
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `context` | string | Yes | The text content to compress |
| `prompt` | string | Yes | Instructions for compression |
| `model` | string | No | Model to use (default: "gpt-4o") |
| `scaledown.rate` | number | No | Compression rate 0.0-1.0 (default: 0.4) |

### Response Format

```json
{
    "results": {
        "compressed_prompt": "string"
    }
}
```

### Example Usage

```javascript
async function callScaleDown(context, prompt, model = "gpt-4o", rate = 0.4) {
    const response = await fetch("https://api.scaledown.xyz/compress/raw/", {
        method: "POST",
        headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            context: context,
            prompt: prompt,
            model: model,
            scaledown: { rate: rate }
        })
    });
    
    const data = await response.json();
    return data.results.compressed_prompt;
}
```

### Error Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 401 | Invalid API key |
| 403 | Forbidden - key inactive |
| 429 | Rate limit exceeded |
| 500 | Server error |

---

## Gemini API

Google's Gemini API is used for knowledge extraction, categorization, and chat responses.

### Base URL

```
https://generativelanguage.googleapis.com/v1beta
```

### Authentication

Include your API key as a query parameter:

```
?key=your-api-key-here
```

### Endpoints

#### List Available Models

```
GET /models?key={API_KEY}
```

**Response:**
```json
{
    "models": [
        {
            "name": "models/gemini-2.0-flash",
            "displayName": "Gemini 2.0 Flash",
            "supportedGenerationMethods": ["generateContent"]
        }
    ]
}
```

#### Generate Content

```
POST /models/{model}:generateContent?key={API_KEY}
```

**Request Body:**
```json
{
    "contents": [
        {
            "parts": [
                { "text": "Your prompt here" },
                {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": "base64-encoded-image"
                    }
                }
            ]
        }
    ],
    "generationConfig": {
        "responseMimeType": "application/json"
    }
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `contents` | array | Yes | Array of content objects |
| `contents[].parts` | array | Yes | Array of part objects |
| `parts[].text` | string | No | Text prompt |
| `parts[].inline_data` | object | No | Image data |
| `inline_data.mime_type` | string | Yes* | MIME type of image |
| `inline_data.data` | string | Yes* | Base64-encoded image |
| `generationConfig` | object | No | Generation settings |
| `generationConfig.responseMimeType` | string | No | Force JSON output |

### Response Format

```json
{
    "candidates": [
        {
            "content": {
                "parts": [
                    {
                        "text": "Generated response text"
                    }
                ]
            }
        }
    ]
}
```

### Example: Text Generation

```javascript
async function callGemini(prompt, imageData = null) {
    const parts = [{ text: prompt }];
    
    if (imageData) {
        parts.push({
            inline_data: {
                mime_type: imageData.mimeType,
                data: imageData.base64
            }
        });
    }
    
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: parts }]
            })
        }
    );
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}
```

### Example: JSON Generation

```javascript
async function callGeminiJSON(prompt) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        }
    );
    
    const data = await response.json();
    return JSON.parse(data.candidates[0].content.parts[0].text);
}
```

### Supported Models

| Model | Best For | Speed |
|-------|----------|-------|
| `gemini-2.0-flash` | General use | Fast |
| `gemini-1.5-pro` | Complex tasks | Slow |
| `gemini-1.5-flash` | Balanced | Medium |
| `gemma-*` | Lightweight | Fast |

### Error Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 400 | Invalid request |
| 401 | Invalid API key |
| 403 | API not enabled |
| 429 | Quota exceeded |
| 500 | Server error |

---

## Internal Functions

### PDF Processing

#### `handlePDF(file)`

Processes an uploaded PDF file.

```javascript
/**
 * Process a PDF file and extract content
 * @param {File} file - PDF file from input/drop
 * @returns {Promise<void>}
 */
async function handlePDF(file)
```

#### `extractStructuredText(items, viewport)`

Extracts text from PDF.js text content items.

```javascript
/**
 * Extract structured text from PDF page
 * @param {Array} items - PDF.js text content items
 * @param {Object} viewport - PDF.js viewport object
 * @returns {string} Extracted text with preserved structure
 */
function extractStructuredText(items, viewport)
```

#### `extractTextFromPageImage(pdfPage, viewport)`

OCR fallback using Gemini Vision.

```javascript
/**
 * Extract text from page image using AI vision
 * @param {PDFPageProxy} pdfPage - PDF.js page object
 * @param {Object} viewport - PDF.js viewport
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromPageImage(pdfPage, viewport)
```

### Knowledge Extraction

#### `extractKnowledge(pages)`

Main knowledge extraction pipeline.

```javascript
/**
 * Extract and categorize knowledge from PDF pages
 * @param {Array} pages - Array of page objects with text
 * @returns {Promise<void>}
 */
async function extractKnowledge(pages)
```

#### `processStructuredKnowledge(data)`

Normalizes extracted knowledge data.

```javascript
/**
 * Process raw knowledge JSON into normalized buckets
 * @param {Object} data - Raw categorized data from Gemini
 */
function processStructuredKnowledge(data)
```

### Chat System

#### `handleChat()`

Main chat handler.

```javascript
/**
 * Process user chat message and generate response
 * @returns {Promise<void>}
 */
async function handleChat()
```

#### `addMessage(text, type, imagePreview)`

Adds a message to chat display.

```javascript
/**
 * Add message to chat container
 * @param {string} text - Message content
 * @param {string} type - "user" or "bot"
 * @param {string|null} imagePreview - Optional image preview URL
 * @returns {string} Message element ID
 */
function addMessage(text, type, imagePreview = null)
```

#### `updateMessage(id, html)`

Updates existing message content.

```javascript
/**
 * Update message content by ID
 * @param {string} id - Message element ID
 * @param {string} html - New HTML content
 */
function updateMessage(id, html)
```

### Annotation Tools

#### `selectAnnotationTool(tool)`

Sets the active annotation tool.

```javascript
/**
 * Select annotation drawing tool
 * @param {string} tool - Tool name: select|rect|circle|arrow|marker|text
 */
function selectAnnotationTool(tool)
```

#### `loadPageForAnnotation(pageNum)`

Loads a page into the annotation canvas.

```javascript
/**
 * Load PDF page into annotation workspace
 * @param {number} pageNum - Page number to load
 */
function loadPageForAnnotation(pageNum)
```

#### `saveAnnotation(pageNum, annotation)`

Persists an annotation.

```javascript
/**
 * Save annotation to state and localStorage
 * @param {number} pageNum - Page number
 * @param {Object} annotation - Annotation data object
 */
function saveAnnotation(pageNum, annotation)
```

#### `getAnnotatedPageImage()`

Exports annotated page as image data.

```javascript
/**
 * Generate combined image of page + annotations
 * @returns {Object|null} {base64, mimeType, preview} or null
 */
function getAnnotatedPageImage()
```

### UI Helpers

#### `showToast(message, type)`

Displays a toast notification.

```javascript
/**
 * Show toast notification
 * @param {string} message - Notification text
 * @param {string} type - success|error|info|warning
 */
function showToast(message, type = "info")
```

#### `openModal(id)` / `closeModal(id)`

Modal visibility control.

```javascript
/**
 * Open modal by ID
 * @param {string} id - Modal element ID
 */
function openModal(id)

/**
 * Close modal by ID
 * @param {string} id - Modal element ID
 */
function closeModal(id)
```

#### `openSlidePanel(panelId)` / `closeSlidePanel(panelId)`

Slide panel control.

```javascript
/**
 * Open slide-over panel
 * @param {string} panelId - Panel identifier (visuals|knowledge|troubleshoot|annotate)
 */
function openSlidePanel(panelId)

/**
 * Close slide-over panel
 * @param {string} panelId - Panel identifier
 */
function closeSlidePanel(panelId)
```

### Utility Functions

#### `parseJSONFromResponse(response)`

Safely parses JSON from AI response.

```javascript
/**
 * Parse JSON from LLM response, handling various formats
 * @param {string} response - Raw response text
 * @returns {Object} Parsed JSON object
 * @throws {Error} If parsing fails
 */
function parseJSONFromResponse(response)
```

#### `formatPartText(text)`

Formats parts/specs text for display.

```javascript
/**
 * Format raw part/spec text into styled HTML
 * @param {string} text - Raw text content
 * @returns {string} Formatted HTML string
 */
function formatPartText(text)
```

#### `escapeHtml(text)`

Escapes HTML special characters.

```javascript
/**
 * Escape HTML to prevent XSS
 * @param {string} text - Raw text
 * @returns {string} Escaped text safe for innerHTML
 */
function escapeHtml(text)
```

#### `downloadFile(content, filename, type)`

Triggers file download.

```javascript
/**
 * Download content as file
 * @param {string} content - File content
 * @param {string} filename - Download filename
 * @param {string} type - MIME type
 */
function downloadFile(content, filename, type)
```

---

## Event Handlers

### File Events

| Event | Element | Handler |
|-------|---------|---------|
| `click` | `#drop-zone` | Triggers file input |
| `dragover` | `#drop-zone` | Adds dragover class |
| `dragleave` | `#drop-zone` | Removes dragover class |
| `drop` | `#drop-zone` | Handles dropped file |
| `change` | `#pdf-upload` | Handles selected file |

### Chat Events

| Event | Element | Handler |
|-------|---------|---------|
| `click` | `#send-btn` | `handleChat()` |
| `keypress` | `#user-query` | Enter triggers send |
| `paste` | `document` | `handlePasteImage()` |
| `change` | `#chat-image-input` | `handleChatImageSelect()` |

### Navigation Events

| Event | Element | Handler |
|-------|---------|---------|
| `click` | `.nav-item` | `openSlidePanel()` |
| `click` | `.panel-close` | `closeSlidePanel()` |
| `click` | `.quick-chip` | `handleQuickAction()` |
| `click` | `.modal-overlay` | Close if backdrop clicked |
| `keydown` | `document` | Escape closes modals |

### Configuration Events

| Event | Element | Handler |
|-------|---------|---------|
| `click` | `#config-btn` | Opens config modal |
| `click` | `#save-keys` | `saveConfiguration()` |
| `click` | `#theme-toggle` | Toggles theme |
| `click` | `#refresh-models-btn` | `fetchGeminiModels()` |

---

## Data Structures

### Page Object

```javascript
{
    pageNum: 1,              // Page number (1-indexed)
    text: "Page content...", // Extracted text
    imageSrc: "data:...",    // Base64 thumbnail
    links: ["https://..."]   // Extracted URLs
}
```

### Knowledge Item

```javascript
{
    page: 1,                 // Source page number
    text: "Extracted info"   // Relevant content
}
```

### Manual Entry

```javascript
{
    id: "1704067200000",     // Timestamp ID
    name: "Manual.pdf",      // Original filename
    pageCount: 50,           // Total pages
    dateAdded: "2024-01-01", // ISO date string
    pages: [...]             // Array of page objects
}
```

### Annotation Object

```javascript
// Shape annotation (rect, circle, arrow)
{
    id: 1704067200000,       // Timestamp ID
    type: "rect",            // rect|circle|arrow
    x1: 100, y1: 100,        // Start coordinates
    x2: 200, y2: 200,        // End coordinates
    color: "#ff4d4f"         // Stroke color
}

// Marker annotation
{
    id: 1704067200001,
    type: "marker",
    x: 150, y: 150,          // Position
    label: "Part A",         // Marker label
    color: "#1890ff"
}

// Text annotation
{
    id: 1704067200002,
    type: "text",
    x: 100, y: 100,          // Position
    text: "Note here",       // Annotation text
    color: "#52c41a"
}
```

### Metrics Object

```javascript
{
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
            description: "Asked about..."
        }
    ],
    surveys: [...]
}
```

### Image Data Object

```javascript
{
    base64: "...",           // Base64-encoded image
    mimeType: "image/jpeg",  // MIME type
    preview: "data:..."      // Full data URL for display
}
```

---

## Category Definitions

Knowledge is categorized using these definitions:

```javascript
const CATEGORIES = {
    safety: {
        label: "Safety",
        icon: "fa-solid fa-triangle-exclamation",
        color: "#ff4d4f",
        sdPrompt: "Extract safety warnings, cautions, hazards..."
    },
    parts: {
        label: "Parts & Specs",
        icon: "fa-solid fa-gear",
        color: "#1890ff",
        sdPrompt: "Extract component names, model numbers..."
    },
    warranty: {
        label: "Warranty",
        icon: "fa-solid fa-certificate",
        color: "#52c41a",
        sdPrompt: "Extract warranty duration, coverage terms..."
    },
    procedures: {
        label: "Procedures",
        icon: "fa-solid fa-list-check",
        color: "#fa8c16",
        sdPrompt: "Extract step-by-step instructions..."
    },
    errors: {
        label: "Errors & Diagnostics",
        icon: "fa-solid fa-circle-exclamation",
        color: "#eb2f96",
        sdPrompt: "Extract error codes, troubleshooting tables..."
    },
    video: {
        label: "Links & Tutorials",
        icon: "fa-solid fa-play-circle",
        color: "#722ed1",
        sdPrompt: "Extract URLs, QR codes, video references..."
    }
};
```

---

## Error Handling

### API Error Handling Pattern

```javascript
try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            return "Invalid API Key";
        }
        throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    return processData(data);
    
} catch (error) {
    console.error("API Call Failed:", error);
    showToast("Request failed: " + error.message, "error");
    return fallbackValue;
}
```

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Please configure API Keys" | Missing keys | Add keys in Configuration |
| "Invalid ScaleDown Key" | Wrong/expired key | Check ScaleDown dashboard |
| "Gemini API Error" | API issue | Check key/quota |
| "No valid JSON object found" | Parse failure | Model output issue |
| "Invalid API response structure" | Unexpected format | Try different model |