# Product Manual Assistant — User Guide

A practical guide to using the Product Manual Assistant.

## What This App Does

Upload a PDF manual, and the app will:

1. Extract all the text from each page
2. Compress it using ScaleDown (keeps the important stuff)
3. Run it through Gemini to categorize everything
4. Let you search, browse, and ask questions about it

Everything runs in your browser. No server, no account needed.

## Setting Up

### API Keys

You need two API keys:

**ScaleDown** — Handles text compression
- Go to [scaledown.ai](https://scaledown.ai)
- Sign up and grab your API key

**Gemini** — Powers the AI features
- Go to [Google AI Studio](https://aistudio.google.com)
- Create a project and generate an API key

Once you have both, click the gear icon in the app header and paste them in. They're stored locally in your browser.

### Picking a Model

The app will fetch available Gemini models automatically. `gemini-2.0-flash` is a good default — fast and capable. If you need more horsepower for complex manuals, try `gemini-1.5-pro`.

## Uploading a Manual

Click the book icon in the header to open the library. Drag a PDF in or click to browse.

The app will:
- Extract text from each page
- Generate thumbnails
- Run OCR on pages that don't have extractable text
- Compress and categorize everything

This takes a minute or two depending on the PDF size.

## Finding Information

### Quick Actions

The chips below the chat input are shortcuts:

- **Safety** — Shows all warnings and hazards
- **Warranty** — Shows coverage and claim info
- **Diagnose** — Opens the troubleshooting panel
- **Parts** — Shows components and specifications

### Chat

Just ask questions in plain English:

- "What's the warranty period?"
- "How do I replace the battery?"
- "What does error E-04 mean?"

The AI pulls relevant context from the manual and answers with page references.

### Attaching Images

Click the + button next to the chat input to:

- Upload an image from your computer
- Insert a page from the PDF
- Insert an annotated page you've marked up

You can also paste images directly with Ctrl+V (or Cmd+V on Mac).

### Knowledge Panel

Click "Knowledge" in the sidebar to browse everything the AI extracted, organized by category. Click any card to jump to that page.

### Page Gallery

Click "Visuals" in the sidebar to see thumbnails of every page. Use the search box to filter by text content.

## Troubleshooting Panel

Click "Troubleshoot" in the sidebar. Pick an issue category (power, display, audio, etc.) and the app generates a diagnostic workflow based on the manual content.

There's also an error code lookup — type in a code like "E-04" and get an explanation.

## Annotations

Click "Annotate" in the sidebar to mark up pages.

Tools available:
- **Rectangle** — Draw boxes around things
- **Circle** — Highlight circular areas
- **Arrow** — Point at stuff
- **Marker** — Drop a labeled pin
- **Text** — Add text notes

Pick a color, select a page, and start drawing. Annotations are saved automatically.

You can export the annotated image or send it to chat for analysis.

## Multi-Manual Library

The app saves manuals locally. Click the book icon to see your library, load a previous manual, or delete ones you don't need.

### Cross-Manual Search

Click "Search All" in the header to search across all your stored manuals at once.

## Metrics

Click "Metrics" in the header to see usage stats:

- How many queries you've run
- Which categories get used most
- Satisfaction ratings (from the feedback form)
- Recent activity

You can export this data as CSV or JSON.

## Theme

Click the sun/moon icon in the header to toggle between light and dark mode.

## Storage Limits

The app uses localStorage, which typically has a 5-10MB limit. Large manuals might bump up against this. If you're running low on space, delete old manuals from the library.

## Common Issues

**"Please configure API Keys"**
Open settings (gear icon) and add your keys.

**PDF won't process**
Make sure it's a valid PDF. Password-protected or corrupted files won't work.

**Knowledge extraction is empty**
The PDF might be image-based with no extractable text. The OCR fallback helps but isn't perfect for all layouts.

**Chat not responding**
Check your network connection and API key validity. Also check the browser console for errors.

## More Documentation

- [Architecture](ARCHITECTURE.md) — How the app is built
- [API Reference](API.md) — Internal functions and external APIs
- [Contributing](CONTRIBUTING.md) — How to contribute